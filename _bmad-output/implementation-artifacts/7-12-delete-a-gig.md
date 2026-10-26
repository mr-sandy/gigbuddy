---
baseline_commit: f2fc38f
---
# Story 7.12: Delete a gig

Status: review

<!-- Source: epics.md "Epic 7 / Story 7.12". Decisions by Sandy 2026-10-26: any gig (past or upcoming) can be deleted; same pattern as 7.11 (second-tap confirm, real delete, online only). -->

## Story

As Sandy,
I want to delete a gig,
so that I can clear out cancelled or wrongly entered gigs (and free their songs for deletion).

## Acceptance Criteria

See epics.md Story 7.12 (AC 1–12). Summary: "Delete gig" on the gig edit page → "Delete
<venue>, <date>?" with "Yes, delete" / "Keep" ("Yes, delete" disabled while the request runs);
`DELETE /api/v1/setlists/:setlistId` deletes the gig and its setlist (one record); any gig, past
or upcoming; real delete; missing gig succeeds quietly; online only; a queued edit can't
recreate it; AR-12 note; no soft delete, undo or bulk delete.

## Tasks / Subtasks

- [x] **Task 1: API** (AC 3–5)
  - [x] `api/src/ddb/setlists.ts`: `deleteSetlist(bandId, setlistId)`. The sort key includes the
    gig date (`SETLIST#<date>#<setlistId>`), so query the partition the way `getSetlist` does
    and `DeleteCommand` **every** item whose `setlistId` matches, not just the first (see
    "Date-change copies" below). Deleting the item also drops it from GSI1.
  - [x] `api/src/routes/setlists.ts`: `.delete('/:setlistId')` → `deleteSetlist(ACTIVE_BAND_ID,
    setlistId)` then 204. Missing gig is fine (204).
  - [x] Tests in `api/src/routes/setlists.test.ts`: delete, delete missing, and delete removes
    every copy with that `setlistId`.
- [x] **Task 2: Web API + hook** (AC 3, 6, 7)
  - [x] `web/src/api/setlists.ts`: `deleteSetlist(setlistId): Promise<void>`; 204 → resolves,
    anything else throws (fetch throws offline). Pattern: `deleteSong` in `web/src/api/songs.ts`.
  - [x] `useSetlistMutation()` gains `deleteSetlist(setlistId)`: calls the API (not the outbox);
    on success `removePending(setlistRecordKey(...))`, removes it from `['setlists', band]` and
    removes `['setlist', band, setlistId]`. Throws on failure. Pattern: `useSongMutation`.
- [x] **Task 3: UI** (AC 1, 2, 6)
  - [x] `GIG_DELETE` microcopy block (button "Delete gig", confirm, "Yes, delete", "Keep",
    failure line "Couldn't delete the gig. Check your connection and try again.").
  - [x] `gig-edit.tsx`, edit mode only: `DeleteGig` below Save/Cancel, modelled on `DeleteSong`
    in `song-edit.tsx` minus the in-use branch. Confirm line uses the saved record
    (`initial.gigMeta`), not the unsaved form fields: "Delete <venue>, <formatGigDate(date)>?",
    date only when venue is blank. Disabled "Yes, delete" while running. Success → `/gigs`
    (replace). Failure → failure line.
  - [x] Tests in `gig-edit.test.tsx`: confirm, Keep, success, failure, no delete button when
    adding.
- [x] **Task 4: Docs** (AC 8): extend the architecture.md single-song delete note (line ~259)
  to cover single-gig delete (`DELETE /api/v1/setlists/:setlistId`, online only, deletes the
  setlist with it).
- [ ] **Task 5: Verify, commit, deploy** (AC 11, 12). Verified 2026-10-26; commit and deploy follow code review.

## Dev Notes

- Files touched mirror 7.11: `api/src/ddb/setlists.ts`, `api/src/routes/setlists.ts`,
  `web/src/api/setlists.ts`, `web/src/hooks/use-setlist-mutation.ts`, `web/src/lib/microcopy.ts`,
  `web/src/routes/gig-edit.tsx`, plus co-located tests. `apiFetch` already supports `DELETE`
  and 204; `removePending` already exists in `outbox.ts`; DELETE is `NetworkOnly` in the
  service worker.
- `BUTTON_CLASS` / `BODY_PRIMARY` are local constants in `song-edit.tsx`; copy them into
  `gig-edit.tsx` as the routes already do for `LABEL_CLASS` etc. (no shared extraction).
- No in-use check: nothing refers to a gig. `/api/v1/upcoming-gigs` reads GSI1, so the deleted
  gig drops out of it too; the web app has no cache for it.
- **Date-change copies:** `putSetlist` writes to a sort key that includes the date, and nothing
  removes the old item, so editing a gig's date (Story 7.9) appears to leave an old-date copy
  behind. Deleting every item with the `setlistId` keeps a deleted gig from coming back via
  such a copy. Fixing the date-change write itself is out of scope here (raised with Sandy).
- Known gap (as 7.11): a PUT already in flight when the delete lands could recreate the gig.
  Single user; accepted.

## Dev Agent Record

### Agent Model Used

claude-opus-5-5

### Completion Notes List

- `deleteSetlist` queries the band partition (as `getSetlist` does) and deletes every item whose
  `setlistId` matches, so an old-date copy left by a date change (Story 7.9) goes too. DDB test
  covers two copies across a paginated query plus an unrelated gig left alone.
- `DELETE /api/v1/setlists/:setlistId` returns 204 whether or not the gig existed.
- `useSetlistMutation().deleteSetlist` calls the API directly (not the outbox), then drops any
  queued edit and removes the gig from both caches; throws on failure and changes nothing.
- `DeleteGig` on the edit page, modelled on `DeleteSong`; the confirm line names the saved gig,
  not unsaved form edits. The Save button now uses the shared local `BUTTON_CLASS` (same classes).
- Lint, typecheck, test (shared 30, infra 55, api 129, web 266) and build pass. No infra change
  (Lambda already has read/write on the table).

### File List

- api/src/ddb/setlists.ts, api/src/ddb/setlists.test.ts
- api/src/routes/setlists.ts, api/src/routes/setlists.test.ts
- web/src/api/setlists.ts, web/src/api/setlists.test.ts
- web/src/hooks/use-setlist-mutation.ts, web/src/hooks/use-setlist-mutation.test.tsx
- web/src/routes/gig-edit.tsx, web/src/routes/gig-edit.test.tsx
- web/src/lib/microcopy.ts
- _bmad-output/planning-artifacts/architecture.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Review Findings

- [x] [Review][Patch] Disable "Keep" while the delete request is running [web/src/routes/gig-edit.tsx:215]
- [x] [Review][Defer] Queued edit can re-PUT the gig if a flush is in flight or lands between the API delete and `removePending`; likewise a concurrent put during the server-side delete [web/src/hooks/use-setlist-mutation.ts:60, api/src/ddb/setlists.ts:63] — deferred, spec-accepted gap ("as 7.11"), single user

### Change Log

- 2026-10-26: Story created; status → ready-for-dev.
- 2026-10-26: Implemented story 7.12 (delete a gig); status → review.
- 2026-10-26: Code review (light: auditor + edge-case); "Keep" disabled while deleting; status → review.
