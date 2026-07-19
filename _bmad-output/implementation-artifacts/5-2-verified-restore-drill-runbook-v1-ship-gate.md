---
baseline_commit: "ccddb92"
builds_on: 5-1-json-export-endpoint-library-footer-affordance
---

# Story 5.2: Verified restore drill + runbook — V1 SHIP GATE (FR-34, AR-14)

Status: ready-for-dev

> **SHIP-BLOCKING STORY — contains a manual, production-only task no coding agent should attempt unsupervised.**
> Tasks 1–3 (runbook authoring, Playwright spec, npm scripts) are normal code deliverables — implement,
> test, and review them exactly like any other story. **Task 4 (executing the drill against the live
> `gigbuddy-data` table and recording the Sign-off log entry) is explicitly OUT OF SCOPE for automated
> `dev-story` execution.** It requires Sandy's own AWS credentials, ~15–60 minutes of real elapsed time
> against production, and a Lambda env-var swap that (done wrong) can lock Sandy out of his own app. See
> "Disaster prevention — the env-var swap gotcha" and "What 'done' means for this story" in Dev Notes
> before doing anything with Task 4. **Do not fabricate a Sign-off log entry.** A story marked complete
> with an invented sign-off row is worse than a story left at `review` — it would let V1 ship on a false
> promise of verified recoverability, which is the entire thing this story exists to prevent.

## Story

As Sandy,
I want a documented restore runbook and an end-to-end executed drill against the live `gigbuddy-data` table, with sign-off,
so that before V1 ships I have proof — not theory — that PITR + AWS Backup actually return my data and the app reads from a restored table correctly.

## Acceptance Criteria

**AC-1 — Runbook exists with the required section order**

**Given** `infra/runbooks/restore-pitr.md`
**When** the runbook is read
**Then** it contains these sections, in order: 1. Purpose, 2. Triggers, 3. Prerequisites, 4. RPO / RTO targets, 5. Step-by-step procedure, 6. Validation checks, 7. Rollback, 8. Sign-off log

**AC-2 — Purpose section**

**Given** the Purpose section
**When** read
**Then** it states the FR-34 verified-restore obligation this runbook discharges (≤24h data-loss window, ≤2h restore-to-operational target, restore procedure verified end-to-end before V1 ships)

**AC-3 — Triggers section**

**Given** the Triggers section
**When** read
**Then** it lists: a real data-loss event, a scheduled periodic drill (recommend annually or on major architecture change), and the one-time V1 ship-gate execution

**AC-4 — Prerequisites section**

**Given** the Prerequisites section
**When** read
**Then** it lists: AWS SSO / admin-profile access (the `gigbuddy-deploy-role` OIDC role used by CI does **not** carry DynamoDB restore/delete or unscoped Lambda-config permissions — this is intentional least-privilege, not an oversight), the exact IAM actions needed (`dynamodb:RestoreTableToPointInTime`, `dynamodb:DescribeTable`, `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:DeleteTable` on `gigbuddy-data*`; `lambda:UpdateFunctionConfiguration`, `lambda:GetFunctionConfiguration` on `gigbuddy-api`), and local AWS CLI v2 configured with `--region eu-west-2`

**AC-5 — RPO/RTO targets section**

**Given** the RPO/RTO targets section
**When** read
**Then** it states RPO ~5 min (PITR continuous) and RTO ≤2h per FR-34 (target 15–60 min), matching architecture.md Decision 3 verbatim
**And** it also notes that AWS Backup daily snapshots are the secondary restore mechanism (RPO ~24h) for restores older than PITR's 35-day window

**AC-6 — Step-by-step procedure covers exactly 10 phases**

**Given** the step-by-step procedure
**When** read
**Then** it covers, in order: (1) seed canary record, (2) wait 5 min for PITR to roll forward, (3) initiate PITR restore to a side table, (4) wait for restore completion (poll until `ACTIVE`), (5) validate canary present in the restored table, (6) swap the Lambda's `TABLE_NAME` env to the restored table, (7) confirm the app reads correctly (manual check + optionally the Playwright spec), (8) swap `TABLE_NAME` back to `gigbuddy-data`, (9) delete the side table, (10) delete the canary record from `gigbuddy-data`
**And** each phase has an explicit AWS CLI command (or UI/browser action for phase 7) and its expected output
**And** Phase 4 is documented as the dominant time cost (5–15 min for a small table) and the total drill is documented as 15–60 min

**AC-7 — Validation checks section**

**Given** the Validation checks section
**When** read
**Then** it states what confirms success at each phase (e.g., restore `TableStatus: ACTIVE`, canary item present via `get-item`, Library/Setlist pages render post-swap, `TABLE_NAME` confirmed reverted post-swap-back)

**AC-8 — Rollback section**

**Given** the Rollback section
**When** read
**Then** it states how to revert if the drill misfires at any phase (primarily: re-run the `TABLE_NAME` swap-back command pointed at `gigbuddy-data` — the original table is never touched destructively by phases 1–9, only read from and appended to)
**And** it explicitly states that the original `gigbuddy-data` table's `DeletionProtection` must NEVER be disabled as part of the drill (the restored side table is a separate resource without DeletionProtection and can be deleted directly in Phase 9; disabling protection on the source table is never a valid step in this runbook)

**AC-8b — AWS Backup secondary restore procedure**

**Given** the runbook
**When** read
**Then** it includes a brief secondary procedure (a subsection at the end of the Step-by-step section, or an appendix) documenting how to restore from an AWS Backup daily snapshot instead of PITR — used when the target restore point is older than PITR's 35-day window
**And** the secondary procedure references the same env-swap pattern from Phase 6 (i.e. once the AWS Backup restore-job produces a side table, the swap/validate/swap-back pattern of Phases 6–8 applies unchanged)
**And** it is explicitly labelled as secondary (RPO ~24h) — PITR remains the primary path

**AC-9 — Sign-off log section**

**Given** the Sign-off log section
**When** read
**Then** it is a markdown table with columns: Date, Executor, Total elapsed, RPO observed, RTO observed, Outcome, Notes
**And** it is empty (header row only) at the time this story is code-reviewed — a fabricated row is a story defect, not a completion

**AC-10 — Playwright verified-restore spec**

**Given** `e2e/restore/verified-restore.spec.ts`
**When** run against a deployed URL pointed at a restored table
**Then** the spec logs in via the auth gate
**And** verifies the Library lists at least one Song
**And** verifies that opening a Setlist overview renders Songs (data-structure integrity check)
**And** the spec is parameterized (via environment variables) so the drill executor can pass the test URL and credentials without editing the spec file

**AC-11 — Drill executed and signed off (MANUAL — not part of automated dev-story)**

**Given** the verified-restore drill is executed end-to-end by Sandy against the live `gigbuddy-data` table
**When** all 10 phases complete successfully
**Then** the Sign-off log table gains one row: date, executor name, total elapsed time, RPO observed, RTO observed, notes
**And** the row is committed to git

**AC-12 — Failure handling (MANUAL)**

**Given** the drill encountered any failure during execution
**When** the failure is reproduced or analyzed
**Then** the Rollback section is followed
**And** the failure cause is documented in the Sign-off log
**And** the story is not marked `done` in `sprint-status.yaml` until a clean drill passes end-to-end, with a Sign-off entry dated within the last 90 days of the V1 ship decision

## Tasks / Subtasks

- [x] **Task 1 — Author `infra/runbooks/restore-pitr.md`** (AC: 1, 2, 3, 4, 5, 6, 7, 8, 8b, 9)
  - [ ] Write the 8 sections in order (Purpose → Triggers → Prerequisites → RPO/RTO → Step-by-step → Validation checks → Rollback → Sign-off log). Mirror the prose style and structure of the existing `infra/runbooks/bootstrap.md` (numbered sections, fenced shell blocks, `# expect: ...` comment lines after each command)
  - [ ] Purpose: cite FR-34 verbatim (≤24h data-loss window, ≤2h restore-to-operational, verified-before-ship obligation) — see Dev Notes "Source citations" for exact wording to draw from
  - [ ] Triggers: data-loss event / scheduled drill / V1 ship gate (this execution)
  - [ ] Prerequisites: AWS SSO or the `gigbuddy-admin` bootstrap profile from `bootstrap.md` §0a (NOT the CI `gigbuddy-deploy-role` — verified against `infra/lib/stacks/ci-stack.ts`: the deploy role has `dynamodb:Query/Scan/DescribeTable` only, scoped for the blackout check, and no `RestoreTableToPointInTime`/`PutItem`/`DeleteTable`; this is deliberate least-privilege, don't propose widening it). List the exact IAM actions from AC-4. AWS CLI v2, `--region eu-west-2` on every command. For the AWS Backup secondary procedure (AC-8b): also list `backup:StartRestoreJob`, `backup:DescribeRestoreJob`, `backup:ListRecoveryPointsByBackupVault`, and the IAM `PassRole` for the AWS Backup restore role
  - [ ] RPO/RTO targets: copy verbatim from architecture.md Decision 3 (`~5 min` / `≤2h` / `15–60 min`); add a one-line note that AWS Backup daily snapshots (RPO ~24h) are the secondary path for restores older than PITR's 35-day window (AC-5, AC-8b)
  - [ ] Step-by-step: write all 10 phases per AC-6. Use the design in Dev Notes "Phase-by-phase command design" — do not invent a different mechanism for canary seeding or the env-var swap; both have a specific correct approach and a specific way to get it wrong (see "Disaster prevention" below)
  - [ ] Validation checks: one bullet per phase, cross-referencing the phase number
  - [ ] Rollback: state that phases 1–9 never mutate `gigbuddy-data` destructively (only an added-then-removed canary item), so rollback is "re-run the swap-back command"; cover the case where the swap-back itself needs redoing if phase 8 was skipped or failed. **Include the explicit DeletionProtection guardrail statement required by AC-8**: the original `gigbuddy-data` table's `DeletionProtection` must NEVER be disabled as part of the drill; the restored side table is a separate resource without DeletionProtection and can be deleted directly in Phase 9
  - [ ] Secondary procedure (AC-8b): append a subsection at the end of Step-by-step titled `Secondary — restore from AWS Backup daily snapshot`. Cover the shape only (no need to duplicate every command): (1) `aws backup list-recovery-points-by-backup-vault` to find the target snapshot, (2) `aws backup start-restore-job` with `Metadata` supplying a new `TargetTableName` (per AWS docs — verify the exact metadata keys at implementation time), (3) `aws backup describe-restore-job` to poll to `COMPLETED`, then (4) rejoin the PITR path at Phase 5 (validate) — Phases 5–10 (validate → swap → confirm → swap-back → delete side table → delete canary) apply unchanged, including the env-var swap warning. Label it explicitly as secondary (RPO ~24h vs PITR's ~5 min) — see Dev Notes "AWS Backup secondary procedure — scope and shape"
  - [ ] Sign-off log: markdown table, header row only, columns exactly `Date | Executor | Total elapsed | RPO observed | RTO observed | Outcome | Notes`. **See Dev Notes "Sign-off log column synthesis" — this column set is a synthesis of two partial lists in epics.md and should be flagged to Sandy in the completion notes as a schema decision to confirm before Task 4 executes**
  - [ ] Update `infra/runbooks/bootstrap.md`'s existing forward-reference (§7 "Rotation runbooks ... ship in Story 5.2") — see Dev Notes "Rotation-runbook discrepancy" — do NOT author `rotate-jwt-key.md` / `rotate-password.md` in this story; instead correct the forward-reference so it stops pointing at Story 5.2 for something this story's AC doesn't cover

- [x] **Task 2 — Playwright verified-restore spec** (AC: 10)
  - [ ] Create `e2e/restore/verified-restore.spec.ts` per the design in Dev Notes "Playwright spec design" — logs in through the `/login` form using env-provided credentials, asserts the Library page lists at least one Song, opens the first Setlist card from Setlists home and asserts at least one Song row renders in the overview
  - [ ] Create `e2e/restore/playwright.config.ts` — a separate, minimal config (no `webServer` block: this spec runs against an already-deployed URL, not a local dev server pair). `baseURL` and credentials come from environment variables (`RESTORE_DRILL_URL`, `RESTORE_DRILL_PASSWORD`), not hardcoded and not CLI flags the executor has to remember — read them with a clear thrown error if either is unset, so a mis-invoked run fails fast with a readable message rather than a confusing Playwright navigation error
  - [ ] Do NOT let this spec get picked up by the existing `e2e/playwright.config.ts` (`testDir: '.'`, `testMatch: '**/*.spec.ts'` — that glob currently matches everything under `e2e/`, including `restore/`). Scope the smoke config's `testDir` (or `testMatch`) so `pnpm test:e2e` (the smoke suite) does not attempt to run the restore spec against a local dev server that has none of the required env vars

- [x] **Task 3 — Wire npm scripts** (AC: 10)
  - [ ] Add `"test:e2e:restore": "playwright test --config restore/playwright.config.ts"` to `e2e/package.json` `scripts`
  - [ ] Add `"test:e2e:restore": "pnpm --filter e2e run test:e2e:restore"` to the root `package.json` `scripts`, alongside the existing `test:e2e` entry
  - [ ] Confirm `pnpm test:e2e` (smoke) still passes unaffected, and `pnpm --filter e2e exec tsc -p tsconfig.json --noEmit` typechecks the new spec + config

- [ ] **Task 4 — Execute the drill against live `gigbuddy-data` and record sign-off** (AC: 11, 12) — **MANUAL. Not part of automated `dev-story`. Sandy executes this himself, using Tasks 1–3's runbook and spec, after they've landed and been reviewed.**
  - [ ] Follow `infra/runbooks/restore-pitr.md` phases 1–10 end-to-end against the real `gigbuddy-data` table
  - [ ] On a clean pass: add one row to the Sign-off log table with real date, executor, elapsed time, RPO/RTO observed, notes; commit
  - [ ] On any failure: follow Rollback, log the failure in the Sign-off log with cause, retry until a clean pass exists before treating this story as ship-gate-satisfied
  - [ ] Only after this task has a genuine passing Sign-off row does `sprint-status.yaml` move this story to `done`

## Dev Notes

### What "done" means for this story — read this first

Tasks 1–3 are ordinary code: a markdown runbook, a Playwright spec, two `package.json` edits. Implement, lint,
typecheck, and get them to `review` exactly like every other story — the code-review and adversarial-review
workflows apply normally to Tasks 1–3. **Task 4 is different in kind, not just content**: it requires real AWS
credentials with production-grade permissions, mutates a live Lambda's configuration (even if briefly), and takes
15–60 real minutes including a mandatory 5-minute wait. No coding agent should execute Task 4 autonomously — there
is no "test mode" for swapping a production Lambda's table pointer. Move this story to `review` once Tasks 1–3
are complete and reviewed; leave Task 4 and the Sign-off log open for Sandy. Do not move this story to `done` in
`sprint-status.yaml` without a real, dated Sign-off row — CLAUDE.md's canonical-status rule and this story's own
AC-9/AC-12 both depend on that row being genuine.

### Disaster prevention — the env-var swap gotcha

`aws lambda update-function-configuration --environment` **replaces the entire `Variables` map**; it does not merge.
`api-stack.ts` sets three env vars on `gigbuddy-api`: `TABLE_NAME`, `JWT_KEY_PARAM`, `PASSWORD_HASH_PARAM`. A swap
command that only sets `TABLE_NAME` will silently wipe the other two, breaking the JWT-key and password-hash SSM
lookups — i.e. it locks Sandy out of the live app. **Every swap command (phases 6 and 8) must re-specify all three
variables**, changing only `TABLE_NAME`:

```
aws lambda update-function-configuration \
  --function-name gigbuddy-api \
  --environment "Variables={TABLE_NAME=gigbuddy-data-restore-<timestamp>,JWT_KEY_PARAM=/gigbuddy/jwt-key,PASSWORD_HASH_PARAM=/gigbuddy/password-hash}" \
  --region eu-west-2
```

and the swap-back (phase 8) is the same command with `TABLE_NAME=gigbuddy-data`. Put this exact warning in the
runbook itself, immediately above both the phase-6 and phase-8 commands — don't bury it only in a preamble.

### Phase-by-phase command design

- **Phase 1 (seed canary):** seed through the app's own write path, not a raw `dynamodb put-item`. Authenticate via
  `POST /api/v1/auth/login` (reuse the `curl -c cookie.txt` pattern already established in `bootstrap.md` §8), then
  `PUT /api/v1/songs/<nanoid>` with a body matching `SongPutInputSchema` (`bandId: k0c5Db7zM2qF3vNa` —
  `ACTIVE_BAND_ID` from `shared/src/active-band.ts` —, `songId`, `title: "RESTORE CANARY <ISO-8601 timestamp>"`,
  `clientWrittenAt`, `version: 1`). This is more reliable than a hand-built raw DDB item (which would need
  DynamoDB's typed-attribute JSON and is easy to get subtly wrong against `SongSchema`), and it exercises the real
  write path the drill is meant to validate. Generate the `songId` with any 16-char URL-safe string (`openssl rand
  ... | tr ...` or similar) — it does not need to come from `web/src/lib/id.ts`, just be unique.
- **Phase 3 (restore):** `aws dynamodb restore-table-to-point-in-time --source-table-name gigbuddy-data
  --target-table-name gigbuddy-data-restore-<timestamp> --restore-date-time <ISO-8601, after the canary write>
  --region eu-west-2`. Note for the runbook: GSI1 is restored automatically (AWS restores all GSIs present on the
  source table at the restore point by default) — no separate GSI-recreation step is needed. The restored table
  does **not** inherit PITR-enabled or DeletionProtection status — expected and fine, since it's a short-lived side
  table.
- **Phase 5 (validate canary):** `aws dynamodb get-item --table-name gigbuddy-data-restore-<timestamp> --key
  '{"pk":{"S":"BAND#k0c5Db7zM2qF3vNa"},"sk":{"S":"SONG#<canary songId>"}}' --region eu-west-2` — confirm the item is
  present and its `title` matches the canary string.
- **Phase 9 (delete side table):** since the restored table has no DeletionProtection, `aws dynamodb delete-table
  --table-name gigbuddy-data-restore-<timestamp> --region eu-west-2` succeeds directly — no protection-disable step
  needed (unlike the main `gigbuddy-data` table, which the runbook should explicitly note is NOT touched by
  `delete-table` anywhere in this procedure).
- **Phase 10 (delete canary):** there is no delete endpoint in the API (V1 has none, per architecture.md Decision 2
  "no admin-delete endpoints"). Use a raw `aws dynamodb delete-item --table-name gigbuddy-data --key
  '{"pk":{"S":"BAND#k0c5Db7zM2qF3vNa"},"sk":{"S":"SONG#<canary songId>"}}' --region eu-west-2` directly against the
  live table — this is the one raw-DDB mutation in the whole drill, and it's additive-cleanup only (removing
  exactly the item phase 1 added), never touching any pre-existing Song or Setlist.

### AWS Backup secondary procedure — scope and shape

Epics.md's AC (lines 1826–1834) requires the runbook to *document* an AWS Backup secondary restore path — it does
NOT require executing an AWS Backup restore as part of Task 4's drill. Task 4's Sign-off log entry is satisfied by
a clean PITR pass; AWS Backup verification is not part of the V1 ship gate. Keep the secondary subsection lean:
mechanism + IAM + rejoin-point + explicit "secondary, ~24h RPO" labelling. Do not spec canary + wait + validate
+ swap steps a second time — the whole point of "rejoin at Phase 5" is that Phases 5–10 are shared. Exact AWS
Backup command flags (particularly `start-restore-job`'s `Metadata` map, which differs per resource type) should
be verified against AWS docs at implementation time rather than transcribed from memory — the runbook is a
document Sandy will follow under pressure, so an untested command shape is worse than a `# TODO: verify` note
that flags the check.

### Sign-off log column synthesis

Epics.md gives two different partial column lists for the Sign-off log: the section-order AC (line 1786) says
"table for date, executor, outcome, notes" (4 columns), while the completion AC (line 1816) says "date, executor
name, total elapsed time, RPO observed, RTO observed, notes" (6 columns, no Outcome). This spec's AC-9 synthesises
both into a 7-column table (Date | Executor | Total elapsed | RPO observed | RTO observed | Outcome | Notes) —
Outcome is retained because AC-12 depends on documenting failure cause, which needs a pass/fail axis distinct
from free-text Notes. This is a spec synthesis, not a verbatim lift from epics.md — flag it in the Task 1
completion notes so Sandy can confirm (or amend) the column set before Task 4 executes and the row-shape becomes
irreversible in git history. If Sandy chooses a different schema, edit AC-9 and the Task-1 subtask to match
before re-running dev-story on this file.

### Playwright spec design

`e2e/restore/verified-restore.spec.ts` cannot reuse `e2e/playwright.config.ts`'s `webServer` entries — those spin
up local `pnpm dev` servers, but this spec targets an already-deployed URL with a table that's been swapped to a
restored copy. Give it its own config:

```ts
// e2e/restore/playwright.config.ts
import { defineConfig } from '@playwright/test';

const baseURL = process.env.RESTORE_DRILL_URL;
if (!baseURL) throw new Error('RESTORE_DRILL_URL env var is required to run the restore drill spec');

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { viewport: { width: 1280, height: 800 } } }],
});
```

The spec itself drives the real `/login` form (per `web/src/routes/login.tsx`: `#password` input, `Sign in`
submit button, `required aria-live` error `<p role="alert">` on failure) rather than pre-seeding a session
cookie — this is the literal AC-10 "logs in via the auth gate." Read the password from
`RESTORE_DRILL_PASSWORD`, fail fast if unset:

```ts
import { expect, test } from '@playwright/test';

const password = process.env.RESTORE_DRILL_PASSWORD;
if (!password) throw new Error('RESTORE_DRILL_PASSWORD env var is required to run the restore drill spec');

test('restored table serves Library and Setlist data through the auth gate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();

  await page.getByRole('link', { name: 'Library' }).click();
  // At least one Song row renders — any Song works, including the canary if present.
  await expect(page.locator('main, section').getByRole('link').first()).toBeVisible();

  await page.goto('/');
  const firstSetlist = page.getByRole('button', { name: /,/ }).first(); // GigCard aria-label composes "venue, date[, Tonight]"
  await firstSetlist.click();
  await expect(page.getByText(/./)).toBeVisible(); // overview rendered at all — refine selector against actual SetlistSongRow markup during implementation
});
```

Treat the selectors above as a starting sketch, not gospel — verify exact `getByRole`/`getByLabel` matches against
`web/src/routes/library.tsx`, `web/src/components/library-song-row.tsx`, `web/src/routes/home.tsx`,
`web/src/components/gig-card.tsx`, and `web/src/components/setlist-song-row.tsx` at implementation time, the same
way `e2e/smoke/shell.spec.ts` does it. The one hard requirement from AC-10 that must not be simplified away: the
spec must assert Library shows a Song AND that opening a Setlist overview renders Songs — two distinct data-path
checks, not one.

Don't hardcode a dependency on the canary Song existing when the spec runs — the executor may run it any time
after phase 6 and before phase 8, potentially against a table state where the canary write happened outside the
current terminal session. Assert "at least one Song / row renders," not "the canary specifically" — the canary's
presence is validated separately and more precisely in phase 5 via `get-item`.

### Rotation-runbook discrepancy — do not silently expand or silently ignore

`infra/runbooks/bootstrap.md` (§ near "Verify the access gate") states: *"Rotation runbooks (`rotate-jwt-key.md`,
`rotate-password.md`) ship in Story 5.2 alongside the verified-restore drill."* **This story's actual AC text in
`epics.md` says no such thing** — Story 5.2's AC is scoped entirely to `restore-pitr.md` +
`e2e/restore/verified-restore.spec.ts` + the sign-off drill. `architecture.md`'s canonical folder tree (line ~986)
also lists `rotate-jwt-key.md` / `rotate-password.md` as files that should eventually exist, without assigning them
to a story. Per CLAUDE.md, `epics.md` is the AC authority — do not author the rotation runbooks in this story; that
would be scope invented by this story rather than authorized by it. Do fix the dangling forward-reference in
`bootstrap.md` so a future reader doesn't go looking for rotation runbooks that Story 5.2 never promised to
deliver — reword it to something like "Rotation runbooks are not yet scheduled to a story; author on-demand before
first rotation is needed" (or similar factual, non-committal phrasing). Flag this discrepancy to Sandy in the PR /
completion notes rather than silently resolving it either way — it's a genuine gap between two planning documents,
not a judgment call this story should make unilaterally.

### Source citations

- FR-34 (epics.md §Backup & Export): "Automated at-least-daily backup with reasonable retention, restorable to the
  live store. ≤24h data-loss window; ≤2h restore-to-operational target. A documented restore procedure exists and
  has been verified end-to-end at least once before V1 ships."
- AR-14 (epics.md §Additional Requirements): "Verified-restore release gate: restore-pitr.md runbook is executed
  end-to-end before V1 ships (seed canary → restore via PITR to side table → validate → swap env to restored table
  → confirm → swap back). Ship-blocking story."
- architecture.md Decision 3 ("Backup & Recovery (FR-34)"): RPO ~5 min, RTO 15–60 min (≤2h ceiling), runbook path
  `infra/runbooks/restore-pitr.md`, the exact 6-verb drill sequence (seed → restore → validate → swap → confirm →
  swap back — this story's runbook expands that into the 10 explicit phases epics.md's AC spells out).

### Architecture compliance checklist

- [ ] Runbook lives at exactly `infra/runbooks/restore-pitr.md` (path is canonical in architecture.md's folder tree)
- [ ] Playwright restore spec lives at exactly `e2e/restore/verified-restore.spec.ts` (also canonical)
- [ ] `e2e` package boundary respected: the spec is black-box HTTP/browser against a deployed URL — it does not
      import anything from `web/` or `api/` source (CLAUDE.md boundary: "e2e ↔ rest: black-box HTTP only")
- [ ] No widening of `gigbuddy-deploy-role` (CI OIDC) permissions to cover restore/delete actions — the drill is
      manual-admin-only by design; don't "fix" this by adding IAM to `ci-stack.ts`
- [ ] `TABLE_NAME`/`JWT_KEY_PARAM`/`PASSWORD_HASH_PARAM` env var names match `infra/lib/stacks/api-stack.ts` exactly
- [ ] File naming: `kebab-case` throughout (`restore-pitr.md`, `verified-restore.spec.ts`)
- [ ] Biome passes on the two new TypeScript files (`verified-restore.spec.ts`, `restore/playwright.config.ts`)

### Files to create / update

- **Create:** `infra/runbooks/restore-pitr.md`, `e2e/restore/verified-restore.spec.ts`, `e2e/restore/playwright.config.ts`
- **Update:** `infra/runbooks/bootstrap.md` (fix the dangling Story 5.2 rotation-runbook forward-reference),
  `e2e/package.json` (new `test:e2e:restore` script), root `package.json` (new `test:e2e:restore` passthrough),
  `e2e/playwright.config.ts` (scope `testDir`/`testMatch` so the smoke config no longer picks up `restore/*.spec.ts`)

### Previous story intelligence (Story 5.1)

Story 5.1 (export endpoint) shipped clean with no deviations from the canonical file tree. Its Dev Notes flagged
two lessons worth repeating here: (1) when epics.md's AC prose implies a mechanism ("scans the DDB table... Query
per partition") that doesn't match what the codebase actually has, verify against the real code before designing
around the prose — this story's runbook does the same verification for the canary-seeding and env-swap mechanics.
(2) 5.1 established that `api/src/ddb/*` is the sole DDB import surface for **application code**; this story's one
raw-DDB CLI call (phase 10, deleting the canary) is an operator action via AWS CLI, not application code, so it
doesn't violate that boundary — but don't add a raw-DDB helper module to `api/` or `infra/` to "support" the drill;
it's a runbook of CLI commands, not new source.

### Project Structure Notes

`infra/runbooks/restore-pitr.md` and `e2e/restore/verified-restore.spec.ts` are both explicitly named in
architecture.md's canonical directory tree — no path deviation. The one net-new structural element not already
implied by architecture.md is `e2e/restore/playwright.config.ts` (a second Playwright config, needed because the
restore spec's execution context — deployed URL, real credentials, no local dev servers — is fundamentally
different from the smoke suite's). This is a reasonable, minimal addition consistent with Playwright's own
multi-config patterns; it does not require an architecture.md amendment, but note it in the story's completion
notes so the next reader isn't surprised by a second config file.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2] — story ACs (verbatim source for all AC numbering above; lines 1826–1834 for the AWS Backup secondary path, lines 1836–1842 for the DeletionProtection guardrail)
- [Source: _bmad-output/planning-artifacts/epics.md#FR-34, #AR-14] — the underlying requirement and release-gate framing
- [Source: _bmad-output/planning-artifacts/architecture.md#3. Backup & Recovery (FR-34)] — RPO/RTO targets, drill sequence, runbook path
- [Source: _bmad-output/planning-artifacts/architecture.md folder tree] — canonical paths for the runbook and spec
- [Source: infra/lib/stacks/data-stack.ts] — table name, PITR flag, DeletionProtection, GSI1 definition
- [Source: infra/lib/stacks/api-stack.ts] — `TABLE_NAME`/`JWT_KEY_PARAM`/`PASSWORD_HASH_PARAM` env var names (the swap-command gotcha)
- [Source: infra/lib/stacks/ci-stack.ts] — confirms the CI OIDC deploy role deliberately lacks restore/delete DDB permissions
- [Source: infra/runbooks/bootstrap.md] — existing runbook prose/structure style to mirror; also the source of the rotation-runbook discrepancy
- [Source: shared/src/active-band.ts] — `ACTIVE_BAND_ID` constant used in canary item keys
- [Source: shared/src/schemas/song.ts] — `SongSchema`/`SongPutInputSchema` shape for the canary PUT body
- [Source: api/src/routes/songs.ts, api/src/ddb/songs.ts] — canary seed path (`PUT /api/v1/songs/:songId`) and raw item key shape (`pk`/`sk`)
- [Source: web/src/router.tsx] — route paths (`/`, `/library`, `/setlists/:setlistId`) for the Playwright spec
- [Source: web/src/routes/login.tsx] — login form field/button text for the Playwright spec
- [Source: web/src/components/gig-card.tsx] — Setlist cards are `<button>` elements with a composed `aria-label`, not `<a>` links
- [Source: e2e/playwright.config.ts, e2e/smoke/shell.spec.ts] — existing Playwright conventions to mirror/diverge from deliberately
- [Source: _bmad-output/implementation-artifacts/5-1-json-export-endpoint-library-footer-affordance.md] — previous story intelligence

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (dev-story workflow, 2026-07-19).

### Debug Log References

- `pnpm --filter e2e exec tsc -p tsconfig.json --noEmit` — clean.
- `pnpm lint` — flagged Biome formatter reflow of a Playwright locator chain; auto-fixed via `pnpm lint:fix`.
- `pnpm typecheck` — all five workspace packages clean.
- `pnpm test` — 573 tests pass across web + api + shared + infra (e2e is excluded from the unit-test run by root package.json's `!e2e` filter).

### Completion Notes List

Tasks 1–3 (code deliverables) landed. Task 4 (executing the drill against the live `gigbuddy-data` table and appending a real Sign-off row) is deliberately left open for Sandy — no coding agent should touch it unsupervised, and the story spec explicitly says a fabricated Sign-off row is a defect rather than a completion.

Two spec-flagged decisions to confirm before Task 4 executes:

1. **Sign-off log column set is a spec synthesis.** `epics.md` provides two partial column lists (4-column at line 1786, 6-column at line 1816). This runbook uses the 7-column synthesis called out in AC-9: `Date | Executor | Total elapsed | RPO observed | RTO observed | Outcome | Notes`. If Sandy prefers a different schema (e.g., drop `Outcome`, or fold `Outcome` into `Notes`), edit the table header in `infra/runbooks/restore-pitr.md` § 8 before the first drill row is committed — once real rows exist the schema is effectively frozen in git history.
2. **Rotation-runbook forward-reference in `bootstrap.md` was corrected, not fulfilled.** `bootstrap.md` § 8 previously said "Rotation runbooks (`rotate-jwt-key.md`, `rotate-password.md`) ship in Story 5.2". Story 5.2's actual AC (from `epics.md`) does not include those runbooks, and `architecture.md`'s folder tree lists them without assigning a story. The forward-reference is now reworded to "not yet scheduled to a story — author on-demand before the first rotation is needed." This is a discrepancy between two planning docs; flagged here for Sandy's attention rather than silently resolved by inventing the runbooks in this story.

One net-new structural element beyond `architecture.md`'s folder tree: `e2e/restore/playwright.config.ts`, a second Playwright config. This is a minimal, Playwright-idiomatic addition needed because the restore-drill spec's execution context (deployed URL, real credentials, no local dev servers) is fundamentally different from the smoke suite. No architecture amendment required. `e2e/playwright.config.ts`'s `testDir` was narrowed from `.` to `./smoke` so the smoke run no longer picks up `restore/*.spec.ts`.

The AWS Backup secondary procedure in the runbook contains two `# TODO: verify` markers around `aws backup list-recovery-points-by-backup-vault` and `aws backup start-restore-job --metadata`. Per the spec's "AWS Backup secondary procedure — scope and shape" dev note, an untested command shape would be worse than a flagged verify-me — the runbook is followed under pressure and AWS Backup's `Metadata` map for DynamoDB restores has varied historically.

### File List

Created:

- `infra/runbooks/restore-pitr.md`
- `e2e/restore/verified-restore.spec.ts`
- `e2e/restore/playwright.config.ts`

Updated:

- `infra/runbooks/bootstrap.md` — corrected the dangling Story 5.2 rotation-runbook forward-reference in § 8.
- `e2e/playwright.config.ts` — narrowed `testDir` from `.` to `./smoke` so the smoke config does not pick up the restore spec.
- `e2e/package.json` — added `test:e2e:restore` script.
- `package.json` — added root `test:e2e:restore` passthrough alongside the existing `test:e2e`.

## Change Log

| Date       | Version | Description                                              | Author            |
| ---------- | ------- | -------------------------------------------------------- | ----------------- |
| 2026-07-19 | 0.1     | Tasks 1–3 landed; Task 4 (manual drill) left open.       | Dev agent (Opus 4.7) |

