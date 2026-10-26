---
baseline_commit: 3d45be6
---

# Story 7.8: Setlist on the gig page

Status: done

<!-- Source: epics.md "Epic 7 / Story 7.8". Builds on 7.7 (gig page shell) and 7.5 (song page). -->

## Story

As Sandy,
I want a gig's page to list its songs by section, each opening that song's page,
so that I can see what we're playing and read any song in it without leaving the gig.

## Acceptance Criteria

1. `/gigs/:setlistId` keeps its title, date and "Back to gigs" link from 7.7. Beneath them it
   lists the setlist's songs in stored order, grouped by section. Each section with a
   non-blank name shows that name as a small heading above its songs; a blank name shows no
   heading. A section with no songs is left out.
2. Each song shows its `titleSnapshot` (no Songs-table lookup) as a large tap target in
   generous type, using existing `STYLE.md` roles, and links to
   `/gigs/:setlistId/songs/:songId`.
3. With no songs in any section, the gig page shows a plain one-line empty-state message in
   place of the list.
4. `/gigs/:setlistId/songs/:songId` shows the same content as `/songs/:songId` (7.5), with
   "Back to gig" linking to `/gigs/:setlistId` in place of "Back to songs", and no "Edit"
   link. Loading, error and "Song not found" behave as on the song page, with the
   "Back to gig" link.
5. `/songs/:songId` is unchanged (still "Back to songs" and "Edit").
6. `/gigs/:setlistId/songs/:songId` is a valid route (amends 7.1 AC3); signed out, it shows
   the existing login.
7. No per-gig annotations, previous/next song, performance mode, reordering or setlist
   editing. No change to `api/`, `shared/` or `infra/`; uses the existing hooks.
8. Same responsive and theming rules as 7.1 (360px–1680px with no horizontal scroll,
   light/dark via `prefers-color-scheme`, WCAG AA contrast).
9. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass. Unit tests cover section
   headings (including a blank name and an empty section), song order, the empty state, gig →
   song → "Back to gig", and the gig song page having no "Edit" link. `e2e/smoke` checks
   `/gigs/:setlistId/songs/:songId` ends on the login when signed out.
10. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] **Task 1: Copy** (AC: 3, 4)
  - [x] `web/src/lib/microcopy.ts`: append (don't edit existing blocks) a block commented
    `/* Story 7.8 — setlist on the gig page, and the song page inside a gig. */`:
    ```ts
    export const GIG_SETLIST = {
      empty: 'No songs in this setlist yet.',
      backToGig: 'Back to gig',
    } as const;
    ```
  - [x] No `STYLE.md` or token change: section headings reuse the existing "group label
    inside a list" bullet (STYLE.md, "Spacing and tap targets"); rows reuse the gig/song row
    classes.

- [x] **Task 2: Setlist on the gig page** (AC: 1, 2, 3)
  - [x] `web/src/routes/gig.tsx`: inside the `setlist ? (...)` branch, after the date line,
    render the setlist. Update the header comment (drop "The setlist itself arrives in a
    later story").
  - [x] `const sections = setlist.sections.filter((s) => s.songs.length > 0)`. If empty, one
    `<p>` with `GIG_SETLIST.empty`, Body role, secondary text,
    `mt-[var(--spacing-section-gap)]` (same classes as the 7.7 status line apart from the
    margin).
  - [x] Otherwise, for each section in stored order:
    - if `section.name.trim()` is non-empty, an `<h2>` with the trimmed name, using exactly
      the classes of the "Past" `<h2>` in `gigs.tsx`
      (`m-0 mt-[var(--spacing-section-gap)] text-[length:var(--text-body)] font-normal …`);
    - a `<ul>` of its songs, row markup and classes exactly as `GigRows` in `gigs.tsx`
      (`li` with hairline border, block `Link` with `min-h-tap`, Row role), text
      `song.titleSnapshot`, `to={`/gigs/${setlist.setlistId}/songs/${song.songId}`}`.
    - When a section has no heading, give its `<ul>` the section gap instead of the
      `spacing-unit*2` top margin so groups stay visually separate; a headed `<ul>` keeps
      `mt-[calc(var(--spacing-unit)*2)]` as in `gigs.tsx`.
  - [x] Keys: a song can appear twice in one setlist, so don't key on `songId`. Use the
    section index for sections and `${sectionIndex}-${songIndex}` for rows (the list is
    static; index keys are fine).
  - [x] Do not show `perGigAnnotation`. Do not look up songs; `titleSnapshot` only.
  - [x] If the file grows unwieldy, a small local `SetlistSections` component in the same
    file is fine. No new shared component.

- [x] **Task 3: Song page inside a gig** (AC: 4, 5)
  - [x] `web/src/routes/song.tsx`: read `const { songId, setlistId } = useParams();`.
    When `setlistId` is defined, the page is in a gig:
    - back link `to={`/gigs/${setlistId}`}`, text `GIG_SETLIST.backToGig`;
    - no Edit link.
    Otherwise everything is exactly as today (`/songs`, `SONGS.backToSongs`, Edit link).
    Content, status line and `useSongOrCached` are unchanged. Update the header comment with
    one line about the gig variant.
  - [x] Derive the context from the URL, not navigation state, so it survives refresh and a
    PWA relaunch. Don't add a prop or a second route component.
  - [x] `web/src/router.tsx`: add `{ path: 'gigs/:setlistId/songs/:songId', element: <Song /> }`
    after `gigs/:setlistId`, inside the `RequireAuth` children. Catch-all unchanged.

- [x] **Task 4: Tests** (AC: 9)
  - [x] `gig.test.tsx` (existing mocks of `use-setlist.js` / `use-setlists.js`). Build
    full `sections` arrays in the fixture. Cover:
    - two sections named `Set 1` and `Set 2` ⇒ two `h2`s with those names, songs in stored
      order under each (check `getAllByRole('link')` order, excluding "Back to gigs"), each
      link's `href` is `/gigs/<setlistId>/songs/<songId>`;
    - a section with a blank or whitespace-only name ⇒ its songs show, no extra `h2`;
    - a section with no songs ⇒ no heading for it;
    - the same `songId` twice ⇒ both rows render (no key warning);
    - `sections: []` and all-empty sections ⇒ the empty line, no list;
    - existing tests keep passing (venue/date/not-found/loading).
  - [x] `song.test.tsx`: add a `renderGigSong()` helper with route
    `/gigs/:setlistId/songs/:songId` and entry `/gigs/g1/songs/abc`. Cover: title shows;
    "Back to gig" links to `/gigs/g1`; no "Edit" link; "Song not found" shows with
    "Back to gig". The existing `/songs/:songId` tests stay unchanged (AC5).
  - [x] `app-bootstrap.test.tsx`: extend the `home → Gigs → a gig` journey (or add a
    sibling test) so the stub setlist has one section with one song
    (`{ songId: 's1', titleSnapshot: 'Test Tune' }`) and `/songs/s1` returns a full song
    record (Zod-validated; copy the shape from the existing songs journey). Click
    `Test Tune`, expect the `h1` `Test Tune` and a "Back to gig" link; click it, expect the
    gig `h1` again.
  - [x] `e2e/smoke/shell.spec.ts`: add `/gigs/anything/songs/anything` to the gig routes
    loop and update the test title to mention it. No auth fixture.
  - [x] Placeholder names only (`Set 1`, `Test Tune`, `Venue A`). Don't invent real songs,
    venues or section names. No snapshot tests.

- [x] **Task 5: Verify, commit, deploy** (AC: 7, 9, 10)
  - [x] `git diff --stat HEAD -- api shared infra` is empty.
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass.
  - [x] Commit after code review, one commit: `Implement story 7.8: Setlist on the gig page`.
    Push to `main` only with Sandy's go-ahead; watch `deploy.yml` with `gh run watch`. If the
    blackout check blocks, report it; don't use `deploy-force.yml` unless Sandy says so.
  - [x] Set the story to `review`. No screenshots and no manual checklist for Sandy.

## Dev Notes

### What this story is

Read-only and web only. The gig page from 7.7 gains its song list, and the existing song
page gains a second URL under the gig. All the data is already on the setlist record that
the gig page has loaded, so there are no new fetches on the gig page.

### Design decision (Sandy, 2026-10-26)

- The gig's song URL is nested (`/gigs/:setlistId/songs/:songId`) rather than reusing
  `/songs/:songId`. The URL alone decides "Back to gig" vs "Back to songs", so it survives
  refresh and PWA relaunch. It also leaves room for the gig version of the page to grow
  apart later (per-gig annotation, previous/next). For now it renders the same `Song`
  component.
- Section names show as small headings.
- No Edit link inside a gig. That avoids deciding where Back goes after an edit (the 7.6 review
  fix area). Editing stays available from Songs.

### Facts verified when the story was written (2026-10-26)

- `SetlistSchema` (`shared/src/schemas/setlist.ts`): `sections: { name: string; songs:
  SongRef[] }[]`; `SongRef = { songId, titleSnapshot, perGigAnnotation? }`. `titleSnapshot`
  is the title at write time by design (AR-11), so it may differ from a since-renamed song.
  That's accepted. Import types from `@gigbuddy/shared` if needed; no parallel types.
- The song page title still comes from the Songs record (`useSongOrCached`), so it shows the
  current title even if the snapshot is older.
- A `songId` in a setlist may not exist in the library (deleted, or imported data). The gig
  song page then shows "Song not found." with "Back to gig". That's correct; no special
  handling.
- Section names in real data come from the Apple Notes import (7 JR5 setlists). Don't
  assume particular values ("Set 1" etc. are only test placeholders). Blank names are
  possible in principle; handle them per AC1.
- `gig.tsx` today: back link, `PageTitle` (venue, or date if venue blank), date line, status
  line fallback via `useSetlistOrCached`. All of that is preserved.
- `song.tsx` today: back link + Edit link in a flex row, then content. Only the two links
  change, and only when `setlistId` is in the params.
- Router: `gigs/:setlistId` exists; React Router 7 ranks the more specific
  `gigs/:setlistId/songs/:songId` correctly with no ordering tricks.

### Guardrails

- Out of scope: `perGigAnnotation`, previous/next, performance mode, jump, editing or
  reordering a setlist, song counts per section, time display, any `api/`, `shared/`,
  `infra/` or sync change.
- One layout from 360px up; titles wrap (no `truncate`, no `whitespace-nowrap`).
- Biome only; `kebab-case` files; co-located tests; `.js` import suffix; imports from
  `react-router`; British English.

### Project Structure Notes

No new files. Updated: `web/src/routes/gig.tsx` (+ test), `web/src/routes/song.tsx`
(+ test), `web/src/router.tsx`, `web/src/lib/microcopy.ts`, `web/src/app-bootstrap.test.tsx`,
`e2e/smoke/shell.spec.ts`, `sprint-status.yaml`.

### Previous story intelligence

- 7.7: `GigRows` in `gigs.tsx` is the row pattern; the "Past" `<h2>` is the group-label
  pattern and has a STYLE.md bullet. Review was clean. Deploy was blocked by the Sunday
  evening blackout and forced by Sandy, so expect the blackout check again on weekend evenings.
- 7.6: Back after edit needed a review fix, which is why this story keeps Edit out of the gig
  context.
- 7.3/7.7: signed-in journeys live in `app-bootstrap.test.tsx` with a `fetch` stub; records
  must be full schema shapes because responses are Zod-validated.
- Commits: one per story, then a separate "Close out" commit after review.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.8]
- [Source: _bmad-output/implementation-artifacts/7-7-gig-list-at-gigs.md, 7-5-basic-song-page.md, 7-6-add-and-edit-a-song.md]
- [Source: shared/src/schemas/setlist.ts]
- [Source: web/src/routes/gig.tsx, gigs.tsx, song.tsx; web/src/router.tsx; web/src/lib/microcopy.ts]
- [Source: web/src/routes/gig.test.tsx, song.test.tsx; web/src/app-bootstrap.test.tsx; e2e/smoke/shell.spec.ts]
- [Source: STYLE.md "Spacing and tap targets"]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created (2026-10-26).

- Implemented gig setlist (`SetlistSections` in gig.tsx), nested song route reusing `Song` (URL decides Back link and Edit), microcopy, tests (gig, song, bootstrap journey, e2e smoke).
- The existing "blank venue" gig test now uses a one-song fixture, since the empty-state line is a `<p>`.
- lint, typecheck, test (all packages) and build pass; `api`/`shared`/`infra` untouched. Commit/push/deploy left for after code review and Sandy's go-ahead.

### File List

- web/src/lib/microcopy.ts
- web/src/routes/gig.tsx
- web/src/routes/gig.test.tsx
- web/src/routes/song.tsx
- web/src/routes/song.test.tsx
- web/src/router.tsx
- web/src/app-bootstrap.test.tsx
- e2e/smoke/shell.spec.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-10-26: Implemented story 7.8 (setlist on the gig page); status → review.
- 2026-10-26: Code review clean; committed (f2a60f8), deployed, Sandy checked live; status → done.
