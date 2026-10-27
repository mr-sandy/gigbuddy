---
baseline_commit: ec72df9
---

# Story 7.20: Header and tab bar

Status: done

<!-- Source: epics.md "Epic 7 / Story 7.20" and the 2026-10-27 UI review decisions under Epic 7.
     Reference look: _bmad-output/planning-artifacts/mockups/ui-review-2026-10-27.html
     (`.hdr`, `.tabs`, `.tab`, `.group`, `.btn-secondary`, `.btn-sm` CSS; `hdr()`, `listHdr()`,
     `tabs()` helpers; `P.songs`, `P.gigs`, `P.gig`, `P.song` pages; "Laptop" section).
     The mock-up shows the look; the acceptance criteria are the spec. The mock-up's band
     button (chevron, opens a sheet) is Story 7.22, not this one. -->

## Story

As Sandy,
I want a consistent header and a Songs | Gigs tab bar,
so that I can always see where I am and move between the two lists in one tap.

## Acceptance Criteria

1. `/songs` and `/gigs` show a header with the band name ("The Jack Ruby 5", from
   `ACTIVE_BAND_NAME`) on the left in Lora, and Add song or Add gig on the right. The band
   name isn't tappable yet (7.22).
2. Those two pages show a tab bar fixed to the bottom: Songs | Gigs, at least 60px tall. The
   current tab has primary text, semibold, with a 3px brass line along its top. Content is
   padded so nothing hides under the bar. No other page shows the tab bar.
3. Song, gig, form and gig song pages show a header with the back link on the left and, where
   it exists today, Edit on the right.
4. On the gig page, Edit setlist moves next to the first set's heading, as a small secondary
   button.
5. The Home page is removed. `/` redirects to `/songs` (Sandy chose 2026-10-27), and so does
   the catch-all route. The band name and counts from Home don't move elsewhere.
6. No change to `api/`, `shared/` or `infra/`. `STYLE.md` gains "Header" and "Tab bar" entries.
7. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass. Tests cover the tab bar
   on both list pages (and its absence elsewhere), the active tab, the `/` redirect and Edit
   setlist's new place.
8. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] Task 1: Tokens and merge config (AC: 1, 2, 4)
  - [x] In `web/src/styles/tokens.css` `@theme`, type scale: add
        `--text-nav: 20px; --text-nav--line-height: 1.2;` (band name and tab labels) and
        `--text-small: 16px; --text-small--line-height: 1.5;` (small buttons only).
  - [x] Spacing: add `--spacing-tab-bar: 60px;` next to `--spacing-play-bar`, and
        `--spacing-header: 56px;` (header minimum height).
  - [x] In `web/src/lib/utils.ts`, add `'tab-bar'` and `'header'` to the tailwind-merge
        spacing list (7.19 lesson: without this `cn` keeps both `min-h-tap` and the custom
        `min-h-*`). Add a case to `utils.test.ts`.
- [x] Task 2: Button gains `secondary` variant and `sm` size (AC: 4)
  - [x] In `web/src/components/ui/button.tsx`: variant
        `secondary: 'bg-muted text-foreground hover:bg-muted/70'` (shadcn's secondary, on our
        tokens); size `sm: 'min-h-tap px-3 text-[length:var(--text-small)] leading-[var(--text-small--line-height)] [&_svg:not([class*=\'size-\'])]:size-4'`.
        Still at least 44px high — "small" means smaller text and padding, never a smaller tap.
  - [x] Add a case to `button.test.tsx` (secondary + sm render with `data-variant` /
        `data-size` and the 44px class).
- [x] Task 3: `PageHeader` component (AC: 1, 3)
  - [x] New `web/src/components/page-header.tsx`: `PageHeader({ left, right }: { left?: ReactNode; right?: ReactNode })`
        renders `<header>` as a flex row, `items-center justify-between`, gap 16px,
        `min-h-header`, `border-b border-border`, bottom margin 16px (`mb-[calc(var(--spacing-unit)*4)]`).
        It bleeds across the gutters: `-mx-[var(--spacing-gutter)] px-[calc(var(--spacing-gutter)-10px)]`
        so ghost-button text (10px side padding) lines up with the 16px gutter and the hairline
        runs edge to edge on a phone. Empty slots render an empty `<div>` so `right` stays right.
  - [x] Export a `BandName` (or render inside `PageHeader` via a prop — dev's choice, keep it
        in `components/`, not in a route) that shows `ACTIVE_BAND_NAME` as plain text:
        `<p>` (not a heading, not a button), Lora (`[font-family:var(--font-serif-editorial)]`),
        `--text-nav`, `text-foreground`, `px-2.5` to match ghost-button padding.
  - [x] Co-located `page-header.test.tsx`: renders left and right content, and the band name
        as plain text (not a link or button). A `<header>` inside `<main>` isn't a `banner`
        landmark, so test by content, not by that role.
- [x] Task 4: `TabBar` and the list layout route (AC: 2)
  - [x] New `web/src/components/tab-bar.tsx`: `<nav aria-label="Lists">`, `fixed inset-x-0 bottom-0`,
        `bg-background border-t border-border`. Inner row: two `NavLink`s (from `react-router`)
        to `/songs` and `/gigs`, labels `SONGS.heading` / `GIGS.heading`. Each tab:
        `flex flex-1 max-w-[12rem] min-h-tab-bar items-center justify-center`,
        `pb-[env(safe-area-inset-bottom)]` with `box-content` (as the play bar, so the 60px is
        above the home indicator), `--text-nav`, `text-muted-foreground`,
        `border-t-[3px] border-transparent -mt-px` (the 3px line sits over the bar's 1px top
        border), focus ring as rows. Row: `flex justify-center` so the tabs are equal halves on
        a phone and two centred 12rem tabs on a wide window (mock-up `.lap .tabs`), no breakpoint.
  - [x] Active tab via NavLink's `className` callback: `text-foreground font-semibold border-primary`.
        NavLink sets `aria-current="page"` itself. Use `end` so `/songs/new` would not match —
        moot as the bar only renders on the two list routes, but keeps it honest.
  - [x] Tabs are nav links, not `Button`s (like rows). Record this in STYLE.md.
  - [x] New `web/src/routes/list-layout.tsx`: `ListLayout` renders
        `<div className="pb-[calc(var(--spacing-tab-bar)+1px+var(--spacing-unit)*4+env(safe-area-inset-bottom))]"><Outlet /></div><TabBar />`
        (bar + border + 16px breathing room, same pattern as `song.tsx`'s play-bar padding).
  - [x] In `web/src/router.tsx`, nest `songs` and `gigs` under a pathless route
        `{ element: <ListLayout />, children: [{ path: 'songs', … }, { path: 'gigs', … }] }`.
        Every other route stays outside it, which is what keeps the bar off them.
- [x] Task 5: Remove Home; redirects (AC: 5)
  - [x] `router.tsx`: index route becomes `{ index: true, element: <Navigate to="/songs" replace /> }`;
        the top-level catch-all `*` becomes `<Navigate to="/songs" replace />`. Signed out,
        `/songs` is behind `RequireAuth`, so unknown paths still end on `/login` (existing
        bootstrap test and e2e smoke keep passing).
  - [x] Delete `web/src/routes/home.tsx`, `home.test.tsx`, `web/src/lib/counts.ts`,
        `counts.test.ts` (only Home used `formatCounts`). Remove `HOME` from `microcopy.ts`, and
        `SONGS.backToHome` / `GIGS.backToHome`.
  - [x] Leave `login.tsx`'s `navigate('/')` alone: `/` now redirects to `/songs`, and
        `login.test.tsx` mounts its own `/` route.
  - [x] `e2e/smoke/shell.spec.ts`: only the header comment mentions `home.test.tsx`; point it
        at the list-page and bootstrap unit tests instead. No test changes there.
- [x] Task 6: List pages (AC: 1, 2)
  - [x] `songs.tsx` and `gigs.tsx`: replace the top row (Home back link + Add) with
        `<PageHeader left={<BandName />} right={Add song | Add gig Button as today} />`.
        Keep `PageTitle` ("Songs" / "Gigs") as the page's `<h1>` below the header, as in the
        mock-up. Lists, status lines, Past group and the export footer are unchanged.
- [x] Task 7: Detail and form pages (AC: 3)
  - [x] `song.tsx`: top row → `PageHeader` (back link left; Edit right only on `/songs/:songId`
        with a song, as today). "Screen may sleep" stays directly under the header. Play bar and
        its padding unchanged.
  - [x] `gig.tsx`: top row → `PageHeader` (Back to gigs left; Edit right when the gig is
        shown). Edit setlist leaves the header (Task 8).
  - [x] `song-edit.tsx`, `gig-edit.tsx`, `setlist-edit.tsx`: every state shows a `PageHeader`.
        Not-found/loading states: the existing back link moves into it. Form state: a back link
        (ghost, muted, chevron-left) that goes exactly where Cancel goes — same `exitTo`, same
        `canStepBack` → `navigate(-1)` logic, `replace` on the `Link`. Pull the Cancel link's
        onClick into a small local helper in each file so the two links can't drift. Labels by
        destination: add song "Back to songs" (`SONGS.backToSongs`); edit song "Back to song"
        (new `SONGS.backToSong`); add gig "Back to gigs" (`GIGS.backToGigs`); edit gig and edit
        setlist "Back to gig" (`GIG_SETLIST.backToGig`). No Edit on form pages. Cancel at the
        foot stays (7.21 replaces both with the sheet header).
  - [x] `PageTitle`: drop the `afterBackLink` prop (the header's bottom margin now does that
        job) and update `page-title.test.tsx`.
  - [x] `authenticated-shell.tsx`: drop `pt-[var(--spacing-section-gap)]` so the header sits at
        the top; keep the 40rem column and gutter. Update its comment (the shell still has no
        chrome of its own; routes render their header, the list layout renders the tab bar).
- [x] Task 8: Edit setlist beside the first set (AC: 4)
  - [x] In `gig.tsx` `SetlistSections`, the first section that has songs gets a heading row:
        `<div className="flex items-center justify-between gap-…">` holding the `h2` (if named)
        and `<Button asChild variant="secondary" size="sm"><Link to={…/setlist}><Pencil aria-hidden />{SETLIST_TEXT.editLink}</Link></Button>`.
        Keep the button outside the `h2` so the heading's accessible name is just the set name.
        Row keeps the section gap above it; the list follows 8px below as now.
  - [x] First shown section unnamed: the row has an empty left and the button on the right,
        in the place the heading would be.
  - [x] Empty setlist (no section with songs): the row holds the "No songs in this setlist
        yet." line on the left and the button on the right — Edit setlist must stay reachable,
        it's the only way to add songs.
  - [x] Pass `setlistId` (already on `setlist`) — no new props from `Gig`.
- [x] Task 9: Tests (AC: 7)
  - [x] `songs.test.tsx` / `gigs.test.tsx`: band name text shown; Add link href unchanged;
        no "Home" link. Replace the "links back home" tests.
  - [x] `tab-bar.test.tsx`: in a `MemoryRouter` at `/songs`, both tabs link to `/songs` and
        `/gigs`; Songs has `aria-current="page"` and Gigs hasn't; flip at `/gigs`.
  - [x] Router-level (in `app-bootstrap.test.tsx`, which drives the real `router`): signed in,
        `/` lands on `/songs` (`router.state.location.pathname`) and shows the Songs tab bar;
        `/library` signed in also lands on `/songs`; the tab bar (`navigation` named "Lists")
        is present on `/songs` and `/gigs` and absent on a song page, a gig page, a gig song
        page and `/songs/new`. Rework "home → Songs → a song page" and "home → Gigs → a gig"
        to start at `/` (landing on Songs) and use the tabs. The two "landing page" tests that
        wait for "The Jack Ruby 5" still work (band name is in the list header) — fix comments.
  - [x] `gig.test.tsx`: Edit setlist link (href `/gigs/g1/setlist`) sits in the same row as
        the first set's heading (e.g. `within(heading.parentElement)`), not in the header;
        unnamed first section and empty setlist still show it; Edit (gig) stays in the header.
        Update the existing "links to the edit form only when the gig is shown" test.
  - [x] Form tests: the back link exists with the right label and href for add and edit
        (song, gig, setlist). Existing Cancel tests keep passing.
  - [x] Existing tests are updated, not deleted (except `home.test.tsx` and `counts.test.ts`,
        whose code goes).
- [x] Task 10: STYLE.md (AC: 6)
  - [x] Type roles: add `--text-nav` (20px Lora for the band name / system for tab labels)
        and `--text-small` (16px, small buttons only).
  - [x] New "Header" entry: every signed-in page starts with it; 56px min, hairline under,
        runs to the screen edge on a phone; list pages: band name left (Lora 20px, plain text
        until 7.22), Add right; other pages: back link left, Edit right where it exists; page
        title 16px below. Replace the "Back link at the top of a page, then the page title 4px
        below it" line.
  - [x] New "Tab bar" entry: `/songs` and `/gigs` only; fixed bottom, 1px `--border` top line;
        two tabs at least 60px, equal halves on a phone, 12rem each centred on wide windows;
        20px quiet text; current tab foreground, semibold, 3px brass top line; links, not
        Buttons; content padded clear of it; down to the home indicator like the play bar.
  - [x] Buttons table: "Edit setlist (beside the first set)" → `secondary`, `sm`, Lucide pencil.
        Note `sm` keeps the 44px tap height.
- [x] Task 11: Verify and ship (AC: 6, 7, 8)
  - [x] `git diff --stat ec72df9 -- api shared infra` is empty.
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass. If
        `web/scripts/contrast-report.ts` lists text pairs, add foreground on `--muted` (the
        secondary button) and confirm it passes.
  - [x] Commit `Implement story 7.20: Header and tab bar`, deploy via the normal pipeline,
        then Sandy's quick look on phone and laptop. (After code-review, per the story workflow.)

### Review Findings

- [x] [Review][Patch] Header back link on Add song / Add gig leaves a duplicate history entry: `canStepBack` requires `initial`, so /songs → /songs/new → back does `replace` to /songs and leaves `[/songs, /songs]`. Allow `navigate(-1)` for add forms when `location.key !== 'default'` [web/src/routes/song-edit.tsx:83, web/src/routes/gig-edit.tsx:78]
- [x] [Review][Patch] Post-login `navigate('/')` now takes an extra hop through the `/` → `/songs` redirect; use `navigate('/songs', { replace: true })` (also clears the 7.1 deferral) [web/src/routes/login.tsx:30]
- [x] [Review][Patch] `EditSetlistButton` and `HEADING_ROW` were inserted between the "Gig page" block comment and `SetlistSections`, so the comment no longer sits above the function it describes [web/src/routes/gig.tsx:12]
- [x] [Review][Patch] Tests: assert the "Lists" nav explicitly on `/gigs`, add `/gigs/new`, `/gigs/g1/edit`, `/gigs/g1/setlist` and `/songs/a1/edit` to the no-tab-bar table [web/src/app-bootstrap.test.tsx] (the "an `<h1>`" comment turned out to be accurate and was kept)
- [x] [Review][Defer] Tab bar `<nav>` renders inside the shell's `<main>` landmark [web/src/routes/list-layout.tsx:12] — deferred, valid HTML; revisit if the shell is restructured
- [x] [Review][Defer] Keyboard-focused rows can scroll behind the fixed tab bar (no `scroll-padding-bottom`) [web/src/components/tab-bar.tsx:17] — deferred, pre-existing with the play bar

## Dev Notes

### Current state (read before editing)

- `web/src/router.tsx`: `/login` outside; everything else under `RequireAuth` →
  `AuthenticatedShell`; index route is `<Home />`; catch-all `*` → `<Navigate to="/" replace />`.
- `AuthenticatedShell`: a `<main>` with `mx-auto max-w-[40rem] px-gutter pt-section-gap`
  around the `Outlet`. Its test asserts there's no `navigation` role in the shell itself —
  still true after this story (the tab bar lives in `ListLayout`).
- Every route hand-rolls its top row:
  `<div className="flex items-center justify-between gap-[calc(var(--spacing-unit)*4)]">` with a
  ghost muted back `Button asChild` + `Link` + `ChevronLeft`, and an optional ghost brass Edit /
  Add. `PageTitle afterBackLink` adds 4px top margin after it.
  - `songs.tsx` / `gigs.tsx`: back link "Home" → `/`; Add song / Add gig.
  - `song.tsx`: "Back to gig" or "Back to songs"; Edit only on `/songs/:songId`. Play bar and
    its bottom padding (Story 7.19) are on this page — don't touch them.
  - `gig.tsx`: "Back to gigs"; right side holds both Edit setlist and Edit (gig).
  - `song-edit.tsx`, `gig-edit.tsx`, `setlist-edit.tsx`: back link only in the not-found /
    loading state; the form state starts with `PageTitle` and has Cancel at the foot with the
    `exitTo` / `canStepBack` / `navigate(-1)` logic.
- `home.tsx`: `<h1>GigBuddy</h1>`, band name, counts line, links to Songs/Gigs. Only consumer of
  `formatCounts` and `HOME`.
- `app-bootstrap.tsx` pre-`/me` boot shell renders `<h1>GigBuddy</h1>` — unchanged. The e2e
  smoke and bootstrap tests rely on it.
- `Button` (`components/ui/button.tsx`): variants default, destructive, destructive-outline,
  outline, ghost, link; one size (`min-h-tap px-4`). Ghost gets `px-2.5` via compoundVariants.
- `cn` uses `extendTailwindMerge` with spacing `['unit', 'gutter', 'tap', 'play-bar']`.

### Design decisions for this spec

- **Redirect target `/songs`** — Sandy's choice when this spec was written.
- **"Primary text" on the active tab means foreground text**, not brass. STYLE.md and the ACs
  use "primary/secondary text" for foreground/muted (e.g. 7.17 "secondary text"), and the
  mock-up's `.tab[aria-current="page"]` is `color: var(--foreground)`. The brass is the 3px line.
- **"Small secondary button"** = shadcn's `secondary` variant (muted fill) at a new `sm` size:
  16px text, 12px padding, still 44px tall. Taken from the mock-up's `btn-secondary btn-sm`.
- **Page titles stay.** The header doesn't replace the `<h1>`: list pages keep "Songs" /
  "Gigs" under the header, as in the mock-up. The band name is a `<p>`, so each page keeps
  exactly one `h1`.
- **Back link labels unchanged** ("Back to songs" etc.). The mock-up's shorter labels aren't in
  the ACs.
- **Form pages' back link mirrors Cancel.** AC 3 lists form pages; today their form state has
  no back link. It goes where Cancel goes so there's no second exit with different behaviour.
  Short-lived: 7.21 turns these pages into sheets with Cancel in the sheet header.
- **Header is in the page flow, not sticky.** The ACs don't ask for sticky, and a fixed top bar
  would eat chart space on the song page.
- **Tab bar via a pathless layout route** so "no other page shows it" is structural, not a
  per-route flag, and the bar doesn't remount between the two tabs.
- **Tab labels reuse `SONGS.heading` / `GIGS.heading`** — no new strings needed.

### Out of scope (don't build)

- Band name as a button / settings sheet (7.22). Export link stays at the foot of `/songs`.
- Sheets, AlertDialog, Cancel/Save in a header (7.21).
- Badges or counts anywhere. Hiding the tab bar on scroll. Icons on tabs.
- Any change to `api/`, `shared/`, `infra/`, the play bar, or the service worker.

### Library notes

- React Router 7, import from `react-router`. `NavLink` gives `aria-current="page"` and a
  `className={({ isActive }) => …}` callback; pass `end` for exact matching.
- `Navigate` with `replace` for redirects (already used in `router.tsx`).
- Tailwind v4: `border-t-[3px]`, `-mt-px`, `box-content` all fine. Use `cn` for the NavLink
  class callback so the custom `min-h-tab-bar` merges correctly.
- No new packages.

### Testing standards

- Vitest + Testing Library, co-located tests, no snapshots. Router-level checks go through the
  real `router` in `app-bootstrap.test.tsx` (it resets location in `beforeEach`).
- Query by role and name: `getByRole('navigation', { name: 'Lists' })`,
  `getByRole('link', { name: 'Songs' })` and check `aria-current`.
- Note `getByRole('link', { name: 'Songs' })` is now unique on `/songs` only if nothing else is
  named "Songs" — the `h1` is a heading, not a link, so it's fine.

### Previous story intelligence (7.18, 7.19)

- 7.19's follow-up fix: `cn` silently kept both `min-h-tap` and `min-h-play-bar` until the
  token was added to tailwind-merge. Add `tab-bar` and `header` up front (Task 1).
- 7.19 moved the home-indicator padding into each column with `box-content` so the regions run
  to the screen edge; do the same for tabs.
- 7.18 removes dead microcopy keys rather than leaving them; same here for `HOME`,
  `backToHome`.
- Routes don't set one-off sizes; sizes live in tokens and components.

### References

- `_bmad-output/planning-artifacts/epics.md` — Story 7.20 (and 7.21, 7.22 for what not to build)
- `_bmad-output/planning-artifacts/mockups/ui-review-2026-10-27.html` — header, tabs, gig page
- `STYLE.md` — tokens, Buttons table, bottom bar entry
- `web/src/routes/song.tsx` — play-bar padding pattern to copy for the tab bar
- `AGENTS.md` — boundaries, one commit per story, British English

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented all tasks. `pnpm lint`, `pnpm typecheck`, `pnpm test` (319 tests, contrast report passes, incl. foreground on `--muted`) and `pnpm build` pass; `git diff --stat ec72df9 -- api shared infra` is empty.
- `BandName` lives in `components/page-header.tsx` beside `PageHeader`. Form pages' back link and Cancel share a local `leave` click handler per file.
- Gig page: Edit setlist sits in a heading row with the first non-empty set (or beside the "No songs" line when the setlist is empty); gig Edit stays in the header.
- Bootstrap tests gained router-level checks: `/` and unknown paths land on `/songs`, tab switching, and no tab bar on song, gig, gig song and add-song pages.
- Not done by design: commit, deploy and Sandy's live look follow code-review (AGENTS.md story workflow).

### File List

- web/src/styles/tokens.css
- web/src/lib/utils.ts, utils.test.ts
- web/src/lib/microcopy.ts
- web/src/components/ui/button.tsx, button.test.tsx
- web/src/components/page-header.tsx, page-header.test.tsx (new)
- web/src/components/tab-bar.tsx, tab-bar.test.tsx (new)
- web/src/components/page-title.tsx, page-title.test.tsx
- web/src/routes/list-layout.tsx (new)
- web/src/routes/authenticated-shell.tsx
- web/src/routes/songs.tsx, songs.test.tsx
- web/src/routes/gigs.tsx, gigs.test.tsx
- web/src/routes/song.tsx
- web/src/routes/gig.tsx, gig.test.tsx
- web/src/routes/song-edit.tsx, song-edit.test.tsx
- web/src/routes/gig-edit.tsx, gig-edit.test.tsx
- web/src/routes/setlist-edit.tsx, setlist-edit.test.tsx
- web/src/router.tsx
- web/src/routes/login.tsx, login.test.tsx (review patch)
- web/src/app-bootstrap.test.tsx
- e2e/smoke/shell.spec.ts (comment only)
- STYLE.md
- Deleted: web/src/routes/home.tsx, home.test.tsx, web/src/lib/counts.ts, counts.test.ts

### Change Log

- 2026-10-27: Story created (ready-for-dev).
- 2026-10-27: Implemented header, tab bar, Home removal, Edit setlist move (review).
- 2026-10-27: Code review: 4 patches applied (add-form back link steps back, login lands on /songs, gig.tsx comment moved, tab-bar test coverage); 2 deferred.
- 2026-10-27: Committed b3b6b91; CI and deploy run 40556987464 green. Sandy's live check: all looks good. Status → done.
