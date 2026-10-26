---
baseline_commit: 393fb941f23f7a189bced0e8d2e92500a11e31f8
---
# Story 7.10: Edit the setlist as text

Status: done

<!-- Source: epics.md "Epic 7 / Story 7.10". Pattern: Story 7.9 (gig-edit.tsx), including the 7.6 review fix (step back in history on leaving an edit). -->

## Story

As Sandy,
I want to edit a gig's setlist as plain text, one song per line,
so that I can paste in a setlist shared by text message and add, remove or reorder songs by editing lines.

## Acceptance Criteria

1. The gig page gains one "Edit setlist" link to `/gigs/:setlistId/setlist`. Nothing else on
   the gig page changes.
2. `/gigs/:setlistId/setlist` shows the venue as the title (`PageTitle`) and one labelled
   multi-line text box, using `STYLE.md` type roles (16px minimum), pre-filled from the stored
   setlist: each song's `titleSnapshot` on its own line, in stored order; each section with a
   non-blank name preceded by a line `## <name>`; a blank line between sections.
3. On "Save", the text is read line by line. Blank lines are ignored. A line starting `##`
   starts a new section named by the rest of the line, trimmed. Lines before the first `##`
   form a section with a blank name. Every other line, trimmed, is a song title.
4. Each title is matched to a library song by title, ignoring case and surrounding spaces,
   and treating curly quotes (‘ ’ “ ”) as straight ones (' "). `titleSnapshot` is set to the
   library song's current title. The same song may appear more than once.
5. If any title matches no song, or more than one song, nothing is saved and a plain message
   lists those lines (e.g. "Not in the library: <title>"). The text box keeps what was typed.
6. A valid save writes the setlist through the existing `use-setlist-mutation` hook,
   replacing its sections and keeping the gig details, then goes to the gig page. "Cancel"
   goes back to the gig page without saving.
7. Per-gig annotations are not shown or edited. A song already in the setlist keeps its
   stored `perGigAnnotation` (matched by `songId`); new songs have none.
8. An unknown `setlistId` shows the same "Gig not found" line and "Back to gigs" link as the
   gig page. While the library is loading or fails, Save is unavailable with a plain line.
9. `/gigs/:setlistId/setlist` is a valid route (amends 7.1 AC3); signed out, it shows the
   existing login.
10. No fuzzy matching, creating songs from unmatched lines, drag reordering, autosave or
    unsaved-changes prompt. No change to `api/`, `shared/` or `infra/`.
11. Same responsive and theming rules as 7.1 (360px–1680px with no horizontal scroll,
    light/dark via `prefers-color-scheme`, WCAG AA contrast).
12. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass. Unit tests cover the
    text round trip (stored setlist → text → same sections), section headings and the
    unnamed first section, case-insensitive matching, unmatched and ambiguous titles, kept
    annotations, and Cancel. `e2e/smoke` checks the new route ends on the login when signed
    out.
13. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] **Task 1: Copy** (AC: 1, 2, 5, 8)
  - [x] `web/src/lib/microcopy.ts`: append (don't edit earlier blocks) a block commented
    `/* Story 7.10 — edit the setlist as text. */`:
    ```ts
    export const SETLIST_TEXT = {
      editLink: 'Edit setlist',
      label: 'Setlist',
      hint: 'One song per line. Start a line with ## to name a section.',
      save: 'Save',
      cancel: 'Cancel',
      notInLibrary: 'Not in the library:',
      ambiguous: 'More than one song is called:',
      songsLoading: 'Loading songs…',
      songsError: "Couldn't load your songs, so the setlist can't be saved yet.",
    } as const;
    ```
    Problem lines render as `${SETLIST_TEXT.notInLibrary} ${line}`. Microcopy holds plain
    strings only; no functions.
  - [x] No `STYLE.md` change: "Forms" already covers labels, the text box and Save/Cancel.

- [x] **Task 2: Pure text ↔ sections module** (AC: 2–5, 7)
  - [x] New `web/src/lib/setlist-text.ts`, no React, two exports. Types come from
    `@gigbuddy/shared` (`Section`, `SongRef`, `Song`); define no parallel record types (a small
    local result type for the parse outcome is fine).
  - [x] `setlistToText(sections: Section[]): string`
    - For each section, in order: if its name is non-blank, a line `## <name trimmed>`; then
      each song's `titleSnapshot`, one per line. Join sections with one blank line.
    - A blank-named section that is **not the first** gets a bare `##` line, so it doesn't
      merge into the section above on the way back (AC3 reads `##` alone as a blank name).
      A blank-named first section gets no heading.
    - An empty named section still writes its `## <name>` line, so the round trip keeps it.
      An empty blank-named section writes nothing.
  - [x] `parseSetlistText(text, songs: Song[], previous: Section[])` returns either
    `{ ok: true, sections: Section[] }` or `{ ok: false, notInLibrary: string[], ambiguous: string[] }`.
    - Split on `/\r?\n/`. Trim each line. Skip blank lines.
    - A trimmed line starting `##` opens a new section named `line.slice(2).trim()`. It is
      kept even if no songs follow (the gig page already hides empty sections).
    - A song line before any `##` opens one blank-named section (only when such a line
      exists; never emit an empty leading unnamed section).
    - Match key: one small helper, `matchKey(s)` = `s.trim().toLowerCase()` with `‘ ’`
      (U+2018, U+2019) replaced by `'` and `“ ”` (U+201C, U+201D) by `"`. Apply it to both
      the typed line and the library title. Nothing else is normalised (AC10).
    - Match: build a map from `matchKey(title)` to the songs with that key. One
      song → `{ songId, titleSnapshot: song.title }`. Zero → `notInLibrary`; two or more →
      `ambiguous`. Record the trimmed line as typed, each distinct line once (compare by
      the match key), in first-seen order.
    - Annotations (AC7): build `songId → perGigAnnotation` from `previous`, taking the first
      stored occurrence that has one. Every occurrence of that `songId` in the result gets
      it. Omit the key entirely when there is none (don't write `perGigAnnotation: undefined`).
    - Any problem → `ok: false` and no sections.
  - [x] Header comment: one short paragraph on the format and why matching is exact.

- [x] **Task 3: Gig page link** (AC: 1)
  - [x] `gig.tsx`: in the top row, wrap the right-hand side in a group holding "Edit setlist"
    (`to={`/gigs/${setlist.setlistId}/setlist`}`) then the existing "Edit", both with the
    existing link class, shown only when `setlist` is set. Give the outer row and the group
    `flex-wrap` and keep the existing `gap-[calc(var(--spacing-unit)*4)]`; at 360px the three
    Row-size links are close to the 328px content width. Nothing else on the page changes.

- [x] **Task 4: The setlist text route** (AC: 2–8, 10)
  - [x] New `web/src/routes/setlist-edit.tsx` exporting `SetlistEdit`, modelled on
    `gig-edit.tsx`. There is no add mode: the route always has a `setlistId`.
  - [x] Outer component: `useSetlistOrCached(setlistId)`. While `setlist` is unset, render the
    "Back to gigs" link and status line exactly as `EditExisting` in `gig-edit.tsx` does
    (AC8). Once set, render `<SetlistTextForm key={setlist.setlistId} initial={setlist} />`,
    which reads `setlistToText(initial.sections)` once into `useState`, so a refetch never
    resets what Sandy is typing.
  - [x] Title: `PageTitle` with the venue trimmed, or `formatGigDate(date)` when the venue is
    blank, as `gig.tsx` does.
  - [x] Layout: label (`htmlFor="setlist-text"`, `LABEL_CLASS`), the hint beneath it (Body,
    secondary text), then `<textarea id="setlist-text" rows={16}>` with
    `${FIELD_CLASS} resize-y` (copy the class strings from `gig-edit.tsx`; don't refactor
    shared constants in this story). Set `spellCheck={false}`, `autoCorrect="off"` and
    `autoCapitalize="off"` so iOS doesn't rewrite titles. Link the hint with
    `aria-describedby`. No placeholder.
  - [x] Library: `useSongs()`. `songs = data`. If `songs` is undefined, disable Save and show
    one Body, secondary-text line under the text box with `aria-live="polite"`:
    `SETLIST_TEXT.songsLoading` while `isPending`, else `SETLIST_TEXT.songsError`. If cached
    `data` exists, allow Save even when a refetch failed.
  - [x] Save (`<form noValidate onSubmit>`, `preventDefault`):
    - `parseSetlistText(text, songs, initial.sections)`. On `ok: false`, render a
      `<p role="alert">` block under the text box (Body, primary text, as the 7.9 required
      message) with one line per problem: all `notInLibrary` lines, then all `ambiguous`
      lines. Focus the text box. Don't call `saveSetlist`. The text is untouched.
    - On `ok: true`, clear any message and build the record field by field: `bandId:
      ACTIVE_BAND_ID`, `setlistId`, `gigMeta: initial.gigMeta`, `sections`,
      `clientWrittenAt: new Date().toISOString()`, `version: 1`. Never spread `initial`:
      it carries `serverReceivedAt` and `SetlistPutInputSchema` is `.strict()`, so the API
      would answer 400 and the flusher would silently drop the write.
    - `await saveSetlist(record)`, then leave as `gig-edit.tsx` does: with history
      (`location.key !== 'default'`) `navigate(-1)`, else
      `navigate(`/gigs/${setlistId}`, { replace: true })`.
  - [x] Cancel: `<Link replace to={`/gigs/${setlistId}`}>` whose `onClick` steps back with
    `navigate(-1)` when there is history, as in `gig-edit.tsx`.
  - [x] Header comment in the style of `gig-edit.tsx`.

- [x] **Task 5: Route** (AC: 9)
  - [x] `router.tsx`: add `{ path: 'gigs/:setlistId/setlist', element: <SetlistEdit /> }`
    beside the other gig routes, inside the `RequireAuth` shell.

- [x] **Task 6: Tests** (AC: 12)
  - [x] `web/src/lib/setlist-text.test.ts` (pure, no mocks). Neutral fixtures (`Tune A`,
    `Tune B`, `Set 1`); don't invent real song titles.
    - Round trip: sections `[{ name: '', … }, { name: 'Set 1', … }, { name: '', … }, { name: 'Set 2', songs: [] }]`
      → `setlistToText` → `parseSetlistText` with matching library songs deep-equals the
      original (titles equal to library titles).
    - Exact text for a two-section setlist (`## Set 1` lines, blank line between).
    - Lines before the first `##` form a blank-named section; no leading empty section when
      the text starts with `##`; blank lines and surrounding spaces ignored; `\r\n` works.
    - `'  tune a '` matches library `Tune A` and the snapshot is `Tune A`; a repeated title
      yields two refs.
    - Curly quotes: `Tune’s A` matches library `Tune's A` (snapshot keeps the library's
      straight quote), and `“Tune” B` matches `"Tune" B`; the reverse direction works too.
    - Unmatched title → `notInLibrary`; two library songs titled `Tune A` / `tune a` →
      `ambiguous`; duplicates reported once.
    - Kept annotation: a stored `s1` with `perGigAnnotation: 'slow'` keeps it after a
      reorder; a new song has no `perGigAnnotation` key.
  - [x] `web/src/routes/setlist-edit.test.tsx`, modelled on `gig-edit.test.tsx`: mock
    `use-setlist.js`, `use-setlists.js`, `use-songs.js` and `use-setlist-mutation.js`.
    Routes: the real `/gigs/:setlistId/setlist`, plus stubs for `/gigs` and `/gigs/:setlistId`.
    - Pre-fill: the text box holds `setlistToText(fullGig.sections)`; title is the venue.
    - Edit and Save: `saveSetlist` called once with keys exactly `bandId, setlistId, gigMeta,
      sections, clientWrittenAt, version`; `gigMeta` equals the original; the gig stub shows.
      (Use `user.clear` + `user.type`, remembering `{` and `[` are special in `user.type`.)
    - Unmatched line: the alert lists `Not in the library: <line>`, `saveSetlist` not
      called, the text box keeps the typed text.
    - Library pending: Save disabled and `SETLIST_TEXT.songsLoading` shown; library error with
      no data: `SETLIST_TEXT.songsError`.
    - Cancel shows the gig stub and doesn't call `saveSetlist`.
    - Unknown gig: `GIGS.notFound` and "Back to gigs", no text box.
  - [x] `gig.test.tsx`: "Edit setlist" points to `/gigs/g1/setlist` and is absent on not
    found. The 7.8 song-order test filters links by text; add `SETLIST_TEXT.editLink` to that
    filter (line ~105).
  - [x] `e2e/smoke/shell.spec.ts`: add `/gigs/anything/setlist` to the `/gigs` loop and its
    test title.
  - [x] No snapshot tests.

- [ ] **Task 7: Verify, commit, deploy** (AC: 10, 12, 13)
  - [x] `git diff --stat HEAD -- api shared infra` is empty.
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.
  - [ ] After code review: one commit, `Implement story 7.10: Edit the setlist as text`. Push
    to `main` only with Sandy's go-ahead, then watch `deploy.yml` with `gh run watch`
    (`GH_TOKEN=$(gh auth token --user mr-sandy)`). If the blackout check blocks, report it;
    don't use `deploy-force.yml`.
  - [x] Set the story to `review`. No screenshots and no manual checklist for Sandy.

## Dev Notes

### What this story is

Web only. One pure parser/serialiser module, one form route, one link and some copy. The
whole-record PUT and its optimistic caching already exist in `useSetlistMutation`. Copy the
shape of `gig-edit.tsx` closely; put all the text logic in `lib/setlist-text.ts` so it is
tested without React.

### Facts verified when the story was written (2026-10-26)

- `shared/src/schemas/setlist.ts`: `sections: { name: string; songs: { songId,
  titleSnapshot, perGigAnnotation? }[] }[]`. `SetlistPutInputSchema` =
  `SetlistSchema.omit({ serverReceivedAt }).strict()`. Exports `Section`, `SongRef`,
  `Setlist`, `SetlistPutInput`. Server never reads Songs on a setlist PUT, so the client
  supplies `titleSnapshot` (AR-11).
- `shared/src/schemas/song.ts`: `Song.title` is a plain string; nothing stops two songs having
  the same title, hence the ambiguous case.
- `useSongs()` (`web/src/hooks/use-songs.ts`): TanStack query `['songs', ACTIVE_BAND_ID]`,
  persisted to IDB, so `data` is normally there at once from cache.
- `useSetlistOrCached(setlistId)` returns `{ setlist, statusLine }` with the not-found /
  loading / error line already worked out. The list endpoint returns full records, so the
  list-cache fallback includes sections and annotations.
- `gig.tsx` top row today: "Back to gigs" on the left, "Edit" on the right (only when the
  gig is loaded). `gig.test.tsx` counts song links by filtering out those two link texts.
- Row (`--text-row`) is 22px, Reading 22px, Body 18px (`STYLE.md`). The text box uses
  Reading via `FIELD_CLASS`, so iOS won't zoom.

### Guardrails

- Out of scope: showing or editing annotations, fuzzy matching (list numbers like "1.",
  other punctuation, "feat."; Sandy decided on 2026-10-26 to straighten curly quotes only,
  because iOS inserts them when pasting from Messages and when typing), creating songs, drag reordering, autosave, unsaved-changes prompt, editing gig
  details here, any change to `api/`, `shared/`, `infra/`, hooks or sync.
- Don't restructure the gig page beyond the link row. Don't extract shared form class
  constants in this story.
- Biome only; `kebab-case` files; co-located tests; `.js` import suffix; `react-router`
  imports; British English. Never use `--color-border-hairline` for field borders.

### Project Structure Notes

New: `web/src/lib/setlist-text.ts` (+ `.test.ts`), `web/src/routes/setlist-edit.tsx`
(+ `.test.tsx`).
Updated: `router.tsx`, `gig.tsx`, `gig.test.tsx`, `microcopy.ts`, `e2e/smoke/shell.spec.ts`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.10]
- [Source: _bmad-output/implementation-artifacts/7-9-add-and-edit-a-gig.md (pattern)]
- [Source: _bmad-output/implementation-artifacts/7-8-setlist-on-the-gig-page.md]
- [Source: shared/src/schemas/setlist.ts, song.ts]
- [Source: web/src/hooks/use-setlist-mutation.ts, use-setlist-or-cached.ts, use-songs.ts]
- [Source: web/src/routes/gig-edit.tsx, gig.tsx, song-edit.tsx (textarea); web/src/router.tsx]
- [Source: web/src/lib/microcopy.ts, gig-date.ts; STYLE.md "Forms"; e2e/smoke/shell.spec.ts]

## Dev Agent Record

### Agent Model Used

claude-sonnet-5-5

### Debug Log References

None. Lint, typecheck, test (shared 30, infra 55, api 121, web 244) and build all pass; `git diff --stat HEAD -- api shared infra` is empty.

### Completion Notes List

- Pure `lib/setlist-text.ts` (`setlistToText`, `parseSetlistText`) with a `matchKey` helper (trim, lower-case, curly quotes straightened). A blank-named section that isn't first, and has songs, gets a bare `##` so it survives the round trip.
- `setlist-edit.tsx` follows `gig-edit.tsx`: whole-record PUT built field by field, history step-back on Save/Cancel, Save disabled until the library (or cached library) is available.
- Gig page: "Edit setlist" link beside "Edit", row wraps at narrow widths.
- Tests: 8 text-module tests, 7 route tests, gig page link tests, e2e smoke path added (e2e not run locally; no signed-out server).
- Task 7 commit and deploy left open: awaiting code review and Sandy's go-ahead to push.
- Code review (2026-10-26, Sandy chose option A): a line matching no library title but matching a stored `titleSnapshot` whose song is still in the library resolves to that song, so a setlist with a since-renamed song saves unchanged and picks up the new title. Deleted songs are still reported. One test added.

### File List

- web/src/lib/microcopy.ts (modified)
- web/src/lib/setlist-text.ts (new)
- web/src/lib/setlist-text.test.ts (new)
- web/src/routes/setlist-edit.tsx (new)
- web/src/routes/setlist-edit.test.tsx (new)
- web/src/routes/gig.tsx (modified)
- web/src/routes/gig.test.tsx (modified)
- web/src/router.tsx (modified)
- e2e/smoke/shell.spec.ts (modified)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)
- _bmad-output/implementation-artifacts/7-10-edit-the-setlist-as-text.md (modified)

### Change Log

- 2026-10-26: Implemented story 7.10 (edit the setlist as text); status → review.
- 2026-10-26: Code review: renamed songs resolve by their stored title.
