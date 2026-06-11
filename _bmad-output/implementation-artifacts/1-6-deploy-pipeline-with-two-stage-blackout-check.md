---
baseline_commit: 2a7d4ae
---

# Story 1.6: Deploy pipeline with two-stage blackout check

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Sandy,
I want a GitHub Actions deploy pipeline that ships from `main` with a fail-closed blackout check and an auditable manual-override workflow,
so that I can deploy safely and the system refuses to deploy within 24h of any Gig without me explicitly overriding with a venue-name confirmation.

## Acceptance Criteria

**AC-1 — `.github/workflows/deploy.yml` runs the canonical deploy sequence over OIDC**

**Given** `.github/workflows/deploy.yml`
**When** a `push` to `main` triggers it (and `workflow_dispatch` is also accepted for break-glass)
**Then** the workflow declares `permissions: { id-token: write, contents: read }` and runs a single job whose steps execute in this exact order:
  1. `actions/checkout@v4`
  2. `aws-actions/configure-aws-credentials@v4` with `role-to-assume: <gigbuddy-deploy-role ARN>` and `aws-region: eu-west-2`
  3. `pnpm/action-setup@v4` pinned to the same version `ci.yml` uses (11.0.9)
  4. `actions/setup-node@v4` with `node-version-file: '.nvmrc'` and `cache: 'pnpm'`
  5. `pnpm install --frozen-lockfile`
  6. `pnpm lint`
  7. `pnpm typecheck`
  8. `pnpm test`
  9. **Blackout check** — `pnpm -F infra exec tsx scripts/blackout-check.ts` (see AC-2)
  10. `pnpm -F infra exec cdk diff --all` (informational; do NOT `|| true` — diff failures surface real CFN drift)
  11. `pnpm -F infra exec cdk deploy --all --require-approval=never`
  12. Build the SPA: `pnpm build:web`
  13. Resolve bucket name + distribution id from CloudFormation outputs (`aws cloudformation describe-stacks --stack-name GigbuddyWeb --query "Stacks[0].Outputs[?OutputKey=='SpaBucketName'].OutputValue" --output text` and same for `DistributionId`)
  14. `aws s3 sync web/dist/ s3://<bucket>/ --delete`
  15. `aws cloudfront create-invalidation --distribution-id <id> --paths '/*'` (capture the invalidation ID; do NOT wait for completion — the smoke test verifies the new bundle is reachable through any cached edge anyway via `cache-control` assertion below)
  16. **Smoke test** (see AC-3)
**And** the workflow assumes the `gigbuddy-deploy-role` via OIDC; there are NO `aws-access-key-id` / `aws-secret-access-key` repo secrets present, and `Settings → Secrets and variables → Actions` shows only the deploy-role-ARN variable (a non-secret repo variable per AR-31)
**And** every step uses `working-directory: .` (the workflow does not `cd` into a subpackage)
**And** the job declares `timeout-minutes: 20` (typical end-to-end is under 8 minutes; the cap defends against a hung step blocking subsequent deploys)

**AC-2 — `infra/scripts/blackout-check.ts` is two-stage and fail-closed**

**Given** `infra/scripts/blackout-check.ts` invoked by the deploy workflow
**When** the script runs
**Then** Stage 1 calls `DescribeTable` on `gigbuddy-data` in `eu-west-2`; any thrown exception (IAM `AccessDenied`, network failure, throttling, `ResourceNotFoundException`) causes the script to exit non-zero with stderr message exactly: `blackout check could not run reliably; use deploy-force.yml after confirming no Gig in 24h` (no stack trace appended; the message above is the entire stderr line)
**And** Stage 2 queries upcoming Gigs within the next 24h Europe/London window by calling `Scan` on `gigbuddy-data` Global Secondary Index `GSI1` with a `FilterExpression` of `gsi1sk BETWEEN :todayKey AND :tomorrowKey` where `:todayKey` and `:tomorrowKey` are the current and next Europe/London-local ISO dates formatted as `YYYY-MM-DD#` (the trailing `#` is the GSI1 sort-key separator — see Dev Notes for the key shape derivation)
**And** any thrown exception during the Stage 2 `Scan` causes the same fail-closed exit with the same exact stderr message as Stage 1
**And** when Stage 2 returns **one or more items**, the script exits non-zero with stderr enumerating each blocking gig as `BLOCKED: <venue> @ <isoDate> <time?>` (one per line) — venue and date are pulled from the item's `gigMeta` attribute; if `gigMeta.time` is absent, omit the trailing ` <time>` segment
**And** when Stage 2 returns **zero items**, the script runs the static fallback: if the current time in `Europe/London` is Friday, Saturday, or Sunday AND the hour is in `[18, 24)` (i.e. 18:00:00 through 23:59:59 inclusive), exit non-zero with stderr `BLOCKED: weekend evening static fallback (<weekday> <HH:MM> Europe/London)`; otherwise exit 0 with stdout `blackout check passed (no upcoming gigs; outside weekend-evening fallback window)`
**And** the script uses the named IANA timezone `Europe/London` for every time-of-day computation — never a UTC offset literal — by relying on `Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ... })` to extract weekday/hour/date components
**And** the script's exit code is the sole signal the workflow keys on; the workflow does NOT parse stderr for branching
**And** the script accepts (and is unit-tested with) injected `now: Date`, `describeTable: () => Promise<unknown>`, and `scanGigs: () => Promise<Array<{gigMeta: {venue: string, date: string, time?: string}}>>` so the decision logic is testable in isolation from the AWS SDK and the system clock

**AC-3 — Smoke test step verifies both CloudFront origins**

**Given** the smoke-test step at the end of `deploy.yml` (after S3 sync + CloudFront invalidation)
**When** it runs
**Then** it issues `curl -fsS -o /tmp/health.json -w '%{http_code}\n' https://gig.cormie.com/api/v1/health` and asserts:
  - HTTP status `200`
  - Response body parses to `{"status":"ok"}`
**And** it issues `curl -fsS -D /tmp/index.headers -o /tmp/index.html -w '%{http_code}\n' https://gig.cormie.com/index.html` and asserts:
  - HTTP status `200`
  - `/tmp/index.headers` contains a `via:` header naming `cloudfront` — proves the response was served through CloudFront, not direct origin-pull (the assertion is `grep -iE '^via:.*cloudfront' /tmp/index.headers`). The `CachingOptimized` cache policy (web-stack.ts:75) controls CloudFront's cache-key behavior, not response headers; S3 origin objects have no `Cache-Control` set by default, and no Response Headers Policy is attached, so the only reliable CDN-in-path proof is the `Via` header CloudFront injects on every response.
**And** any non-200 response or missing header pattern fails the workflow step (non-zero exit propagates because of `curl -fsS` and `grep`'s exit code)
**And** the smoke step runs AFTER the CloudFront invalidation; it does NOT wait for invalidation completion — the new SPA bundle being served from any edge is acceptable (the invalidation merely accelerates propagation; eventual consistency is fine for a single-user app)

**AC-4 — `.github/workflows/deploy-force.yml` requires a reason AND a venue-name confirmation when blocking gigs exist**

**Given** `.github/workflows/deploy-force.yml`
**When** triggered via `workflow_dispatch`
**Then** the workflow declares two `inputs`:
  - `reason: { description: 'Why this override is needed', required: true, type: string }`
  - `venueConfirmation: { description: 'Type the venue name of the nearest blocking Gig (leave blank if none)', required: false, type: string, default: '' }`
**And** the workflow's first job ("enumerate") runs `pnpm -F infra exec tsx scripts/blackout-check.ts --report-only`:
  - `--report-only` causes the script to **print** blocking gigs to stdout as one JSON object per line (`{"venue": "...", "date": "...", "time": "..."}` — `time` omitted if absent) and exit `0` regardless of whether any are blocking (so the workflow can read them and continue)
  - the workflow captures stdout into `$GITHUB_OUTPUT` as `blocking_gigs`
**And** if the captured `blocking_gigs` is non-empty, a subsequent step compares `inputs.venueConfirmation` against the `venue` field of the **first** (chronologically nearest by `date` then `time`) blocking gig:
  - exact equality required (case-sensitive, full string match, no trimming beyond `inputs.venueConfirmation` being already-trimmed by GH Actions)
  - if `venueConfirmation` is empty OR does not match → the workflow fails the step with stderr `venue confirmation does not match the nearest blocking Gig; aborting force-deploy` (no further steps run; `cdk deploy` is NOT invoked)
**And** if `blocking_gigs` is empty, no venue confirmation is required — the workflow proceeds (force-deploy used because the static fallback fires, not because of a real gig conflict)
**And** before proceeding to the deploy steps, the workflow writes the `reason` text PLUS the typed `venueConfirmation` PLUS each enumerated blocking gig to two places:
  1. `$GITHUB_STEP_SUMMARY` (markdown-formatted; visible in the GH Actions run summary)
  2. A CloudWatch Logs log line — written via `aws logs put-log-events` against an existing CloudWatch Log Group `/gigbuddy/deploy-force` (which the workflow creates on first run via `aws logs create-log-group --log-group-name /gigbuddy/deploy-force --region eu-west-2 || true` to make the workflow self-healing; the workflow then creates a log stream named `<run-id>` and writes one JSON event)
**And** after the audit logging, the workflow runs the same step sequence as `deploy.yml` from step 5 onward (pnpm install through smoke test), but **skips the blackout check step** (no Step 9 in this workflow)
**And** the workflow uses the same OIDC role (`gigbuddy-deploy-role`) and the same permissions block (`id-token: write, contents: read`) as `deploy.yml`

**AC-5 — Branch protection: `ci.yml` is required at PR time; blackout check is not**

**Given** the `main` branch protection rules
**When** Sandy opens a PR against `main`
**Then** the `lint + typecheck + test` status check (the value of `jobs.verify.name` in `.github/workflows/ci.yml`, which is what GitHub branch protection keys on — not the workflow name `ci` and not the job key `verify`) must pass before the PR is mergeable — this is configured manually in GitHub repo settings (Sandy is the admin; the configuration step is captured in the bootstrap runbook addendum produced by this story — see AC-7)
**And** the deploy workflow and its blackout check are NOT required at PR time (Gig times change between PR open and merge; the blackout check is a deploy-time guard that runs against the live DDB table at the exact moment of merge-to-main → deploy)
**And** the PR-time `ci.yml` continues to NOT assume the deploy role (PRs run on `pull_request` triggers; the OIDC `sub` constraint `repo:<owner>/gigbuddy:ref:refs/heads/main` rejects PR-ref token-exchange attempts — AR-31)

**AC-6 — Empty-table fresh-deploy path: blackout check passes via static fallback on a Tuesday morning**

**Given** the production `gigbuddy-data` table contains zero Setlist items (the V1 reality for Story 1.6's first deploy and every subsequent deploy until Story 3.x lands Setlist persistence)
**When** the deploy workflow runs on a Tuesday at 10:00 Europe/London
**Then** Stage 1 `DescribeTable` succeeds
**And** Stage 2 `Scan` returns zero items
**And** the static-fallback rule (weekend 18:00–24:00 only) does NOT fire (Tuesday is not Fri/Sat/Sun)
**And** the script exits 0 with the documented stdout passing message
**And** the workflow proceeds to `cdk diff` → `cdk deploy` → S3 sync → invalidation → smoke test → finish
**And** this scenario is exercised by `infra/scripts/blackout-check.test.ts` as a unit case (real CI exercise happens when Sandy lands the first real PR against the live deploy)

**AC-7 — Bootstrap runbook documents the OIDC hand-off, the deploy-role-ARN repo variable, and branch protection**

**Given** `infra/runbooks/bootstrap.md`
**When** read after Story 1.6 closes
**Then** Section 7 ("OIDC hand-off") is amended to enumerate the exact post-bootstrap GitHub configuration steps:
  1. Copy the `DeployRoleArn` CFN output value
  2. In the GitHub repo, navigate to `Settings → Secrets and variables → Actions → Variables` and create a repository variable `AWS_DEPLOY_ROLE_ARN` with that value (variable, not secret — ARNs are not sensitive; using a variable lets the value appear in workflow logs for diagnostic purposes)
  3. Navigate to `Settings → Branches → Branch protection rules` and create a rule for `main` that requires the `ci` status check to pass before merging, with `Require a pull request before merging` enabled and `Require approvals = 0` (Sandy is the sole reviewer; PRs from his fork into his repo do not need approval)
  4. Verify by opening a no-op PR: the `ci` check appears as "Required" and the merge button is disabled until it succeeds
**And** the addendum notes that the deploy and deploy-force workflows reference `vars.AWS_DEPLOY_ROLE_ARN` — Sandy's variable name MUST be exactly `AWS_DEPLOY_ROLE_ARN` (case sensitive) for the workflows to resolve the value
**And** a new Section 9 ("Emergency: deploy-force.yml") documents:
  - When to use it (gig less than 24h away but the deploy MUST go through — e.g. an incident requires a hotfix)
  - The two inputs (`reason`, `venueConfirmation`) and how the venue name is sourced (it appears in the deploy-force workflow's first-job log output as `BLOCKED: <venue> @ <isoDate>` lines)
  - The CloudWatch log location for audit (`/gigbuddy/deploy-force`)
  - The deploy-force run history lives in GH Actions → Workflows → "deploy-force"; the `reason` and `venueConfirmation` are in `$GITHUB_STEP_SUMMARY` for every run

## Tasks / Subtasks

- [ ] **Task 1 — Add `dynamodb:Scan` to the deploy role + add `@aws-sdk/client-dynamodb` to infra** (AC: 2)
  - [ ] Open `infra/lib/stacks/ci-stack.ts`. Locate the existing DynamoDB policy statement (around lines 111–117 — currently grants `dynamodb:Query, dynamodb:DescribeTable` on the table + `index/*`).
  - [ ] Extend the `actions` array to include `'dynamodb:Scan'`. Result:
    ```ts
    this.deployRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['dynamodb:Query', 'dynamodb:Scan', 'dynamodb:DescribeTable'],
        resources: [props.tableArn, `${props.tableArn}/index/*`],
      }),
    );
    ```
    **Why Scan and not Query:** GSI1's partition key is `BAND#<bandId>#SETLIST_BY_DATE` — Query against GSI1 requires an exact partition-key value. V1 ships with a single Band but the script does not know its `bandId` ahead of time (architecture defers the multi-Band registry to V2, line 256). Scan on GSI1 returns all setlist records regardless of band — at single-user volume (≤ low hundreds of setlists in V1's lifetime) the read cost is negligible (~$0.0001 per deploy). The architecture explicitly leaves the door open ("Stage 2 — query: **scan/query** upcoming Gigs", line 411).
  - [ ] Update `infra/lib/stacks/ci-stack.test.ts` to assert `dynamodb:Scan` is in the actions array for the table-scoped policy statement. The existing test (lines 56-68 cover CloudFormation scoping) is the right place — add a peer test:
    ```ts
    it('grants dynamodb:Query+Scan+DescribeTable on the table + GSI', () => {
      const template = synth();
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['dynamodb:Query', 'dynamodb:Scan', 'dynamodb:DescribeTable']),
              Resource: Match.arrayWith([
                'arn:aws:dynamodb:eu-west-2:111111111111:table/gigbuddy-data',
                'arn:aws:dynamodb:eu-west-2:111111111111:table/gigbuddy-data/index/*',
              ]),
            }),
          ]),
        }),
      });
    });
    ```
  - [ ] Open `infra/package.json` and add `@aws-sdk/client-dynamodb` to `devDependencies` (the script runs at deploy time via `tsx`, so it's a devDep not a runtime dep). Use the latest stable `^3.x` aligned with the rest of the repo (api/package.json already pulls `@aws-sdk/client-ssm@^3.658.0`; match the major).
  - [ ] Run `pnpm install` from the repo root to update the lockfile.
  - [ ] **Do NOT add `@aws-sdk/client-dynamodb` to api/package.json** — `api/` will gain DDB access only via `api/src/ddb/*` wrappers in Story 2.3 per AR-42. This story only needs DDB SDK in infra, where the boundary rule does not apply (CDK + scripts package).

- [ ] **Task 2 — Author `infra/scripts/blackout-check.ts` with injectable IO** (AC: 2, 6)
  - [ ] Create the directory: `infra/scripts/` (does not exist yet — `mkdir infra/scripts`).
  - [ ] Author `infra/scripts/blackout-check.ts`. The module exports a pure decision function and a thin `main()` that wires real AWS SDK calls. Skeleton:
    ```ts
    import {
      DescribeTableCommand,
      DynamoDBClient,
      ScanCommand,
    } from '@aws-sdk/client-dynamodb';

    const TABLE_NAME = 'gigbuddy-data';
    const REGION = 'eu-west-2';
    const FAIL_CLOSED_MESSAGE =
      'blackout check could not run reliably; use deploy-force.yml after confirming no Gig in 24h';

    export type Gig = {
      gigMeta: { venue: string; date: string; time?: string };
    };

    export type BlackoutDecision =
      | { exit: 0; stdout: string; blockingGigs: [] }
      | { exit: 1; stderr: string; blockingGigs: Gig[] };

    export type Deps = {
      now: Date;
      describeTable: () => Promise<unknown>;
      scanGigs: (londonIsoDateToday: string, londonIsoDateTomorrow: string) => Promise<Gig[]>;
    };

    /**
     * Returns the IANA-Europe/London-local YYYY-MM-DD date string for `at`.
     * Uses Intl.DateTimeFormat to handle BST/GMT transitions correctly without
     * a tz library.
     */
    export function londonIsoDate(at: Date): string { /* ... */ }

    /** Returns the Europe/London-local weekday short name (Mon..Sun) at `at`. */
    export function londonWeekday(at: Date): 'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'|'Sun' { /* ... */ }

    /** Returns the Europe/London-local hour [0..23] at `at`. */
    export function londonHour(at: Date): number { /* ... */ }

    export async function decideBlackout(deps: Deps): Promise<BlackoutDecision> { /* ... */ }

    /** Real-world entrypoint. Wires AWS SDK calls and `process.exit`. */
    async function main(args: string[]): Promise<never> { /* ... */ }

    // Only call main when invoked as a script (not when imported by the test file)
    const isDirectInvocation =
      import.meta.url === `file://${process.argv[1]}` ||
      import.meta.url.endsWith(process.argv[1] ?? '');
    if (isDirectInvocation) {
      void main(process.argv.slice(2));
    }
    ```
  - [ ] Implement `londonIsoDate(at)` using `new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)` — the `en-CA` locale formats dates as `YYYY-MM-DD` natively, avoiding manual parsing. Verify with both a BST date (e.g. `new Date('2026-07-01T22:30:00Z')` → `'2026-07-01'` since BST is UTC+1) and a GMT date (e.g. `new Date('2026-01-15T22:30:00Z')` → `'2026-01-15'`).
  - [ ] Implement `londonWeekday(at)` using `new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short' }).format(at)` (returns `'Mon'`, `'Tue'`, etc.).
  - [ ] Implement `londonHour(at)` using `new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false }).format(at)` and `Number()`-cast the string. Watch out: `hour12: false` returns `'24'` for midnight in some implementations on some engines. Test both `00:00:00` and `23:59:59` boundaries and add a normalisation `% 24` if needed; the unit tests below catch this.
  - [ ] Implement `decideBlackout(deps)`:
    1. `await deps.describeTable()` — catch any error → return `{ exit: 1, stderr: FAIL_CLOSED_MESSAGE, blockingGigs: [] }`
    2. Compute `todayKey = londonIsoDate(deps.now) + '#'` and `tomorrowKey = londonIsoDate(addDays(deps.now, 1)) + '#'` (helper `addDays` adds 24h of milliseconds — be explicit, not a clever date-fns dep)
    3. `await deps.scanGigs(todayKey, tomorrowKey)` — catch any error → fail-closed (same message)
    4. If `gigs.length > 0`: sort by `(date, time ?? '')` ascending and return `{ exit: 1, stderr: gigs.map(formatGig).join('\n'), blockingGigs: gigs }` where `formatGig({gigMeta: {venue, date, time}})` returns `BLOCKED: ${venue} @ ${date}${time ? ' ' + time : ''}`
    5. Otherwise (zero gigs): static fallback. If `londonWeekday(deps.now)` is in `['Fri','Sat','Sun']` AND `londonHour(deps.now)` is in `[18, 23]` (i.e. `>=18 && <24`): return `{ exit: 1, stderr: 'BLOCKED: weekend evening static fallback (...)' , blockingGigs: [] }`
    6. Otherwise: return `{ exit: 0, stdout: 'blackout check passed (no upcoming gigs; outside weekend-evening fallback window)', blockingGigs: [] }`
  - [ ] Implement `main(args)`:
    1. Parse `args` for `--report-only` flag.
    2. Build a real `DynamoDBClient({ region: REGION })`.
    3. `describeTable = () => ddbClient.send(new DescribeTableCommand({ TableName: TABLE_NAME }))` — return value unused; only the throw-or-not matters
    4. `scanGigs = async (todayKey, tomorrowKey) => { /* loop over Scan pages */ }`:
       - Use `ScanCommand` with `TableName: TABLE_NAME`, `IndexName: 'GSI1'`, `FilterExpression: 'gsi1sk BETWEEN :todayKey AND :tomorrowKey'`, `ExpressionAttributeValues: { ':todayKey': { S: todayKey }, ':tomorrowKey': { S: tomorrowKey + 'zzzz' } }` — the trailing `zzzz` extends the upper bound past every possible setlistId NanoID
       - Page via `ExclusiveStartKey` if `LastEvaluatedKey` is set (single-user volume should not paginate, but the loop is cheap)
       - Map each item to `Gig` by reading the `gigMeta` Map attribute and unmarshalling the `venue`, `date`, `time` String attributes (use `@aws-sdk/util-dynamodb`'s `unmarshall` OR a tiny inline reader — both are acceptable; if you pull in `@aws-sdk/util-dynamodb`, add it to `infra/package.json` devDeps the same way Task 1 added the client)
    5. `const decision = await decideBlackout({ now: new Date(), describeTable, scanGigs })`
    6. **If `--report-only`:** instead of exiting with `decision.exit`, write each blocking gig's `gigMeta` (the flat `{venue, date, time?}` shape) as JSON-per-line to stdout (`process.stdout.write(JSON.stringify(g.gigMeta) + '\n')` — NOT `JSON.stringify(g)`, which would emit the nested `{gigMeta: {...}}` wrapper) and `process.exit(0)`. The deploy-force workflow consumes this output via `jq -r .venue`, which expects `venue` at the top level — matching AC-4's contract `{"venue": "...", "date": "...", "time": "..."}`.
    7. **Otherwise:** if `decision.exit === 0`, `process.stdout.write(decision.stdout + '\n')` and `process.exit(0)`. If `decision.exit === 1`, `process.stderr.write(decision.stderr + '\n')` and `process.exit(1)`.
  - [ ] **Anti-scope-creep:** the script must NOT:
    - Touch SSM, CloudFront, S3, Lambda, or any AWS service other than DynamoDB
    - Read or write files outside stdout/stderr
    - Make any HTTPS calls (the upcoming-gigs API endpoint per AR-40 is for client iPhone pre-fetch, not deploy checks; this story uses DDB direct)
    - Take a `BAND_ID` env var — Scan covers all bands; multi-band V2 work happens in V2 stories, not here

- [ ] **Task 3 — Author `infra/scripts/blackout-check.test.ts` covering GMT + BST + all branches** (AC: 2, 6)
  - [ ] Create `infra/scripts/blackout-check.test.ts`. Import `decideBlackout`, `londonIsoDate`, `londonWeekday`, `londonHour` from `./blackout-check.js`.
  - [ ] **Helper builders** at the top of the file:
    ```ts
    const ok = async () => undefined;
    const throwing = async () => { throw new Error('boom'); };
    const empty = async () => [];
    const oneGig = (gig: Gig) => async () => [gig];
    const manyGigs = (gigs: Gig[]) => async () => gigs;
    ```
  - [ ] **Test cases** (organize in `describe` blocks):
    1. `londonIsoDate` returns the BST-local date for a UTC instant just before midnight London time during BST (e.g. `new Date('2026-07-01T22:30:00Z')` → `'2026-07-01'` — BST is UTC+1 so the local clock reads 23:30)
    2. `londonIsoDate` returns the GMT-local date for a UTC instant just before midnight London time in winter (e.g. `new Date('2026-01-15T22:30:00Z')` → `'2026-01-15'` — GMT is UTC+0)
    3. `londonIsoDate` correctly rolls forward across DST transitions (e.g. `new Date('2026-03-29T01:30:00Z')` — clocks spring forward; the date is still `'2026-03-29'` in London but the local hour is 02:30 BST)
    4. `londonWeekday` returns `'Mon'..'Sun'` for `new Date('2026-06-15T12:00:00Z')` and friends — pick one date per weekday over a 7-day span and assert each
    5. `londonHour` returns `0..23` correctly across BST/GMT — pick UTC instants that map to 00, 01, 17, 18, 23 London-local in both seasons
    6. `decideBlackout` returns `exit: 1` with the canonical fail-closed message when `describeTable` throws
    7. `decideBlackout` returns `exit: 1` with the canonical fail-closed message when `scanGigs` throws (after `describeTable` succeeds)
    8. `decideBlackout` with `describeTable: ok`, `scanGigs: empty`, `now: <Tue 10:00 London GMT>` → `exit: 0` and the documented stdout message (covers AC-6)
    9. `decideBlackout` with `describeTable: ok`, `scanGigs: empty`, `now: <Tue 10:00 London BST>` → `exit: 0` (same as above but in BST — proves the static fallback weekend check honors local TZ across DST)
    10. `decideBlackout` with `describeTable: ok`, `scanGigs: empty`, `now: <Fri 18:00 London BST>` → `exit: 1`, stderr starts with `BLOCKED: weekend evening static fallback`
    11. `decideBlackout` with `describeTable: ok`, `scanGigs: empty`, `now: <Fri 19:30 London GMT>` → `exit: 1`, stderr starts with `BLOCKED: weekend evening static fallback`
    12. `decideBlackout` with `describeTable: ok`, `scanGigs: empty`, `now: <Sun 23:30 London GMT>` → `exit: 1`
    13. `decideBlackout` with `describeTable: ok`, `scanGigs: empty`, `now: <Sun 17:59 London BST>` → `exit: 0` (one second below the 18:00 window) — boundary test
    14. `decideBlackout` with `describeTable: ok`, `scanGigs: empty`, `now: <Mon 00:00 London GMT>` → `exit: 0` (midnight Monday is OUT of the weekend window because the rule is Fri/Sat/Sun, not "weekend nights spilling into Mon morning"; if you want to widen later, do it in a follow-up)
    15. `decideBlackout` with `describeTable: ok`, `scanGigs: oneGig({gigMeta:{venue:'The Blue Note', date:'2026-06-15', time:'20:00'}})`, `now: <2026-06-14T10:00:00Z>` → `exit: 1`, stderr is `BLOCKED: The Blue Note @ 2026-06-15 20:00`
    16. `decideBlackout` with two blocking gigs sorted by date ascending — assert stderr contains both, nearest first (sort proof)
    17. `decideBlackout` with a gig whose `gigMeta.time` is `undefined` → stderr formats as `BLOCKED: <venue> @ <date>` (no trailing space, no `undefined`)
  - [ ] **Run the test file** with `pnpm -F infra test`. All cases pass on both your local machine's timezone and on the CI runner (Ubuntu UTC) — the `Intl.DateTimeFormat` calls are timezone-independent of the host, only the `Europe/London` token matters.

- [ ] **Task 4 — Author `.github/workflows/deploy.yml`** (AC: 1, 3)
  - [ ] Create `.github/workflows/deploy.yml`. Pattern matches `.github/workflows/ci.yml` for the install + node setup steps; the rest is new.
  - [ ] Use the existing `pnpm/action-setup@v4` version pin `11.0.9` (same as `ci.yml`) — do NOT bump or change.
  - [ ] Skeleton (this is the literal file; do not paraphrase — every detail is load-bearing):
    ```yaml
    name: deploy

    on:
      push:
        branches: [main]
      workflow_dispatch:

    concurrency:
      # One deploy at a time. A queued deploy that lands after a newer commit is wasted work.
      group: deploy
      cancel-in-progress: false

    permissions:
      id-token: write
      contents: read

    jobs:
      deploy:
        name: deploy main to gig.cormie.com
        runs-on: ubuntu-latest
        timeout-minutes: 20
        steps:
          - uses: actions/checkout@v4

          - uses: aws-actions/configure-aws-credentials@v4
            with:
              role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}
              aws-region: eu-west-2

          - uses: pnpm/action-setup@v4
            with:
              version: 11.0.9

          - uses: actions/setup-node@v4
            with:
              node-version-file: '.nvmrc'
              cache: 'pnpm'

          - run: pnpm install --frozen-lockfile

          - run: pnpm lint

          - run: pnpm typecheck

          - run: pnpm test

          - name: blackout check
            run: pnpm -F infra exec tsx scripts/blackout-check.ts

          - name: cdk diff
            run: pnpm -F infra exec cdk diff --all

          - name: cdk deploy
            run: pnpm -F infra exec cdk deploy --all --require-approval=never

          - name: build SPA
            run: pnpm build:web

          - name: resolve stack outputs
            id: outputs
            run: |
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
              echo "bucket=$BUCKET" >> "$GITHUB_OUTPUT"
              echo "dist_id=$DIST_ID" >> "$GITHUB_OUTPUT"

          - name: upload SPA to S3
            run: aws s3 sync web/dist/ s3://${{ steps.outputs.outputs.bucket }}/ --delete

          - name: CloudFront invalidation
            run: aws cloudfront create-invalidation --distribution-id ${{ steps.outputs.outputs.dist_id }} --paths '/*'

          - name: smoke test API health
            run: |
              STATUS=$(curl -fsS -o /tmp/health.json -w '%{http_code}' https://gig.cormie.com/api/v1/health)
              echo "status: $STATUS"
              test "$STATUS" = "200"
              grep -q '"status":"ok"' /tmp/health.json

          - name: smoke test SPA index
            run: |
              STATUS=$(curl -fsS -D /tmp/index.headers -o /tmp/index.html -w '%{http_code}' https://gig.cormie.com/index.html)
              echo "status: $STATUS"
              test "$STATUS" = "200"
              grep -iE '^via:.*cloudfront' /tmp/index.headers
    ```
  - [ ] **Why `concurrency: group: deploy, cancel-in-progress: false`:** the deploy workflow takes ~8 min; back-to-back merges to main should serialize, not run in parallel (parallel `cdk deploy` against the same stacks corrupts CloudFormation state). `cancel-in-progress: false` because cancelling a partially-deployed run leaves the infrastructure in a worse state than letting it finish.
  - [ ] **Why no `cdk diff` `|| true`:** if `cdk diff` itself errors (CFN access denied, network failure), we want the deploy to fail before `cdk deploy` runs — a `cdk deploy` that proceeds without a successful diff is operating blind.
  - [ ] **Why `--require-approval=never`:** CI cannot answer interactive prompts; the bootstrap runbook captures the security trade-off explicitly. The pre-existing `infra/runbooks/bootstrap.md` Section 4 warning carries forward — Sandy's first deploy goes through bootstrap-user step-by-step; subsequent CI-driven deploys accept the auto-approval.

- [ ] **Task 5 — Author `.github/workflows/deploy-force.yml`** (AC: 4)
  - [ ] Create `.github/workflows/deploy-force.yml`. Two-job workflow: `enumerate` reports blocking gigs and validates venueConfirmation; `deploy` runs the rest if enumerate succeeds.
  - [ ] Skeleton:
    ```yaml
    name: deploy-force

    on:
      workflow_dispatch:
        inputs:
          reason:
            description: 'Why this override is needed'
            required: true
            type: string
          venueConfirmation:
            description: 'Type the venue name of the nearest blocking Gig (leave blank if none)'
            required: false
            type: string
            default: ''

    concurrency:
      group: deploy
      cancel-in-progress: false

    permissions:
      id-token: write
      contents: read

    jobs:
      enumerate:
        name: enumerate blocking gigs and validate venue confirmation
        runs-on: ubuntu-latest
        timeout-minutes: 5
        outputs:
          blocking_gigs: ${{ steps.enumerate.outputs.blocking_gigs }}
        steps:
          - uses: actions/checkout@v4
          - uses: aws-actions/configure-aws-credentials@v4
            with:
              role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}
              aws-region: eu-west-2
          - uses: pnpm/action-setup@v4
            with:
              version: 11.0.9
          - uses: actions/setup-node@v4
            with:
              node-version-file: '.nvmrc'
              cache: 'pnpm'
          - run: pnpm install --frozen-lockfile
          - id: enumerate
            name: enumerate blocking gigs (report-only mode)
            run: |
              OUTPUT=$(pnpm -F infra --silent exec tsx scripts/blackout-check.ts --report-only)
              echo "$OUTPUT"
              # multiline output handling per GitHub docs
              {
                echo 'blocking_gigs<<EOF'
                echo "$OUTPUT"
                echo EOF
              } >> "$GITHUB_OUTPUT"
          - name: validate venue confirmation if blocking gigs exist
            env:
              VENUE_INPUT: ${{ inputs.venueConfirmation }}
              BLOCKING: ${{ steps.enumerate.outputs.blocking_gigs }}
            run: |
              if [ -z "$BLOCKING" ]; then
                echo "no blocking gigs; venue confirmation not required"
                exit 0
              fi
              FIRST_VENUE=$(echo "$BLOCKING" | head -n 1 | jq -r .venue)
              echo "nearest blocking venue: $FIRST_VENUE"
              if [ "$VENUE_INPUT" != "$FIRST_VENUE" ]; then
                echo "venue confirmation does not match the nearest blocking Gig; aborting force-deploy" >&2
                exit 1
              fi
          - name: audit log to GH summary
            env:
              REASON: ${{ inputs.reason }}
              VENUE_INPUT: ${{ inputs.venueConfirmation }}
              BLOCKING: ${{ steps.enumerate.outputs.blocking_gigs }}
            run: |
              {
                echo "## deploy-force audit"
                echo ""
                echo "- run id: ${{ github.run_id }}"
                echo "- actor: ${{ github.actor }}"
                echo "- reason: $REASON"
                echo "- venueConfirmation: $VENUE_INPUT"
                echo ""
                echo "### blocking gigs at deploy time"
                echo ""
                echo '```'
                echo "$BLOCKING"
                echo '```'
              } >> "$GITHUB_STEP_SUMMARY"
          - name: audit log to CloudWatch
            env:
              REASON: ${{ inputs.reason }}
              VENUE_INPUT: ${{ inputs.venueConfirmation }}
              BLOCKING: ${{ steps.enumerate.outputs.blocking_gigs }}
            run: |
              aws logs create-log-group --log-group-name /gigbuddy/deploy-force --region eu-west-2 2>/dev/null || true
              aws logs create-log-stream --log-group-name /gigbuddy/deploy-force --log-stream-name ${{ github.run_id }} --region eu-west-2
              TIMESTAMP=$(( $(date +%s) * 1000 ))
              # Build a JSON event payload via jq to ensure proper escaping
              MESSAGE=$(jq -n \
                --arg runId "${{ github.run_id }}" \
                --arg actor "${{ github.actor }}" \
                --arg reason "$REASON" \
                --arg venueConfirmation "$VENUE_INPUT" \
                --arg blockingGigs "$BLOCKING" \
                '{event:"deploy-force",runId:$runId,actor:$actor,reason:$reason,venueConfirmation:$venueConfirmation,blockingGigs:$blockingGigs}')
              aws logs put-log-events \
                --log-group-name /gigbuddy/deploy-force \
                --log-stream-name ${{ github.run_id }} \
                --log-events "timestamp=$TIMESTAMP,message=$MESSAGE" \
                --region eu-west-2

      deploy:
        name: deploy main to gig.cormie.com (force, blackout skipped)
        runs-on: ubuntu-latest
        needs: enumerate
        timeout-minutes: 20
        steps:
          - uses: actions/checkout@v4
          - uses: aws-actions/configure-aws-credentials@v4
            with:
              role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}
              aws-region: eu-west-2
          - uses: pnpm/action-setup@v4
            with:
              version: 11.0.9
          - uses: actions/setup-node@v4
            with:
              node-version-file: '.nvmrc'
              cache: 'pnpm'
          - run: pnpm install --frozen-lockfile
          - run: pnpm lint
          - run: pnpm typecheck
          - run: pnpm test
          # Blackout check intentionally OMITTED — that's the whole point of this workflow.
          - run: pnpm -F infra exec cdk diff --all
          - run: pnpm -F infra exec cdk deploy --all --require-approval=never
          - run: pnpm build:web
          - id: outputs
            name: resolve stack outputs
            run: |
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
              echo "bucket=$BUCKET" >> "$GITHUB_OUTPUT"
              echo "dist_id=$DIST_ID" >> "$GITHUB_OUTPUT"
          - run: aws s3 sync web/dist/ s3://${{ steps.outputs.outputs.bucket }}/ --delete
          - run: aws cloudfront create-invalidation --distribution-id ${{ steps.outputs.outputs.dist_id }} --paths '/*'
          - name: smoke test API health
            run: |
              STATUS=$(curl -fsS -o /tmp/health.json -w '%{http_code}' https://gig.cormie.com/api/v1/health)
              test "$STATUS" = "200"
              grep -q '"status":"ok"' /tmp/health.json
          - name: smoke test SPA index
            run: |
              STATUS=$(curl -fsS -D /tmp/index.headers -o /tmp/index.html -w '%{http_code}' https://gig.cormie.com/index.html)
              test "$STATUS" = "200"
              grep -iE '^via:.*cloudfront' /tmp/index.headers
    ```
  - [ ] **Concurrency group is the same as `deploy.yml`** (`group: deploy`) so a force-deploy and a normal deploy queue against each other rather than racing.
  - [ ] **`jq` is preinstalled on `ubuntu-latest` runners** — no setup step needed. If the runner image ever drops `jq`, install with `apt-get install -y jq` in a step (defer until needed).
  - [ ] **The `--silent` flag on `pnpm -F infra --silent exec tsx ...`** suppresses pnpm's lifecycle output so `$OUTPUT` captures only the script's stdout (the JSON-per-line blocking-gigs report). Test locally before relying.
  - [ ] **The CloudWatch log group `/gigbuddy/deploy-force` is created lazily by this workflow on first run** (`aws logs create-log-group ... || true`). It is NOT created by the CDK observability-stack — keeping log-group creation out of CDK avoids a stack that mutates state on every deploy.

- [ ] **Task 6 — Verify the deploy role can write to `/gigbuddy/deploy-force` CloudWatch log group** (AC: 4)
  - [ ] The `gigbuddy-deploy-role` (ci-stack.ts) does NOT currently grant `logs:CreateLogGroup`, `logs:CreateLogStream`, or `logs:PutLogEvents`. Add a scoped policy statement to `infra/lib/stacks/ci-stack.ts`:
    ```ts
    // CloudWatch Logs: audit log for deploy-force overrides. Scoped to /gigbuddy/deploy-force only.
    this.deployRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [
          `arn:aws:logs:${this.region}:${this.account}:log-group:/gigbuddy/deploy-force`,
          `arn:aws:logs:${this.region}:${this.account}:log-group:/gigbuddy/deploy-force:*`,
        ],
      }),
    );
    ```
    The two-resource ARN pattern is required by `PutLogEvents`, which expects the `:log-stream:*` sub-resource form, while `CreateLogGroup` operates on the unsuffixed log-group ARN.
  - [ ] Extend `ci-stack.test.ts` with an assertion that the policy includes `logs:PutLogEvents` on the `/gigbuddy/deploy-force` ARN pattern.
  - [ ] **Do NOT broaden to `logs:*` on `*`** — the deploy role intentionally cannot read/tamper with Lambda's own log group `/aws/lambda/gigbuddy-api`. That's the operator's read surface, not the deploy pipeline's.

- [ ] **Task 7 — Amend `infra/runbooks/bootstrap.md` with OIDC-handoff GitHub config steps + emergency section** (AC: 5, 7)
  - [ ] Open `infra/runbooks/bootstrap.md`. Replace the existing Section 7 ("OIDC hand-off") with an expanded version that documents the post-bootstrap GitHub repo configuration:
    - The `DeployRoleArn` CFN output value goes into a **GitHub repository variable** (Settings → Secrets and variables → Actions → Variables → "New repository variable") named **exactly** `AWS_DEPLOY_ROLE_ARN` (case sensitive — the workflows reference `vars.AWS_DEPLOY_ROLE_ARN`)
    - Why a variable, not a secret: ARNs are not sensitive; using a variable means the value appears in workflow logs (visible only to repo collaborators) which aids diagnosis. Secrets are masked in logs.
    - Branch protection for `main`: Settings → Branches → Branch protection rules → "Add branch protection rule" → branch name pattern `main` → check "Require status checks to pass before merging" → required check: `lint + typecheck + test` (the value of the `jobs.verify.name` field in `ci.yml` — GitHub branch protection keys on the job's display name, not the workflow name `ci` and not the job key `verify`; the picker autocompletes from check-run history once `ci.yml` has run at least once on `main`) → check "Require a pull request before merging" with `Required approvals = 0` → save
    - Verification: open a draft PR with a one-character README change; the PR's "Checks" tab shows `lint + typecheck + test` as required and the merge button is disabled until it passes
  - [ ] Add a new Section 9 ("Emergency: deploy-force.yml") immediately after the existing Section 8:
    - When to use it: gig less than 24h away but a deploy MUST proceed (security hotfix, customer-blocking outage). Default answer is "wait until after the gig" — this workflow is for the cases where waiting is not an option.
    - The two inputs (`reason`, `venueConfirmation`) — `reason` is free text, `venueConfirmation` must match the venue of the nearest blocking Gig exactly. The first job's log shows the blocking-gigs JSON output; copy the `venue` field value verbatim into the `venueConfirmation` input.
    - Audit trail: `$GITHUB_STEP_SUMMARY` is captured per run (visible in GH Actions UI for 90 days by default). CloudWatch log group `/gigbuddy/deploy-force` retains entries indefinitely (no retention configured — accept this for V1; a future story can wire a 365-day retention policy if log volume becomes a concern).
    - **Do NOT bypass the workflow** by running `pnpm -F infra exec cdk deploy` locally with the bootstrap-user credentials. The OIDC role is the only legitimate CI deploy path post-bootstrap. The bootstrap-user is for cdk bootstrap and emergency break-glass only.
  - [ ] Voice & tone: matches the existing runbook (terse, numbered, copy-pasteable; no exclamation marks; no marketing voice). Per UX-DR7 and the existing runbook's style.

- [ ] **Task 8 — Verification pass** (AC: 1-7)
  - [ ] `pnpm typecheck` green across all packages (the new TS file `infra/scripts/blackout-check.ts` is picked up by `infra/tsconfig.json`'s `include` if it covers `scripts/**` — verify; if not, extend `include` to `['bin/**/*', 'lib/**/*', 'scripts/**/*']` and re-run typecheck. The biome `files.includes` block in `biome.json` similarly does NOT list `infra/scripts/**` — extend to include it so lint runs against the new file).
  - [ ] `pnpm lint` green. Biome will format the new files automatically with `pnpm lint:fix` if needed.
  - [ ] `pnpm test` green. The 17-case `blackout-check.test.ts` adds ~17 tests to `infra/`'s suite (currently 30; should be ~47 post-story plus the +2 from ci-stack.test.ts additions).
  - [ ] `pnpm -F infra run synth` (full CDK synth) succeeds; the ci-stack `.template.json` now contains `dynamodb:Scan` AND `logs:PutLogEvents` policy statements; diff against pre-story output.
  - [ ] `pnpm -F infra exec tsx scripts/blackout-check.ts` runs locally **without AWS credentials**: expects the SDK to throw on `DescribeTable` (no creds → `CredentialsProviderError`); the fail-closed path triggers and the script exits 1 with the canonical message. Captures both that the wiring is correct and that the SDK error handling is robust.
  - [ ] **GitHub Actions execution proof (deferred to Sandy):**
    - Sandy populates the `AWS_DEPLOY_ROLE_ARN` repo variable per the bootstrap runbook amendment
    - Sandy configures branch protection per AC-5 / runbook
    - Sandy merges the Story 1.6 PR to `main`; `deploy.yml` runs end-to-end; verify all 16 steps succeed and the live site at `https://gig.cormie.com/` serves the new SPA bundle
    - Sandy manually triggers `deploy-force.yml` with `reason: 'test override'` and `venueConfirmation: ''` (empty); verify enumerate step succeeds with zero blocking gigs and the deploy job proceeds
    - Capture run URLs in the Dev Agent Record
  - [ ] **Do NOT** add a workflow_dispatch in `ci.yml` for "test deploy on PR" — the deploy is `main`-only by AR-31's OIDC sub constraint, and adding a PR-trigger would either fail at credential-assume time (good — proves the constraint works) or require widening the trust policy (bad — defeats AR-31). Leave PR-time validation to `ci.yml`'s lint/typecheck/test only.

- [ ] **Task 9 — Resolve the deferred-work entry "Function URL unprotected during bootstrap deploy window"** (AC: 7)
  - [ ] The 1.3 review left this entry in `_bmad-output/implementation-artifacts/deferred-work.md` (line 15): "Function URL unprotected during bootstrap deploy window — short window between GigbuddyApi and GigbuddyWeb deploys; no secrets exposed until Story 1.4. Document the window in bootstrap.md."
  - [ ] In `infra/runbooks/bootstrap.md` Section 4 ("First deploy"), add a one-paragraph note explaining: "Between the `GigbuddyApi` and `GigbuddyWeb` deploys, the Lambda Function URL is reachable directly (no `SourceArn` lock yet — that's added by `GigbuddyWeb`). The window is short (a few minutes) and pre-dates any secret material in the Lambda (Story 1.4 wires SSM secrets). If you are bootstrapping for the first time, this is acceptable; if you are tearing down and rebuilding mid-flight after Story 1.4 has shipped, deploy `GigbuddyWeb` immediately after `GigbuddyApi` to minimise the window."
  - [ ] In `deferred-work.md`, strike through the entry (`~~...~~`) and append `**Resolved in Story 1.6 (Task 9)** — bootstrap-window risk documented in bootstrap.md Section 4.`

## Dev Notes

### Architecture compliance (the contract you must follow)

**Source of truth:** `_bmad-output/planning-artifacts/architecture.md`. Patterns are the contract; deviations require updating that document, not the implementation (line 471).

This story implements architecture Decision 6 (Deploy Automation + Gig-Window Blackout, lines 388–426) end-to-end. The CDK side of the deploy infrastructure (ci-stack OIDC role, IAM permissions) was authored in Story 1.3; this story authors the GitHub Actions workflows and the blackout-check script that consume that infrastructure.

**Hard rules from the architecture:**

- AR-29 (line 163): GitHub Actions pipeline with **two-stage blackout check (fail-closed on any infra error)**. Stage 1 `DescribeTable`; Stage 2 query upcoming Gigs within 24h Europe/London. Zero records → static fallback (Fri–Sun 18:00–24:00). Script lives at `infra/scripts/blackout-check.ts`. Named TZ `Europe/London`.
- AR-30 (line 165): Manual override workflow (`deploy-force.yml`) with `workflow_dispatch`, required `reason`, AND venue-name typing as second confirmation when blocking Gigs exist within 24h. Logged.
- AR-31 (line 166): OIDC trust policy scoped to `repo:<owner>/gigbuddy:ref:refs/heads/main` — PR runners cannot assume the deploy role. **No long-lived AWS keys anywhere.**
- AR-46 (line 187): No Redux/Zustand/Jotai/analytics SDK. (Not directly relevant to this story but a reminder for any tool selection.)
- NFR-6 (line 84): "Routine maintenance — deploys, patches, cert renewals, dependency updates — must not be scheduled within 24h of any future Gig recorded in the system. Deploy automation enforces this by querying upcoming Gig dates at deploy time and blocking if any falls within the window. Static fallback when no Gig data is available: avoid Friday–Sunday 18:00–24:00 local."

**Patterns to reuse:**

- **State management taxonomy** (architecture lines 718–729): not directly relevant — no client-side state in this story.
- **Naming conventions** (architecture lines 473–495):
  - Files kebab-case (`blackout-check.ts`, `deploy.yml`, `deploy-force.yml`).
  - Identifiers `camelCase` (`decideBlackout`, `scanGigs`, `londonIsoDate`), `PascalCase` (`BlackoutDecision`, `Deps`, `Gig`), `SCREAMING_SNAKE_CASE` for module-level constants (`TABLE_NAME`, `REGION`, `FAIL_CLOSED_MESSAGE`).
  - DDB key prefixes `SCREAMING_SNAKE_CASE` with `#` separator: `BAND#<bandId>#SETLIST_BY_DATE` (GSI1 partition key), `<isoDate>#<setlistId>` (GSI1 sort key).
- **Testing patterns** (architecture lines 769–778): Vitest for unit tests, co-located `*.test.ts` next to source, no snapshot tests. Use `aws-cdk-lib/assertions` for the ci-stack policy assertions (Task 1, Task 6).
- **GSI1 key shape** (architecture line 224, Decision 2 line 213): `gsi1pk = BAND#<bandId>#SETLIST_BY_DATE`, `gsi1sk = <isoDate>#<setlistId>`. The blackout script's BETWEEN filter uses `<isoDate>#` as the lower bound and `<tomorrowIsoDate>#zzzz` as the upper bound (the `zzzz` extends past every possible NanoID — NanoIDs use the URL-safe alphabet `[A-Za-z0-9_-]`, all of which sort below `z`). This is a Scan-with-FilterExpression because GSI1 has many partition keys (one per band); a Query would need a partition key value.

**Boundaries (CLAUDE.md §Boundaries, architecture.md lines 1017–1027):**

- `infra` ↔ runtime: env vars passed from CDK. The blackout-check script is **part of `infra/`**, not `api/`. It accesses DDB directly via the AWS SDK (this is allowed for infra-side scripts). The `api/src/ddb/*` wrapper rule (AR-42) applies to the Lambda runtime, not deploy-time scripts.
- `e2e` ↔ rest: not touched.
- The blackout-check script does NOT import from `api/`, `web/`, or `shared/`. It is standalone.
- `.github/workflows/deploy.yml` and `deploy-force.yml` are top-level repo files (not in `infra/`). They invoke commands inside the packages via `pnpm -F infra exec ...`.

### Library and framework requirements (do NOT substitute)

- **AWS SDK v3 (`@aws-sdk/client-dynamodb`)** — devDependency of `infra/`. Match the `^3.658.0` major version pin used by `api/src/secrets/ssm.ts` (`@aws-sdk/client-ssm@^3.658.0`). Do NOT use the SDK v2 (`aws-sdk` namespace) — it's in maintenance mode and not used anywhere else in the repo.
- **`tsx` (already present in `infra/devDependencies`)** — the script runs via `tsx`, no compilation step needed. The workflow invokes it as `pnpm -F infra exec tsx scripts/blackout-check.ts`.
- **Native `Intl.DateTimeFormat`** for timezone math — no date library (no `date-fns`, no `luxon`, no `dayjs`). Node 22 ships ICU data covering Europe/London BST + GMT transitions reliably. Adding a date library to handle one timezone is over-engineering.
- **GitHub Actions runner image: `ubuntu-latest`** — preinstalled binaries include `aws-cli/2.x`, `curl`, `jq`, `grep`, `sed`, `head`, `tail`. No `apt-get install` needed for this story.
- **`pnpm/action-setup@v4` pinned to `11.0.9`** — matches the existing `ci.yml` (line 17 of `.github/workflows/ci.yml`). Do not bump.
- **`actions/setup-node@v4` with `node-version-file: '.nvmrc'`** — `.nvmrc` declares `22`, matching `package.json` engines.
- **`aws-actions/configure-aws-credentials@v4`** — the modern OIDC-aware version. The `role-to-assume` input reads from `vars.AWS_DEPLOY_ROLE_ARN`. Region: `eu-west-2` (matches everywhere else in the repo).

### What this story does NOT include (anti-scope-creep)

These appear nearby in the architecture/epics but are owned by later stories. **Do not scaffold:**

- **`api/src/routes/upcoming-gigs.ts`** (AR-40) — owned by Story 4.5 (backgrounding survives Tonight gig pre-fetch). The blackout-check script accesses DDB directly via the IAM-scoped deploy role; the client-facing upcoming-gigs API is a separate endpoint serving iPhone foreground pre-fetch.
- **A "multi-band registry" item or Scan over BAND# items** — architecture explicitly defers multi-band to V2 (lines 254–260). Scan-on-GSI1 sidesteps the band-enumeration problem entirely (GSI1 only contains setlist records, indexed by date — all bands' setlists land in one Scan).
- **Eager `dynamodb-local` integration tests** — out of scope. The decision-logic unit tests with injected `scanGigs` and `describeTable` callables cover the same surface without the operational overhead.
- **Smoke tests against the deployed login flow** (Story 1.4 surface area) — the `curl /api/v1/health` + `curl /index.html` checks are sufficient for AC-3. Login-flow smoke tests are deferred to Story 5.1 / 5.2 (export and verified-restore drill).
- **CloudFront real-time logging** — architecture mentions CloudFront access logs 30-day retention is "(if used)" — currently not used. Story 1.6 does NOT turn on access logs. Future story can.
- **A "test deploy from PR" path** — AR-31's OIDC `sub` constraint is the contract. PR runners cannot assume the deploy role. This is by design.
- **A "deploy to staging" workflow** — V1 has one environment (Sandy's personal AWS account). Staging is a V2 concern; no staging workflow ships in this story.
- **AWS Backup retention adjustments, log group retention adjustments, or any CDK changes beyond the two scoped ci-stack additions** — Tasks 1 and 6 are the only CDK touches in this story. Don't touch the data-stack, api-stack, web-stack, or observability-stack code.
- **A blackout-check API endpoint for the iPhone PWA** — the iPhone's gig-window awareness is via its own client-side pre-fetch logic (Story 4.5 + AR-40), independent of CI's deploy-time check.
- **Workflow re-runs from main → branch protection bypass paths** — branch protection is configured in GitHub UI per AC-5; the workflow files do not attempt to enforce it programmatically.

If you find yourself wanting to scaffold any of the above, **don't**. The respective stories carry the ACs that will land them correctly.

### Existing files this story modifies — current state and what changes

#### `infra/lib/stacks/ci-stack.ts` (Tasks 1, 6 — extend deploy-role permissions)

**Current state (post-Story 1.3):** Creates the GitHub OIDC provider, the `gigbuddy-deploy-role` with the `repo:<owner>/gigbuddy:ref:refs/heads/main` sub constraint, and ten policy statements covering CloudFormation/S3/CloudFront/DynamoDB/SSM/IAM/Lambda. DynamoDB policy currently grants `dynamodb:Query` + `dynamodb:DescribeTable`.

**This story changes:**
1. Extends the DynamoDB policy statement to include `dynamodb:Scan` (Task 1).
2. Adds a new policy statement granting `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` on `/gigbuddy/deploy-force` log group ARN pattern only (Task 6).

**Must preserve:**
- The OIDC provider `Url` and `clientIds` (`token.actions.githubusercontent.com`, `sts.amazonaws.com`)
- The role's `assumedBy` FederatedPrincipal trust policy and its sub constraint (AR-31)
- All ten existing policy statements unchanged
- The CfnOutput `DeployRoleArn`

#### `infra/lib/stacks/ci-stack.test.ts` (Tasks 1, 6 — add assertions for the new permissions)

**Current state:** Four tests covering OIDC provider creation, role + sub constraint, no static credentials, CloudFormation scoping (the CloudFormation-scoping test sits at lines 56–68 — that range is unchanged by this story).

**This story changes:** Add two tests — one asserting `dynamodb:Scan` is in the actions for the table-scoped statement (Task 1), one asserting `logs:PutLogEvents` is in the actions on the `/gigbuddy/deploy-force` ARN (Task 6).

**Must preserve:** All five existing test cases. Naming and structure follow the existing pattern (use `Match.objectLike` / `Match.arrayWith`).

#### `infra/package.json` (Task 1 — add @aws-sdk/client-dynamodb)

**Current state:** Devdeps include `aws-cdk-lib`, `@types/node`, `aws-cdk`, `esbuild`, `tsx`, `typescript`, `vitest`. No AWS SDK v3 clients.

**This story changes:** Add `@aws-sdk/client-dynamodb` (`^3.658.0` to match the api package's SDK version family) to `devDependencies`.

**Must preserve:** All existing entries. Lockfile must be updated via `pnpm install` from the repo root.

#### `infra/tsconfig.json` and root `biome.json` (Task 8 — include `infra/scripts/**`)

**Current state:**
- `infra/tsconfig.json` `include`: `['bin/**/*', 'lib/**/*']` — `scripts/**` is NOT included
- `biome.json` `files.includes`: `['web/src/**', 'api/src/**', 'shared/src/**', 'infra/bin/**', 'infra/lib/**', 'e2e/**', ...]` — `infra/scripts/**` is NOT included

**This story changes:**
- `infra/tsconfig.json` `include` → `['bin/**/*', 'lib/**/*', 'scripts/**/*']`
- `biome.json` `files.includes` → add `'infra/scripts/**'` after `'infra/lib/**'`

**Must preserve:** All other configuration. Both files are touched additively only.

#### `infra/runbooks/bootstrap.md` (Tasks 7, 9 — amend Sections 4 + 7, add Section 9)

**Current state:** Sections 0–8 covering prereqs, bootstrap-user, cdk.context.json, cdk bootstrap, SSM seed, first deploy, SPA upload, smoke tests, OIDC hand-off, post-Story-1.4 access-gate verification.

**This story changes:**
- Section 4: add a paragraph about the api/web Function URL lock bootstrap window (Task 9)
- Section 7: expand to include GitHub repository variable creation (`AWS_DEPLOY_ROLE_ARN`) and branch protection rule configuration (Task 7)
- New Section 9: emergency `deploy-force.yml` usage (Task 7)

**Must preserve:** Sections 0, 1, 2, 3, 5, 6, 8 unchanged. Voice & tone unchanged (terse, numbered, no exclamations).

#### `_bmad-output/implementation-artifacts/deferred-work.md` (Task 9 — strike + mark resolved)

**Current state:** Lists the "Function URL unprotected during bootstrap deploy window" entry in the Story 1.3 review section (line 15).

**This story changes:** Strike through the entry and append `**Resolved in Story 1.6 (Task 9)** — bootstrap-window risk documented in bootstrap.md Section 4.`

**Must preserve:** All other entries, including the still-open Story 1.5 entries.

### Existing files this story DOES NOT touch (regression safety)

- `infra/lib/stacks/data-stack.ts`, `api-stack.ts`, `web-stack.ts`, `web-cert-stack.ts`, `observability-stack.ts` — entirely unchanged. The blackout script consumes DDB read-only via IAM; no infra resources change shape.
- `infra/bin/gigbuddy.ts` — unchanged. Stack composition is set; the new script is invoked outside the CDK app.
- `infra/cdk.context.json` — unchanged. Context values from Story 1.3 carry forward.
- `api/`, `web/`, `shared/`, `e2e/` — entirely unchanged. This is an `infra/` + `.github/` + runbook story.
- `.github/workflows/ci.yml` — unchanged. Branch protection enforcement is GitHub UI configuration (manual), not a workflow file change.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — updated at story-close time by the dev-story workflow to flip the entry to `review` (don't pre-flip).

### Previous story intelligence (1.5 + 1.4 + 1.3 learnings)

From **Story 1.5** (working tree at story-write time; commit pending):

- The Story 1.5 manual smoke verified `pnpm dev:web` at `http://localhost:5273/`. Production smoke at `https://gig.cormie.com/` (this story's deploy target) is the next-level integration.
- Story 1.5 left three deferred items (deferred-work.md lines 30–32); none are in scope for 1.6.
- The Setlists home route renders an empty state in V1; the deploy workflow does NOT need to seed data — it just deploys the same empty-state app.

From **Story 1.4** (commit `7384bc6`):

- `daysUntilExpiry`-banner is MacBook-only (silent on iPhone in Performance Mode). Not directly relevant to deploy-time concerns.
- The 1.4 review left several deferred items (deferred-work.md lines 19–26); none are in scope for 1.6.

From **Story 1.3** (commit `26ddf8b`):

- **Cross-region references with `crossRegionReferences: true` are set on each stack, not the App** (1.3 Completion Notes deviation #2). The blackout-check script does NOT touch cross-region resources; it queries one DDB table in `eu-west-2`. No cross-region concern here.
- **`@aws-sdk/client-dynamodb` is NOT yet a dependency anywhere in the repo.** `api/` uses `@aws-sdk/client-ssm` (1.4). Task 1 adds `@aws-sdk/client-dynamodb` to `infra/devDependencies` for the first time.
- **`infra/tsconfig.json` sets `exactOptionalPropertyTypes: false`** (1.3 deviation #1) because CDK 2.x types don't honor it. The blackout-check script lives in `infra/` and benefits from this relaxation (no need to defensively widen `time?: string` reads).
- **The 1.3 ci-stack already grants `dynamodb:Query`, `dynamodb:DescribeTable` on the table + GSI1 ARN.** Task 1's `dynamodb:Scan` addition extends this in-place, same statement.
- **The deploy role's `s3:*` actions are scoped to bucket name prefix `gigbuddyweb-*`** (1.3 Completion Notes) — the S3 sync step in the workflow targets the bucket name resolved from CFN outputs at deploy time. No code change needed.
- **The deploy role has `cloudfront:CreateInvalidation` on `*`** (1.3 Completion Notes — stack-cycle prevented narrowing). The CloudFront invalidation step references the distribution ID from CFN outputs; the wildcard scope is acceptable.
- **The deploy role has `cloudformation:DescribeStacks` on `CDKToolkit/*`** (1.3 review patch finding) — this is what makes `aws cloudformation describe-stacks --stack-name GigbuddyWeb` work from the workflow.

From **Story 1.1** (commit `d5dcbab`):

- **`pnpm test` filters out `e2e`** (`"test": "pnpm --filter \"!e2e\" -r run test"` in root `package.json`). The new `blackout-check.test.ts` lives in `infra/`, so it IS picked up by `pnpm test`.
- **Biome 2.4.16** with `!**/dist` ignore syntax. New files in `infra/scripts/` will need `infra/scripts/**` added to `biome.json` `files.includes` (Task 8).

### Implementation patterns reused from architecture

- **GSI1 key shape** (architecture line 224, Decision 2): `gsi1pk = BAND#<bandId>#SETLIST_BY_DATE`, `gsi1sk = <isoDate>#<setlistId>`. The blackout script uses `gsi1sk BETWEEN :todayKey AND :tomorrowKey` where keys are `<isoDate>#`.
- **Setlist item shape** (architecture line 215): `gigMeta: { venue, date, time }`. The script reads these three fields from each blocking-gig item.
- **Naming conventions** (architecture lines 473–495): file kebab-case, identifier camelCase/PascalCase/SCREAMING_SNAKE_CASE per role.
- **No analytics SDK / no Sentry** (NFR-16, AR-46): the deploy-force audit log goes to CloudWatch via raw `aws logs put-log-events`, not a third-party SaaS.
- **OIDC trust scope** (AR-31, ci-stack.ts:35): `repo:<owner>/gigbuddy:ref:refs/heads/main`. The workflows in this story rely on this constraint — they cannot run on PR refs because the credential exchange would fail. This is by design; do not work around it.
- **Pre-mortem outcomes table** (architecture lines 432–446) — three rows are directly relevant:
  - "Blackout check fails-open on IAM/network errors" → Two-stage check; any infra error fails the deploy
  - "Manual --force override misused as path of least resistance" → Workflow enumerates blocking Gigs and requires typing venue name as second confirmation
  - "SW auto-updates mid-gig" → `skipWaiting: false` + §A.2 deploy blackout (belt and braces) — Story 1.6 IS the §A.2 deploy blackout layer.

### Latest tech information (versions verified at story-write time, 2026-06-12)

- **AWS SDK v3 (`@aws-sdk/client-dynamodb`@^3.658.0)** — `DescribeTableCommand` and `ScanCommand` are the canonical imports. The `Scan` command's `IndexName` parameter targets GSI1. `FilterExpression` with `BETWEEN` and `ExpressionAttributeValues` is the documented pattern. The SDK throws subclasses of `Error` for client/server errors (`ResourceNotFoundException`, `AccessDeniedException`, etc.) — all caught by `try/catch` around the `await ddbClient.send(...)` call.
- **`@aws-sdk/util-dynamodb` (optional)** — if you choose to use `unmarshall` from this package, it converts a DDB AttributeValue Map into a plain JS object. Worth pulling in for the gig parsing if the inline reader gets messy; otherwise skip and parse inline (Map → `gigMeta.M.venue.S`, etc.). Both are acceptable.
- **`Intl.DateTimeFormat` BST handling** — Node 22 LTS (the target runtime) ships full-ICU by default and correctly handles BST/GMT transitions. The `2026-03-29` and `2026-10-25` DST boundary dates (last Sunday in March / October) are the right edge-case test inputs.
- **GitHub Actions OIDC + `aws-actions/configure-aws-credentials@v4`** — the modern pattern. The action automatically constructs the `AssumeRoleWithWebIdentity` call using the GH OIDC token. No need to set `audience` explicitly (the default `sts.amazonaws.com` matches our trust policy).
- **`pnpm/action-setup@v4` @ `version: 11.0.9`** — pinned in `ci.yml`; reuse the same pin.
- **`actions/setup-node@v4`** — supports `node-version-file: '.nvmrc'` (reads from `/.nvmrc`); `cache: 'pnpm'` enables pnpm dependency caching.
- **CloudFront `Via` header** — CloudFront injects a `Via: 1.1 <id>.cloudfront.net (CloudFront)` response header on every response it serves, regardless of cache policy or origin. The smoke test's `grep -iE '^via:.*cloudfront'` proves the SPA was served through the CDN. The `CachingOptimized` cache policy (web-stack.ts:75) governs cache-key behavior, NOT response headers — and S3 origin objects have no `Cache-Control` set by default (the deploy workflow's `aws s3 sync` does not pass `--cache-control`), so `Via` is the only reliable CDN-in-path proof available without a Response Headers Policy.

### Files this story creates

- `infra/scripts/blackout-check.ts` — two-stage fail-closed blackout check (Task 2)
- `infra/scripts/blackout-check.test.ts` — Vitest unit tests covering GMT + BST + all decision branches (Task 3)
- `.github/workflows/deploy.yml` — main deploy pipeline (Task 4)
- `.github/workflows/deploy-force.yml` — manual override workflow (Task 5)

### Files this story modifies

- `infra/lib/stacks/ci-stack.ts` — extend DDB policy with `Scan` (Task 1); add CloudWatch Logs policy for deploy-force audit (Task 6)
- `infra/lib/stacks/ci-stack.test.ts` — add assertions for both new permissions (Tasks 1, 6)
- `infra/package.json` — add `@aws-sdk/client-dynamodb` devDependency (Task 1)
- `infra/tsconfig.json` — extend `include` to cover `scripts/**/*` (Task 8)
- `biome.json` — extend `files.includes` to cover `infra/scripts/**` (Task 8)
- `infra/runbooks/bootstrap.md` — amend Sections 4 + 7, add Section 9 (Tasks 7, 9)
- `_bmad-output/implementation-artifacts/deferred-work.md` — strike + mark resolved the 1.3 Function-URL-bootstrap-window entry (Task 9)
- `pnpm-lock.yaml` — regenerated by `pnpm install` after Task 1 (commit alongside the package.json change)

### Files this story deletes

None.

### Project Structure Notes

- **Fully aligned with architecture's directory tree** (lines 840–1015):
  - `infra/scripts/blackout-check.ts` — architecture line 980–981 (`scripts/` folder explicitly named).
  - `.github/workflows/deploy.yml`, `deploy-force.yml` — architecture line 846–848 (both files explicitly named).
- **One variance:** `infra/scripts/blackout-check.test.ts` is co-located with the script — not enumerated separately in the architecture tree but follows the architecture's testing pattern (line 770: "Vitest co-located `*.test.ts`"). Listed as added for clarity.
- **No architecture.md update required.** Every file this story touches sits inside a known, sanctioned location.

### Testing requirements

- **Unit (Vitest, infra package):**
  - `infra/scripts/blackout-check.test.ts` covers 17 cases listed in Task 3. All cases use injected `now`/`describeTable`/`scanGigs` deps — no real AWS SDK calls, no real system clock dependency.
  - `infra/lib/stacks/ci-stack.test.ts` extended with two new assertions per Task 1 + Task 6.
- **Unit (Vitest, other packages):** no changes.
- **E2E (Playwright):** no changes. The `shell.spec.ts` smoke from Story 1.5 continues to exercise the MacBook chrome locally; production smoke is the `curl` step in `deploy.yml` (Task 4).
- **Manual proof (deferred to Sandy, Task 8):**
  - First merge to `main` after Story 1.6 lands → observe `deploy.yml` runs end-to-end → capture run URL
  - One-off `workflow_dispatch` of `deploy-force.yml` with `reason: 'test override'`, `venueConfirmation: ''` (zero blocking gigs in V1 → no venue required) → observe enumerate step succeeds and deploy proceeds → capture run URL
- **No live AWS testing required from the dev agent** (the script has injectable IO; the workflows are static YAML). Sandy's first production merge is the integration test.

### Dev environment reminders

- **Local script invocation** without AWS creds: `pnpm -F infra exec tsx scripts/blackout-check.ts` → expect exit 1 with fail-closed message (the AWS SDK throws `CredentialsProviderError` on `DescribeTable` → Stage 1 catch → exit 1). This is the right behavior; it proves the wiring is correct.
- **Local script invocation** with AWS creds (`AWS_PROFILE=gigbuddy-admin`): `pnpm -F infra exec tsx scripts/blackout-check.ts` → expect exit 0 on a Tuesday morning with empty DDB (Stage 1 succeeds, Stage 2 returns zero, static fallback passes).
- **The deploy workflow's `cdk deploy --all` step deploys SIX stacks** (data, api, web-cert, web, observability, ci). On a no-change deploy, CDK fast-paths to "no changes" within ~30 seconds per stack.
- **AWS_PROFILE / SSO**: same setup as Story 1.3 bootstrap. The local dev path uses Sandy's admin profile; CI uses the OIDC role.
- **Node 22, pnpm 11.0.9** — both already pinned. Do not bump.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 6 — Deploy Automation + Gig-Window Blackout] (lines 388–426) — full two-stage check spec, OIDC scope, manual override pattern, branch protection rationale
- [Source: _bmad-output/planning-artifacts/architecture.md#Cost guardrails] (lines 371–377) — Budgets, reserved concurrency, WAF rate-limit are out-of-band guardrails; this story does not affect them
- [Source: _bmad-output/planning-artifacts/architecture.md#Pre-mortem outcomes] (lines 432–446) — three rows explicitly speak to this story: blackout fail-closed, manual override venue confirmation, SW auto-update prevention via deploy blackout
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 2 — Data Store] (lines 197–260) — GSI1 key shape, Setlist item shape, V2 evolution paths (no multi-band registry in V1)
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules] (lines 469–836) — naming conventions, no Snapshot tests, structured CloudWatch logs
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries] (lines 836–1027) — `infra/scripts/blackout-check.ts`, `.github/workflows/deploy.yml`, `deploy-force.yml` all enumerated
- [Source: _bmad-output/planning-artifacts/architecture.md#Requirements → structure mapping] (line 1102) — "Deploy blackout | §A.2 | .github/workflows/deploy.yml, deploy-force.yml; infra/scripts/blackout-check.ts; api/src/routes/upcoming-gigs.ts" — the api route is for client iPhone pre-fetch (Story 4.5), NOT this story's blackout check
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.6] (lines 600–644) — verbatim AC text
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1] (lines 253–266) — epic objectives, key ARs (AR-29 to AR-31, AR-37)
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory] NFR-5 (line 83), NFR-6 (line 84), AR-29 (line 163), AR-30 (line 165), AR-31 (line 166), AR-40 (line 178) — operational floor, gig-window blackout, OIDC trust scope, the unrelated upcoming-gigs client endpoint
- [Source: _bmad-output/implementation-artifacts/1-3-aws-infrastructure-stacks-data-api-web-observability-ci.md] — ci-stack deploy role; modifications in Tasks 1, 6 extend its policy set
- [Source: _bmad-output/implementation-artifacts/1-4-access-gate-single-password-jwt-cookie-ssm.md] — auth gate; deploy smoke test does NOT exercise auth (covered by bootstrap runbook Section 8)
- [Source: _bmad-output/implementation-artifacts/1-5-navigation-chrome-scaffold.md] — chrome scaffold; deploy ships the same SPA whose chrome 1.5 built. No dependency between 1.5 logic and this story's pipeline.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — Story 1.3 line 15 entry resolved by Task 9
- [Source: infra/runbooks/bootstrap.md] — Section 7 (OIDC hand-off) amended by Task 7; Section 4 amended by Task 9; new Section 9 added by Task 7
- [Source: .github/workflows/ci.yml] — pnpm + setup-node patterns to reuse in `deploy.yml` and `deploy-force.yml`
- [Source: CLAUDE.md] — boundaries (web ↔ api HTTP only — not relevant; api ↔ DDB via `api/src/ddb/*` — not relevant to infra/scripts), React Router 7 (not relevant), Tailwind v4 (not relevant), Biome (relevant — extend `files.includes`), Zod (not relevant)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) via Claude Code, baseline_commit `<set on dev-story start>`.

### Debug Log References

### Completion Notes List

### File List

### Review Findings

### Change Log
