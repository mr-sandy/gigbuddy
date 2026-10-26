---
baseline_commit: a049002
---

# Story 7.16: Purge per-gig notes

Status: done

<!-- Source: epics.md "Epic 7 / Story 7.16" and the 2026-10-26 decisions under Epic 7. -->

## Story

As Sandy,
I want per-gig notes gone from GigBuddy,
so that setlists are just songs in order and there's one less thing to think about.

## Acceptance Criteria

1. `perGigAnnotation` is removed from `SongRefSchema` in `shared/`. A song ref is `songId` and
   `titleSnapshot` only.
2. Reads never return the field: a stored setlist that still has a note comes back from the
   API, the gig pages and `GET /api/v1/export` without it.
3. A setlist PUT whose song refs still carry `perGigAnnotation` (an old cached client) is
   accepted, and the note is dropped rather than stored. No 400.
4. Editing a setlist as text no longer carries notes across (the 7.10 carry-over goes).
5. A one-off script, `api/scripts/purge-per-gig-notes.ts`, removes the field from the stored
   setlist items. Dry run by default: it lists each gig and each note it would remove, so
   Sandy sees what goes. `--apply` rewrites only the items that have a note, changing
   nothing else, then re-reads and confirms none are left. Re-running is harmless.
6. `architecture.md` no longer describes per-gig annotations as part of the record.
7. No UI change: notes aren't shown anywhere today. No change to `infra/`.
8. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass. Tests cover: a stored
   note is stripped on read; a PUT with a note is accepted and stored without it; the export
   has no notes; the text editor no longer keeps them.
9. Deployed to gig.cormie.com via the normal pipeline; the purge runs after Sandy has seen
   the dry run.

## Tasks / Subtasks

- [x] **Task 1: Schema** (AC 1, 2, 3)
  - [x] `shared/src/schemas/setlist.ts`: delete the `perGigAnnotation` line from
    `SongRefSchema` and fix the header comment ("`SongRef[]` (songId + titleSnapshot)").
  - [x] Leave `SongRefSchema` as a plain (non-strict) `z.object`. Zod's default is to strip
    unknown keys, and that is what gives AC 2 and 3 for free:
    - Reads: `api/src/ddb/setlists.ts` `stripKeyAttrs` runs `SetlistSchema.parse`, so a stored
      note is dropped before it reaches a route or the export.
    - Writes: `SetlistPutInputSchema` is `.strict()` only at the top level (Zod's `.strict()`
      is shallow), so a nested `perGigAnnotation` is stripped, not rejected.
      `api/src/routes/setlists.ts` builds the stored record from `parsed.data`, never the raw
      body.
  - [x] Do **not** make `SongRefSchema` strict: an installed PWA on an old build could still
    send the field, and a 400 on save mid-gig prep is worse than a silent drop.
- [x] **Task 2: Web** (AC 4)
  - [x] `web/src/lib/setlist-text.ts`: remove the `annotations` map, the loop lines that fill
    it, and the spread in the `SongRef` literal. The ref becomes
    `{ songId: match.songId, titleSnapshot: match.title }`. Keep `previousIds` (renamed-song
    matching) exactly as it is; it shares the same loop over `previous`.
  - [x] Keep the `previous` parameter: it is still needed for renamed titles.
- [x] **Task 3: Tests** (AC 2, 3, 4, 8)
  - [x] `api/src/ddb/setlists.test.ts`: fixture `makeSetlist` has
    `perGigAnnotation: 'start slow'` and will no longer typecheck as `Setlist`. Drop it from
    the fixture, and add one test where the raw DDB item (built with `rawItem`, then the extra
    field added) has a note: `getSetlist` / `listSetlistsByBand` return the ref without
    `perGigAnnotation` (`not.toHaveProperty`).
  - [x] `api/src/routes/setlists.test.ts`:
    - Line ~66 fixture: drop the note.
    - The "atomicity … AND annotation" test (~237–280): remove the notes from `existing` and
      `replacement` and drop "annotation" from its name and comment; it still covers reorder
      plus a new section in one PUT.
    - New test: PUT a body whose song ref has `perGigAnnotation` (build it as a plain object or
      cast — the type no longer allows it). Expect 200 `applied`, and `putSetlistMock`
      called with a record whose ref has no `perGigAnnotation`.
  - [x] `api/src/routes/export.test.ts` (~129–196): drop the note from the fixture and the
    comment. Make `listSetlistsByBand` mock data the parsed shape (it is mocked, so the strip
    is proven in the ddb test, not here). Replace the `.toBe('half-time feel')` assertion with
    `not.toHaveProperty('perGigAnnotation')` on that ref, or just remove it — the ddb test is
    the real proof. Prefer removing to avoid a test that proves nothing.
  - [x] `shared/src/schemas/export.test.ts` (~27, ~72): change it to show the schema strips the
    field: parse an archive whose ref has a note, expect the parsed ref has no
    `perGigAnnotation`.
  - [x] `web/src/lib/setlist-text.test.ts` (~83–99): replace "keeps a stored annotation
    through a reorder" with "drops a stored note": previous refs carry
    `perGigAnnotation` (cast the fixture), the parsed songs equal plain `ref(...)`s.
  - [x] `web/src/routes/gig-edit.test.tsx:36` and `setlist-edit.test.tsx:35,86`: remove the
    note from fixtures/expectations. Read each test first: if one asserted the note
    survived a save, change it to assert it does not.
- [x] **Task 4: Purge script** (AC 5)
  - [x] New `api/scripts/purge-per-gig-notes.ts`, modelled on
    `api/scripts/migrate-setlist-keys.ts` (same header style, client setup, `ACTIVE_BAND_ID`,
    `TABLE_NAME` env default `gigbuddy-data`, region fixed to eu-west-2, same `loadItems`
    query on `pk = BAND#<bandId>` and `begins_with(sk, 'SETLIST#')`).
  - [x] Run with `pnpm --filter api exec tsx scripts/purge-per-gig-notes.ts [--apply]`.
  - [x] Dry run (default): for each item with any note, print `setlistId  venue  date` then one
    indented line per note: section name, song title (`titleSnapshot`), note text. End with
    `N setlists, M with notes, K notes in total.`
  - [x] `--apply`: for each item with notes, `PutCommand` the same item (all keys and fields
    unchanged, including `clientWrittenAt` and `serverReceivedAt`) with `perGigAnnotation`
    removed from every song ref. Skip items with no notes. Then re-load and print `OK` if no
    ref anywhere has the field, else list the ones that do.
  - [x] Do not touch `clientWrittenAt`/`serverReceivedAt`: this is housekeeping, not an edit,
    and bumping them could make a client's next save look stale.
  - [x] `biome.json` already lints `api/scripts/` (added in 7.13); check the new file passes.
  - [x] Leave `migrate-setlist-keys.ts` alone.
- [x] **Task 5: Docs** (AC 6)
  - [x] `_bmad-output/planning-artifacts/architecture.md`: remove `PerGigAnnotation` from the
    record-schema list (~131), `perGigAnnotation?` from the setlist shape (~230) and the
    schema snippet (~559), "annotations" from the setlist content decision (~213, ~251),
    "Per-gig annotation edit" from the LWW bullet (~244), the example key in the naming
    line (~498 — swap for another real key or drop it), and the per-gig annotation clause in
    the colour-never-alone line (~844). Add a one-line note where the setlist shape is
    described: "Per-gig notes removed in Story 7.16 (2026-10-26)." Don't rewrite anything
    else.
- [x] **Task 6: Verify, commit, deploy, purge** (AC 8, 9)
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all green.
  - [x] `git grep -n perGigAnnotation -- shared api/src web e2e` returns only the deliberate
    "old client sends it" / "stored item has it" test fixtures.
  - [x] After code review: commit `Implement story 7.16: Purge per-gig notes`, push, and let
    the normal pipeline deploy.
  - [x] Dry run against prod with Sandy's AWS credentials; **show Sandy the output and wait for
    a go-ahead** before `--apply`. If the permission check blocks `--apply`, ask Sandy to run
    it (`! pnpm --filter api exec tsx scripts/purge-per-gig-notes.ts --apply`), as in 7.13.
  - [x] Order with the deploy doesn't matter (old code tolerates a missing note, new code
    strips one), but deploying first means no new note can be written after the purge.
  - [x] Note the dry-run time in the Change Log: it's the PITR restore point if a note is
    wanted back.

## Dev Notes

### What this story is

Housekeeping. Sandy decided on 2026-10-26 that per-gig notes only add complication. Nothing
in the web app shows them since the 7.1 reset; the only live code path is the 7.10 text
editor quietly carrying them through a save. The field leaves the schema, reads and writes
drop it, and a one-off script clears it out of DynamoDB. Song-level fields (`performanceNotes`,
`practiceNotes`, chord chart, key, patch in `SongSchema`) are not touched.

### Design choices

- **Strip, don't reject.** Default Zod stripping removes the field on read and write with
  no extra code. A strict schema would 400 an old cached client's save.
- **Script, not lazy cleanup.** Stripping on read hides notes, but they'd linger in DDB (and
  in any raw table export) until each gig is next saved. "Purge" means gone; the script does
  it once and shows Sandy exactly what is being removed first.
- **Timestamps untouched by the script.** The LWW comparison uses `clientWrittenAt`; leaving it
  alone means the purge can never cause or win a conflict.
- **PITR is the undo.** The table has point-in-time recovery; the dry-run time is the restore
  point.

### Facts verified when the story was written (2026-10-26)

- `perGigAnnotation` appears in code only at: `shared/src/schemas/setlist.ts:19` (schema),
  `web/src/lib/setlist-text.ts:39–46, 79–83` (carry-over), and test fixtures in
  `api/src/ddb/setlists.test.ts`, `api/src/routes/setlists.test.ts`,
  `api/src/routes/export.test.ts`, `shared/src/schemas/export.test.ts`,
  `web/src/lib/setlist-text.test.ts`, `web/src/routes/gig-edit.test.tsx`,
  `web/src/routes/setlist-edit.test.tsx`. Nothing in `e2e/` or `infra/`.
- `SongRefSchema` and `SectionSchema` are plain `z.object` (strip mode).
  `SetlistPutInputSchema = SetlistSchema.omit({ serverReceivedAt: true }).strict()` — top
  level only.
- `ExportSchema` composes `SetlistSchema`, and the export route reads through
  `listSetlistsByBand` (which parses), so it inherits the change.
- `web/src/routes/gig-edit.tsx` carries `sections` from the loaded setlist, which is already
  parsed by the API, so a gig-details save can't re-send a note.
- Prod: 7 setlists at data load, 9 at the 7.13 migration. Whether any carry notes is unknown
  until the dry run; zero is a fine result.

### Guardrails

- Zod in `shared/` is the only source of the record shape. Don't add a TypeScript type that
  re-introduces the field "for legacy items"; use a local `Record<string, unknown>` in the
  script and casts in the two tests that need an old-shaped object.
- `api/src/ddb/*` stays the only DDB surface for app code; the script is not app code
  (same exemption as 7.13's script) and must not be imported by anything.
- One commit for the story. Don't fold in the export-link story (next in the queue).
- British English in comments and copy.

### Project Structure Notes

- Changed: `shared/src/schemas/setlist.ts`, `web/src/lib/setlist-text.ts`, the seven test
  files above, `_bmad-output/planning-artifacts/architecture.md`.
- New: `api/scripts/purge-per-gig-notes.ts`.

### Previous story intelligence

- 7.13 set the one-off-script pattern: dry run by default, `--apply` to write, verify after,
  show Sandy the dry run before applying. Its `--apply` was blocked by the permission check
  and Sandy ran it — expect the same and ask rather than retry.
- 7.15 and 7.14 were web-only; the API test helpers (`makeSetlist`, `putInput`,
  `authedRequest`, `rawItem`) are unchanged since 7.13.

### References

- `_bmad-output/planning-artifacts/epics.md` — Epic 7 decisions (2026-10-26), Story 7.16
- `_bmad-output/implementation-artifacts/7-13-key-setlists-by-id-not-date.md` — script and
  migration-run pattern
- `_bmad-output/implementation-artifacts/7-10-edit-the-setlist-as-text.md` — origin of the
  note carry-over
- `api/scripts/migrate-setlist-keys.ts`

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5

### Debug Log References

### Completion Notes List

- Removed `perGigAnnotation` from `SongRefSchema`; Zod default stripping drops stored notes on read and old-client notes on PUT (no 400).
- Removed the note carry-over from `setlist-text.ts`; `previousIds` untouched.
- Added `api/scripts/purge-per-gig-notes.ts` (dry run default, `--apply` rewrites only items with notes, re-reads and prints OK). Not run yet.
- Tests: new ddb read-strip test, PUT-with-note test, shared schema strip test, text-editor drops-note test; fixtures cleaned. Export test assertion on the note removed.
- architecture.md updated. lint, typecheck, test (api 130, shared 31, web 302, infra 55) and build pass.
- Task 6 remainder (commit, deploy, prod dry run, Sandy's go-ahead, `--apply`) follows code review per the one-story workflow.

### File List

- shared/src/schemas/setlist.ts
- shared/src/schemas/export.test.ts
- web/src/lib/setlist-text.ts
- web/src/lib/setlist-text.test.ts
- web/src/routes/gig-edit.test.tsx
- web/src/routes/setlist-edit.test.tsx
- api/src/ddb/setlists.test.ts
- api/src/routes/setlists.test.ts
- api/src/routes/export.test.ts
- api/scripts/purge-per-gig-notes.ts (new)
- _bmad-output/planning-artifacts/architecture.md

### Change Log

- 2026-10-26: Story created; status → ready-for-dev.
- 2026-10-26: Implemented; status → review.
- 2026-10-26: Code review (lightweight): clean. Two minor notes left as they are by Sandy (no
  write guard in the one-off purge script; the shared strip test parses a setlist, not an
  archive). Committed and pushed to deploy.
- 2026-10-26: Committed fe34e4d; deploy run 40409337105 and CI green. Sandy ran the prod dry
  run (9 setlists, 2 with notes, 5 notes: Big Ed's Wedding 2026-05-24, Howlin Wolf
  2026-04-24) and then `--apply`: OK, no notes left. Restore point is just before the apply
  run, 2026-10-26.
- 2026-10-26: Sandy's live check: all good. Status → done.
