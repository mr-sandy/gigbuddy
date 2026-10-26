---
baseline_commit: aba8d62
---
# Story 7.11: Delete a song

Status: done

<!-- Source: epics.md "Epic 7 / Story 7.11". Decisions by Sandy 2026-10-26: block when in a setlist, second-tap confirm, real delete. -->

## Story

As Sandy,
I want to delete a song from the library,
so that I can clear out duplicates and songs the band no longer plays.

## Acceptance Criteria

See epics.md Story 7.11 (AC 1–12). Summary: "Delete song" on the song edit page → "Delete
<title>?" with "Yes, delete" / "Keep"; `DELETE /api/v1/songs/:songId` refuses (409) while the
song is in any setlist and the page names those gigs; real delete; online only; a queued edit
can't recreate it; AR-12 note; no soft delete, undo or bulk delete.

## Tasks / Subtasks

- [x] **Task 1: API** (AC 3–5)
  - [x] `api/src/ddb/songs.ts`: `deleteSong(bandId, songId)` via `DeleteCommand`.
  - [x] `api/src/routes/songs.ts`: `.delete('/:songId')`. If any setlist from
    `listSetlistsByBand(ACTIVE_BAND_ID)` has a section song with that `songId`, answer 409
    `{ status: 'error', error: { code: 'SONG_IN_USE', message } }` and delete nothing.
    Otherwise delete (missing song is fine) and answer 204.
  - [x] Tests in `api/src/routes/songs.test.ts`: delete, delete missing, 409 when in use.
- [x] **Task 2: Web API + hook** (AC 3, 6, 7)
  - [x] `apiFetch` method union gains `'DELETE'`.
  - [x] `web/src/api/songs.ts`: `deleteSong(songId): Promise<'deleted' | 'in-use'>`; 204 →
    deleted, 409 `SONG_IN_USE` → in-use, anything else throws (fetch throws offline).
  - [x] `outbox.ts`: `removePending(recordKey)` (pending entries only; an in-flight entry is
    left to the flusher — see the known gap below).
  - [x] `useSongMutation()` gains `deleteSong(songId)`: calls the API (not the outbox); on
    `deleted` drops outbox entries for the song, removes it from `['songs', band]` and removes
    `['song', band, songId]`. Returns the result; throws on failure.
- [x] **Task 3: UI** (AC 1, 2, 4, 6)
  - [x] `SONG_DELETE` microcopy block.
  - [x] `song-edit.tsx`, edit mode only: "Delete song" button below Save/Cancel. Tapping it
    shows either the confirm ("Delete <title>?", "Yes, delete", "Keep") or, if cached setlists
    (`useSetlists`) already show the song in use, the in-use line with each gig (venue, date)
    and "Keep". Server 409 → generic in-use line. Failure → plain failure line. Success →
    `/songs` (replace).
  - [x] Tests in `song-edit.test.tsx`: confirm, Keep, success, in-use (cache), in-use (409),
    failure; no delete button when adding.
- [x] **Task 4: Docs** (AC 8): architecture.md deletion-guardrails note.
- [x] **Task 5: Verify, commit, deploy** (AC 11, 12). Verified, committed, deployed; Sandy checked the live app 2026-10-26.

## Dev Notes

- DELETE `/api/v1/*` is already `NetworkOnly` in the service worker (`web/vite.config.ts`).
- Blocking delete while in use keeps setlist history intact (architecture.md "Setlist
  history first-class").
- Known gap: a PUT already in flight when the delete lands could recreate the song. Single
  user; accepted.

## Dev Agent Record

### Agent Model Used

claude-opus-5-5

### Completion Notes List

- Lint, typecheck, test (shared 30, infra 55, api 124, web 256) and build pass. Lambda already has `grantReadWriteData`, so no infra change.
- Self-review (lightweight, at Sandy's request): no findings. After a delete, Back from `/songs` reaches the deleted song's page, which shows "Song not found"; accepted.

### File List

- api/src/ddb/songs.ts, api/src/routes/songs.ts, api/src/routes/songs.test.ts
- web/src/api/client.ts, web/src/api/songs.ts, web/src/api/songs.test.ts
- web/src/sync/outbox.ts
- web/src/hooks/use-song-mutation.ts, web/src/hooks/use-song-mutation.test.tsx
- web/src/routes/song-edit.tsx, web/src/routes/song-edit.test.tsx
- web/src/lib/microcopy.ts
- _bmad-output/planning-artifacts/architecture.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-10-26: Implemented story 7.11 (delete a song); status → review.
- 2026-10-26: Code review (lightweight): clean. Applied one nit: "Yes, delete" is disabled while the request runs. Status → done.
- 2026-10-26: Deployed; Sandy's live check passed.
