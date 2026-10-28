---
baseline_commit: 9b362f4e3cd530c279f0ffab93bdfd1fb7e717f1
---

# Story 7.29: Edit a song from inside a gig

Status: review

<!-- Source: Sandy, 2026-10-28: "I would like to be able to edit songs from within /gigs."
     Consequences discussed and scope approved the same day: Edit link on the gig song page,
     Delete hidden there, place in the setlist kept, gig page shows current song titles. -->

## Story

As Sandy,
I want an Edit link on a song's page while I'm inside a gig,
so that I can fix a chart, key or patch without leaving the gig and finding the song in Songs.

## Acceptance Criteria

1. `/gigs/:setlistId/songs/:songId` shows the same "Edit" link in the header as `/songs/:songId`
   (same copy, icon and style). It opens the edit sheet at
   `/gigs/:setlistId/songs/:songId/edit`, carrying the page's `?at=` query unchanged.
   This reverses 7.8 AC4's "no Edit link".
2. The sheet opens over the gig song page, which stays mounted: the play bar keeps showing the
   same position (e.g. "3 of 12") behind the sheet, and the screen stays awake.
3. Cancel and Save both return to the gig song page with the same `?at=` (the same place for a
   song that appears twice). With history, both step back as today. Opened directly (no
   history): Cancel and Save replace to `/gigs/:setlistId/songs/:songId?at=…`. Saved changes
   show on the song page straight away.
4. The gig-context sheet has no "Delete song" (the song is always in this gig's setlist).
   `/songs/:songId/edit` keeps Delete exactly as today.
5. The gig page's setlist rows show each song's current library title, so a rename made
   anywhere shows in every gig. When the songs list isn't loaded or doesn't have the song, the
   row shows the stored `titleSnapshot` as today.
6. `/songs/:songId`, `/songs/:songId/edit` and `/songs/new` behave exactly as today.
7. No change to `api/`, `shared/` or `infra/`; no new package.
8. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.
9. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] **Task 1: Route** (AC: 1, 2)
  - [x] `web/src/router.tsx`: give `gigs/:setlistId/songs/:songId` a child
        `{ path: 'edit', element: <SongEdit /> }`, mirroring `songs/:songId`. `Song` already
        renders `<Outlet />`, so the page stays mounted under the sheet.
- [x] **Task 2: Edit link on the gig song page** (AC: 1)
  - [x] `web/src/routes/song.tsx`: show the Edit link whenever `song` is loaded. In a gig, link
        to `{ pathname: `/gigs/${setlistId}/songs/${song.songId}/edit`, search: location.search }`
        (or build the string from `useLocation().search`); outside a gig, unchanged. Update the
        header comment ("no Edit link" line).
- [x] **Task 3: Sheet exits and Delete in a gig** (AC: 3, 4, 6)
  - [x] `web/src/routes/song-edit.tsx`: read `setlistId` from `useParams()` alongside `songId`.
        Work out the record page once:
        `setlistId ? `/gigs/${setlistId}/songs/${songId}${search}` : `/songs/${songId}``,
        where `search` is `useLocation().search`. Use it for `useSheetExit(...)` in both
        `EditExisting` and `SongForm` and for the no-history `navigate(..., { replace: true })`
        after Save. Keep `navigate(-1)` when `canStepBack`. `/songs/new` (no `songId`) is
        unchanged and still exits to `/songs`.
  - [x] Render `<DeleteSong>` only when there's no `setlistId`.
  - [x] Update the file's header comment with one line on the gig variant.
- [x] **Task 4: Current titles on the gig page** (AC: 5)
  - [x] `web/src/routes/gig.tsx`: call `useSongs()` in `Gig` (or `SetlistSections`), build a
        `Map` of `songId → title`, and render `titles.get(song.songId) ?? song.titleSnapshot`
        in each row. Don't wait on the songs query: the stored title shows until the list
        arrives. Update the header comment.
- [x] **Task 5: Tests** (AC: 1–6)
  - [x] `song.test.tsx`: replace the 7.8 "no Edit link" gig test. The gig song page now has an
        Edit link whose href is `/gigs/g1/songs/abc/edit?at=2` for entry
        `/gigs/g1/songs/abc?at=2`. `/songs/abc` still links to `/songs/abc/edit`.
  - [x] `song-edit.test.tsx` (use the existing `renderAt(...history)` helper; add the gig route
        and its `edit` child to its route table):
        - with history `['/gigs/g1/songs/abc?at=2', '/gigs/g1/songs/abc/edit?at=2']`, Cancel
          and Save each land back on `/gigs/g1/songs/abc?at=2`;
        - with only `['/gigs/g1/songs/abc/edit?at=2']`, Cancel and Save each replace to
          `/gigs/g1/songs/abc?at=2`;
        - no "Delete song" button in the gig sheet, still there on `/songs/abc/edit`.
  - [x] `gig.test.tsx`: with the songs list cached and a song's title changed from its
        `titleSnapshot`, the row shows the library title; with no songs list, it shows
        `titleSnapshot`.
  - [x] Existing `/songs` tests stay green unchanged (AC6).
- [ ] **Task 6: Verify and ship** (AC: 7–9): checks, commit
      `Implement story 7.29: Edit a song from inside a gig`, push, deploy, Sandy's quick look.
  - Checks done (lint, typecheck, test, build pass). Commit, push and deploy follow code review.

## Dev Notes

### Why this is now safe

7.8 left Edit out of the gig song page only to avoid deciding where Back goes after an edit
(7.8 Dev Notes: "That avoids deciding where Back goes after an edit … Editing stays available
from Songs"). Since 7.21 the edit form is a sheet on a child route of the page it opens over,
and `useSheetExit` steps back when there's history. So the answer is simply "back to the gig
song page you came from". The only extra work is the no-history fallback and keeping `?at=`.

### Current state of the files touched

- `web/src/router.tsx`: `gigs/:setlistId/songs/:songId` is a leaf route with `<Song />`;
  `songs/:songId` has an `edit` child with `<SongEdit />`.
- `web/src/routes/song.tsx`: `right={song && !setlistId ? <Edit link> : null}`. The play bar
  position comes from `resolvePlace(playOrder(setlist), songId, at)` with `at` from
  `useSearchParams()`. **If the edit URL dropped `?at=`, a repeated song's play bar would jump
  to its first appearance behind the sheet**, which is why `?at=` must ride along to `/edit`
  and back. `useWakeLock()` lives in `Song`, so keeping `Song` mounted keeps the screen awake.
  `useEffect(scrollTo(0,0), [songId, at])` won't fire on opening or closing the sheet as long
  as `songId` and `at` are unchanged.
- `web/src/routes/song-edit.tsx`: `EditExisting` uses `useSheetExit(`/songs/${songId}`)`;
  `SongForm` computes `exitTo = initial ? `/songs/${songId}` : '/songs'` and after Save does
  `navigate(-1)` if `canStepBack`, else `navigate(`/songs/${songId}`, { replace: true })`.
  `DeleteSong` uses `historyIndex() >= 2` to step back past the record page (7.23); it's not
  rendered in the gig context, so that logic needs no gig variant.
  Must preserve: whole-record PUT copying `performanceNotes` / `practiceNotes`; the form
  mounting once from the loaded song; double-tap guard.
- `web/src/routes/gig.tsx`: rows render `song.titleSnapshot` (line ~84). Links use
  `gigSongPath(setlistId, order, index)`, which adds `?at=`.
- `web/src/hooks/use-songs.ts`: `useSongs()` → `['songs', ACTIVE_BAND_ID]`, persisted to IDB,
  so it's normally cached even offline. `saveSong` already merges the edit into this cache
  optimistically, so a rename shows on the gig page immediately after Save.

### Saving offline (investigated as asked)

`useSongMutation().saveSong` writes the song and songs-list caches optimistically, then
enqueues a whole-record PUT in the IndexedDB outbox (`web/src/sync/outbox.ts`) and kicks the
flusher. It never throws and needs no connection; the outbox retries when the connection
returns, and edits to the same song coalesce (last write wins). **So saving a chart fix at a
venue with no signal works: it shows straight away and syncs later.** Only Delete needs a
connection, and Delete is hidden in the gig sheet.

### Out of scope

- The setlist text editor (`setlistToText`) still writes stored titles, so after a rename the
  "Edit setlist" text shows the old name until saved. Parsing already resolves an old title to
  the same song (`parseSetlistText`'s `previousIds`), so nothing breaks. Leave it unless Sandy
  asks.
- Re-saving setlists to refresh `titleSnapshot`. Not needed: AC5 reads live titles.
- No API, schema or sync change.

### Testing standards

Vitest + Testing Library, co-located, no snapshots. Follow the existing `renderGigSong()` and
`renderAt(...history)` helpers; seed caches with `queryClient.setQueryData` as the current
tests do.

### References

- [Source: _bmad-output/implementation-artifacts/7-8-setlist-on-the-gig-page.md#AC4, Dev Notes]
- [Source: _bmad-output/implementation-artifacts/7-21-edit-and-add-in-sheets.md]
- [Source: _bmad-output/implementation-artifacts/7-23-small-fixes-after-the-ui-review.md] (history depth)
- [Source: web/src/components/edit-sheet.tsx] `useSheetExit`
- [Source: web/src/lib/gig-position.ts] `resolvePlace`, `gigSongPath`
- [Source: shared/src/schemas/setlist.ts] `titleSnapshot` (AR-11)
- [Source: AGENTS.md] performance-mode safety: Edit sits in the header, away from the play bar;
  a stray tap opens a sheet that Cancel closes. Nothing destructive is added.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5

### Completion Notes List

- Added `edit` child route under the gig song route; Edit link now shows in a gig and carries `?at=`.
- `song-edit.tsx`: one `useRecordPage` helper gives the exit target (gig song page with `?at=`, or `/songs/:id`); Delete hidden when a `setlistId` is present.
- `gig.tsx` rows show the live library title via `useSongs()`, falling back to `titleSnapshot`.
- Tests: replaced the 7.8 "no Edit link" test; added gig-sheet exit tests (history and direct), Delete visibility, and gig row title tests. 454 web tests pass; lint, typecheck and build pass.
- Not done here: commit, push, deploy and Sandy's live check (follow code review).

### File List

- web/src/router.tsx
- web/src/routes/song.tsx
- web/src/routes/song.test.tsx
- web/src/routes/song-edit.tsx
- web/src/routes/song-edit.test.tsx
- web/src/routes/gig.tsx
- web/src/routes/gig.test.tsx

### Change Log

- 2026-10-28: Story created; status → ready-for-dev.
- 2026-10-28: Implemented; status → review.
- 2026-10-28: Code review (lightweight, inline): no defects; all ACs met. Optional nit noted (dead `songId === undefined` branch in `useRecordPage`), left as is.
