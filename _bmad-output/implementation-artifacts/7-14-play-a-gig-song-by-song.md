---
baseline_commit: c9910c1
---

# Story 7.14: Play a gig song by song

Status: ready-for-dev

<!-- Source: epics.md "Epic 7 / Story 7.14". Builds on 7.8 (setlist on the gig page, gig song page). -->

## Story

As Sandy,
I want to step through a gig's songs in order from the song page,
so that I can move to the next song on stage without going back to the gig list each time.

## Acceptance Criteria

1. Gig song links carry the song's place in the setlist: `/gigs/:setlistId/songs/:songId?at=<n>`,
   where `n` is the 1-based position across all sections in stored order. A song that repeats
   has a different `n` each time.
2. The gig song page shows a bar fixed to the bottom of the screen with "Previous", the
   position ("3 of 12") and "Next". The page content never sits under it: the end of a long
   chart can scroll fully clear of the bar. Navigation lives only in the bar; there is no
   tap-on-content or swipe navigation.
3. Next opens the song at `n+1`, Previous the song at `n−1`, crossing section boundaries.
   Each opens at the top of the page. History is replaced, so the browser's Back and
   "Back to gig" both return to the gig.
4. At the first song Previous is shown but inert; at the last song Next is shown but inert.
   Neither ever turns into another action.
5. The place comes from the setlist, not the song record. If the song is missing from the
   library ("Song not found."), the bar still shows so Sandy can step past it.
6. If `at` is missing, not a number, out of range, or points at a different song, the place is
   the song's first appearance in the setlist. If the song is not in the setlist at all, or
   the setlist hasn't loaded, there is no bar. Position logic lives in one pure helper so a
   later mid-set jump can show another song while keeping the planned place, without
   changing the setlist.
7. `/songs/:songId` is unchanged (no bar).
8. No mid-set jump, performance notes, per-gig annotations, next-song title preview, swipe
   or keyboard shortcuts, wake lock, or full-screen mode. No change to `api/`, `shared/` or
   `infra/`.
9. Same responsive and theming rules as 7.1. `STYLE.md` gains a short "Bottom bar" entry.
10. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass. Unit tests cover the
    position helper (repeats, bad `at`, not in setlist, across sections), the bar at first,
    middle and last songs, the missing-song case, and no bar on `/songs/:songId`.
11. Deployed to gig.cormie.com via the normal pipeline. A UI review follows this story
    (Sandy, 2026-10-26).

## Tasks / Subtasks

- [ ] **Task 1: Position helper** (AC: 1, 3, 6)
  - [ ] New `web/src/lib/gig-position.ts` (+ `gig-position.test.ts`). Pure functions, no React:
    ```ts
    import type { Setlist, SongRef } from '@gigbuddy/shared';

    /** Every song in the setlist, sections flattened in stored order. */
    export function playOrder(setlist: Setlist): SongRef[];

    /**
     * 0-based index of the place in playOrder for this song, or null when the
     * song isn't in the setlist. `at` is the raw `?at=` value (1-based).
     * A valid `at` whose song matches wins; otherwise the first appearance.
     */
    export function resolvePlace(order: SongRef[], songId: string, at: string | null): number | null;

    /** Link to the gig song page at a 0-based place. */
    export function gigSongPath(setlistId: string, order: SongRef[], index: number): string;
    // → `/gigs/${setlistId}/songs/${order[index].songId}?at=${index + 1}`
    ```
  - [ ] `at` parsing: accept only a whole number string (`/^\d+$/`) in `1..order.length`.
    `"0"`, `"-1"`, `"2.5"`, `"abc"`, `""`, `null` and out-of-range all fall back.
  - [ ] Tests: two sections flattened in order; a repeated song resolves to the `at` given
    (both occurrences); `at` pointing at a different song → first appearance; each bad `at`
    form above → first appearance; song not in setlist → `null`; empty setlist → `null`;
    `gigSongPath` output. Placeholder ids only.

- [ ] **Task 2: Gig page links carry `at`** (AC: 1)
  - [ ] `web/src/routes/gig.tsx` `SetlistSections`: build each link with `gigSongPath`. Keep a
    running flat index across sections (e.g. compute `playOrder` once and an offset per
    section, or a counter outside the map). Nothing else on the gig page changes.
  - [ ] Update `gig.test.tsx` href expectations to include `?at=<n>`, including a repeated
    song getting two different `at` values and a second-section song continuing the count.

- [ ] **Task 3: Bottom bar on the gig song page** (AC: 2, 3, 4, 5, 6, 7)
  - [ ] Copy: append to `web/src/lib/microcopy.ts` a block commented
    `/* Story 7.14 — play a gig song by song. */`:
    ```ts
    export const GIG_PLAY = {
      previous: 'Previous',
      next: 'Next',
      position: (n: number, total: number) => `${n} of ${total}`,
    } as const;
    ```
    (Check how existing microcopy handles parameterised strings first and follow that if a
    pattern exists.)
  - [ ] `web/src/routes/song.tsx`: when `setlistId` is set, also call
    `useSetlistOrCached(setlistId)` and read `at` with `useSearchParams` (from `react-router`).
    Compute `order = playOrder(setlist)` and `place = resolvePlace(order, songId, at)`.
    Render the bar only when `setlist` and `place !== null`. This is independent of whether
    the song record loaded (AC5): render it outside the `song ? … : statusLine` branch.
  - [ ] Keep the bar in a small local component in `song.tsx` (e.g. `GigPlayBar`), as 7.8 did
    with `SetlistSections`. No new shared component.
  - [ ] Bar layout:
    - Outer: `fixed inset-x-0 bottom-0`, background `var(--color-bg)`, 1px top border in
      `var(--color-text-secondary)` (not the hairline token: it is transparent in dark mode),
      bottom padding `env(safe-area-inset-bottom)` (`index.html` already has
      `viewport-fit=cover`).
    - Inner: same column as the shell, `mx-auto max-w-[40rem] px-[var(--spacing-gutter)]`,
      a flex row: Previous left, position centre, Next right; `justify-between`, vertically
      centred, `py-[calc(var(--spacing-unit)*2)]`.
    - Previous/Next: Row role, primary text, underlined, `min-h-tap` and at least
      `min-w-[var(--spacing-tap)]`, focus outline as the other links. Use `<Link replace
      to={gigSongPath(...)}>`.
    - Position: Body role, secondary text, e.g. "3 of 12".
    - Inert end (AC4): render the same label as a `<span aria-disabled="true">` in secondary
      text, no underline, same box size so nothing shifts. Not a link, not a button, no
      handler.
  - [ ] Content clearance (AC2): when the bar shows, give the page enough bottom padding that
    the last chart line can scroll above the bar, e.g. a wrapper or spacer with
    `pb-[calc(var(--spacing-tap)+var(--spacing-unit)*4+env(safe-area-inset-bottom))]`. Don't
    change `authenticated-shell.tsx`.
  - [ ] Scroll to top (AC3): there is no `ScrollRestoration` in the app, and Next re-renders
    the same mounted `Song` component, so the scroll position would carry over. Add
    `useEffect(() => { window.scrollTo(0, 0); }, [songId, at])` in `song.tsx`. (Biome may flag
    the extra deps as unnecessary; if so, keep them with a `biome-ignore` comment explaining
    they are the trigger.)
  - [ ] `/songs/:songId` (no `setlistId`): `useSetlistOrCached` must not fire a request. Check
    `useSetlist(null)` is disabled (it takes `setlistId ?? null`), and `useSetlists` is cached
    list data; acceptable. If `useSetlistOrCached` with `undefined` would show a status line
    or fetch, guard it. No bar, nothing else changes (AC7).
  - [ ] Update the header comment of `song.tsx` with one line about the bar.

- [ ] **Task 4: Style guide** (AC: 9)
  - [ ] `STYLE.md`, under "Spacing and tap targets", add a "Bottom bar" bullet: fixed to the
    bottom on the gig song page; page background; 1px top border in secondary text colour;
    links at Row size, at least 44px; position at Body size, secondary; an unavailable action
    shows as secondary text, not a link; content is padded so nothing hides under it. No
    token changes.

- [ ] **Task 5: Tests** (AC: 10)
  - [ ] `song.test.tsx`: also mock `../hooks/use-setlist.js` and `../hooks/use-setlists.js`
    (same pattern as `gig.test.tsx`). Fixture: two sections, three songs total, one songId
    repeated. Cover:
    - middle song: Previous and Next links with correct `href` (including `?at=`), "2 of 3";
    - first song: Previous is not a link (`aria-disabled="true"`), Next is a link;
    - last song: Next is not a link, Previous is;
    - repeated song with `?at=3` shows "3 of 3", with no `at` shows its first place;
    - song record not found (`useSong` → `null`) still shows the bar;
    - setlist not loaded → no bar; song not in setlist → no bar;
    - `/songs/:songId` → no Previous/Next;
    - existing tests keep passing (add a default setlist mock in `beforeEach` if needed).
  - [ ] `app-bootstrap.test.tsx`: extend the gig → song journey with a second song in the stub
    setlist (full Zod shape for `/songs/s2`). From `Test Tune`, click Next, expect the second
    song's `h1`; click "Back to gig", expect the gig `h1`.
  - [ ] No e2e change needed (route unchanged; query string doesn't affect the auth redirect).
  - [ ] Placeholder names only (`Test Tune`, `Second Test Tune`, `Set 1`). No snapshot tests.

- [ ] **Task 6: Verify, commit, deploy** (AC: 8, 10, 11)
  - [ ] `git diff --stat HEAD -- api shared infra` is empty.
  - [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass.
  - [ ] Commit after code review, one commit: `Implement story 7.14: Play a gig song by song`.
    Push to `main` only with Sandy's go-ahead; watch `deploy.yml` with `gh run watch`. If the
    blackout check blocks, report it; don't use `deploy-force.yml` unless Sandy says so.
  - [ ] Set the story to `review`. No screenshots and no manual checklist for Sandy.

## Dev Notes

### What this story is

Web only. The first step towards using GigBuddy on stage: from a gig, open a song, then move
Previous/Next through the setlist. Everything needed is already on the setlist record; no new
fetches beyond the setlist query (usually already cached from the gig page).

### Design choices made in this spec (to confirm at Sandy's live check)

- **Place in the URL (`?at=`), not navigation state.** It survives refresh and a PWA
  relaunch, and handles a song that appears twice. The song shown (`:songId`) and the planned
  place (`at`) are separate on purpose: a later mid-set jump story can show any song while
  keeping `at`, so Next carries on from the plan and the setlist is never edited (AGENTS.md
  performance-mode safety). This story doesn't implement that; when `at` disagrees with
  `songId`, it falls back to the song's first appearance. The jump story will revisit that
  rule inside `resolvePlace`.
- **Fixed bottom bar.** AGENTS.md: don't use tap-to-advance over content that can scroll; put
  navigation in fixed chrome. Bottom is in thumb reach on a phone on the keyboard stand and
  harmless on a laptop. One layout for all widths.
- **Inert at the ends.** AGENTS.md: a routine advance control never turns into a destructive
  or state-ending action. Labels stay visible so the bar doesn't shift.
- **History replaced on Previous/Next**, so Back always goes to the gig rather than walking
  back through twenty songs.
- **Position "3 of 12"** is shown because it's cheap and useful on stage. Next-song title
  preview is left for the UI review.

### Facts verified when the story was written (2026-10-26)

- `web/src/routes/song.tsx`: one component for `/songs/:songId` and
  `/gigs/:setlistId/songs/:songId` (7.8); `setlistId` in params switches the back link and
  hides Edit. Content: `PageTitle`, key · patch line, chord chart (`whitespace-pre-wrap`). All
  preserved.
- `web/src/routes/gig.tsx` `SetlistSections`: rows link to
  `/gigs/${setlistId}/songs/${songId}`, keyed by `${sectionIndex}-${songIndex}` because songs
  can repeat. Only the `to` changes.
- `useSetlistOrCached(setlistId)` (`web/src/hooks/use-setlist-or-cached.ts`) returns
  `{ setlist, statusLine }`, falling back to the list cache. Use only `setlist` here; the
  song's own status line stays as it is.
- `SetlistSchema` (`shared/src/schemas/setlist.ts`): `sections: { name; songs: SongRef[] }[]`,
  `SongRef = { songId, titleSnapshot, perGigAnnotation? }`. Import types from
  `@gigbuddy/shared`; no parallel types.
- `AuthenticatedShell` is a plain `<main>` column (`max-w-[40rem]`, gutter padding). The bar
  sits outside that flow via `position: fixed` but aligns its inner row to the same column.
- Tokens available: `--color-bg`, `--color-text-primary`, `--color-text-secondary`,
  `--color-accent`, `--color-border-hairline` (transparent in dark), `--spacing-unit`,
  `--spacing-gutter`, `--spacing-section-gap`, `--spacing-tap`, `--text-row`,
  `--text-body`. `min-h-tap` utility exists.
- No `ScrollRestoration`/`scrollTo` anywhere in `web/src` today.
- `index.html` viewport has `viewport-fit=cover`, so `env(safe-area-inset-bottom)` works in
  the installed iPhone PWA.

### Guardrails

- Out of scope: mid-set jump, performance notes, `perGigAnnotation`, next-song preview, swipe,
  keyboard shortcuts, wake lock, full screen, any `api/`, `shared/`, `infra/` or sync change.
- No device detection; one layout from 360px to 1680px; no horizontal scroll; titles wrap.
- Biome only; `kebab-case` files; co-located tests; `.js` import suffix; imports from
  `react-router`; British English; strings in `microcopy.ts`.

### Project Structure Notes

New: `web/src/lib/gig-position.ts` (+ test). Updated: `web/src/routes/song.tsx` (+ test),
`web/src/routes/gig.tsx` (+ test), `web/src/lib/microcopy.ts`, `web/src/app-bootstrap.test.tsx`,
`STYLE.md`, `sprint-status.yaml`. Router unchanged.

### Previous story intelligence

- 7.8: the gig song page and `SetlistSections` are the base; local components in the route
  file are the pattern. The URL decides context, not navigation state.
- 7.13: back-end only; no web patterns changed. Setlists are now keyed by ID, so
  `useSetlistOrCached` always returns the latest copy of a gig.
- 7.7: weekend-evening deploys can hit the blackout check; report, don't force.
- Signed-in journeys live in `app-bootstrap.test.tsx` with a `fetch` stub; records must be full
  schema shapes (Zod-validated).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.14]
- [Source: _bmad-output/implementation-artifacts/7-8-setlist-on-the-gig-page.md]
- [Source: AGENTS.md "Performance-mode safety"]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-10-19.md §3.3]
- [Source: shared/src/schemas/setlist.ts; web/src/routes/song.tsx, gig.tsx;
  web/src/hooks/use-setlist-or-cached.ts; web/src/styles/tokens.css; STYLE.md]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created (2026-10-26).

### File List

### Change Log

- 2026-10-26: Story created; status → ready-for-dev.
