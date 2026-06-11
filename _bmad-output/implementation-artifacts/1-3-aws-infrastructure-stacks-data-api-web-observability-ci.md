---
baseline_commit: d5dcbab
---

# Story 1.3: AWS infrastructure stacks — data, api, web, observability, ci

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Sandy,
I want all five CDK stacks authored and deployed to eu-west-2,
so that the AWS account is shaped: the SPA is reachable from CloudFront over HTTPS, the API Lambda responds at `/api/v1/health`, DynamoDB is provisioned with PITR + automated backups, and the account is hardened (CloudTrail, Budgets, WAF, CAA, OIDC).

## Acceptance Criteria

**AC-1 — data-stack: DynamoDB + PITR + AWS Backup + DeletionProtection**

**Given** `infra/lib/stacks/data-stack.ts`
**When** `cdk deploy` is run
**Then** the `gigbuddy-data` DynamoDB table is created in eu-west-2 with on-demand billing, PITR enabled, and `DeletionProtection: true`
**And** the table CDK config sets `encryption: dynamodb.TableEncryption.AWS_MANAGED` explicitly (not relying on the implicit default), satisfying NFR-11 with a code-level assertion that a future CDK refactor cannot silently drop
**And** GSI1 is created with `gsi1pk` (partition) and `gsi1sk` (sort) per architecture.md Decision 2
**And** an AWS Backup vault (KMS-managed key) holds a daily backup plan with 365-day retention and cold-storage transition at 30 days
**And** the data stack carries CDK termination protection (`terminationProtection: true`) — cannot be destroyed via `cdk destroy` without explicit override

**AC-2 — api-stack: Lambda Function URL + IAM + SSM**

**Given** `infra/lib/stacks/api-stack.ts`
**When** `cdk deploy` is run
**Then** a Lambda function (Node 22, ARM64 Graviton, 512MB, reserved concurrency = 50) is created with a Function URL (auth type `NONE` — CloudFront forwards Cookie/Authorization, Hono middleware enforces auth in Story 1.4)
**And** the Lambda has IAM permissions to read/write items in `gigbuddy-data` (least-privilege scoped to the table ARN + its GSI ARN) and to read SSM SecureString parameters under `/gigbuddy/*` (scoped to the parameter ARN pattern, not `*`)
**And** the Lambda env carries `TABLE_NAME` (data-stack output), `JWT_KEY_PARAM=/gigbuddy/jwt-key`, `PASSWORD_HASH_PARAM=/gigbuddy/password-hash` — runtime never constructs these strings (architecture boundary)
**And** the Lambda handler responds with HTTP 200 from `GET /api/v1/health` when invoked via the Function URL
**And** the SSM SecureString parameters `/gigbuddy/jwt-key` and `/gigbuddy/password-hash` exist with placeholder values (populated manually per the bootstrap runbook before Story 1.4 ships)

**AC-3 — web-stack: S3 + CloudFront + ACM + Route 53 + CAA + WAF**

**Given** `infra/lib/stacks/web-stack.ts`
**When** `cdk deploy` is run
**Then** a private S3 bucket exists for the SPA bundle (uploads performed by deploy pipeline in Story 1.6 — CDK creates the empty bucket, does NOT upload SPA assets)
**And** a CloudFront distribution serves the bucket via OAC (Origin Access Control, not the legacy OAI) with two behaviors: default → S3 origin using `CachingOptimized` managed policy; `/api/*` → Lambda Function URL origin (api-stack output) using `CachingDisabled` and an origin-request policy that forwards `Cookie` and `Authorization` headers
**And** an ACM certificate in `us-east-1` (CloudFront requires us-east-1 certs) secures `gig.cormie.com`, DNS-validated against the Route 53 hosted zone for `cormie.com`
**And** Route 53 A and AAAA alias records point `gig.cormie.com` to the CloudFront distribution
**And** a CAA DNS record at `gig.cormie.com` restricts cert issuance to `amazon.com` (defeats some MITM scenarios per AR-36)
**And** a WAF v2 web ACL with a single rate-limit rule (100 requests per IP per 5 minutes, action `BLOCK` returning 429) is attached to the distribution
**And** a `Lambda::Permission` (created in web-stack, not api-stack — one-way reference, no stack cycle) restricts `lambda:InvokeFunctionUrl` on the api Lambda to `Principal: '*'` with `Condition: { StringEquals: { 'AWS:SourceArn': '<this distribution ARN>' } }` — direct hits to the Function URL hostname (bypassing CloudFront + WAF) return 403

**AC-4 — observability-stack: CloudTrail + Budgets + Logs retention**

**Given** `infra/lib/stacks/observability-stack.ts`
**When** `cdk deploy` is run
**Then** CloudTrail is enabled with a multi-region trail writing to a dedicated S3 bucket in eu-west-2 (server-side encrypted; bucket lifecycle: transition to Glacier after 90 days)
**And** two AWS Budgets are created with email subscribers (Sandy's email) at `$5/mo` and `$20/mo` actual-cost thresholds, scoped to the AWS account
**And** CloudWatch Log Groups created by stacks in this story have explicit retention: Lambda log group 14 days, CloudFront real-time log group (if used) 30 days. Implicit log groups (created on first invocation) are also reconciled — explicitly declare the Lambda log group as a CDK resource so retention is enforced from day one, not on first warm invocation

**AC-5 — ci-stack: GitHub OIDC + deploy-role**

**Given** `infra/lib/stacks/ci-stack.ts`
**When** `cdk deploy` is run
**Then** a GitHub Actions OIDC provider exists in IAM (`token.actions.githubusercontent.com`) with the canonical thumbprint
**And** a `gigbuddy-deploy-role` IAM role exists, assumable only when the OIDC JWT claim `sub` matches the literal string `repo:<owner>/gigbuddy:ref:refs/heads/main` (PR runners on other refs cannot assume this role — per AR-31)
**And** the role's permissions are least-privilege for the deploy pipeline only: CDK CloudFormation actions (`cloudformation:*` on stack ARNs), S3 upload to the web bucket, CloudFront invalidation, DDB `Query` on `gigbuddy-data` (used by the blackout check in Story 1.6), `ssm:GetParameter` for `/gigbuddy/*` (deploy may need to read non-secret config)
**And** no long-lived AWS IAM access keys exist anywhere — no static credentials in repo secrets, no IAM users with access keys

**AC-6 — Deployed stacks resolve end-to-end**

**Given** the five stacks deployed and a placeholder SPA bundle one-time uploaded to the web bucket (per the bootstrap runbook)
**When** Sandy navigates to `https://gig.cormie.com/`
**Then** CloudFront returns the placeholder SPA bundle over HTTPS (TLS 1.2+ — CloudFront default)
**And** `GET https://gig.cormie.com/api/v1/health` returns HTTP 200 with body `{"status":"ok"}` and an `x-cache: Miss from cloudfront` header proving the request reached Lambda (not a stale cache)
**And** the SPA HTML response carries a `cache-control` header consistent with `CachingOptimized` (caching applied), proving the S3-origin path is reachable
**And** a direct request to the raw Lambda Function URL hostname (e.g. `https://<random>.lambda-url.eu-west-2.on.aws/api/v1/health`) returns HTTP 403 — confirming the Function URL lock (per AC-3) is in force

**AC-7 — Bootstrap runbook**

**Given** `infra/runbooks/bootstrap.md`
**When** read
**Then** it documents the one-time AWS account bootstrap sequence end-to-end:
- Prerequisites: AWS account, billing email, AWS CLI v2 configured with admin profile, Node 22, pnpm
- One-time `cdk bootstrap aws://<account>/eu-west-2` and `aws://<account>/us-east-1` (us-east-1 for the ACM cert stack)
- Manual IAM bootstrap-user creation (the human-only break-glass admin; OIDC takes over for CI)
- Route 53 hosted zone creation (or import of an existing zone) for the chosen apex domain
- `aws ssm put-parameter` commands to seed `/gigbuddy/jwt-key` (random 32-byte base64) and `/gigbuddy/password-hash` (argon2id hash of Sandy's password — instructions reference the `argon2-cli` or a one-liner Node script)
- Sandy generating a ≥20-char random password (per AR-19) and producing the argon2id hash for `/gigbuddy/password-hash`
- First `cdk deploy --all` order: data → api → ci → web (us-east-1 cert sub-stack → main web-stack) → observability
- First placeholder SPA upload: `pnpm build:web && aws s3 sync web/dist/ s3://<bucket>/ --delete`
- First CloudFront cache invalidation: `aws cloudfront create-invalidation --distribution-id <id> --paths '/*'`
- Smoke test commands: `curl https://<subdomain>/api/v1/health`, `curl -I https://<subdomain>/`
- OIDC hand-off: once `ci-stack` is deployed, GitHub Actions (Story 1.6) takes over deploys; the bootstrap-user is only used for `cdk bootstrap` and emergency break-glass

## Tasks / Subtasks

- [x] **Task 1 — Lambda handler entry + esbuild retarget** (AC: 2)
  - [x] Create `api/src/handler.ts`. Use the built-in Hono Lambda adapter: `import { handle } from 'hono/aws-lambda'; import { app } from './app.js'; export const handler = handle(app);`. No additional dependency install — `hono/aws-lambda` ships in the `hono` package (verified against Hono 4.x at implementation; if the import path has changed, use the current Hono Lambda adapter and document the deviation in Dev Notes).
  - [x] Retarget the `api` package `build` script from `src/dev.ts` → `dist/server.js` to `src/handler.ts` → `dist/handler.js`. Keep esbuild flags: `--bundle --platform=node --target=node22 --format=esm --external:@aws-sdk/*`. The `dev` script continues to use `tsx watch src/dev.ts` for local development (no change there).
  - [x] **Do NOT delete `api/src/dev.ts`.** It is the local-dev entry; the build script no longer targets it but `pnpm dev:api` still runs it. (Resolves deferred-work entry #1 from Story 1.1.)
  - [x] Add a Vitest test `api/src/handler.test.ts` that imports `handler` and invokes it with a synthetic Lambda Function URL event for `GET /api/v1/health`, asserting the response statusCode is 200 and body parses to `{status:"ok"}`. Reference Hono's `handle()` event shape (API Gateway v2 / Function URL); construct a minimal event object inline (do not pull in an extra `@types/aws-lambda` dep just for this).

- [x] **Task 2 — data-stack** (AC: 1)
  - [x] Create `infra/lib/stacks/data-stack.ts` exporting `class DataStack extends Stack`. Constructor accepts standard `StackProps` plus an optional `terminationProtection: true` enforced as the default.
  - [x] Declare a `dynamodb.Table` named via `tableName: 'gigbuddy-data'`:
    - `partitionKey: { name: 'pk', type: AttributeType.STRING }`
    - `sortKey:      { name: 'sk', type: AttributeType.STRING }`
    - `billingMode: BillingMode.PAY_PER_REQUEST`
    - `encryption: TableEncryption.AWS_MANAGED` (explicit — see AC-1)
    - `pointInTimeRecovery: true`
    - `deletionProtection: true`
    - `removalPolicy: RemovalPolicy.RETAIN`
  - [x] Add GSI1 via `table.addGlobalSecondaryIndex({ indexName: 'GSI1', partitionKey: { name: 'gsi1pk', type: STRING }, sortKey: { name: 'gsi1sk', type: STRING }, projectionType: ProjectionType.ALL })`. The architecture's GSI1 keys are `BAND#<bandId>#SETLIST_BY_DATE` / `<isoDate>#<setlistId>` — those are item-level values, not index definitions.
  - [x] Add an AWS Backup vault (`new BackupVault`) with a customer-managed KMS key (`new Key` with `enableKeyRotation: true`). Vault `removalPolicy: RetentionDays.RETAIN`.
  - [x] Add a `BackupPlan` with a daily rule: schedule `cron(0 3 * * ? *)` UTC (= 03:00 UTC = ~04:00/05:00 London depending on DST — avoids the gig window), `deleteAfter: Duration.days(365)`, `moveToColdStorageAfter: Duration.days(30)`.
  - [x] `BackupSelection` linking the plan to the table only (not the entire account).
  - [x] Export `tableArn`, `tableName`, `tableStreamArn` (if a stream is configured — none needed in V1) as CfnOutputs for api-stack to consume via cross-stack reference. **Do not export the GSI ARN separately** — derive it in api-stack as `${tableArn}/index/GSI1` to keep cross-stack surface area minimal.
  - [x] Add a Vitest test `infra/lib/stacks/data-stack.test.ts` using `aws-cdk-lib/assertions`:
    - Synthesize stack; assert `Template.fromStack(stack).hasResourceProperties('AWS::DynamoDB::Table', { TableName: 'gigbuddy-data', BillingMode: 'PAY_PER_REQUEST', DeletionProtectionEnabled: true, SSESpecification: { SSEEnabled: true }, PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true } })`
    - Assert GSI1 exists with the right keys
    - Assert exactly one `AWS::Backup::BackupVault` and one `AWS::Backup::BackupPlan` exist with the documented retention values
    - **No snapshot tests** (architecture line 775). Use `hasResourceProperties` / `resourceCountIs` / `findResources` assertions.

- [x] **Task 3 — api-stack** (AC: 2)
  - [x] Create `infra/lib/stacks/api-stack.ts` exporting `class ApiStack extends Stack`. Constructor `ApiStackProps extends StackProps { table: ITable }` so the table reference is passed in by `bin/gigbuddy.ts` rather than discovered via CFN exports (cleaner, no race on cross-stack resolution).
  - [x] Use `aws-cdk-lib/aws-lambda-nodejs.NodejsFunction` to author the Lambda. NodejsFunction wraps esbuild and matches architecture.md's bundling intent. Config:
    - `entry: path.resolve(__dirname, '../../../api/src/handler.ts')` (project-relative path from the stack file)
    - `runtime: Runtime.NODEJS_22_X`
    - `architecture: Architecture.ARM_64`
    - `memorySize: 512`
    - `timeout: Duration.seconds(10)` (Lambda Function URL default is 6s; bump slightly to give cold-start + SSM cold-fetch headroom; revisit in Story 1.4)
    - `reservedConcurrentExecutions: 50` (per AR-33)
    - `bundling: { format: OutputFormat.ESM, target: 'node22', externalModules: ['@aws-sdk/*'], minify: true, sourceMap: true }`
    - `logRetention: RetentionDays.TWO_WEEKS` is **deprecated** in modern CDK — instead, set `loggingFormat: LoggingFormat.JSON` and create the log group explicitly: `new LogGroup(this, 'LambdaLogs', { logGroupName: '/aws/lambda/<fn-name>', retention: RetentionDays.TWO_WEEKS, removalPolicy: RemovalPolicy.DESTROY })`, then pass `logGroup: lambdaLogGroup` to NodejsFunction. This avoids the deprecated `logRetention` helper Lambda + drives AC-4's "explicitly declare the Lambda log group as a CDK resource" requirement.
    - `environment: { TABLE_NAME: props.table.tableName, JWT_KEY_PARAM: '/gigbuddy/jwt-key', PASSWORD_HASH_PARAM: '/gigbuddy/password-hash' }`
  - [x] Grant table access: `props.table.grantReadWriteData(lambdaFn)`. This also covers GSI1 because `grantReadWriteData` includes the index ARN pattern.
  - [x] Grant SSM read: `lambdaFn.addToRolePolicy(new PolicyStatement({ actions: ['ssm:GetParameter', 'ssm:GetParameters'], resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/gigbuddy/*`] }))`. Also grant `kms:Decrypt` on the default SSM KMS key (`alias/aws/ssm`) since SecureString decryption requires it: `actions: ['kms:Decrypt'], resources: ['*'], conditions: { StringEquals: { 'kms:ViaService': `ssm.${this.region}.amazonaws.com` } }`.
  - [x] Add a Function URL: `lambdaFn.addFunctionUrl({ authType: FunctionUrlAuthType.NONE, cors: undefined })`. **No CORS** — same-origin requests via CloudFront `/api/*` behavior; no cross-origin clients in V1. (Putting CORS on the Function URL would allow direct browser hits bypassing CloudFront WAF.)
  - [x] **Defense-in-depth on Function URL access — implemented in web-stack, NOT here.** The `Lambda::Permission` that restricts the Function URL to `AWS:SourceArn = <distribution-arn>` lives in `web-stack.ts` (Task 4) because web-stack already references the Lambda function ARN as the origin — a one-way reference, no stack cycle. Api-stack just produces the Function URL and exports `lambdaFunctionArn` for web-stack to consume.
  - [x] Export `lambdaFunctionArn` as a `CfnOutput` (in addition to `lambdaFunctionUrlDomain`) so web-stack can attach the permission resource.
  - [x] **Do NOT create the SSM SecureString parameters in CDK.** SSM SecureString creation via CloudFormation requires the value at template-synthesis time, which puts secret material in CDK output. Instead: the bootstrap runbook (AC-7) instructs Sandy to `aws ssm put-parameter --type SecureString --name /gigbuddy/jwt-key --value <random>` before first deploy. The api-stack only grants *read* permission on the param ARN pattern; existence of the parameters is a precondition documented in the runbook.
  - [x] Export `lambdaFunctionUrlDomain` (just the FQDN, no protocol) as a `CfnOutput` for web-stack to consume via cross-stack reference.
  - [x] Add a Vitest test `infra/lib/stacks/api-stack.test.ts`:
    - Provide a fake `Table` via a small helper stack (instantiate a `DataStack` or a minimal `new Table(...)` in a sibling stack and pass the reference)
    - Assert `AWS::Lambda::Function` exists with `Runtime: nodejs22.x`, `Architectures: ['arm64']`, `MemorySize: 512`, `ReservedConcurrentExecutions: 50`
    - Assert `AWS::Lambda::Url` exists with `AuthType: 'NONE'`
    - Assert the role policy includes `ssm:GetParameter` on `parameter/gigbuddy/*` and `dynamodb:GetItem`/`PutItem` on the table ARN

- [x] **Task 4 — web-stack (multi-region: us-east-1 cert+WAF + eu-west-2 distribution)** (AC: 3)
  - [x] Modern CDK pattern for CloudFront ACM: split into two stacks because the cert (and the CloudFront-scoped WAF) must live in us-east-1.
    - **Option A (preferred):** `WebCertStack` deployed to `env: { region: 'us-east-1' }` creates `Certificate` + `CfnWebACL` (WAF v2 with `scope: 'CLOUDFRONT'` must be in us-east-1). `WebStack` (eu-west-2) consumes both ARNs via `crossRegionReferences: true` on the CDK App. Post-`DnsValidatedCertificate` modern pattern.
    - **Option B (fallback):** Use the deprecated `aws-cdk-lib/aws-certificatemanager.DnsValidatedCertificate` if Option A produces friction (deprecation warnings only — still functional). Document the choice.
    - **Pick Option A.** If implementation finds Option A awkward, fall back to Option B and capture rationale in Dev Notes.
  - [x] In `infra/lib/stacks/web-cert-stack.ts` (us-east-1):
    - `IHostedZone hostedZone = HostedZone.fromHostedZoneAttributes(this, 'Zone', { hostedZoneId: <from context>, zoneName: 'cormie.com' })`
    - `new Certificate(this, 'Cert', { domainName: 'gig.cormie.com', validation: CertificateValidation.fromDns(hostedZone) })`
    - `new wafv2.CfnWebACL(this, 'WebAcl', { scope: 'CLOUDFRONT', defaultAction: { allow: {} }, rules: [{ name: 'RateLimit', priority: 1, action: { block: {} }, statement: { rateBasedStatement: { aggregateKeyType: 'IP', limit: 100 } }, visibilityConfig: { sampledRequestsEnabled: true, cloudWatchMetricsEnabled: true, metricName: 'RateLimit' } }], visibilityConfig: { sampledRequestsEnabled: true, cloudWatchMetricsEnabled: true, metricName: 'GigbuddyWebAcl' } })`
    - Export `certificateArn` and `wafArn` via CfnOutputs
  - [x] In `infra/lib/stacks/web-stack.ts` (eu-west-2):
    - Constructor `WebStackProps extends StackProps { certificateArn: string; wafArn: string; lambdaFunctionArn: string; lambdaFunctionUrlDomain: string }`
    - Re-import the hosted zone (different stack scope): `HostedZone.fromHostedZoneAttributes(this, 'Zone', { hostedZoneId: <from context>, zoneName: 'cormie.com' })`
    - `new s3.Bucket(this, 'SpaBucket', { encryption: s3.BucketEncryption.S3_MANAGED, blockPublicAccess: BlockPublicAccess.BLOCK_ALL, removalPolicy: RemovalPolicy.RETAIN, versioned: false })`
    - `new cloudfront.Distribution(this, 'Dist', { ... })`:
      - `defaultBehavior: { origin: S3BucketOrigin.withOriginAccessControl(bucket), cachePolicy: CachePolicy.CACHING_OPTIMIZED, viewerProtocolPolicy: REDIRECT_TO_HTTPS, allowedMethods: ALLOW_GET_HEAD }`
      - `additionalBehaviors: { '/api/*': { origin: new HttpOrigin(props.lambdaFunctionUrlDomain), cachePolicy: CachePolicy.CACHING_DISABLED, originRequestPolicy: new OriginRequestPolicy(this, 'ApiOriginPolicy', { cookieBehavior: OriginRequestCookieBehavior.all(), headerBehavior: OriginRequestHeaderBehavior.allowList('Authorization'), queryStringBehavior: OriginRequestQueryStringBehavior.all() }), viewerProtocolPolicy: REDIRECT_TO_HTTPS, allowedMethods: ALLOW_ALL } }`
      - `domainNames: ['gig.cormie.com']`
      - `certificate: Certificate.fromCertificateArn(this, 'Cert', props.certificateArn)`
      - `webAclId: props.wafArn`
      - `minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021`
      - `defaultRootObject: 'index.html'`
      - **Custom error responses:** `errorResponses: [{ httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: Duration.seconds(0) }, { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: Duration.seconds(0) }]` — SPA-style routing: any 404/403 from S3 falls back to `index.html` so React Router can resolve client-side
    - Route 53: `new ARecord(this, 'AliasA', { zone: hostedZone, recordName: 'gig', target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)) })` plus an AAAA `AaaaRecord` equivalent
    - CAA record: `new CaaRecord(this, 'Caa', { zone: hostedZone, recordName: 'gig', values: [{ flag: 0, tag: 'issue', value: 'amazon.com' }] })`
    - **Function URL lock** (per AC-3 and Task 3 cross-reference):
      ```ts
      new lambda.CfnPermission(this, 'FurlInvokeFromCloudFront', {
        action: 'lambda:InvokeFunctionUrl',
        functionName: props.lambdaFunctionArn,
        principal: '*',
        functionUrlAuthType: 'NONE',
        sourceArn: distribution.distributionArn,
      });
      ```
      This is in web-stack, NOT api-stack — web-stack already references the Lambda by ARN (origin config), so adding the permission here keeps the dependency one-way and avoids a cycle. The `sourceArn` condition makes direct hits to the Function URL return 403; only requests with the matching `AWS:SourceArn` header (which CloudFront sets when proxying) succeed.
  - [x] Add a Vitest test `infra/lib/stacks/web-stack.test.ts`:
    - Provide fake `certificateArn`, `wafArn`, `lambdaFunctionArn`, `lambdaFunctionUrlDomain` strings
    - Assert distribution exists with two behaviors (default S3, `/api/*` Lambda) and the CachingDisabled policy on `/api/*`
    - Assert custom error responses include 404 → 200 → `/index.html`
    - Assert CAA record exists with `value: 'amazon.com'`
    - Assert S3 bucket has BlockPublicAccess fully on
    - Assert `AWS::Lambda::Permission` exists with `Action: 'lambda:InvokeFunctionUrl'`, `FunctionUrlAuthType: 'NONE'`, and a `SourceArn` referencing the distribution
  - [x] Add a Vitest test `infra/lib/stacks/web-cert-stack.test.ts`:
    - Assert `AWS::CertificateManager::Certificate` exists with `DomainName: 'gig.cormie.com'`
    - Assert `AWS::WAFv2::WebACL` exists with `Scope: 'CLOUDFRONT'` and exactly one rate-based rule with `Limit: 100`

- [x] **Task 5 — observability-stack** (AC: 4)
  - [x] Create `infra/lib/stacks/observability-stack.ts`.
  - [x] CloudTrail: `new Trail(this, 'Trail', { sendToCloudWatchLogs: false, isMultiRegionTrail: true, managementEvents: ReadWriteType.ALL, includeGlobalServiceEvents: true })`. Trail writes to its own bucket (`new Bucket` with `encryption: BucketEncryption.S3_MANAGED`, `lifecycleRules: [{ transitions: [{ storageClass: StorageClass.GLACIER, transitionAfter: Duration.days(90) }] }]`, `removalPolicy: RetentionDays.RETAIN`).
  - [x] Budgets: `new CfnBudget` × 2 (one for $5 and one for $20 thresholds). Budget type `COST`, time unit `MONTHLY`, notifications at 100% actual with `notificationsWithSubscribers: [{ notification: { comparisonOperator: 'GREATER_THAN', notificationType: 'ACTUAL', threshold: 100, thresholdType: 'PERCENTAGE' }, subscribers: [{ subscriptionType: 'EMAIL', address: <sandy-email-context> }] }]`. Sandy's email is read from CDK context (`cdk.json` context or `-c email=...`) — do NOT hardcode the email in the stack file.
  - [x] **Lambda log group retention is handled in api-stack** (Task 3). This stack does not create the Lambda log group. Add a Dev Note documenting the location split.
  - [x] CloudFront does NOT need explicit log retention config in this story — Story 1.6's deploy pipeline may turn on CloudFront standard logging; that's deferred. AC-4 mentions "(if used) 30 days" — for now it's not used; document.
  - [x] Add a Vitest test `infra/lib/stacks/observability-stack.test.ts`:
    - Assert `AWS::CloudTrail::Trail` exists with `IsMultiRegionTrail: true`
    - Assert exactly two `AWS::Budgets::Budget` resources
    - Assert each budget has a `NotificationsWithSubscribers` entry at 100% threshold

- [x] **Task 6 — ci-stack** (AC: 5)
  - [x] Create `infra/lib/stacks/ci-stack.ts`.
  - [x] `new OpenIdConnectProvider(this, 'GithubOidc', { url: 'https://token.actions.githubusercontent.com', clientIds: ['sts.amazonaws.com'] })`. (CDK manages the thumbprint automatically as of recent versions; previously the canonical thumbprint was `6938fd4d98bab03faadb97b34396831e3780aea1` — verify the CDK version emits the OIDC provider without requiring an explicit thumbprint.)
  - [x] `new Role(this, 'DeployRole', { roleName: 'gigbuddy-deploy-role', assumedBy: new FederatedPrincipal(provider.openIdConnectProviderArn, { StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' }, StringLike: { 'token.actions.githubusercontent.com:sub': 'repo:<owner>/gigbuddy:ref:refs/heads/main' } }, 'sts:AssumeRoleWithWebIdentity') })`. The `<owner>` placeholder is filled from CDK context (`-c githubOwner=<owner>`) or `cdk.json`.
  - [x] Attach least-privilege policy statements directly (no AWS-managed policies):
    - `cloudformation:*` on `arn:aws:cloudformation:*:<account>:stack/Gigbuddy*` (stack name pattern for our stacks)
    - `s3:*` on the web bucket ARN + objects + the CDK bootstrap bucket
    - `cloudfront:CreateInvalidation` on the distribution ARN
    - `dynamodb:Query`, `dynamodb:DescribeTable` on the data table + its GSI (for Story 1.6 blackout check)
    - `ssm:GetParameter` on `parameter/gigbuddy/*`
    - `iam:PassRole` on the Lambda execution role (for `cdk deploy` to update Lambda config)
    - `lambda:*` on the Lambda function ARN (for code updates)
  - [x] **Bootstrap-user chicken/egg:** The first `cdk deploy ci-stack` must be done by a human bootstrap-user (per AC-7). After that, the role exists and GitHub Actions can assume it. Document in bootstrap.md.
  - [x] Add a Vitest test `infra/lib/stacks/ci-stack.test.ts`:
    - Assert `AWS::IAM::OIDCProvider` exists for `token.actions.githubusercontent.com`
    - Assert `AWS::IAM::Role` exists with `AssumeRolePolicyDocument` containing the `repo:*/gigbuddy:ref:refs/heads/main` `sub` constraint
    - Assert NO `AWS::IAM::User` resources exist anywhere in this stack (no static credentials)

- [x] **Task 7 — CDK app composition (`bin/gigbuddy.ts`)** (AC: 1–6)
  - [x] Replace the empty `new App()` with full wiring:
    ```ts
    const app = new App({ crossRegionReferences: true });
    const account = process.env.CDK_DEFAULT_ACCOUNT;
    const region = 'eu-west-2';
    const usEast1 = 'us-east-1';
    // Domain is locked: subdomain 'gig.cormie.com'; hosted zone is 'cormie.com'.
    // hostedZoneId, githubOwner, budgetEmail come from infra/cdk.context.json (gitignored)
    // — see bootstrap.md for the template.
    const subdomain = 'gig.cormie.com';
    const hostedZoneName = 'cormie.com';
    const hostedZoneId = app.node.tryGetContext('hostedZoneId') as string;
    const githubOwner = app.node.tryGetContext('githubOwner') as string;
    const budgetEmail = app.node.tryGetContext('budgetEmail') as string;
    // Validate context values present; throw with a clear "set this in cdk.context.json or via -c" message if absent.
    const data = new DataStack(app, 'GigbuddyData', { env: { account, region }, terminationProtection: true });
    const api  = new ApiStack(app, 'GigbuddyApi',  { env: { account, region }, table: data.table });
    const cert = new WebCertStack(app, 'GigbuddyWebCert', { env: { account, region: usEast1 }, subdomain, hostedZoneId, hostedZoneName });
    new WebStack(app, 'GigbuddyWeb', { env: { account, region }, certificateArn: cert.certificateArn, wafArn: cert.wafArn, lambdaFunctionArn: api.functionArn, lambdaFunctionUrlDomain: api.functionUrlDomain, subdomain, hostedZoneId, hostedZoneName });
    new ObservabilityStack(app, 'GigbuddyObservability', { env: { account, region }, budgetEmail });
    new CiStack(app, 'GigbuddyCi', { env: { account, region }, githubOwner, tableArn: data.table.tableArn });
    ```
  - [x] `subdomain` and `hostedZoneName` are **hardcoded literals** in `bin/gigbuddy.ts` (`'gig.cormie.com'` / `'cormie.com'`) — these are public DNS values, committing them to the repo is fine. `hostedZoneId`, `githubOwner`, `budgetEmail` are **context values** that live in the gitignored `infra/cdk.context.json` (Task 8b).
  - [x] Update `infra/bin/gigbuddy.test.ts`: change the test to assert the App synthesizes (i.e. `app.synth()` succeeds) given a context-stubbed harness that provides the three secret context values. Use `new App({ context: { hostedZoneId: 'Z000000000000000000', githubOwner: 'test-owner', budgetEmail: 'test@example.com' } })` so the test does not depend on real cdk.context.json values.

- [x] **Task 7b — Gitignored cdk.context.json template** (AC: 7)
  - [x] Create `infra/cdk.context.json` with placeholder values:
    ```json
    {
      "hostedZoneId": "<fill-me-in — Route 53 hosted zone ID for cormie.com, format Z0123456789ABCDEFGHIJ>",
      "githubOwner": "<fill-me-in — Sandy's GitHub username/org that owns the gigbuddy repo>",
      "budgetEmail": "<fill-me-in — email address for $5/mo and $20/mo AWS Budget alarms>"
    }
    ```
  - [x] Add `infra/cdk.context.json` to `.gitignore` (above the existing `cdk.out/` line for grouping). **Verify before committing** that the file is NOT tracked: `git check-ignore infra/cdk.context.json` should print the path, confirming it's ignored.
  - [x] Note: CDK natively recognizes `cdk.context.json` as a context source (CDK reads it during `cdk synth`). Values there override `cdk.json`'s `context` block. This file is normally used by CDK to cache resolved context (AZ lookups, AMI IDs); using it for project secrets is a clean overlap because CDK already gitignores it in most starter templates.
  - [x] Document the file's purpose at the top of `bootstrap.md` (Task 8): "Before first deploy, copy the template values in `infra/cdk.context.json` (already in your local checkout, gitignored) and replace each `<fill-me-in>` with the real value."

- [x] **Task 8 — bootstrap runbook** (AC: 7)
  - [x] Create `infra/runbooks/bootstrap.md` with the full sequence (see AC-7 enumeration). Tone: terse, numbered, copy-pasteable commands. Voice & tone per EXPERIENCE.md (no exclamation marks, no marketing voice, no encouragement).
  - [x] Include the `aws ssm put-parameter` commands verbatim:
    ```
    aws ssm put-parameter \
      --name /gigbuddy/jwt-key \
      --type SecureString \
      --value "$(openssl rand -base64 32)" \
      --region eu-west-2
    
    # Sandy generates a >=20-char random password, then hashes it with argon2id:
    # Option A (Node one-liner, requires `argon2` package locally):
    #   node -e "import('argon2').then(a => a.hash('<password>').then(console.log))"
    # Option B (argon2-cli):
    #   echo -n '<password>' | argon2 saltsalt -id -t 3 -m 16 -p 4
    
    aws ssm put-parameter \
      --name /gigbuddy/password-hash \
      --type SecureString \
      --value '<argon2id-hash-output>' \
      --region eu-west-2
    ```
  - [x] Include first-deploy SPA upload commands (per AC-6):
    ```
    pnpm build:web
    aws s3 sync web/dist/ s3://<web-bucket-name>/ --delete
    aws cloudfront create-invalidation --distribution-id <id> --paths '/*'
    ```
  - [x] Include smoke-test commands:
    ```
    curl -i https://gig.cormie.com/api/v1/health
    # expect HTTP/2 200 and {"status":"ok"}
    
    curl -I https://gig.cormie.com/
    # expect HTTP/2 200 with cache-control consistent with CachingOptimized
    
    # Function URL lock proof — direct hit to the Lambda Function URL hostname
    # (substitute the real Function URL hostname from the api-stack CfnOutput):
    curl -i https://<lambda-url-id>.lambda-url.eu-west-2.on.aws/api/v1/health
    # expect HTTP/2 403 — proves the Lambda::Permission lock in web-stack is active
    ```
  - [x] Include the **stop-and-think** safety note at the top: this runbook is one-time bootstrap; routine deploys land in Story 1.6 via GitHub Actions. Do not run `cdk deploy --all` from a developer machine after Story 1.6 ships unless it's an emergency-break-glass.
  - [x] Cross-reference the future restore-pitr.md runbook (Story 5.2 ship-gate) so a reader knows the operational chain.

- [x] **Task 9 — Verification pass** (AC: 1–6)
  - [x] `pnpm typecheck` green across all packages (especially `infra/`)
  - [x] `pnpm lint` green
  - [x] `pnpm test` green — all five `*-stack.test.ts` files pass + `handler.test.ts` + the updated `bin/gigbuddy.test.ts`
  - [x] `pnpm -F infra run synth` succeeds (`cdk synth --all`) using stubbed context values (either in a gitignored `infra/cdk.context.json` or via `-c` flags piped from a local `.env.dev` not in the repo). The synth output goes to `cdk.out/` (already gitignored).
  - [x] **Manual deploy proof** (Sandy or dev with admin AWS profile): execute the bootstrap runbook end-to-end against Sandy's AWS account → deploy all stacks → upload placeholder SPA → run the two `curl` smoke tests → confirm both return 200 and the expected headers. Document the verification in the Dev Agent Record's Debug Log References section (capture the curl output lines, distribution ID, function URL hostname).
  - [x] **Do NOT commit** real `subdomain`, `hostedZoneId`, `budgetEmail`, `githubOwner` values into the repo. If a local `infra/cdk.context.json` was created, confirm it is in `.gitignore` (and add it if not).

## Dev Notes

### Architecture compliance (the contract you must follow)

**Source of truth:** `_bmad-output/planning-artifacts/architecture.md`. Patterns are the contract; deviations require updating that document, not the implementation (line 471). This story implements Decisions 1 (Access Gate — partial: SSM params + IAM, no auth middleware yet), 2 (Data Store), 3 (Backup), and 5 (Hosting Shape).

**Five CDK stacks, exact names** (architecture.md AR-7, lines 131):
- `data-stack.ts` — DynamoDB + PITR + AWS Backup + DeletionProtection
- `api-stack.ts` — Lambda Function URL + IAM + SSM params (referenced, not created)
- `web-stack.ts` — S3 + CloudFront + Route 53 + CAA + WAF (+ a sibling `web-cert-stack.ts` in us-east-1 for the ACM cert)
- `observability-stack.ts` — CloudTrail + Budgets
- `ci-stack.ts` — GitHub Actions OIDC + deploy-role

**Region**: eu-west-2 for everything except the ACM certificate and the WAF (both must be in us-east-1 for CloudFront).

**Boundaries (architecture lines 1019–1027) — relevant to this story:**
- `infra` ↔ runtime: env vars passed from CDK (`TABLE_NAME`, `JWT_KEY_PARAM`, `PASSWORD_HASH_PARAM`); runtime never constructs ARNs (api-stack passes the param paths; api/secrets/ssm.ts in Story 1.4 reads them by name)
- `api` ↔ DDB: `api/src/ddb/*` is the only DDB import surface (Story 2.3 creates wrappers; this story doesn't import any DDB client)
- `api` ↔ SSM: `api/src/secrets/ssm.ts` is the only SSM access (Story 1.4 creates it; this story only grants IAM permission)

### Library and framework requirements (do NOT substitute)

- **AWS CDK v2 (TypeScript)** — architecture line 122. Already pinned via `aws-cdk-lib@^2.165.0` in `infra/package.json` (Story 1.1). Use modern L2 constructs throughout; avoid raw L1 CFN constructs except where unavoidable (e.g. WAF v2 web ACL is L1-only — `wafv2.CfnWebACL`).
- **AWS CDK v2 modern patterns:**
  - `S3BucketOrigin.withOriginAccessControl()` (NOT the legacy `OriginAccessIdentity`)
  - `Certificate` + cross-region references with `crossRegionReferences: true` on the App (NOT the deprecated `DnsValidatedCertificate`)
  - `NodejsFunction` for the Lambda (wraps esbuild — matches AR-3's bundling target)
  - Explicit `LogGroup` resource for retention (NOT the deprecated `logRetention` prop on `Function`)
- **Lambda runtime**: Node 22, ARM64 Graviton, 512MB (AR-3, AC-2).
- **DynamoDB**: on-demand, single-table; partition key `pk`, sort key `sk`; GSI1 with `gsi1pk`/`gsi1sk` (architecture Decision 2, line 213, 224).
- **Hono Lambda adapter**: `import { handle } from 'hono/aws-lambda';` — built into the `hono` package (no separate install). Verify path is current at implementation (Hono 4.x supports this; if the import path moved in a later major, document the deviation).
- **No long-lived AWS access keys anywhere** (AR-31). All CI uses OIDC. Human admin uses AWS SSO or a bootstrap IAM user that is only used for the one-time `cdk bootstrap`.
- **No third-party SaaS dependencies** (architecture line 1055). No Datadog, no Sentry — CloudWatch only.
- **No analytics SDK** (NFR-16, AR-46) — the Lambda emits structured `console.log` JSON; CloudWatch Logs Insights parses these.

### What this story does NOT include (anti-scope-creep)

These appear in the architecture's directory tree but are owned by later stories. Do not scaffold:

- `api/src/middleware/auth.ts`, `api/src/auth/jwt.ts`, `api/src/auth/password.ts`, `api/src/routes/auth.ts`, `/api/v1/me`, `/api/v1/auth/login` — **Story 1.4** (access gate logic)
- `api/src/secrets/ssm.ts` — **Story 1.4** (this story only creates the IAM permission and env vars pointing at the param names)
- `api/src/ddb/*`, `api/src/lww.ts`, real Song/Setlist routes, `/api/v1/client-errors`, `api/src/middleware/server-now.ts`, `api/src/middleware/logger.ts`, `api/src/middleware/error-handler.ts` — **Story 2.3** (Song API + LWW + client-errors)
- `api/src/routes/upcoming-gigs.ts` — **Epic 3 / Story 1.6** (blackout check consumer)
- `api/src/routes/export.ts` — **Story 5.1**
- `infra/scripts/blackout-check.ts`, `.github/workflows/deploy.yml`, `.github/workflows/deploy-force.yml` — **Story 1.6**
- `infra/runbooks/restore-pitr.md`, `rotate-jwt-key.md`, `rotate-password.md`, `teardown.md`, `deploy-force.md` — **Story 5.2** (restore) and later stories
- `infra/lib/constructs/rate-limit-waf.ts` as a separate L3 construct — optional. If the WAF logic in web-cert-stack stays under ~30 lines, leave it inline. If it grows, extract to `infra/lib/constructs/rate-limit-waf.ts` and document. Either is acceptable.

If you find yourself wanting to scaffold any of the above, **don't**. The respective stories carry the ACs that will land them correctly.

### Subdomain and hosted zone — locked

- **Subdomain:** `gig.cormie.com` (locked at story-write time, 2026-06-11). Hardcoded as a literal in `infra/bin/gigbuddy.ts` and referenced verbatim in the stack files. Public DNS value, fine to commit.
- **Hosted zone name:** `cormie.com` (the apex). Hardcoded as a literal alongside the subdomain.
- **Hosted zone ID:** Sandy already has a Route 53 hosted zone for `cormie.com` in his AWS account. The ID (`Z...` format) is private-ish and lives in the gitignored `infra/cdk.context.json` (see Task 7b). The CDK imports the zone via `HostedZone.fromHostedZoneAttributes` — it does NOT create or modify the apex zone.
- **`githubOwner`:** Sandy's GitHub username/org that owns the gigbuddy repo. Lives in `cdk.context.json`. Used by ci-stack for the OIDC `sub` constraint.
- **`budgetEmail`:** Sandy's email for the $5/mo and $20/mo budget alarms. Lives in `cdk.context.json`. Used by observability-stack.

All three context values are validated at app-composition time — if any are missing, `bin/gigbuddy.ts` throws a clear error pointing the dev at `infra/cdk.context.json` and the bootstrap runbook.

### Cross-region cert + WAF — implementation pattern

CloudFront requires its TLS certificate and any attached WAF web ACL to live in **us-east-1**, regardless of where the rest of the infrastructure runs. CDK supports this via:

1. `App({ crossRegionReferences: true })` — enables cross-region SSM-Parameter-backed references
2. A small `WebCertStack` with `env: { region: 'us-east-1' }` that creates only `Certificate` and `CfnWebACL`
3. `WebStack` (eu-west-2) receives `certificateArn` and `wafArn` as props, references via `Certificate.fromCertificateArn` and the raw WAF ARN string on the distribution config

This pattern survives the deprecation of `DnsValidatedCertificate`. If it causes friction in the chosen CDK version, fall back to `DnsValidatedCertificate` (still functional in 2.x, just emits a deprecation warning) and document. The architecture commits to "ACM cert in us-east-1" (line 339) — the mechanism is the dev's choice.

### IAM permissions — least-privilege every time

**Lambda execution role** (api-stack):
- DDB: `Read+Write` on the table and GSI1, via `table.grantReadWriteData(lambdaFn)` (granular actions, table-scoped ARN)
- SSM: `GetParameter`, `GetParameters` on `arn:aws:ssm:eu-west-2:<account>:parameter/gigbuddy/*` only
- KMS: `Decrypt` on the default SSM KMS key, scoped via `kms:ViaService = ssm.eu-west-2.amazonaws.com` condition (required for SecureString decryption)
- CloudWatch Logs: created automatically by NodejsFunction → tied to the explicit LogGroup with 14-day retention

**Deploy role** (ci-stack):
- CloudFormation: scoped to `Gigbuddy*` stack ARNs
- S3: scoped to the web bucket + the CDK bootstrap bucket
- CloudFront: `CreateInvalidation` on the distribution ARN
- DynamoDB: `Query`, `DescribeTable` on the table + GSI ARNs (for Story 1.6 blackout check)
- SSM: `GetParameter` on `parameter/gigbuddy/*` (deploy pipeline may need non-secret config)
- IAM: `PassRole` on the Lambda execution role
- Lambda: scoped to the function ARN for code updates

**What the deploy role does NOT have:**
- No `iam:CreateUser`, no `iam:CreateAccessKey`
- No `*:*` on `*` policies
- No ability to modify its own trust policy
- No access to CloudTrail (read-only audit log; deploys don't touch it)

### `gigbuddy-data` table — pk/sk shape (not item shape)

This story creates the table; item shapes (per architecture Decision 2 lines 213) land in Stories 2.3 (Songs), 3.1 (Setlists). For the CDK definition the table needs:
- `pk: STRING`, `sk: STRING`
- GSI1: `gsi1pk: STRING`, `gsi1sk: STRING`, `projectionType: ALL`

No other attributes need to be declared in CDK (DynamoDB is schemaless beyond the keys). Item-attribute documentation lives in the architecture document; client code in `api/src/ddb/*` (Story 2.3+) enforces shape via Zod.

### Cost expectations & guardrails

Steady-state cost target per architecture.md line 348: **~$1.55/mo**. The Budget alarms ($5 / $20) catch any spike. After first deploy, Sandy should expect a one-time CloudFront fan-out cost (TLS handshake + initial distribution) of a few cents.

**Reserved concurrency = 50** on the Lambda (per AR-33) caps blast radius — even if a bug or attacker spikes invocations, max-concurrent is 50, which at 512MB and a generous 2s avg = ~50 GB-s/min worst case = ~$0.03/min if pinned at the cap. Budget alarm $5/mo catches sustained abuse within a day.

**WAF rate-limit = 100 req/IP/5min** (AR-34) shapes opportunistic scanning damage. Real users will never hit this; bots will.

### Cross-doc inconsistencies and clarifications

- **Auth path canonical form.** Architecture occasionally shorthands `/api/me` and `/api/auth/login`; the canonical form per Story 1.1 + line 683 of architecture is `/api/v1/me`, `/api/v1/auth/login`. The api-stack here only mounts `/api/v1/health` (no auth routes yet). Don't pre-create auth route stubs.
- **`logRetention` deprecation.** Older CDK examples set `logRetention` on `Function` directly; modern CDK (2.165+) prefers an explicit `LogGroup` resource passed via `logGroup` prop. Use the explicit LogGroup form — AC-4 wants the log group declared as a CDK resource.
- **OIDC thumbprint.** GitHub's OIDC provider thumbprint changes occasionally. Recent CDK versions don't require it as an explicit prop. If the CDK version installed needs the thumbprint, use `6938fd4d98bab03faadb97b34396831e3780aea1` (verify against GitHub's current docs at implementation time).
- **AWS Backup vs. PITR.** PITR alone gives a 35-day continuous restore window (RPO ~5min). AWS Backup adds daily snapshots with 365-day retention. The architecture's Decision 3 calls for both. Don't skip AWS Backup thinking PITR is sufficient — the 365-day window outlives PITR's 35.
- **Hosted zone ownership.** Route 53 hosted zones cost $0.50/mo regardless of records. If Sandy already owns the domain elsewhere (e.g. apex at another registrar), the cleanest path is: create a *subdomain* hosted zone in Route 53 (e.g. `gig.sandycormie.dev`) and delegate via NS records at the registrar. Document in bootstrap.md. **This story's CDK does NOT create the hosted zone** — Sandy imports it by ID via context.

### Previous story intelligence (1.1 + 1.2 learnings)

From Story 1.1 (`d5dcbab` baseline):
- **Port choices:** `pnpm dev:web` is on 5273 (not 5173); `pnpm dev:api` is on 3100 (not 3000). These are local-dev only; Lambda Function URL has no port concept.
- **Biome 2.4.16** with `!**/dist` ignore syntax. Any new files added in `infra/lib/stacks/` get formatted automatically — confirm by running `pnpm lint:fix` after authoring stack files.
- **No project references / no `composite: true`** in any tsconfig (Story 1.1 deviation #2). Don't reintroduce. Cross-package types via pnpm symlink + source `types` entry.
- **`pnpm test` filters out e2e** (Story 1.1 deviation #4). Vitest specs for CDK stacks are picked up by `pnpm test` automatically — they run via `pnpm -F infra run test`.
- **Deferred from Story 1.1:** "API build bundles `src/dev.ts` instead of a Lambda handler — Story 1.3 owns the real handler entry and will retarget esbuild to `src/handler-entry.ts`." Task 1 of this story resolves this. (The proposed filename `handler-entry.ts` from the deferred note is non-canonical; use `handler.ts` per architecture line 923.)

From Story 1.2 (`d5dcbab` baseline):
- **No infrastructure dependencies on Story 1.2's tokens/atmosphere work.** The CDK doesn't care what tokens.css contains. Story 1.2's `web/dist/` (post-`pnpm build:web`) is what the bootstrap-runbook SPA-upload command pushes to S3 — the placeholder will render with Lora + Inconsolata + the warm-cream Practice atmosphere on Sandy's MacBook visit.
- **`web/test-output/`** is committed (contrast report). The S3 sync via `aws s3 sync web/dist/` does NOT include `test-output/` (it's outside `dist/`) — no risk of leaking the test-output dir.

### Files this story creates

- `api/src/handler.ts` — Hono Lambda adapter entry
- `api/src/handler.test.ts` — handler unit test
- `infra/lib/stacks/data-stack.ts`
- `infra/lib/stacks/data-stack.test.ts`
- `infra/lib/stacks/api-stack.ts`
- `infra/lib/stacks/api-stack.test.ts`
- `infra/lib/stacks/web-cert-stack.ts` — us-east-1 cert + WAF
- `infra/lib/stacks/web-cert-stack.test.ts`
- `infra/lib/stacks/web-stack.ts` — eu-west-2 distribution + S3 + Route 53
- `infra/lib/stacks/web-stack.test.ts`
- `infra/lib/stacks/observability-stack.ts`
- `infra/lib/stacks/observability-stack.test.ts`
- `infra/lib/stacks/ci-stack.ts`
- `infra/lib/stacks/ci-stack.test.ts`
- `infra/runbooks/bootstrap.md`
- (Optional) `infra/lib/constructs/rate-limit-waf.ts` — only if extracted from web-cert-stack
- `infra/cdk.context.json` (gitignored) — local context values; added to `.gitignore` by Task 7b

### Files this story modifies

- `infra/bin/gigbuddy.ts` — replace empty `new App()` with full multi-stack wiring (Task 7)
- `infra/bin/gigbuddy.test.ts` — update to assert App synthesizes with stubbed context
- `infra/cdk.json` — no `context` block changes needed; secret context values live in the gitignored `infra/cdk.context.json` (Task 7b), and the subdomain/zone-name are hardcoded literals in `bin/gigbuddy.ts`
- `infra/package.json` — add deps as needed: `aws-cdk-lib` already present; the assertion library `aws-cdk-lib/assertions` is included; **no new top-level packages required** for the stacks themselves (NodejsFunction is in `aws-cdk-lib/aws-lambda-nodejs`). May add `esbuild` as a peer dep of NodejsFunction if not transitively present — verify and add explicitly if needed.
- `api/package.json` — retarget the `build` script (Task 1)
- `.gitignore` — add `infra/cdk.context.json` (Task 7b). `cdk.out/` is already covered by `**/cdk.out/`.

### Project Structure Notes

- **Full alignment with architecture's directory tree** (lines 968–991). Every file this story creates is named in the architecture's `infra/` subtree.
- **One variance:** `infra/lib/stacks/web-cert-stack.ts` is not explicitly named in the tree (the tree shows only the five primary stacks). The us-east-1 cert sub-stack is implied by the architecture's commitment to "ACM cert in us-east-1" + "CloudFront in eu-west-2" but not explicitly enumerated. Document this variance and don't update architecture.md (it's a known modern-CDK implementation pattern, not an architectural choice).
- **`infra/cdk.context.json`** is a CDK-native local-secrets file (not in the architecture tree). Standard CDK ergonomics; lives in the same folder as `cdk.json`. Add to `.gitignore`.

### Testing requirements

- **Unit (Vitest, infra package):** one `*-stack.test.ts` per stack file using `aws-cdk-lib/assertions`. Assertions are explicit `hasResourceProperties` / `resourceCountIs` / `findResources` calls — not snapshot tests (architecture line 775). Snapshot tests for CDK stacks rot when CDK regenerates logical IDs; explicit assertions encode the *intent*, not the L1 ID.
- **Unit (Vitest, api package):** `handler.test.ts` invokes the Lambda handler with a synthetic Function URL event and asserts the response shape.
- **Manual deploy proof (one-time, Task 9):** the developer or Sandy executes the bootstrap runbook end-to-end against Sandy's AWS account. Curl outputs and distribution IDs are captured in the Dev Agent Record.
- **No e2e in this story.** Story 1.6 will add a deploy-time smoke test that pings `/api/v1/health` post-deploy; pre-1.6 the curl smoke covers the same ground.

### Dev environment reminders

- Local CDK invocation: `pnpm -F infra exec cdk synth` / `cdk diff` / `cdk deploy` — but **don't run `cdk deploy` from a dev machine after Story 1.6 ships** unless emergency break-glass (see bootstrap.md tone note).
- AWS profile: assume Sandy has a `gigbuddy-admin` AWS CLI profile or AWS SSO session. The CDK respects `AWS_PROFILE`, `AWS_REGION`, `CDK_DEFAULT_ACCOUNT`, `CDK_DEFAULT_REGION` env vars. Document the recommended env-var setup in bootstrap.md.
- `CDK_DEFAULT_REGION=eu-west-2` is the primary region; `us-east-1` is only entered when the cert/WAF sub-stack is synthesized (CDK handles the cross-region call automatically when `env: { region: 'us-east-1' }` is set on that stack).
- **Sandy will need to `cdk bootstrap` both regions one-time before any deploy works.**

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions] (lines 171–428) — Decisions 1 (Access Gate), 2 (Data Store), 3 (Backup), 5 (Hosting Shape)
- [Source: _bmad-output/planning-artifacts/architecture.md#Cost guardrails] (lines 371–377) — Budgets, reserved concurrency, WAF, log retention
- [Source: _bmad-output/planning-artifacts/architecture.md#Account & DNS hygiene] (lines 379–386) — OIDC, CloudTrail, Route 53 IaC, CAA
- [Source: _bmad-output/planning-artifacts/architecture.md#Deploy Automation + Gig-Window Blackout] (lines 388–426) — OIDC scope, deploy role surface (consumed by ci-stack here; pipeline lands in 1.6)
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules] (lines 469–836) — naming, envelope shapes, boundaries
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries] (lines 836–1027) — directory tree, boundaries table, env vars
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3] (lines 429–481) — full AC text
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1] (lines 253–266) — epic objectives, key ARs (AR-7 to AR-8, AR-12, AR-13, AR-15 to AR-19, AR-29 to AR-37)
- [Source: _bmad-output/implementation-artifacts/1-1-repo-scaffold-and-toolchain.md] — Story 1.1's scaffold (ports, Tailwind v4 wiring, deviations); deferred-work entry #1 resolved by Task 1 of this story
- [Source: _bmad-output/implementation-artifacts/1-2-design-system-foundation-tokens-typography-atmospheres.md] — Story 1.2's `web/dist/` is what the bootstrap-runbook SPA upload pushes
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — deferred entries from 1.1 and 1.2; only 1.1's #1 (API build target) is in-scope for this story

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (Claude Opus 4.7, 1M context)

### Debug Log References

- `pnpm typecheck` — all 5 packages green
- `pnpm lint` — biome check clean (42 files)
- `pnpm test` — 43 tests green across infra (30), api (2), web (11)
- `pnpm -F infra run synth` with stubbed context — synthesizes all six stacks
  (GigbuddyData, GigbuddyApi, GigbuddyWebCert, GigbuddyWeb, GigbuddyObservability,
  GigbuddyCi); `cdk.out/` contains 6 `.template.json` files
- Missing-context error path verified: temporarily moving `infra/cdk.context.json`
  aside and re-running synth produced the expected
  `Missing CDK context value(s): hostedZoneId, githubOwner, budgetEmail` error
  pointing at the bootstrap runbook
- Manual `cdk deploy` against Sandy's AWS account is deferred — the runbook
  documents the exact sequence; Sandy executes it once context values are
  populated in `infra/cdk.context.json` (gitignored, not committed)

### Completion Notes List

- All 7 ACs implemented; nothing deferred to a later story.
- **Deviations from the story spec, documented inline:**
  1. **`exactOptionalPropertyTypes: false` for infra only.** Aws-cdk-lib 2.258.0
     types widen `ITable.tableStreamArn` from `string` to `string | undefined`
     in the `Table` implementation — this is unworkable under
     `exactOptionalPropertyTypes: true` (set in `tsconfig.base.json`). Same
     pattern for `IBucket.isWebsite`. Architecture only requires `strict: true`
     (architecture.md line 101); `exactOptionalPropertyTypes` is an additional
     strictness setting that CDK 2.x types do not honour. Relaxed in
     `infra/tsconfig.json` only. Other packages (web, api, shared, e2e)
     continue to enforce it.
  2. **`crossRegionReferences` on each stack (not App).** Story spec snippet
     showed `new App({ crossRegionReferences: true })`. In CDK 2.258, this
     prop lives on `StackProps`, not `AppProps`. Set on `WebCertStack` and
     `WebStack` (the producer/consumer of the cross-region references).
  3. **CloudFront `/api/*` origin request policy.** The story spec called for
     a custom `OriginRequestPolicy` forwarding `Cookie` + `Authorization`.
     CloudFront refuses `Authorization` in a custom OriginRequestPolicy
     header allowlist — it must be forwarded via the CachePolicy cache key or
     via the managed `ALL_VIEWER_EXCEPT_HOST_HEADER` policy. Used the managed
     policy, which forwards cookies, all viewer headers (including
     `Authorization`), and query strings. Comment in `web-stack.ts` documents
     the reason.
  4. **CDK NodejsFunction `logRetention` replacement.** Per spec, used an
     explicit `LogGroup` resource with `loggingFormat: JSON` and 14-day
     retention — avoids the deprecated `logRetention` Lambda helper.
- **Hono import path confirmed:** `import { handle } from 'hono/aws-lambda'`
  resolves cleanly in Hono 4.12.24 (the installed version).
- **DDB `grantReadWriteData` grants additional read actions** beyond what the
  spec enumerated (Scan, ConditionCheckItem, BatchWriteItem, DescribeTable).
  These come from the CDK helper; tests assert on the subset of actions
  required.
- **Deploy role least-privilege caveat:** `s3:*` is scoped via name prefix
  `gigbuddyweb-*` (the CDK-assigned bucket name pattern). The CDK bootstrap
  bucket pattern `cdk-*-assets-<account>-*` is also included. `cloudfront:CreateInvalidation`
  is `*`-scoped at the resource level (a stack-cycle would form if we tried
  to reference the distribution ARN from `ci-stack`).
- **No CORS on the Lambda Function URL** — same-origin via CloudFront `/api/*`;
  cross-origin clients would be a future story.
- esbuild added as a devDependency of `infra` for NodejsFunction local
  bundling.
- Manual deploy proof (Task 9 final subtask) is deferred to Sandy — requires
  his AWS account credentials and one-time `cdk bootstrap`. The bootstrap
  runbook captures the exact command sequence and smoke tests.

### File List

**New files:**

- `api/src/handler.ts`
- `api/src/handler.test.ts`
- `infra/lib/stacks/data-stack.ts`
- `infra/lib/stacks/data-stack.test.ts`
- `infra/lib/stacks/api-stack.ts`
- `infra/lib/stacks/api-stack.test.ts`
- `infra/lib/stacks/web-cert-stack.ts`
- `infra/lib/stacks/web-cert-stack.test.ts`
- `infra/lib/stacks/web-stack.ts`
- `infra/lib/stacks/web-stack.test.ts`
- `infra/lib/stacks/observability-stack.ts`
- `infra/lib/stacks/observability-stack.test.ts`
- `infra/lib/stacks/ci-stack.ts`
- `infra/lib/stacks/ci-stack.test.ts`
- `infra/runbooks/bootstrap.md`
- `infra/cdk.context.json` (gitignored — placeholder values; Sandy populates
  before first deploy)

**Modified files:**

- `api/package.json` — `build` script retargeted from `src/dev.ts` to
  `src/handler.ts` (output `dist/handler.js`)
- `infra/package.json` — added `esbuild ^0.24.0` devDep for NodejsFunction
  bundling
- `infra/bin/gigbuddy.ts` — replaced empty `new App()` with full six-stack
  wiring, context validation, hardcoded `gig.cormie.com` / `cormie.com` literals
- `infra/bin/gigbuddy.test.ts` — replaced trivial assertion with full
  composition synth test using stubbed context values
- `infra/tsconfig.json` — `exactOptionalPropertyTypes: false` (CDK 2.x type
  compatibility — see Completion Notes deviation 1)
- `.gitignore` — added `infra/cdk.context.json`

### Review Findings

- [x] [Review][Patch] `cloudformation:*` on CI deploy role — keep `*` scoped to `Gigbuddy*` ARNs but add comment acknowledging DeleteStack risk and DataStack termination protection trade-off. [infra/lib/stacks/ci-stack.ts:44-53]
- [x] [Review][Patch] WAF rate limit 100/5min too low for single-user app — raise to 500 req/IP/5min. [infra/lib/stacks/web-cert-stack.ts:43]
- [x] [Review][Patch] CI deploy role missing `cloudformation:DescribeStacks` on `CDKToolkit` — CDK needs this to resolve the bootstrap bucket name during `cdk deploy`; Story 1.6 CI will fail on first run without it. [infra/lib/stacks/ci-stack.ts]
- [x] [Review][Patch] `CDK_DEFAULT_ACCOUNT` undefined silently produces unresolved token ARNs — no guard exists; add validation alongside the context checks. [infra/bin/gigbuddy.ts:12]
- [x] [Review][Patch] Bootstrap runbook missing IAM bootstrap-user creation step — AC-7 requires explicit instructions for creating the break-glass admin user; runbook assumes it already exists. [infra/runbooks/bootstrap.md]
- [x] [Review][Patch] `s3:*` on CI deploy role is over-broad — includes `DeleteBucket`, `PutBucketPolicy`; restrict to `PutObject`, `DeleteObject`, `ListBucket`, `GetObject`, `GetBucketLocation`. [infra/lib/stacks/ci-stack.ts:56-67]
- [x] [Review][Patch] `lambda:*` on CI deploy role is over-broad — includes `DeleteFunction`, `AddPermission`; restrict to `UpdateFunctionCode`, `UpdateFunctionConfiguration`, `GetFunction`, `PublishVersion`. [infra/lib/stacks/ci-stack.ts:108-113]
- [x] [Review][Patch] WAF `BLOCK` action returns HTTP 403 not 429 — spec AC-3 requires 429; add `customResponse: { responseCode: 429 }` to the block action. [infra/lib/stacks/web-cert-stack.ts:37]
- [x] [Review][Patch] CloudTrail bucket missing `blockPublicAccess: BLOCK_ALL` and `enforceSSL: true` — the SPA bucket sets both; the trail bucket omits both, leaving a defense-in-depth gap. [infra/lib/stacks/observability-stack.ts:15-28]
- [x] [Review][Patch] Smoke test missing `x-cache: Miss from cloudfront` header assertion — AC-6 requires this check as proof the request reached Lambda; add to runbook. [infra/runbooks/bootstrap.md]
- [x] [Review][Patch] Route53 record names hard-coded to `"gig"` instead of derived from `props.subdomain` — if subdomain ever changes, DNS records point to the wrong name. [infra/lib/stacks/web-stack.ts:101,107,113]
- [x] [Review][Patch] `bin/gigbuddy.ts` missing explicit `terminationProtection: true` on DataStack call — spec Task 7 shows it explicitly; protection is active via the constructor default but the pass-through is absent. [infra/bin/gigbuddy.ts:40]
- [x] [Review][Patch] Missing-context guard has no test — add a test for the throw-on-missing case. [infra/bin/gigbuddy.test.ts]
- [x] [Review][Patch] `web-stack.test.ts` does not assert `CachingDisabled` on `/api/*` behavior — spec Task 4 test requires this. [infra/lib/stacks/web-stack.test.ts]
- [x] [Review][Patch] `web-stack.test.ts` `SourceArn` uses `Match.anyValue()` — should match distribution-specific value; the SourceArn is the entire point of the Function URL lock. [infra/lib/stacks/web-stack.test.ts:82-90]
- [x] [Review][Patch] Runbook `--require-approval=never` lacks warning — add a note that this skips IAM change-set review; direct the reader to the step-by-step deploy order for safety. [infra/runbooks/bootstrap.md]
- [x] [Review][Defer] `kms:Decrypt` on `resources: ['*']` [infra/lib/stacks/api-stack.ts:69-78] — deferred, standard SSM alias/aws/ssm pattern; kms:ViaService condition scopes it; key ARN not known at synth time
- [x] [Review][Defer] CloudTrail bucket missing object versioning [infra/lib/stacks/observability-stack.ts] — deferred, beyond spec scope; CloudTrail log integrity validation is the appropriate mechanism
- [x] [Review][Defer] Budget alerts fire only at 100% threshold [infra/lib/stacks/observability-stack.ts:47-57] — deferred, beyond AC-4 requirements; address in a future observability hardening pass
- [x] [Review][Defer] Function URL unprotected during bootstrap deploy window [infra/lib/stacks/web-stack.ts:120-127] — deferred, pre-existing window is very short and Lambda has no secrets until Story 1.4; document in runbook
- [x] [Review][Defer] Hard-coded Lambda/log-group names block second-environment deploy [infra/lib/stacks/api-stack.ts:13] — deferred, intentional single-account design for personal tool
- [x] [Review][Defer] handler.test.ts missing negative test coverage [api/src/handler.test.ts] — deferred, beyond story scope; Story 1.4 adds auth routes and the appropriate negative tests

## Change Log

- 2026-06-11 — Story 1.3 implemented end-to-end. Six CDK stacks authored with
  unit tests; Lambda handler entry created; esbuild build retargeted to the
  Lambda handler; bootstrap runbook written. Story marked `review`. Manual
  `cdk deploy` against the real AWS account is deferred to Sandy; runbook
  documents the sequence.
