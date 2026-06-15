# Bootstrap runbook — one-time AWS account setup for GigBuddy

This runbook is **one-time**. Routine deploys land in Story 1.6 via GitHub Actions
through the OIDC `gigbuddy-deploy-role`. After 1.6 ships, do not run `cdk deploy`
from a developer machine unless this is an emergency break-glass — and even then,
walk through this document end-to-end first.

Cross-references:

- Recovery: `infra/runbooks/restore-pitr.md` (created in Story 5.2 — the ship gate)
- Architecture contract: `_bmad-output/planning-artifacts/architecture.md`

## 0. Prerequisites

- AWS account with billing email set up
- AWS CLI v2 configured with an admin profile (AWS SSO or a temporary admin IAM user — see below)
- Node 22 and pnpm 11 installed locally
- A Route 53 hosted zone for `cormie.com` already exists in the target AWS account
  (this runbook does NOT create or modify the apex zone)
- A GitHub repository at `<owner>/gigbuddy` (the OIDC trust constraint is keyed on this)

### 0a. Create the bootstrap IAM user (break-glass admin)

If you do not already have admin AWS credentials configured, create a temporary bootstrap
user. After Story 1.6 ships, GitHub Actions takes over all deploys via the OIDC
`gigbuddy-deploy-role`; this user is only needed for the initial bootstrap and
emergency break-glass.

```
# Create the user
aws iam create-user --user-name gigbuddy-bootstrap

# Attach AdministratorAccess (required for CDK bootstrap + first deploy)
aws iam attach-user-policy \
  --user-name gigbuddy-bootstrap \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# Create access keys — note the output; you will not see it again
aws iam create-access-key --user-name gigbuddy-bootstrap
```

Add the output key to `~/.aws/credentials`:

```
[gigbuddy-admin]
aws_access_key_id     = <AccessKeyId from above>
aws_secret_access_key = <SecretAccessKey from above>
```

Set `AWS_PROFILE=gigbuddy-admin` before running commands in the following sections.

**After Story 1.6 ships:** disable or delete this user's access keys — OIDC takes over
and the bootstrap user should not remain active.

## 1. Configure local CDK context (gitignored)

Edit `infra/cdk.context.json` (already in your local checkout, gitignored)
and replace each `<fill-me-in>` placeholder with the real value:

```json
{
  "hostedZoneId": "Z0123456789ABCDEFGHIJ",
  "githubOwner": "sandycormie",
  "budgetEmail": "sandy@example.com"
}
```

The subdomain (`gig.cormie.com`) and apex zone name (`cormie.com`) are hardcoded
literals in `infra/bin/gigbuddy.ts` — these are public DNS values, fine to commit.

## 2. CDK bootstrap both regions

CloudFront's ACM certificate and the CloudFront-scoped WAF web ACL must live
in `us-east-1`. Everything else lives in `eu-west-2`. Bootstrap both:

```
export AWS_PROFILE=gigbuddy-admin    # or use AWS SSO
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=eu-west-2

pnpm -F infra exec cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/eu-west-2
pnpm -F infra exec cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/us-east-1
```

## 3. Seed SSM parameters (one-time, manual)

CDK does not create SSM SecureString parameters because CloudFormation would
require the secret value at synth time, which would leak it into CDK output.
Create them with the AWS CLI before the first deploy:

```
# JWT signing key — 32 random bytes, base64-encoded
aws ssm put-parameter \
  --name /gigbuddy/jwt-key \
  --type SecureString \
  --value "$(openssl rand -base64 32)" \
  --region eu-west-2

# Sandy generates a >=20-char random password, then hashes it with argon2id.
#
# Option A (Node one-liner — requires `argon2` package installed locally):
#   node -e "import('argon2').then(a => a.hash('<password>').then(console.log))"
#
# Option B (argon2-cli — see https://github.com/P-H-C/phc-winner-argon2):
#   echo -n '<password>' | argon2 saltsalt -id -t 3 -m 16 -p 4

aws ssm put-parameter \
  --name /gigbuddy/password-hash \
  --type SecureString \
  --value '<argon2id-hash-output>' \
  --region eu-west-2
```

## 4. First deploy

Order matters for cross-stack references:

```
pnpm -F infra exec cdk deploy GigbuddyData
pnpm -F infra exec cdk deploy GigbuddyApi
pnpm -F infra exec cdk deploy GigbuddyCi
pnpm -F infra exec cdk deploy GigbuddyWebCert     # us-east-1 cert + WAF
pnpm -F infra exec cdk deploy GigbuddyWeb         # eu-west-2 distribution
pnpm -F infra exec cdk deploy GigbuddyObservability
```

Or in one shot (⚠️ skips IAM/security-group change-set review — use the step-by-step
order above for the first deploy so you can inspect IAM changes before confirming):

```
pnpm -F infra exec cdk deploy --all --require-approval=never
```

`data`, `api`, `web`, `observability`, and `ci` are independent enough that
CDK will pick a valid order automatically. The cert + web split is what
forces the us-east-1 dependency.

> **Function URL window during bootstrap.** Between the `GigbuddyApi` and
> `GigbuddyWeb` deploys, the Lambda Function URL is reachable directly (the
> `SourceArn` lock is added by `GigbuddyWeb`). The window is short (a few
> minutes) and pre-dates any secret material in the Lambda — Story 1.4 wires
> SSM secrets. First-time bootstrap: accept the window. Rebuild after Story 1.4
> has shipped: deploy `GigbuddyWeb` immediately after `GigbuddyApi` to minimise
> the window.

## 5. First placeholder SPA upload

The CDK web-stack creates an empty S3 bucket. Upload a placeholder SPA so the
distribution serves something on first visit:

```
pnpm build:web

# Read the bucket name from the GigbuddyWeb stack outputs
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name GigbuddyWeb \
  --query "Stacks[0].Outputs[?OutputKey=='SpaBucketName'].OutputValue" \
  --output text \
  --region eu-west-2)

DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name GigbuddyWeb \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text \
  --region eu-west-2)

aws s3 sync web/dist/ s3://$BUCKET/ --delete
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths '/*'
```

## 6. Smoke tests

```
# SPA reachable
curl -I https://gig.cormie.com/
# expect: HTTP/2 200, cache-control consistent with CachingOptimized

# API health endpoint — verify request reaches Lambda (not a cached response)
curl -i https://gig.cormie.com/api/v1/health
# expect: HTTP/2 200, body {"status":"ok"}
#         header x-cache: Miss from cloudfront  (proves request reached Lambda)

# Function URL lock proof — direct hit to the Lambda Function URL hostname
# (substitute the real Function URL hostname from the GigbuddyApi stack outputs)
FURL=$(aws cloudformation describe-stacks \
  --stack-name GigbuddyApi \
  --query "Stacks[0].Outputs[?OutputKey=='LambdaFunctionUrlDomain'].OutputValue" \
  --output text \
  --region eu-west-2)

curl -i https://$FURL/api/v1/health
# expect: HTTP/2 403 — proves the Lambda::Permission lock in web-stack is active
```

## 7. OIDC hand-off

Once `GigbuddyCi` is deployed, GitHub Actions takes over deploys via the
`gigbuddy-deploy-role` role. The admin profile (or SSO session) used for this
bootstrap is now only for:

- CDK bootstrap (already done above)
- Emergency break-glass (rare; document the action in a follow-up incident note)

1. Capture the deploy role ARN:

   ```
   aws cloudformation describe-stacks \
     --stack-name GigbuddyCi \
     --query "Stacks[0].Outputs[?OutputKey=='DeployRoleArn'].OutputValue" \
     --output text \
     --region eu-west-2
   ```

2. In the GitHub repo, navigate to `Settings → Secrets and variables → Actions
   → Variables` and create a **repository variable** named exactly
   `AWS_DEPLOY_ROLE_ARN` (case-sensitive — the workflows reference
   `vars.AWS_DEPLOY_ROLE_ARN`) with the ARN from step 1 as its value.

   Use a variable, not a secret: ARNs are not sensitive, and a variable's value
   appears in workflow logs (visible only to repo collaborators), which aids
   diagnosis. Secrets are masked.

3. Navigate to `Settings → Branches → Branch protection rules` and add a rule
   for `main`:

   - Branch name pattern: `main`
   - Require a pull request before merging: enabled, `Required approvals = 0`
     (Sandy is the sole reviewer)
   - Require status checks to pass before merging: enabled; the required check
     is `lint + typecheck + test` (the value of `jobs.verify.name` in
     `.github/workflows/ci.yml` — GitHub branch protection keys on the job's
     display name, not the workflow name `ci` or the job key `verify`; the
     check name autocompletes once `ci.yml` has run at least once on `main`).
   - Save the rule.

4. Verify by opening a draft PR with a one-character README change. The PR's
   "Checks" tab shows `lint + typecheck + test` as required, and the merge
   button is disabled until it passes.

The deploy and deploy-force workflows reference `vars.AWS_DEPLOY_ROLE_ARN`.
If the variable name does not match exactly, both workflows fail at the
credential-configuration step.

## 8. Verify the access gate (after Story 1.4 ships)

Once the new code is deployed, run these smoke checks against `gig.cormie.com`:

```
# Unauthenticated read of a protected route → 401 envelope
curl -i https://gig.cormie.com/api/v1/me
# expect: HTTP/2 401, body {"status":"error","error":{"code":"UNAUTHORIZED",...}}
#         no Set-Cookie header

# Login with the wrong password → 401, no cookie
curl -i -X POST https://gig.cormie.com/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"password":"obviously-wrong"}'
# expect: HTTP/2 401, body {"status":"error","error":{"code":"INVALID_CREDENTIALS",...}}

# Login with the right password → 200, Set-Cookie present
curl -i -X POST https://gig.cormie.com/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d "{\"password\":\"$REAL_PASSWORD\"}" \
  -c /tmp/gigbuddy-cookie.txt
# expect: HTTP/2 200, body {"status":"applied"}
#         Set-Cookie: gigbuddy_session=...; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000; Path=/

# Use the cookie to read /me → 200
curl -i https://gig.cormie.com/api/v1/me -b /tmp/gigbuddy-cookie.txt
# expect: HTTP/2 200, body {"status":"ok","data":{"authenticated":true,"daysUntilExpiry":365}}

# Clean up the temp cookie file
rm /tmp/gigbuddy-cookie.txt
```

If any of these fail, check the CloudWatch log group `/aws/lambda/gigbuddy-api`
for a stack trace, and verify both SSM parameters exist with
`aws ssm get-parameters --names /gigbuddy/jwt-key /gigbuddy/password-hash --with-decryption --region eu-west-2 --query 'Parameters[].Name'`
(lists names only — never echo `Values` in shell history).

> Rotation runbooks (`rotate-jwt-key.md`, `rotate-password.md`) ship in
> Story 5.2 alongside the verified-restore drill. Until then, manual
> rotation is: write a new SSM SecureString value, redeploy
> `GigbuddyApi`, log back in. All prior sessions invalidate.

## 9. Emergency: deploy-force.yml

`.github/workflows/deploy-force.yml` bypasses the deploy-time blackout check.
Use it only when a gig is less than 24h away and a deploy MUST proceed
(security hotfix, customer-blocking outage). The default answer is "wait until
after the gig" — this workflow exists for the cases where waiting is not an
option.

Trigger via `Actions → deploy-force → Run workflow` with two inputs:

- `reason` — free text, required. One sentence on why the override is needed.
- `venueConfirmation` — must match the venue name of the nearest blocking Gig
  exactly (case-sensitive). Leave blank if no Gig blocks (the static
  weekend-evening fallback fired but no real Gig is scheduled).

To find the venue name: open the workflow run. The first job (`enumerate`)
logs each blocking Gig as one JSON object per line (`{"venue": "...",
"date": "...", "time": "..."}`). Copy the `venue` field of the **first** entry
verbatim into the `venueConfirmation` input on a re-run.

Audit trail:

- Run history: `Actions → Workflows → deploy-force`. Every triggered run
  appears here; the `reason` and `venueConfirmation` inputs are shown in the
  run's "Inputs" panel.
- `$GITHUB_STEP_SUMMARY` is captured per run (visible in the GitHub Actions UI
  for 90 days by default). Includes the `reason`, `venueConfirmation`, and the
  full list of blocking Gigs at deploy time — including runs where venue
  confirmation failed.
- CloudWatch Logs group `/gigbuddy/deploy-force` (eu-west-2) retains one JSON
  event per force-deploy run (including failed confirmation attempts),
  indefinitely. No retention policy is configured in V1 — accept the volume
  risk; a future story can wire a 365-day retention if needed.

Do NOT bypass the workflow by running `pnpm -F infra exec cdk deploy` locally
with the bootstrap-user credentials. The OIDC role is the only legitimate CI
deploy path post-bootstrap. The bootstrap-user is for `cdk bootstrap` and
emergency break-glass only.
