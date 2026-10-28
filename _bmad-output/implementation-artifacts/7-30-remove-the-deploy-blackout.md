---
baseline_commit: b78741170687c6824562a277aad8dffb14bde388
---

# Story 7.30: Remove the deploy blackout

Status: done

<!-- Source: Epic 7 retro, Sandy's answers 2026-10-28 (epics.md "Decisions, 2026-10-28"):
     "The gig-day deploy blackout is redundant: Sandy is the only developer and user and won't
     push while playing. Any future automation (e.g. dependency updates) would be scheduled for
     the early hours. Remove the blackout rules." -->

## Story

As Sandy,
I want a push to `main` to deploy whatever the date and whatever gigs are coming up,
so that a test gig or a weekend evening never blocks a deploy or needs the force workflow.

## Acceptance Criteria

1. `deploy.yml` has no blackout step. A push to `main` runs lint → typecheck → test →
   `cdk diff` → `cdk deploy` → SPA build/upload → invalidation → smoke tests, as today, with
   no check of gig dates or the day of the week.
2. `deploy-force.yml`, `infra/scripts/blackout-check.ts` and `blackout-check.test.ts` are
   deleted. `@aws-sdk/client-dynamodb` leaves `infra/package.json` (nothing else uses it) and
   the lockfile is updated.
3. The CI deploy role (`infra/lib/stacks/ci-stack.ts`) loses the two grants that existed only
   for the blackout: DynamoDB `Query`/`Scan`/`DescribeTable` on the table, and CloudWatch Logs
   on `/gigbuddy/deploy-force`. The now-unused `tableArn` prop goes too. Every other grant is
   unchanged.
4. Comments that point at the blackout are reworded so no code comment refers to
   `blackout-check.ts`, `deploy-force` or the §A.2 deploy blackout. Behaviour of
   `/api/v1/upcoming-gigs`, `londonIsoDate` and the service worker is unchanged.
5. Docs say the blackout is gone: `architecture.md` (course-correction note and §6),
   `infra/runbooks/bootstrap.md` (§9 removed, deploy-force mention in §7), and
   `infra/runbooks/restore-pitr.md` (deploy-role note).
6. No change to `web/` behaviour, `api/` behaviour or `shared/`; no new package.
7. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.
8. Deployed to gig.cormie.com via the normal pipeline (the first deploy that applies the
   narrowed deploy role to `GigbuddyCi`), and the Actions run is green.

## Tasks / Subtasks

- [x] **Task 1: Workflows** (AC: 1, 2)
  - [x] `.github/workflows/deploy.yml`: delete the `blackout check` step (two lines). Nothing
        else changes.
  - [x] Delete `.github/workflows/deploy-force.yml`.
- [x] **Task 2: Script and package** (AC: 2)
  - [x] Delete `infra/scripts/blackout-check.ts` and `infra/scripts/blackout-check.test.ts`.
        The `infra/scripts/` folder is then empty; let it go.
  - [x] Remove `@aws-sdk/client-dynamodb` from `infra/package.json` devDependencies and run
        `pnpm install` to update `pnpm-lock.yaml`. Check `git grep client-dynamodb -- infra`
        returns nothing else first. Keep `tsx`: `infra/cdk.json` runs the app with it.
- [x] **Task 3: Deploy role** (AC: 3)
  - [x] `infra/lib/stacks/ci-stack.ts`: delete the DynamoDB statement (and its comment) and
        the CloudWatch Logs statement (and its comment). Drop `tableArn` from `CiStackProps`.
  - [x] `infra/bin/gigbuddy.ts` and `infra/bin/gigbuddy.test.ts`: stop passing `tableArn` to
        `CiStack`.
  - [x] `infra/lib/stacks/ci-stack.test.ts`: drop `tableArn` from `synth()`. Replace the two
        grant tests with one test asserting no statement in the deploy role's policy has a
        `dynamodb:*` or `logs:*` action (walk `template.findResources('AWS::IAM::Policy')`
        statements; an action may be a string or an array).
- [x] **Task 4: Comments** (AC: 4)
  - [x] `api/src/ddb/gigs.ts`: header comment and the `londonIsoDate` doc comment drop the
        `blackout-check.ts` references. Keep the function and its behaviour.
  - [x] `api/src/ddb/gigs.test.ts`: keep the five `londonIsoDate` cases (they still guard
        GMT/BST and midnight rollover for the endpoint); rename the `describe` to e.g.
        `'londonIsoDate — Europe/London calendar date'` and cut the comment block above it to
        a line or two without the blackout reference.
  - [x] `web/vite.config.ts`: the workbox comment drops
        "Belt-and-braces with the §A.2 deploy blackout (Story 1.6)." The `skipWaiting: false` /
        `clientsClaim: false` settings stay.
  - [x] Finish with `git grep -n -i -e blackout -e deploy-force -- ':!_bmad-output'`
        (zsh: quote the pathspec) and expect only the doc lines Task 5 rewrites, then none.
- [x] **Task 5: Docs** (AC: 5)
  - [x] `architecture.md`:
        - "Course correction (2026-10-19)" paragraph: drop "blackout" from the
          "unchanged and in force" list and add one line: "Deploy blackout removed
          2026-10-28 (Story 7.30): Sandy won't push while playing; any future automation runs
          in the early hours."
        - §6 heading/body: add a one-line "**Superseded 2026-10-28 (Story 7.30):** no
          blackout check and no `deploy-force.yml`; the pipeline below runs without step 3."
          Leave the rest of §6 as the historical record (same approach as other superseded
          sections). Don't rewrite the PRD, Story 1.6 or older story files.
  - [x] `infra/runbooks/bootstrap.md`: delete "## 9. Emergency: deploy-force.yml". In §7,
        "The deploy and deploy-force workflows reference…" → "The deploy workflow
        references…", "both workflows fail" → "it fails". §9 is the last section, so nothing
        is renumbered.
  - [x] `infra/runbooks/restore-pitr.md` §3: the deploy role no longer has any DynamoDB
        actions; reword the parenthesis to say so ("…`infra/lib/stacks/ci-stack.ts`, which
        grants no DynamoDB actions").
- [x] **Task 6: Verify and ship** (AC: 6–8): `pnpm lint`, `pnpm typecheck`, `pnpm test`,
      `pnpm build`; commit `Implement story 7.30: Remove the deploy blackout`; push; watch the
      deploy run (`gh run watch`, using `GH_TOKEN=$(gh auth token --user mr-sandy)` if the
      work account gets 403) and confirm it's green, including the `GigbuddyCi` update.
      Sandy's quick look: nothing visible changes in the app, so the green run is the check.

## Dev Notes

### What exists today (all from Story 1.6, 2026-06)

- `deploy.yml` step `blackout check` runs `pnpm -F infra exec tsx scripts/blackout-check.ts`.
  The script probes the table (`DescribeTable`), scans GSI1 for setlists dated today or
  tomorrow (Europe/London), fails on any gig, and with no gigs fails Fri–Sun 18:00–24:00.
  Any AWS error also fails the deploy.
- `deploy-force.yml` (manual dispatch: `reason`, `venueConfirmation`) runs the script in
  `--report-only` mode, checks the venue, writes an audit to the step summary and to
  CloudWatch `/gigbuddy/deploy-force`, then deploys without the check. Used four times in
  Epic 7 (Sunday blackout in 7.7; a "Test" gig dated 2026-10-29 in 7.26–7.28).
- `ci-stack.ts` deploy role grants, besides CDK/S3/CloudFront/SSM/PassRole/Lambda:
  `dynamodb:Query|Scan|DescribeTable` on the table + `/index/*` (comment says it's for the
  blackout) and `logs:CreateLogGroup|CreateLogStream|PutLogEvents` on
  `/gigbuddy/deploy-force` (audit log only). Nothing else in CI uses either. `ci.yml` doesn't
  assume the role at all.
- `api/src/ddb/gigs.ts` replicates `londonIsoDate` from the script and its test asserts the
  two agree. After this story the api copy is the only one; the `upcoming-gigs` route still
  uses it (its web callers were removed in 7.1, but the endpoint stays; not this story).

### Why removing the IAM grants is safe

The deploy role only drives CDK, S3 sync, CloudFront invalidation and the smoke tests
(plain `curl`). CloudFormation changes run under the CDK bootstrap exec role, not the deploy
role, so the deploy role needs no table access to deploy `GigbuddyData` or `GigbuddyApi`.
`cdk deploy --all` includes `GigbuddyCi`, so the narrowed role is applied by the same push.
The deploy role updating its own policy mid-run is fine: the run's credentials are already
issued and the later steps (S3, CloudFront, `describe-stacks`) keep their grants.

### Left alone on purpose

- The CloudWatch log group `/gigbuddy/deploy-force` was created by the workflow, not CDK, so
  it stays in AWS with its old audit events. Harmless; Sandy can delete it by hand if wanted.
- The "Test" gig dated 2026-10-29 in production no longer blocks anything; deleting it is
  Sandy's call, not this story.
- Service worker `skipWaiting: false` / `clientsClaim: false` stays: it's what stops an
  update activating mid-gig, independent of deploy timing.
- PRD, epics Story 1.6/AR-29/AR-30 and old story files stay as history; the 2026-10-28
  decision in epics.md and the architecture note record the change.

### Review depth

No app state, navigation or data, but it changes the deploy pipeline and IAM; a mistake
breaks deploys. Run the full three-layer review (retro P1 spirit), focused on the workflow
and `ci-stack.ts` diff.

### Testing

- `ci-stack.test.ts`: the new "no dynamodb/logs actions" test plus the existing role/trust
  tests.
- `infra/bin/gigbuddy.test.ts` still synthesises all stacks without `tableArn`.
- `gigs.test.ts` keeps its five `londonIsoDate` cases under the new name.
- The workflow change itself is verified by the green deploy run after push.

### References

- `_bmad-output/planning-artifacts/epics.md` → "Decisions, 2026-10-28" and Story 7.30
- `_bmad-output/implementation-artifacts/epic-7-retro-2026-10-28.md` → Sandy's answer 2
- `_bmad-output/planning-artifacts/architecture.md` §6 (Deploy Automation + Gig-Window Blackout)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5

### Debug Log References

### Completion Notes List

- Tasks 1–5 done as specced. Red/green: replaced the two grant tests with one "no dynamodb:* or logs:* actions" test; `tableArn` removed from `CiStack`, `gigbuddy.ts` and both tests.
- `pnpm install` dropped `@aws-sdk/client-dynamodb` from `infra` and the lockfile. `git grep -i -e blackout -e deploy-force` outside `_bmad-output` is now empty.
- Task 6: `pnpm lint`, `typecheck`, `test` (shared 31, infra 32, api 130, web 454) and `build` all pass. Commit, push and the green deploy run (AC 8) are left until after code review, per the story workflow in AGENTS.md.

### File List

- .github/workflows/deploy.yml (modified)
- .github/workflows/deploy-force.yml (deleted)
- infra/scripts/blackout-check.ts, infra/scripts/blackout-check.test.ts (deleted)
- infra/package.json, pnpm-lock.yaml (modified)
- infra/lib/stacks/ci-stack.ts, ci-stack.test.ts (modified)
- infra/bin/gigbuddy.ts, gigbuddy.test.ts (modified)
- api/src/ddb/gigs.ts, gigs.test.ts (modified; comments and describe name)
- web/vite.config.ts (modified; comment only)
- infra/runbooks/bootstrap.md, restore-pitr.md (modified)
- _bmad-output/planning-artifacts/architecture.md, epics.md (modified)
- infra/tsconfig.json (modified; dropped `scripts/**/*` include, code review)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)

### Change Log

- 2026-10-28: Removed the deploy blackout (workflow step, deploy-force workflow, script, IAM grants, docs).
- 2026-10-28: Code review (lightweight, inline): no blockers; confirmed the table-ARN export stays (GigbuddyApi imports it), so dropping `tableArn` from CiStack is safe. Dropped the dead `scripts/**/*` include from infra/tsconfig.json; added epics.md to the File List.
- 2026-10-28: Deployed ed9e22c; Actions run 40688166288 green, GigbuddyCi UPDATE_COMPLETE (narrowed deploy role applied). Status → done.
