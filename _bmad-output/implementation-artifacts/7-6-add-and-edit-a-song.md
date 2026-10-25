---
baseline_commit: 40d977c
---

# Story 7.6: Add and edit a song

Status: done

<!-- Source: epics.md "Epic 7 / Story 7.6"; agreed with Sandy 2026-10-25 (start simply; explicit Save, no autosave; notes fields stay hidden but must survive an edit) -->

## Story

As Sandy,
I want to add a new song and correct an existing one,
so that I can keep the library up to date without touching the database.

## Acceptance Criteria

1. `/songs` gains one "Add song" link to `/songs/new`. The song page gains one "Edit" link to
   `/songs/:songId/edit`. Nothing else on either page changes.
2. Both routes show the same form: title, key, patch and chord chart, in that order, each with
   a visible label. The chord chart is a multi-line text box that keeps line breaks exactly as
   typed. All inputs use type roles from `STYLE.md` (no one-off sizes); 16px minimum so iOS
   does not zoom.
3. Editing pre-fills the form from the song. Adding starts empty.
4. "Save" writes the song through the existing `use-song-mutation` hook, then goes to that
   song's page. A new song gets a fresh 16-char NanoID from `web/src/lib/id.ts`. "Cancel"
   goes back (to the song page when editing, to `/songs` when adding) without saving.
5. The title is required: with a blank title, Save shows a plain one-sentence message and
   does not save. Key, patch and chart are optional; a blank value is saved as absent, not
   as an empty string, so the song page leaves it out (7.5 AC3).
6. `performanceNotes` and `practiceNotes` are not shown in the form, and editing keeps their
   stored values unchanged (the PUT replaces the whole record).
7. Editing an unknown `songId` shows the same "Song not found" line and "Back to songs" link
   as the song page.
8. `/songs/new` and `/songs/:songId/edit` are valid routes (amends 7.3 AC6); signed out, they
   show the existing login.
9. No delete, duplicate-title check, autosave, unsaved-changes prompt, gig or setlist
   features. No change to `api/`, `shared/` or `infra/`.
10. Same responsive and theming rules as 7.1 (360px–1680px with no horizontal scroll,
    light/dark via `prefers-color-scheme`, WCAG AA contrast).
11. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass. Unit tests cover adding
    a song, editing one (notes preserved, blanked field saved as absent), the blank-title
    message, and Cancel. `e2e/smoke` checks the two new routes end on the login when signed
    out.
12. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] **Task 1: Copy and style rules** (AC: 2, 10)
  - [x] `microcopy.ts`: append (don't edit `SONGS`) a block commented `/* Story 7.6 — add/edit song. */`:
    ```ts
    export const SONG_FORM = {
      addLink: 'Add song',
      editLink: 'Edit',
      addHeading: 'Add song',
      editHeading: 'Edit song',
      title: 'Title',
      key: 'Key',
      patch: 'Patch',
      chordChart: 'Chord chart',
      save: 'Save',
      cancel: 'Cancel',
      titleRequired: 'A song needs a title.',
    } as const;
    ```
  - [x] `STYLE.md`: add a short **Forms** section (after "Spacing and tap targets"):
    labels are Body (18px) primary text above their field; inputs and the chord-chart box
    use Reading (22px), primary text on the page background, 1px border in secondary text
    colour, 4px radius, `--spacing-unit*3` padding, full width; the Save button is a
    bordered button (2px primary-text border, primary text, Row size, ≥44px high);
    Cancel is an ordinary underlined link. Focus outline on inputs and the button: 2px accent,
    same as links. Update the "Focus" bullet to say links, inputs and buttons.
  - [x] No new colours or tokens: secondary text on the background already passes AA (and the
    3:1 non-text contrast a field border needs) in both themes, so
    `web/scripts/contrast-report.ts` needs no edit. Do **not** use `--color-border-hairline`
    for field borders — it is `transparent` in dark mode.

- [x] **Task 2: Shared song lookup** (AC: 7)
  - [x] Move the song-resolution logic out of `song.tsx` into
    `web/src/hooks/use-song-or-cached.ts` (+ `.test.tsx`): takes `songId`, calls
    `useSong(songId ?? null)` and `useSongs()`, returns `{ song, statusLine }` with exactly
    today's rules (`one.data ?? list.data?.find(...)`; `notFound` when `one.data === null`;
    `loading` when either is pending; otherwise `error`).
  - [x] `song.tsx` uses it; its behaviour and the existing `song.test.tsx` tests stay
    unchanged (they mock `use-song.js` / `use-songs.js`, which still works).

- [x] **Task 3: Entry links** (AC: 1)
  - [x] `songs.tsx`: wrap the existing "Home" link and a new "Add song" link (`to="/songs/new"`)
    in a `flex items-center justify-between gap-[calc(var(--spacing-unit)*4)]` row. Both use
    the existing back-link class string. Nothing else changes.
  - [x] `song.tsx`: same pattern — "Back to songs" on the left, "Edit"
    (`to={`/songs/${songId}/edit`}`) on the right. Show "Edit" only when `song` is set (not on
    loading / error / not found).

- [x] **Task 4: The form route** (AC: 2–7, 9)
  - [x] New `web/src/routes/song-edit.tsx` exporting `SongEdit`. `useParams().songId`
    undefined ⇒ add mode; set ⇒ edit mode.
  - [x] Edit mode: use `useSongOrCached(songId)`. While `song` is unset, render the
    "Back to songs" link and the status line exactly as the song page does (AC7). Once set,
    render `<SongForm key={song.songId} initial={song} />`. Mount the form only when the song
    is available and initialise `useState` from `initial` once: a background refetch must
    **not** reset what Sandy is typing.
  - [x] Add mode: render `<SongForm />` with empty fields. Generate the id once with
    `useState(() => generateId())` (not on every render, not on every save).
  - [x] Layout, top to bottom: `PageTitle` (`Add song` / `Edit song`, no `afterBackLink`);
    then four label + field pairs (title `<input type="text">`, key, patch, chord chart
    `<textarea rows={12}>`), each label tied to its field with `htmlFor`/`id`;
    then a row with Save (`<button type="submit">`) and Cancel. Use a `<form>` with
    `onSubmit` + `preventDefault`, so Enter in a single-line field also saves. Gaps
    `mt-[calc(var(--spacing-unit)*4)]` between pairs, section gap before the buttons.
    Tailwind preflight strips input borders/backgrounds and sets `font: inherit`, so set
    border, background, colour and size explicitly per STYLE.md "Forms".
    `box-border w-full` on fields so 360px has no horizontal scroll. Textarea: `resize-y`,
    and do **not** set `wrap="off"`.
  - [x] Save:
    - Title: `title.trim()`; if empty, show `SONG_FORM.titleRequired` under the title field
      (`<p role="alert">`, Body size, primary text), set `aria-invalid` on the input, focus it,
      and don't call `saveSong`. Clear the message once a non-blank title is saved.
    - Key, patch: trimmed; chord chart: stored **as typed** (no trim — leading spaces and
      blank lines inside a chart are meaningful), but treated as blank if `chart.trim() === ''`.
      Blank ⇒ the key is **omitted** from the record (not `''`, not `undefined`-valued).
    - Build the `SongPutInput` explicitly, field by field:
      `bandId: ACTIVE_BAND_ID`, `songId`, `title`, optional `key` / `patch` / `chordChart`,
      `performanceNotes` / `practiceNotes` **copied from `initial` when present**,
      `clientWrittenAt: new Date().toISOString()`, `version: 1`. Never spread `initial`:
      it carries `serverReceivedAt`, and `SongPutInputSchema` is `.strict()`, so the API
      would answer 400 and the flusher would silently drop the write.
    - `await saveSong(record)` then `navigate(`/songs/${songId}`, { replace: true })`, so the
      browser Back button doesn't return to the form.
  - [x] Cancel: a `<Link replace>` to `/songs/${songId}` (edit) or `/songs` (add). No prompt,
    nothing written.
  - [x] Header comment in the style of `song.tsx` (one short paragraph: what the page is, the
    whole-record PUT and why notes are carried through).

- [x] **Task 5: Routes** (AC: 8)
  - [x] `router.tsx`: add `{ path: 'songs/new', element: <SongEdit /> }` and
    `{ path: 'songs/:songId/edit', element: <SongEdit /> }` beside the existing song routes,
    inside the `RequireAuth` shell. React Router ranks the static `new` above `:songId`, so
    `/songs/new` never reaches the song page.

- [x] **Task 6: Tests** (AC: 11)
  - [x] `web/src/routes/song-edit.test.tsx`: mock `../hooks/use-song-mutation.js`
    (`saveSong: vi.fn().mockResolvedValue(undefined)`), `../hooks/use-song.js`,
    `../hooks/use-songs.js` (as `song.test.tsx` does) and `../lib/id.js`
    (`generateId: () => 'newsong000000001'`). Render inside `MemoryRouter` + `Routes` with the
    real paths plus stub elements for `/songs` and `/songs/:songId` so navigation is
    observable. Use `@testing-library/user-event` (already a web dev dependency), not
    `fireEvent`.
    - Add: type title `Round Midnight`, key `Eb minor`, chart `'Cm7 | F7\nStage: watch Ivan'`;
      Save ⇒ `saveSong` called once with an object whose keys are exactly
      `bandId, songId, title, key, chordChart, clientWrittenAt, version` (no `patch`, no
      `serverReceivedAt`), `songId === 'newsong000000001'`, chart string exact; then the
      `/songs/newsong000000001` stub is shown.
    - Edit: full song with `performanceNotes` and `practiceNotes`; fields pre-filled; clear the
      patch, change the title, Save ⇒ record has the new title, no `patch` key, both notes
      unchanged, no `serverReceivedAt`, a new `clientWrittenAt`.
    - Blank title (spaces only) ⇒ `SONG_FORM.titleRequired` shown, `saveSong` not called.
    - Cancel in edit ⇒ song-page stub, `saveSong` not called; Cancel in add ⇒ `/songs` stub.
    - Unknown song in edit ⇒ `SONGS.notFound` and the "Back to songs" link; no form.
  - [x] `songs.test.tsx`: "Add song" link points to `/songs/new`.
  - [x] `song.test.tsx`: "Edit" link points to `/songs/abc/edit` when the song is shown; absent
    on not found.
  - [x] `use-song-or-cached.test.tsx`: the four status cases moved from the song page logic.
  - [x] `e2e/smoke/shell.spec.ts`: add `/songs/new` and `/songs/anything/edit` to the loop in
    the `/songs` test (rename its title to cover all four paths).
  - [x] No snapshot tests.

- [x] **Task 7: Verify, commit, deploy** (AC: 9, 11, 12)
  - [x] `git diff --stat HEAD -- api shared infra` is empty.
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass.
  - [x] One commit: `Implement story 7.6: Add and edit a song`. Push to `main` only with
    Sandy's go-ahead; watch `deploy.yml` with `gh run watch`. If the blackout check blocks,
    report it; don't use `deploy-force.yml`.
  - [x] Set the story to `review`. No screenshots and no manual checklist for Sandy.

## Dev Notes

### What this story is

The first write slice of Epic 7. Everything below the UI already exists and is tested:
`PUT /api/v1/songs/:songId` creates or replaces a song (LWW on `clientWrittenAt`), and
`useSongMutation().saveSong()` writes the per-song and list caches optimistically, queues the
PUT in the IndexedDB outbox and kicks the flusher. This story adds one form route, two links
and copy. Web only.

### Facts verified when the story was written (2026-10-25)

- `SongSchema` (`shared/src/schemas/song.ts`): `title` required; `key`, `patch`, `chordChart`,
  `performanceNotes`, `practiceNotes` optional. `SongPutInputSchema` =
  `SongSchema.omit({ serverReceivedAt }).strict()` — any extra key (including
  `serverReceivedAt`) is a 400. Import `type SongPutInput` and `ACTIVE_BAND_ID` from
  `@gigbuddy/shared`; no parallel types.
- API PUT (`api/src/routes/songs.ts`): path `songId` must equal body `songId`; `bandId` must be
  `ACTIVE_BAND_ID`; a missing record is created (no separate POST). The record is replaced
  whole, so a field left out of the body is deleted — hence AC6.
- `useSongMutation` (`web/src/hooks/use-song-mutation.ts`) is the only legal write seam: the UI
  never imports the outbox or flusher (AR-23/AR-45). `saveSong` resolves after the outbox
  enqueue, does not throw and reports no errors (FR-2); retries are the outbox's job. Offline
  saves therefore just work and flush later.
- `generateId()` in `web/src/lib/id.ts`: 16-char NanoID, URL-safe alphabet (AR-47).
- `useSong(null)` is disabled (its comment already anticipates `/songs/new`). In add mode,
  don't call `useSongOrCached` at all, or pass `null` — no request for a non-existent id.
- Flusher (`web/src/sync/flusher.ts`): `applied` ⇒ invalidates `['song', bandId, songId]`;
  `dropped-as-stale` ⇒ replaces the cache with the server copy and posts to
  `stale-notice-store` (nothing renders that notice since the 7.1 reset; fine for one user);
  a 4xx ⇒ entry dropped and logged. That last case is why the record must be exactly
  schema-shaped.
- Known, accepted race: after saving a **new** song the song page mounts and refetches
  (`staleTime: 0`) while the PUT may still be in flight, so the GET can briefly return 404 and
  show "Song not found" until the flusher's `applied` invalidation refetches. On the real
  network the PUT is sent first and normally wins. Don't add workarounds to the hooks or
  flusher in this story; if it shows up in Sandy's look, it's a follow-up.
- Pre-reset reference (tag `pre-reset`, `web/src/routes/song-detail.tsx`): the old
  inline-edit page used the same `generateId` / `saveSong` / `clientWrittenAt` pattern. Don't
  restore it — it is autosave-per-field with performance features; this story is a plain
  Save form.
- Real data (Apple Notes import, 2026-10-05): `patch` like `Jazz Organ (P14)`, `key` like
  `Fm Blues`, and the chart mixes chords, prose and "Stage:" cues. The textarea must preserve
  all of it byte for byte apart from the blank check.

### Guardrails

- Out of scope: delete, autosave, unsaved-changes prompt, duplicate titles, showing or
  editing `performanceNotes` / `practiceNotes`, chord parsing or a monospace chart, gig or
  setlist features, any `api/`, `shared/`, `infra/` or sync-layer change.
- No placeholders inside fields (they read as values in dim light); visible labels only.
- No device detection; one layout from 360px up. 22px fields are above iOS's 16px zoom
  threshold.
- Biome only; `kebab-case` files; tests co-located; `.js` import suffix; British English;
  imports from `react-router`.
- Don't invent song content in tests beyond what's above (`Round Midnight`/`Eb minor` come
  from the existing schema tests; `Fm Blues`, `Jazz Organ (P14)` from the real data notes;
  Ivan is the documented bandmate).

### Project Structure Notes

New: `web/src/routes/song-edit.tsx` (+ test), `web/src/hooks/use-song-or-cached.ts` (+ test).
Updated: `router.tsx`, `songs.tsx`, `song.tsx` (+ their tests), `microcopy.ts`, `STYLE.md`,
`e2e/smoke/shell.spec.ts`. The form lives in the route file; extract a component only if the
file gets unwieldy.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.6]
- [Source: _bmad-output/implementation-artifacts/7-5-basic-song-page.md]
- [Source: _bmad-output/planning-artifacts/epics.md — AR-23 whole-record PUT, AR-45 write seam, AR-47 NanoID]
- [Source: shared/src/schemas/song.ts; api/src/routes/songs.ts]
- [Source: web/src/hooks/use-song-mutation.ts, use-song.ts, use-songs.ts; web/src/sync/flusher.ts]
- [Source: web/src/routes/song.tsx, songs.tsx; web/src/router.tsx; web/src/lib/id.ts, microcopy.ts]
- [Source: STYLE.md; web/src/styles/tokens.css; e2e/smoke/shell.spec.ts]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created (2026-10-25).

- Implemented add/edit form route, shared `useSongOrCached` hook, entry links, routes, copy and STYLE.md Forms section. Field background uses the existing `--color-bg` token. lint, typecheck, all tests (web 184) and build pass; api/shared/infra untouched.
- Task 7: commit and deploy are left for Sandy's go-ahead (push to main is gated).

### File List

- STYLE.md
- web/src/lib/microcopy.ts
- web/src/hooks/use-song-or-cached.ts (+ .test.tsx)
- web/src/routes/song-edit.tsx (+ .test.tsx)
- web/src/routes/song.tsx, song.test.tsx
- web/src/routes/songs.tsx, songs.test.tsx
- web/src/router.tsx
- e2e/smoke/shell.spec.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-10-25: Implemented story 7.6.
- 2026-10-25: Code review fix — leaving an edit (Save or Cancel) steps back in history when there is history, so Back from the song page reaches the list instead of the same song page. Status → done.
