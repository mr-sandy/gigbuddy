---
baseline_commit: 3e197f4
---

# Story 7.23: Small fixes after the UI review

Status: review

<!-- Source: deferred-work.md items still open after the 2026-10-27 check (7.20 and 7.21 reviews,
     7.1 manifest colours). Sandy chose 2026-10-27 to switch the manifest to light.
     Not in epics.md before this story; added there alongside it. -->

## Story

As Sandy,
I want deleting to leave Back sensible, focus to stay clear of the bottom bars, and the
installed app's launch colour to be light,
so that the small rough edges left by the UI review are gone.

## Acceptance Criteria

1. **Delete and Back.** Deleting a song or a gig from its edit sheet still lands on the list
   (`/songs` or `/gigs`). When the sheet was opened from the record's page with at least one
   page before that, the deleted record's page is gone from the history: pressing Back on the
   list goes to whatever came before the record page, not to the deleted record. When the
   history is too short for that (the record page was the first page, or the edit sheet was
   opened by a deep link), the current behaviour stays (replace the sheet's entry with the
   list).
2. **Focus clears the bottom bars.** When the keyboard moves focus to something that would sit
   under the tab bar (on `/songs` and `/gigs`) or the play bar (on a gig's song page), the
   browser scrolls it clear of the bar. Pages without a bar are unchanged.
3. **Light manifest.** The PWA manifest's `theme_color` and `background_color` are both
   `#faf9f5` (the light `--background`). The `theme-color` metas and the 7.22 inline script
   are unchanged; they still follow the chosen theme while the app is open.
4. No change to `api/`, `shared/` or `infra/`. `STYLE.md` notes the bars' scroll padding and
   the manifest colour. `deferred-work.md` marks the three items resolved in 7.23.
5. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass. Tests cover: delete with
   enough history (Back skips the deleted record) for a song and a gig; delete with short
   history (falls back to replace); the bars carry the scroll-padding hook; the manifest
   colours.
6. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] Task 1: Delete steps back past the record (AC: 1)
  - [x] New `web/src/lib/history-depth.ts` exporting `historyIndex(): number`: reads
        `window.history.state?.idx` (React Router 7's browser history stores the entry's
        index there; see `getHistoryState` in react-router's dist) and returns it when it's a
        finite number ≥ 0, otherwise `0`. Comment why: React Router has no public API for
        history depth, and `location.key !== 'default'` only says "not first".
  - [x] `web/src/routes/song-edit.tsx` `DeleteSong.onConfirm`: on `'deleted'`, if the sheet
        was opened over the record page with history (the same `canStepBack` condition the
        save path uses: an existing record and `hasHistory`) **and** `historyIndex() >= 2`,
        call `navigate(-2)`; otherwise keep `navigate('/songs', { replace: true })`.
        `DeleteSong` doesn't have `canStepBack` today: pass it in as a prop from `SongEdit`
        (don't recompute it).
  - [x] `web/src/routes/gig-edit.tsx` `DeleteGig.onConfirm`: the same, with `/gigs`.
  - [x] Why −2 is safe: with `canStepBack`, the entry below the sheet is the record page
        (Edit is a child route of the record page, and Cancel/Save already rely on this with
        −1); the entry below that is whatever Sandy came from, normally the list. It can't be
        the deleted record (Save steps back rather than stacking the record twice). If it
        isn't the list (e.g. Sandy came from the other tab), that's still correct: Back no
        longer reaches the deleted record. Don't add a "make sure we land on the list" step.
  - [x] Update the comment above each delete (the 7.21 "replace" comment, if any) to say
        7.23 steps back past the record when it can.
- [x] Task 2: Scroll padding for the bottom bars (AC: 2)
  - [x] Add `data-bottom-bar="tab"` to the `<nav>` in `web/src/components/tab-bar.tsx` and
        `data-bottom-bar="play"` to the `<nav>` in `GigPlayBar` (`web/src/routes/song.tsx`).
  - [x] `web/src/styles/globals.css`, after the `html` block:
        ```css
        /* Story 7.23: keyboard focus scrolls clear of a fixed bottom bar. Same sums as the
           page padding in list-layout.tsx and song.tsx. */
        html:has([data-bottom-bar="tab"]) {
          scroll-padding-bottom: calc(var(--spacing-tab-bar) + 1px + var(--spacing-unit) * 4 + env(safe-area-inset-bottom));
        }

        html:has([data-bottom-bar="play"]) {
          scroll-padding-bottom: calc(var(--spacing-play-bar) + 1px + var(--spacing-unit) * 4 + env(safe-area-inset-bottom));
        }
        ```
        `:has()` is in every browser GigBuddy targets (Safari 15.4+). It drops off by itself
        on pages without a bar, so nothing needs JS. A sheet's own scroll area is unaffected
        (scroll padding applies to the viewport only); the bars sit behind the sheet anyway.
  - [x] Check the play bar's actual height token: the page padding in `song.tsx` uses
        `--spacing-play-bar`; use the same sum, not a new number.
- [x] Task 3: Light manifest (AC: 3)
  - [x] `web/vite.config.ts`: `theme_color: '#faf9f5'`, `background_color: '#faf9f5'`.
  - [x] `web/src/build-output.test.ts`: update the two assertions to `#faf9f5`. (Its
        `beforeAll` skips the rebuild when `dist` exists: run `rm -rf web/dist` first, per the
        2.1 deferred note, or the test reads the old manifest.)
  - [x] Don't touch `index.html`'s metas, the inline theme script, the status-bar style or the
        icons.
- [x] Task 4: Tests (AC: 5)
  - [x] `web/src/lib/history-depth.test.ts`: returns `idx` from `window.history.state`; `0`
        for null state, a missing `idx`, a non-number and a negative number. Restore state in
        `afterEach` (`window.history.replaceState(null, '', '/')`).
  - [x] `song-edit.test.tsx` and `gig-edit.test.tsx` (MemoryRouter, so `window.history` isn't
        the router's): add a test that with `window.history.replaceState({ idx: 2 }, '')` and
        entries `['/songs', '/songs/abc', '/songs/abc/edit']`, a confirmed delete calls
        `navigate(-2)`, landing on "list page"; and that with `idx` 1 (or null) it replaces
        to `/songs` as now. Existing delete tests stay; adjust only if they now hit the −2
        path because of leftover state (reset `window.history` state in `afterEach`).
        Note: the MemoryRouter's own index and `window.history.state.idx` are independent in
        these tests; that's acceptable for unit tests because the router-level test below
        covers the real pairing.
  - [x] `app-bootstrap.test.tsx` (real router), new `describe('delete and Back (Story 7.23)')`:
        start at `/songs`, click the song, click Edit, delete and confirm (mock the
        `DELETE /api/v1/songs/a1` response the mutation expects; read
        `use-song-mutation.ts` for the shape), then expect `/songs`, then
        `await act(() => router.navigate(-1))` and expect the pathname is **not**
        `/songs/a1`. Same for a gig from `/gigs`. Careful: `beforeEach` does
        `window.history.replaceState(null, …)`, which wipes `idx`; React Router then counts
        from `null + 1`. Start each test with
        `window.history.replaceState({ idx: 0 }, '', '/songs')` (or navigate twice) so the
        depth is real, and say so in a comment.
  - [x] `components/tab-bar.test.tsx`: the nav has
        `data-bottom-bar="tab"`. `song.test.tsx`: the play bar nav has
        `data-bottom-bar="play"`.
  - [x] New `web/src/styles/globals.test.ts` (as `tokens.test.ts` reads `tokens.css` with
        `process.cwd()`): `globals.css` contains both `html:has([data-bottom-bar="…"])` rules
        with `scroll-padding-bottom` using `--spacing-tab-bar` and `--spacing-play-bar`.
        jsdom can't check scrolling; this guards against the rule being dropped.
- [x] Task 5: Docs (AC: 4)
  - [x] `STYLE.md`: Tab bar entry, add "and keyboard focus scrolls clear of it (scroll
        padding)"; same note wherever the play bar is described. Colour section: "The
        installed app's manifest colour is the light background (`#faf9f5`); it can't follow
        the theme."
  - [x] `_bmad-output/implementation-artifacts/deferred-work.md`: strike the 7.21 "After a
        delete, Back returns to the deleted record", the 7.20 "Focused rows can scroll behind
        fixed bottom chrome" and the 7.1 "Manifest colours still dark", each with
        `**Resolved in Story 7.23**` and a few words, as earlier resolved items do.
- [ ] Task 6 (commit, push, deploy and Sandy's look follow code review): Verify and ship (AC: 4, 5, 6)
  - [x] `git diff --stat 3e197f4 -- api shared infra` is empty.
  - [x] `rm -rf web/dist`, then `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
  - [ ] Commit `Implement story 7.23: Small fixes after the UI review` (after code review),
        push (this also carries the two unpushed commits `1faa9c5` and `3e197f4`), deploy,
        then Sandy's quick look.

## Dev Notes

### Current state (read before editing)

- `components/edit-sheet.tsx`: `useSheetExit(exitTo)` returns `{ leave, hasHistory }`;
  `hasHistory = location.key !== 'default'`. `leave` steps back (−1) with history, else
  replaces to `exitTo`.
- `routes/song-edit.tsx`: `canStepBack = initial !== undefined && hasHistory` (line ~92).
  Save: `canStepBack ? navigate(-1) : navigate('/songs/:id', { replace: true })`.
  `DeleteSong({ song })` (line ~182) uses its own `useNavigate()`; on `'deleted'` it does
  `navigate('/songs', { replace: true })`. `'in-use'` shows a message and stays.
- `routes/gig-edit.tsx`: same shape; `DeleteGig` (line ~160) navigates
  `navigate('/gigs', { replace: true })` after `deleteSetlist`.
- History today after a delete from list → record → edit: `[list, record, list]`. Back lands on
  the deleted record's not-found page. After 7.23 with −2: `[list]` (forward entries are
  discarded on the next navigation), so Back goes to whatever was before the list.
- Mutations remove the record from the cache before navigation (`removeQueries` in
  `use-song-mutation.ts` / `use-setlist-mutation.ts`), so the list renders without it.
- `components/tab-bar.tsx`: `<nav aria-label="Lists" className="fixed inset-x-0 bottom-0 …">`.
  `routes/list-layout.tsx` pads content by
  `calc(var(--spacing-tab-bar)+1px+var(--spacing-unit)*4+env(safe-area-inset-bottom))`.
- `routes/song.tsx`: `GigPlayBar` renders `<nav className="fixed inset-x-0 bottom-0 …">`
  only on `/gigs/:setlistId/songs/:songId` with a resolvable place; the page pads by the same
  sum with `--spacing-play-bar` (64px). `--spacing-tab-bar` is 60px.
- `web/vite.config.ts` manifest: `theme_color` / `background_color` `#1a1209`.
  `build-output.test.ts:51-52` asserts them. `index.html` has two `theme-color` metas and the
  7.22 inline script that rewrites them; leave all of that alone.

### Design decisions

- **−2, guarded by real depth.** The alternatives were worse: marking the record page
  "deleted" so it redirects itself would leave `[list, list]` and an inert-looking Back; a
  router-level history rewrite isn't available. `window.history.state.idx` is React Router
  internals, so it lives in one small helper with a test and a comment, and a missing or odd
  value falls back to today's behaviour.
- **CSS `:has()` for scroll padding**, not JS or a class toggled from React: the bars already
  exist only where they're needed, so the rule follows them.
- **Manifest light** (Sandy, 2026-10-27). The installed app's launch screen and app switcher
  use the light background; inside the app, the chosen theme still applies at first paint.

### Out of scope (don't build)

- `/login` while signed in, the tab bar inside `<main>`, the settings-sheet focus opener, and
  every other deferred item.
- Undo for delete, or any change to the delete confirm dialog.
- Changing the status-bar style, icons or service worker.

### Testing standards

- Vitest + Testing Library, co-located, no snapshots. Router-level checks in
  `app-bootstrap.test.tsx` with the real `router`. Reset `window.history` state after tests
  that set `idx`.
- Lesson from the flaky-test fix (`3e197f4`): after a slow async action, wait for the dialog to go
  (`waitFor(() => expect(queryByRole('dialog')).not.toBeInTheDocument())`) before querying
  the page behind it by role; it's `aria-hidden` until the sheet unmounts.

### Previous story intelligence (7.21, 7.22)

- 7.21: edit sheets are child routes of the record page; Cancel, Save and Escape step back
  with history. Delete was deliberately a replace; this story refines it.
- 7.22: file-reading tests use `process.cwd()` (jsdom's `import.meta.url` isn't a file URL).
- The flaky-test fix (`3e197f4`) shows the trap: the parent route's text is always present,
  so assert on the sheet closing, not on page text appearing.

### References

- `_bmad-output/implementation-artifacts/deferred-work.md` — the three items
- `_bmad-output/implementation-artifacts/7-21-edit-and-add-in-sheets.md` — sheet routing
- `STYLE.md` — Tab bar, Colour
- `AGENTS.md` — one commit per story, British English

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5

### Debug Log References

### Completion Notes List

- Delete steps back two entries (past the record page) when the sheet sits over a record with history and `historyIndex() >= 2`; otherwise replaces with the list as before. `canStepBack` is passed into `DeleteSong`/`DeleteGig`.
- `data-bottom-bar` hooks on the tab bar and play bar, with `html:has()` scroll-padding rules in `globals.css`.
- Manifest colours now `#faf9f5`.
- Real-router test starts with `idx` set and an earlier page (`before`) so Back lands on it; with Back from the first entry, `router.navigate(-1)` never resolves.
- lint, typecheck, test (web 379, api 130, shared 31, infra 55) and build pass; `api/`, `shared/`, `infra/` unchanged.

- Ultimate context engine analysis completed - comprehensive developer guide created.

### File List

- web/src/lib/history-depth.ts (new), web/src/lib/history-depth.test.ts (new)
- web/src/routes/song-edit.tsx, web/src/routes/song-edit.test.tsx
- web/src/routes/gig-edit.tsx, web/src/routes/gig-edit.test.tsx
- web/src/routes/song.tsx, web/src/routes/song.test.tsx
- web/src/components/tab-bar.tsx, web/src/components/tab-bar.test.tsx
- web/src/styles/globals.css, web/src/styles/globals.test.ts (new)
- web/src/app-bootstrap.test.tsx
- web/vite.config.ts, web/src/build-output.test.ts
- STYLE.md
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/7-23-small-fixes-after-the-ui-review.md

### Change Log

- 2026-10-27: Story created (ready-for-dev).
- 2026-10-27: Implemented; status → review.
