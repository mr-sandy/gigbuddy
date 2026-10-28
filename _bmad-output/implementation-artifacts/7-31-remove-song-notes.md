---
baseline_commit: 3f5612e
---

# Story 7.31: Remove song notes

Status: done

<!-- Source: epics.md "Epic 7 / Story 7.31" and "Decisions, 2026-10-28" under Epic 7. -->

## Story

As Sandy,
I want performance notes and practice notes gone from songs,
so that a song is just its title, key, patch and chart.

## Acceptance Criteria

1. `performanceNotes` and `practiceNotes` are removed from `SongSchema` in `shared/`.
2. Reads never return them: a stored song that still has notes comes back from the API, the
   song pages and `GET /api/v1/export` without them.
3. A song PUT that still carries either field (an old cached build, or a save queued before
   the deploy) is accepted and the notes are dropped, not stored. No 400. Any other unknown
   key still gets a 400.
4. The add/edit song sheet no longer copies notes into the saved record.
5. A one-off script, `api/scripts/purge-song-notes.ts`, removes both fields from the stored
   song items. Dry run by default: it lists each song and each note it would remove.
   `--apply` rewrites only the songs that have notes, changing nothing else, then re-reads
   and confirms none are left. Re-running is harmless.
6. `architecture.md` no longer lists the two fields as part of the song record.
7. No visible UI change. No change to `infra/`.
8. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.
9. Deployed to gig.cormie.com via the normal pipeline; the purge runs after Sandy has seen
   the dry run.

## Tasks / Subtasks

- [x] **Task 1: Schema** (AC 1, 2)
  - [x] `shared/src/schemas/song.ts`: delete the `performanceNotes` and `practiceNotes` lines
    from `SongSchema`. Leave `SongSchema` as a plain (non-strict) `z.object`: Zod's default
    strip is what drops stored notes on read. `api/src/ddb/songs.ts` `getSong` and
    `listSongsByBand` both run `SongSchema.parse`, and the export route reads through
    `listSongsByBand`, and `ExportSchema` composes `SongSchema`, so AC 2 needs no other code.
  - [x] Leave `SongPutInputSchema` as `SongSchema.omit({ serverReceivedAt: true }).strict()`.
    The strict contract stays for every other key (AC 3, last sentence).
- [x] **Task 2: API accepts and drops the retired keys** (AC 3)
  - [x] **Why this is needed (differs from 7.16):** `SongPutInputSchema` is `.strict()` at the
    top level, so after Task 1 a body with `performanceNotes` would 400. The service worker
    is `registerType: 'prompt'`, `skipWaiting: false` (`web/vite.config.ts:12,17`), so the
    phone can keep running the old build after the deploy. The old build's `song-edit.tsx`
    copies notes from its cached song into the PUT. The outbox flusher drops any 4xx entry
    (`web/src/sync/flusher.ts:153`), so a chart or key edit would be silently lost.
  - [x] In `api/src/routes/songs.ts` PUT handler, after `c.req.json()` and before
    `SongPutInputSchema.safeParse`, remove the two retired keys from the body when it is a
    plain object, e.g. a small local helper `dropRetiredKeys(body)` that returns
    `{ ...rest }` without `performanceNotes` / `practiceNotes`. One short comment: retired in
    Story 7.31; an old cached build may still send them; dropping beats a 400 that the
    outbox would discard. Don't touch the schema for this: keep the shim in the route, where
    it can be deleted later without a schema change.
  - [x] The stored record is built from `parsed.data` (already true), so nothing else changes.
- [x] **Task 3: Web** (AC 4)
  - [x] `web/src/routes/song-edit.tsx`: remove the two `initial?.performanceNotes` /
    `initial?.practiceNotes` spreads in `onSubmit` (~122–125). After Task 1 these no longer
    typecheck, which is the prompt.
  - [x] Fix the header comment (~29–31): drop the sentence about copying stored performance
    and practice notes. Keep "Save writes through `useSongMutation` as a whole-record PUT".
  - [x] Nothing in `web/src/routes/song.tsx` reads the fields (verified); no change there.
  - [x] The persisted query cache on the phone may still hold songs with notes until the next
    refetch. Harmless: nothing reads them, and the new edit sheet builds the record field by
    field (the existing "no spreading `initial`" rule).
- [x] **Task 4: Tests** (AC 2, 3, 4, 8)
  - [x] `shared/src/schemas/song.test.ts`: remove the notes from `validSong`. Add one test:
    `SongSchema.parse` of a song with both notes returns an object without them
    (`not.toHaveProperty`). Add one: `SongPutInputSchema` still rejects an unknown key
    (e.g. `colour: 'red'`), so the strict contract is proven.
  - [x] `api/src/ddb/songs.test.ts`: add a test where the raw DDB item has both notes;
    `getSong` and `listSongsByBand` return songs without them.
  - [x] `api/src/routes/songs.test.ts` (PUT block, ~135):
    - New: PUT a body with `performanceNotes` and `practiceNotes` (plain object; the type no
      longer allows them). Expect 200 `applied`, and the `putSong` mock called with a record
      that has neither field.
    - New: PUT a body with another unknown key still returns 400 `VALIDATION_FAILED`.
  - [x] `web/src/routes/song-edit.test.tsx`: `fullSong` (~107–108) keeps the two notes, cast
    as an old-shaped cached record if the mock type complains. In the save test (~194–195)
    replace the two `toBe` lines with `not.toHaveProperty('performanceNotes')` and
    `not.toHaveProperty('practiceNotes')`: proves AC 4 even when the cache still has them.
  - [x] `web/src/routes/song.test.tsx` (~110–125): the "without the notes" test can stay as
    it is (it already proves nothing shows); drop ", without the notes" from the name only
    if the fixture no longer carries them. Prefer keeping the fixture: an old cached record
    is the realistic case.
- [x] **Task 5: Purge script** (AC 5)
  - [x] New `api/scripts/purge-song-notes.ts`, modelled closely on
    `api/scripts/purge-per-gig-notes.ts`: same header style, client setup, `ACTIVE_BAND_ID`,
    `TABLE_NAME` env default `gigbuddy-data`, region eu-west-2, same `loadItems` but with
    `':skPrefix': 'SONG#'`.
  - [x] Run with `pnpm --filter api exec tsx scripts/purge-song-notes.ts [--apply]`.
  - [x] Dry run (default): for each song with either field, print `songId  title`, then one
    indented line per note: `performance: <text>` / `practice: <text>`. End with
    `N songs, M with notes, K notes in total.`
  - [x] `--apply`: `UpdateCommand REMOVE` both fields, conditional on the item existing (all other keys and
    fields unchanged, `clientWrittenAt` and `serverReceivedAt` included). Skip songs with no
    notes. Then re-load and print `OK — no notes left.` or list songs still holding them.
  - [x] Don't change timestamps: housekeeping, not an edit; LWW must not see a newer write.
  - [x] Leave `purge-per-gig-notes.ts` and `migrate-setlist-keys.ts` alone. Check biome
    passes on the new file (it lints `api/scripts/`).
- [x] **Task 6: Docs** (AC 6)
  - [x] `_bmad-output/planning-artifacts/architecture.md`: remove the two fields from the
    song record line (~225, the `{ title, key, patch, chordChart, ... }` block) and from the
    `SongSchema` snippet (~552–553). Add a one-line note by the song record:
    "Performance and practice notes removed in Story 7.31 (2026-10-28)." Don't rewrite
    anything else.
- [x] **Task 7: Verify, commit, deploy, purge** (AC 8, 9)
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all green.
  - [x] `git grep -nE 'performanceNotes|practiceNotes' -- shared api/src web e2e` returns only
    the route shim and the deliberate "old client sends it" / "stored item has it" fixtures.
  - [x] Full three-layer code review (this story touches data: retro decision P1).
  - [x] Commit `Implement story 7.31: Remove song notes`, push, let the pipeline deploy.
  - [x] Deploy before the purge: the old API would happily store notes again from an old
    build; the new one can't.
  - [x] Dry run against prod as a **separate step** after the deploy (retro P2): show Sandy
    the output and **wait for a go-ahead** before `--apply`. If the permission check blocks
    `--apply`, ask Sandy to run
    `! pnpm --filter api exec tsx scripts/purge-song-notes.ts --apply` (as in 7.13 and 7.16).
  - [x] Note the apply time in the Change Log: it is the PITR restore point if a note is ever
    wanted back. The dry-run output itself is also a record of what was removed.

### Review Findings

- [x] [Review][Patch] Purge `--apply` rewrites the whole item with an unconditional Put: an edit or delete made between load and write is overwritten or resurrected. Use `UpdateCommand` `REMOVE performanceNotes, practiceNotes` with `attribute_exists(pk)`, treating a failed condition as skipped [api/scripts/purge-song-notes.ts:68]
- [x] [Review][Patch] Post-apply verification Query is eventually consistent and can falsely report `STILL HAS NOTES`; add `ConsistentRead: true` [api/scripts/purge-song-notes.ts:29]
- [x] [Review][Patch] Old-build PUT test never asserts `putSong` was called or that the outcome is `applied` (Task 4 says "Expect 200 `applied`") [api/src/routes/songs.test.ts:159]
- [x] [Review][Patch] Read-strip test also covers `listSongsByBand` but sits under `describe('getSong')`; give it its own describe [api/src/ddb/songs.test.ts:49]
- [x] [Review][Patch] architecture.md doesn't record that song PUT drops the two retired keys before the strict parse, so the shim reads as removable cruft [_bmad-output/planning-artifacts/architecture.md:227]
- [x] [Review][Patch] File List omits `sprint-status.yaml`, `epics.md` and this story file [7-31-remove-song-notes.md:213]

## Dev Notes

### What this story is

Housekeeping, the song-level twin of 7.16. At the Epic 7 retro (2026-10-28) Sandy chose to
remove performance and practice notes rather than show them. Nothing has shown them since
the 7.1 reset; the only live code path is the edit sheet carrying them through a save so a
whole-record PUT doesn't wipe them. The fields leave the schema, reads drop them, writes
from old builds are tolerated, and a one-off script clears them from DynamoDB.

### Design choices

- **Strip on read via Zod default.** No code beyond deleting two schema lines.
- **Shim in the route, not the schema.** `SongPutInputSchema` must stay strict (AR-23: an
  unknown key is a client bug). Making it non-strict would hide future bugs; a narrow,
  named drop of the two retired keys in the route keeps the contract and saves an old
  build's edit. It can be deleted in a later story once old builds are surely gone.
- **Script, not lazy cleanup.** As 7.16: "remove" means gone from the table and any raw
  export, and Sandy sees exactly what goes first.
- **Timestamps untouched by the script**, so the purge can't cause or win an LWW conflict.
- **PITR is the undo.** Plus the dry-run printout.

### Facts verified when the story was written (2026-10-28)

- The fields appear in code only at: `shared/src/schemas/song.ts:10–11`,
  `web/src/routes/song-edit.tsx:30, 122–125`, and test fixtures in
  `shared/src/schemas/song.test.ts:11–12`, `web/src/routes/song-edit.test.tsx:107–108,
  194–195`, `web/src/routes/song.test.tsx:115–116`. Nothing in `api/src`, `e2e/` or `infra/`.
- `SongSchema` is a plain `z.object` (strip). `SongPutInputSchema` is `.strict()` (top
  level).
- `getSong` and `listSongsByBand` in `api/src/ddb/songs.ts` parse every item with
  `SongSchema`; the export route uses `listSongsByBand`; `ExportSchema.songs` is
  `z.array(SongSchema)`.
- Service worker update is prompt-based (`web/vite.config.ts`); the outbox drops 4xx
  responses as schema bugs (`web/src/sync/flusher.ts:153`). Hence Task 2.
- Prod: 52 songs at the real-data load. Whether any carry notes is unknown until the dry
  run; zero is a fine result (then `--apply` is a no-op and can be skipped).

### Guardrails

- Zod in `shared/` is the only source of the record shape. No TypeScript type that brings
  the fields back "for legacy items"; use `Record<string, unknown>` in the script and casts
  or plain objects in tests.
- `api/src/ddb/*` stays the only DDB surface for app code; the script is not app code (same
  exemption as 7.13 and 7.16) and must not be imported by anything.
- Production-data commands run only after Sandy's explicit go-ahead, never batched with a
  push (retro P2).
- One commit for the story. British English in comments and copy.

### Project Structure Notes

- Changed: `shared/src/schemas/song.ts`, `api/src/routes/songs.ts`,
  `web/src/routes/song-edit.tsx`, tests (`shared/src/schemas/song.test.ts`,
  `api/src/ddb/songs.test.ts`, `api/src/routes/songs.test.ts`,
  `web/src/routes/song-edit.test.tsx`, possibly `web/src/routes/song.test.tsx`),
  `_bmad-output/planning-artifacts/architecture.md`.
- New: `api/scripts/purge-song-notes.ts`.

### Previous story intelligence

- 7.16 is the template: same strip-on-read approach, same script shape. Its prod run found
  5 notes in 2 setlists; Sandy ran `--apply` themselves after the dry run.
- 7.30 (just done) removed the deploy blackout, so the deploy isn't blocked by upcoming gigs.
- 7.29 added the edit sheet over the gig song page; it is the same `song-edit.tsx`, so Task 3
  covers both routes.

### References

- `_bmad-output/planning-artifacts/epics.md`: Epic 7 "Decisions, 2026-10-28", Story 7.31
- `_bmad-output/implementation-artifacts/epic-7-retro-2026-10-28.md`: Sandy's answer 4, P1, P2
- `_bmad-output/implementation-artifacts/7-16-purge-per-gig-notes.md`
- `api/scripts/purge-per-gig-notes.ts`

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5

### Debug Log References

### Completion Notes List

- Fields removed from `SongSchema`; Zod strip drops them on every read (API, export). PUT route drops the two retired keys before the strict parse; other unknown keys still 400. Edit sheet no longer copies notes. Purge script added (dry run default). architecture.md updated.
- lint, typecheck, test (web 454 passed, plus shared/api) and build all green. Remaining Task 7 steps (code review, commit, deploy, dry run, Sandy's go-ahead, apply) are still to do.

### File List

- shared/src/schemas/song.ts
- shared/src/schemas/song.test.ts
- api/src/routes/songs.ts
- api/src/routes/songs.test.ts
- api/src/ddb/songs.test.ts
- api/scripts/purge-song-notes.ts (new)
- web/src/routes/song-edit.tsx
- web/src/routes/song-edit.test.tsx
- _bmad-output/planning-artifacts/architecture.md
- _bmad-output/planning-artifacts/epics.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/7-31-remove-song-notes.md (new)

### Change Log

- 2026-10-28: Story created; status → ready-for-dev.
- 2026-10-28: Implemented Tasks 1–6; verification green; status → review.
- 2026-10-28: Code review (three layers): 6 patches applied (purge now a conditional UpdateCommand REMOVE with consistent reads; test and doc fixes), 9 dismissed. Remaining: commit, deploy, dry run, apply.
- 2026-10-28: Committed c27d06a; deploy run 40694216561 and CI green. Prod dry run: 66 songs, 0 with notes, 0 notes in total — nothing to apply, so no PITR restore point needed. Sandy checked the live app: looks fine; status → done.
