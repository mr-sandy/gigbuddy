---
baseline_commit: ab242f994b91cd6a5111a0b539bf8b2b10669764
---

# Story 7.13: Key setlists by ID, not date

Status: review

<!-- Source: epics.md "Epic 7 / Story 7.13" (revised 2026-10-26: fix the key, not the symptom). -->

## Story

As Sandy,
I want changing a gig's date to update the gig in place,
so that a gig never shows up twice or reverts to its old details.

## Acceptance Criteria

See epics.md Story 7.13 (AC 1–8). Summary: setlist `sk = SETLIST#<setlistId>`; `gsi1pk`/`gsi1sk`
unchanged (`<date>#<setlistId>`), so gig-list order is unchanged; `getSetlist` is a `GetItem`,
`deleteSetlist` a single `DeleteItem` (7.12's delete-every-copy loop goes); a date change
overwrites the same item and updates `gsi1sk`; stale writes still dropped by LWW; one-off prod
migration, shown to Sandy before anything changes, run immediately before the deploy;
architecture.md key docs updated; no record-shape, web or infra change.

## Tasks / Subtasks

- [x] **Task 1: DDB wrapper** (AC 1–4) — `api/src/ddb/setlists.ts`
  - [x] `setlistKey(bandId, setlistId)` → `{ pk: BAND#<bandId>, sk: SETLIST#<setlistId> }` (drop
    the date parameter). `setlistGsi1Key` unchanged.
  - [x] `getSetlist`: `GetCommand` with `Key: setlistKey(bandId, setlistId)`; no `Item` →
    `undefined`; otherwise `stripKeyAttrs(Item)` (still Zod-parses, so schema drift still throws).
  - [x] `putSetlist`: `PutCommand` with the new `sk` and the GSI1 key from `gigMeta.date`. A date
    change now overwrites the one item and moves `gsi1sk`. No condition expression needed — LWW
    stays in the route.
  - [x] `deleteSetlist`: one `DeleteCommand` on `setlistKey(...)`. Deleting a missing key is a
    DDB no-op, so "missing gig succeeds quietly" (7.12 AC) still holds with no extra read.
  - [x] Remove `QueryCommand` usage from get/delete (`listSetlistsByBand` keeps its GSI1 query).
    Rewrite the module header comment: new key table, and replace the "getSetlist uses Query not
    GetCommand" trade-off paragraph with one line saying the date lives only in `gsi1sk` so a
    date change can't leave a copy (Story 7.13).
- [x] **Task 2: Tests** (AC 7)
  - [x] `api/src/ddb/setlists.test.ts`: `rawItem` uses the new `sk`. Replace the `getSetlist`
    Query tests with `GetCommand` tests: returns parsed setlist (key attrs stripped), `undefined`
    when no `Item`, throws on malformed item, sends `Key: { pk, sk: SETLIST#<id> }`. `putSetlist`:
    new `sk`; **date change** — two puts with different dates send the same `Key`/`sk` and
    different `gsi1sk`. `deleteSetlist`: exactly one `DeleteCommand` with the new key, no
    `QueryCommand`. Drop the "every copy" and pagination-for-get tests.
  - [x] `api/src/routes/setlists.test.ts` (mocks the ddb module): existing PUT tests already cover
    unchanged date (apply) and stale write (`dropped-as-stale`, `putSetlist` not called). Add one:
    PUT with a changed `gigMeta.date` and newer `clientWrittenAt` → `applied` and `putSetlist`
    called once with the new date. Delete route tests stay as they are.
  - [x] Fixture tidy: `sk` in `api/src/ddb/gigs.test.ts` (lines ~39, ~109) → `SETLIST#<id>`
    (cosmetic; `listUpcomingGigs` reads GSI1 only). `gigs.ts` needs no change.
- [x] **Task 3: Migration script** (AC 5) — `api/scripts/migrate-setlist-keys.ts`, run with
  `pnpm --filter api exec tsx scripts/migrate-setlist-keys.ts [--apply]`, `--region eu-west-2`
  via `AWS_REGION=eu-west-2`, table `gigbuddy-data` (or `TABLE_NAME` env), band `ACTIVE_BAND_ID`
  from `@gigbuddy/shared`.
  - [x] Query `pk = BAND#<bandId> AND begins_with(sk, 'SETLIST#')` (paginate). Group by
    `setlistId`. Winner per group = latest `clientWrittenAt` (tie → latest `serverReceivedAt`).
  - [x] Default (no `--apply`) is a dry run: print one line per `setlistId` — venue, date, item
    count, and the `sk`s — flagging groups with more than one item, then totals. Change nothing.
  - [x] `--apply`: for each group, `PutCommand` the winner (record fields, untouched) under the
    new key + `setlistGsi1Key` from its own date, **then** `DeleteCommand` every item in the
    group whose `sk` ≠ the new `sk`. Put-before-delete means nothing is lost if it stops halfway;
    re-running is harmless. Print what it did and end with the remaining item count per
    `setlistId` (must be 1).
  - [x] Keep it self-contained (lib-dynamodb directly; build key strings inline with a comment
    pointing at `ddb/setlists.ts`). It lives outside `src/`, so it isn't bundled into the Lambda
    and isn't in the api `tsc` include — it must still pass `pnpm lint` (Biome covers it).
    Header comment: one-off for Story 7.13, not app code.
- [x] **Task 4: Docs** (AC 6) — `_bmad-output/planning-artifacts/architecture.md` line ~227
  (item shapes) and line ~503 (key prefixes): `SETLIST#<isoDate>#<setlistId>` →
  `SETLIST#<setlistId>`; add `gsi1sk = <isoDate>#<setlistId>` beside the setlist item shape
  so it's clear where the date ordering lives.
- [x] **Task 5: Verify** (AC 7): `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- [ ] **Task 6: Migrate, then deploy** (AC 5, 8) — after code review, in this order:
  1. Commit the story (do **not** push yet — push to `main` triggers `deploy.yml`).
  2. Check the deploy won't be blocked by the gig blackout window (Story 1.6): no gig today or
     tomorrow (Europe/London). If there is one, stop and ask Sandy.
  3. Dry run against prod with Sandy's AWS credentials; **show Sandy the output and wait for
     Sandy's go-ahead.** Note the time (PITR restore point).
  4. `--apply`; confirm every `setlistId` now has exactly one item at `SETLIST#<setlistId>`.
  5. Push straight away; watch the deploy to green.

## Dev Notes

- **Only `api/src/ddb/setlists.ts` builds or queries the setlist key** (confirmed by grep). The
  route, web, shared schema, `ddb/gigs.ts` (GSI1 range on `gsi1sk`), blackout check (GSI1) and
  infra are untouched. The GSI1 key attributes are unchanged, so list order and the
  `/upcoming-gigs` range query are unaffected.
- **Why the order is safe:** the *old* code's `getSetlist`/`deleteSetlist` query
  `begins_with(sk, 'SETLIST#')` and filter by `setlistId`, so they still read and delete
  migrated items in the minutes between migration and deploy. The *new* code can't see
  unmigrated items (a `GetItem` on `SETLIST#<id>` misses `SETLIST#<date>#<id>`), so the migration
  must come first. Sandy doesn't edit gigs in between, so no dual-read (epics AC 5).
- **Route PUT flow is unchanged:** `getSetlist` → `compareLww` → `putSetlist`. With the new key
  `getSetlist` always returns the one current item, which also fixes "opens with old details".
- **Removed by this story:** the 7.12 multi-copy delete loop and its test; the partition-scan
  `getSetlist` and its pagination test. Keep `DeleteCommand`, `GetCommand`, `PutCommand`,
  `QueryCommand` imports only as still used.
- **Testing pattern:** `aws-sdk-client-mock` on the cached DocClient (see top of
  `setlists.test.ts` — don't reset the client cache in `afterEach`). `ddbMock.on(GetCommand)
  .resolves({ Item: ... })` / `.resolves({})`.
- **No new dependencies.** `GetCommand` is in `@aws-sdk/lib-dynamodb` already; `tsx` is an api
  devDependency.
- **7.12 status:** sprint-status still has `7-12-delete-a-gig: review` (commit 72fc6de exists;
  deploy/live check not recorded). Close 7.12 out before starting this story, since this story
  rewrites its delete code.

### References

- epics.md § Story 7.13; 7-12-delete-a-gig.md (delete loop being replaced)
- `api/src/ddb/setlists.ts`, `api/src/routes/setlists.ts`, `api/src/ddb/gigs.ts`
- architecture.md lines ~215–235 (item shapes), ~500–504 (key naming)
- `.github/workflows/deploy.yml` (push to `main` deploys); `infra/runbooks/restore-pitr.md`
  (PITR, `--region eu-west-2`)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5

### Completion Notes List

- Tasks 1–5 done: setlist `sk` is now `SETLIST#<setlistId>`; `getSetlist` is a `GetCommand`, `deleteSetlist` a single `DeleteCommand`; `gsi1sk` unchanged. DDB, route and fixture tests updated/added (date-change overwrite, route PUT with changed date). `pnpm lint`, `typecheck`, `test`, `build` all green.
- Migration script written (`api/scripts/migrate-setlist-keys.ts`), **not yet run** against prod.
- Task 6 (commit → dry run shown to Sandy → `--apply` → push/deploy) is deliberately left open: it follows code review and needs Sandy's go-ahead on the dry-run output. 7.12 was already `done` in sprint-status.

### File List

- api/src/ddb/setlists.ts
- api/src/ddb/setlists.test.ts
- api/src/ddb/gigs.test.ts
- api/src/routes/setlists.test.ts
- api/scripts/migrate-setlist-keys.ts (new)
- biome.json (lint api/scripts)
- _bmad-output/planning-artifacts/architecture.md
- _bmad-output/implementation-artifacts/7-13-key-setlists-by-id-not-date.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-10-26: Story created; status → ready-for-dev.
- 2026-10-26: Implemented tasks 1–5; status → review (Task 6 migrate + deploy pending code review).
- 2026-10-26: Code review (lightweight). Fixed: Biome wasn't linting `api/scripts/` (added to `biome.json`); dry run now marks the kept copy with `*`; header no longer suggests `AWS_REGION` (region is fixed). Lint green.
