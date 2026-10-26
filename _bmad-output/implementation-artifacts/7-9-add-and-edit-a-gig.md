# Story 7.9: Add and edit a gig

Status: done

<!-- Source: epics.md "Epic 7 / Story 7.9". Pattern: Story 7.6 (add and edit a song), including its review fix (step back in history on leaving an edit). -->

## Story

As Sandy,
I want to add a new gig and correct an existing one's details,
so that the gig list stays up to date without touching the database.

## Acceptance Criteria

1. `/gigs` gains one "Add gig" link to `/gigs/new`. The gig page gains one "Edit" link to
   `/gigs/:setlistId/edit`. Nothing else on either page changes.
2. Both routes show the same form: venue, date and time, in that order, each with a visible
   label. Date and time use the browser's native date and time inputs. All inputs use type
   roles from `STYLE.md` (no one-off sizes); 16px minimum so iOS does not zoom.
3. Editing pre-fills the form from the gig. Adding starts empty.
4. "Save" writes the setlist through the existing `use-setlist-mutation` hook, then goes to
   that gig's page. A new gig gets a fresh 16-char NanoID from `web/src/lib/id.ts` and no
   sections. "Cancel" goes back (to the gig page when editing, to `/gigs` when adding)
   without saving.
5. Venue and date are required: with either blank, Save shows a plain one-sentence message and
   does not save. Time is optional; a blank time is saved as absent, not as an empty string.
6. Editing keeps the stored sections and songs unchanged (the PUT replaces the whole record).
7. Editing an unknown `setlistId` shows the same "Gig not found" line and "Back to gigs" link
   as the gig page.
8. `/gigs/new` and `/gigs/:setlistId/edit` are valid routes (amends 7.1 AC3); signed out, they
   show the existing login.
9. No delete, setlist editing, duplicate-gig check, autosave or unsaved-changes prompt. No
   change to `api/`, `shared/` or `infra/`.
10. Same responsive and theming rules as 7.1 (360px–1680px with no horizontal scroll,
    light/dark via `prefers-color-scheme`, WCAG AA contrast).
11. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass. Unit tests cover adding
    a gig, editing one (sections preserved, blanked time saved as absent), the required-field
    message, and Cancel. `e2e/smoke` checks the two new routes end on the login when signed
    out.
12. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] **Task 1: Copy** (AC: 2, 5)
  - [x] `web/src/lib/microcopy.ts`: append (don't edit `GIGS` or `GIG_SETLIST`) a block
    commented `/* Story 7.9 — add/edit gig. */`:
    ```ts
    export const GIG_FORM = {
      addLink: 'Add gig',
      editLink: 'Edit',
      addHeading: 'Add gig',
      editHeading: 'Edit gig',
      venue: 'Venue',
      date: 'Date',
      time: 'Time',
      save: 'Save',
      cancel: 'Cancel',
      required: 'A gig needs a venue and a date.',
    } as const;
    ```
  - [x] No `STYLE.md` change: its "Forms" section (from 7.6) already covers labels, fields and
    the Save/Cancel pair. No new colours or tokens.

- [x] **Task 2: Entry links** (AC: 1)
  - [x] `gigs.tsx`: wrap the existing "Home" link and a new "Add gig" link (`to="/gigs/new"`)
    in a `flex items-center justify-between gap-[calc(var(--spacing-unit)*4)]` row, exactly as
    `songs.tsx` does for "Add song". Both use the existing back-link class string. Nothing else
    changes.
  - [x] `gig.tsx`: same pattern, with "Back to gigs" on the left and "Edit"
    (`to={`/gigs/${setlistId}/edit`}`) on the right. Show "Edit" only when `setlist` is set
    (not on loading, error or not found), as `song.tsx` does.

- [x] **Task 3: The form route** (AC: 2–7, 9)
  - [x] New `web/src/routes/gig-edit.tsx` exporting `GigEdit`, modelled line for line on
    `song-edit.tsx`: `useParams().setlistId` undefined means add mode, set means edit mode.
  - [x] Edit mode (`EditExisting`): `useSetlistOrCached(setlistId)`. While `setlist` is unset,
    render the "Back to gigs" link (`GIGS.backToGigs`, `to="/gigs"`) and the status line,
    exactly as the gig page does (AC7). Once set, render
    `<GigForm key={setlist.setlistId} initial={setlist} />`. The form reads `initial` once
    into `useState`, so a background refetch never resets what Sandy is typing.
  - [x] Add mode: `<GigForm />`, with the id generated once by `useState(() => generateId())`.
    Don't call `useSetlistOrCached` in add mode.
  - [x] Layout, top to bottom: `PageTitle` (`Add gig` / `Edit gig`); then three label + field
    pairs: venue `<input type="text">`, date `<input type="date">`, time
    `<input type="time">`. Tie each label to its field with `htmlFor` and `id` (`gig-venue`,
    `gig-date`, `gig-time`). Then a row with Save (`<button type="submit">`) and Cancel. Use a
    `<form noValidate onSubmit>` with `preventDefault`. Reuse the same class strings as
    `song-edit.tsx` (`LINK_CLASS`, `LABEL_CLASS`, `FIELD_CLASS`, `PAIR_GAP`, button classes).
    Copy them into this file; don't refactor `song-edit.tsx` in this story.
  - [x] Native date/time inputs: add `min-h-tap` to those two fields. iOS Safari collapses an
    empty date or time input to almost no height. Keep `box-border w-full` so 360px has no
    horizontal scroll. Don't set `step` on the time input (its value must stay `HH:MM`, per
    the schema comment). Don't set `min`/`max` on the date input; past gigs are valid.
  - [x] Save:
    - `venue.trim()`; `date` as given by the input (a native date input yields `YYYY-MM-DD`
      or `''`, never a partial value); `time` as given (`HH:MM` or `''`).
    - If the venue or the date is blank, show `GIG_FORM.required` once, below the date field
      (`<p role="alert">`, Body size, primary text, same classes as the 7.6 title message).
      Set `aria-invalid` on each blank field, focus the first blank one, and don't call
      `saveSetlist`. Clear the message on a successful save.
    - Build the `SetlistPutInput` explicitly: `bandId: ACTIVE_BAND_ID`, `setlistId`,
      `gigMeta: { venue, date, ...(time !== '' ? { time } : {}) }`,
      `sections: initial?.sections ?? []`, `clientWrittenAt: new Date().toISOString()`,
      `version: 1`. Never spread `initial` or `initial.gigMeta`. `initial` carries
      `serverReceivedAt`, and `SetlistPutInputSchema` is `.strict()`, so the API would
      answer 400 and the flusher would silently drop the write.
    - `await saveSetlist(record)`, then leave as `song-edit.tsx` does (the 7.6 review fix).
      When editing with history (`location.key !== 'default'`), `navigate(-1)`. Otherwise
      `navigate(`/gigs/${setlistId}`, { replace: true })`.
  - [x] Cancel: `<Link replace to={exitTo}>`, where `exitTo` is `/gigs/${setlistId}` when
    editing and `/gigs` when adding. Its `onClick` steps back with `navigate(-1)` when
    editing with history, as in `song-edit.tsx`. Nothing is written and there is no prompt.
  - [x] Header comment in the style of `song-edit.tsx`: one short paragraph covering what the
    page is, the whole-record PUT, and why sections are carried through.

- [x] **Task 4: Routes** (AC: 8)
  - [x] `router.tsx`: add `{ path: 'gigs/new', element: <GigEdit /> }` and
    `{ path: 'gigs/:setlistId/edit', element: <GigEdit /> }` beside the existing gig routes,
    inside the `RequireAuth` shell. React Router ranks the static `new` above `:setlistId`.

- [x] **Task 5: Tests** (AC: 11)
  - [x] `web/src/routes/gig-edit.test.tsx`, modelled on `song-edit.test.tsx`: mock
    `../hooks/use-setlist-mutation.js` (`saveSetlist: vi.fn().mockResolvedValue(undefined)`),
    `../hooks/use-setlist.js`, `../hooks/use-setlists.js` (as `gig.test.tsx` does) and
    `../lib/id.js` (`generateId: () => 'newgig0000000001'`). Render inside `MemoryRouter` +
    `Routes` with the real paths plus stub elements for `/gigs` and `/gigs/:setlistId`. Use
    `@testing-library/user-event`. Use neutral fixtures (`Test Venue`, `Venue A`); don't
    invent real venues.
    - Add: type the venue, date `2026-11-07` and time `20:00`, then Save. `saveSetlist` is
      called once with keys exactly `bandId, setlistId, gigMeta, sections, clientWrittenAt,
      version`, `setlistId === 'newgig0000000001'`, `sections` equal to `[]`, and
      `gigMeta` equal to `{ venue, date: '2026-11-07', time: '20:00' }`. The
      `/gigs/newgig0000000001` stub is then shown.
    - Edit: use a gig with a time and two sections, one of which holds a song with a
      `perGigAnnotation`. Check the fields are pre-filled. Clear the time, change the venue
      and Save. `gigMeta` has no `time` key, `sections` deep-equals the original, there is
      no `serverReceivedAt` key, and `clientWrittenAt` is new.
    - Blank venue (spaces only) with a date: `GIG_FORM.required` is shown and `saveSetlist`
      is not called. Repeat with a venue but a blank date.
    - Cancel when editing shows the gig-page stub; Cancel when adding shows the `/gigs` stub.
      Neither calls `saveSetlist`.
    - An unknown gig in edit mode shows `GIGS.notFound` and the "Back to gigs" link, and no
      form.
  - [x] `gigs.test.tsx`: the "Add gig" link points to `/gigs/new`.
  - [x] `gig.test.tsx`: the "Edit" link points to `/gigs/g1/edit` when the gig is shown, and
    is absent on not found.
  - [x] `e2e/smoke/shell.spec.ts`: add `/gigs/new` and `/gigs/anything/edit` to the loop in the
    `/gigs` test, and update its title to name them.
  - [x] No snapshot tests.

- [x] **Task 6: Verify, commit, deploy** (AC: 9, 11, 12)
  - [x] `git diff --stat HEAD -- api shared infra` is empty.
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.
  - [x] After code review: one commit, `Implement story 7.9: Add and edit a gig`. Push to
    `main` only with Sandy's go-ahead, then watch `deploy.yml` with `gh run watch`. If the
    blackout check blocks, report it; don't use `deploy-force.yml`.
  - [x] Set the story to `review`. No screenshots and no manual checklist for Sandy.

## Dev Notes

### What this story is

The gig twin of 7.6, and web only. `PUT /api/v1/setlists/:setlistId` already creates or
replaces a setlist (LWW on `clientWrittenAt`). `useSetlistMutation().saveSetlist()` already
writes the per-setlist and list caches optimistically, queues the PUT and kicks the flusher.
This story adds one form route, two links and some copy. Copy `song-edit.tsx` closely; its
review fix (stepping back in history) applies here too.

### Facts verified when the story was written (2026-10-26)

- `SetlistSchema` (`shared/src/schemas/setlist.ts`) has
  `gigMeta: { venue: string; date: z.string().date(); time?: string }`. `date` is ISO
  `YYYY-MM-DD` and `time` is `HH:MM` 24-hour, which are the native input value formats.
  `sections: { name, songs: { songId, titleSnapshot, perGigAnnotation? }[] }[]`.
  `SetlistPutInputSchema` = `SetlistSchema.omit({ serverReceivedAt }).strict()`. Import
  `ACTIVE_BAND_ID`, `type Setlist` and `type SetlistPutInput` from `@gigbuddy/shared`, and
  define no parallel types.
- The schema accepts an empty venue string, so the venue rule is the form's job. A blank
  date fails `z.string().date()` with a 400, which the flusher drops and only logs. So the
  form must block a blank date itself.
- API PUT (`api/src/routes/setlists.ts`): the path `setlistId` must match the body; `bandId`
  must be `ACTIVE_BAND_ID`; a missing record is created. `putSetlist` rewrites
  `gsi1sk = <date>#<setlistId>`, so a changed date re-sorts the gig server-side. On the
  client, `orderGigs` sorts the list each render, so the optimistic list entry lands in the
  right group (upcoming or past) at once.
- The list endpoint returns full records (parsed with `SetlistSchema`, sections included), so
  pre-filling from the list cache via `useSetlistOrCached` is safe for AC6.
- After adding a gig, the gig page renders straight from the optimistic per-setlist cache.
  A refetch that 404s before the PUT lands sets `one.data` to `null`, but
  `useSetlistOrCached` falls back to the optimistic list entry, so "Gig not found" should
  not flash. Don't add workarounds in hooks or the flusher.
- `useSetlist(null)` is disabled. `generateId()` returns a 16-char URL-safe NanoID (AR-47).
- `gig.tsx` today renders the back link, then `PageTitle afterBackLink` (venue, or date if
  the venue is blank), the date line, `SetlistSections`, or the status line. Only the top link
  row changes. `gigs.tsx` today renders "Home", `PageTitle`, the upcoming rows, "Past" and
  the past rows. Only the top link row changes.
- Story 7.10 will add "Edit setlist" to the gig page. Don't pre-build it.

### Guardrails

- Out of scope: delete, editing sections or songs, showing the time on the gig page or list,
  duplicate checks, autosave, an unsaved-changes prompt, and any change to `api/`, `shared/`,
  `infra/` or sync.
- No placeholders inside fields; visible labels only. One layout from 360px up; no device
  detection.
- Biome only; `kebab-case` files; co-located tests; `.js` import suffix; `react-router`
  imports; British English.
- Never use `--color-border-hairline` for field borders (it is transparent in dark mode).

### Project Structure Notes

New: `web/src/routes/gig-edit.tsx` (+ `.test.tsx`).
Updated: `router.tsx`, `gigs.tsx`, `gig.tsx` (+ their tests), `microcopy.ts`,
`e2e/smoke/shell.spec.ts`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.9]
- [Source: _bmad-output/implementation-artifacts/7-6-add-and-edit-a-song.md (pattern, review fix)]
- [Source: _bmad-output/implementation-artifacts/7-8-setlist-on-the-gig-page.md]
- [Source: shared/src/schemas/setlist.ts; api/src/routes/setlists.ts; api/src/ddb/setlists.ts]
- [Source: web/src/hooks/use-setlist-mutation.ts, use-setlist-or-cached.ts; web/src/lib/id.ts, gig-date.ts, microcopy.ts]
- [Source: web/src/routes/song-edit.tsx, gig.tsx, gigs.tsx, songs.tsx; web/src/router.tsx]
- [Source: STYLE.md "Forms"; e2e/smoke/shell.spec.ts]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5

### Debug Log References

### Completion Notes List

- Implemented as specified. `pnpm lint`, `typecheck`, `test` (web 228, all workspaces green) and `build` pass; `api/`, `shared/`, `infra/` untouched.
- The 7.8 setlist-order test counted every link on the gig page, so it now also filters out the new Edit link.
- Commit, push and deploy (Task 6) remain for after code review.
- Ultimate context engine analysis completed - comprehensive developer guide created (2026-10-26).

### File List

- web/src/lib/microcopy.ts (modified)
- web/src/routes/gig-edit.tsx (new)
- web/src/routes/gig-edit.test.tsx (new)
- web/src/routes/gigs.tsx, gigs.test.tsx (modified)
- web/src/routes/gig.tsx, gig.test.tsx (modified)
- web/src/router.tsx (modified)
- e2e/smoke/shell.spec.ts (modified)

### Change Log

- 2026-10-26: Implemented story 7.9 (add and edit a gig).
- 2026-10-26: Code review clean (light single-pass); committed b53711b, deployed, checked by Sandy; status → done.
