---
baseline_commit: 56ca4d40fed735036d66a9d07a660a3fb9de5d02
---

# Story 7.3: Song list at /songs

Status: in-progress

<!-- Source: epics.md "Epic 7 / Story 7.3"; agreed with Sandy 2026-10-19 -->

## Story

As Sandy,
I want to open a list of every song in the repertoire from the home page,
so that I can find a song by hand without going through a gig or setlist.

## Acceptance Criteria

1. Signed in, `/` is unchanged except for one clear "Songs" link to `/songs`. No songs are
   listed on `/`.
2. `/songs` lists every song for the band, sorted A–Z by title (case-insensitive). Each row
   shows the song title only. Rows are large tap targets in generous type.
3. While loading, a plain loading line; on error, a plain one-sentence message; with no songs,
   a plain empty-state line.
4. `/songs` has a way back to `/`.
5. Tapping a row goes to `/songs/:songId`, which for now shows the song title and a
   "Back to songs" link (content arrives in Story 7.4). An unknown `songId` shows a plain
   "Song not found" line with the same link.
6. `/songs` and `/songs/:songId` are valid routes (amends 7.1 AC3); any other path still
   redirects to `/`. Signed out, they show the existing login.
7. No search, filter, editing, gig or setlist features. No change to `api/`, `shared/` or
   `infra/`; uses the existing `use-songs` / `use-song` hooks.
8. Same responsive and theming rules as 7.1 (360px–1680px with no horizontal scroll, light/dark
   via `prefers-color-scheme`, WCAG AA contrast).
9. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass. Unit tests cover
   home → Songs → a song; `e2e/smoke` (signed-out only, no auth fixture) checks `/songs` and
   `/songs/:songId` end on the login, and passes.
10. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] **Task 1: Microcopy** (AC: 1, 3, 4, 5)
  - [x] Append to `web/src/lib/microcopy.ts` (append, don't edit the existing groups):
    ```ts
    /* Story 7.3 — song list and song page copy. */
    export const SONGS = {
      heading: 'Songs',
      loading: 'Loading…',
      error: "Couldn't load your songs.",
      empty: 'No songs yet.',
      notFound: 'Song not found.',
      backToHome: 'Home',
      backToSongs: 'Back to songs',
    } as const;
    ```
  - [x] The home link text is `SONGS.heading` ("Songs").

- [x] **Task 2: "Songs" link on the home page** (AC: 1)
  - [x] In `web/src/routes/home.tsx`, add a `<Link to="/songs">` (from `react-router`) below the
    counts line. Nothing else on the page changes: heading, band name and counts line stay
    exactly as they are.
  - [x] Style: `--text-perf-meta` (22px), `--color-text-primary`, underlined, with a tap area
    of at least `--spacing-tap` (44px) high (`inline-flex items-center min-h-tap`). Leave a
    `--spacing-section-gap` above it. **Don't use `--color-accent` for link text.** The light
    accent only passes AA-large, and 22px regular weight isn't "large" under WCAG.
  - [x] `home.tsx` doesn't render a router today and `home.test.tsx` renders `<Home />` bare.
    Wrap renders in `<MemoryRouter>` in that test file, and add one test that the link exists
    with `href="/songs"`.

- [x] **Task 3: `/songs` list route** (AC: 2, 3, 4, 7)
  - [x] New `web/src/routes/songs.tsx` exporting `Songs`.
  - [x] Top: a `<Link to="/">` back to home (`SONGS.backToHome`), then `<h1>` "Songs".
  - [x] Body, using `useSongs()`, checked in this order (same rule as `home.tsx`: cached data
    wins over a background error):
    1. `data` present and non-empty → a `<ul>` of rows.
    2. `data` present and empty → `SONGS.empty`.
    3. `isPending` with no data → `SONGS.loading`.
    4. otherwise → `SONGS.error`.
    - Give the status line `aria-live="polite"`. Plain text: no spinner, toast or retry button.
  - [x] Each row: `<li><Link to={`/songs/${song.songId}`}>{song.title}</Link></li>`. **Title
    only**: no key, patch or notes (Sandy, 2026-10-19). Make the whole row the link, `block`,
    at least `--spacing-tap` high, with vertical padding of roughly `calc(var(--spacing-unit)*3)`.
    Use `--text-perf-meta` (22px) in `--color-text-primary`. Separate rows with a 1px
    `--color-border-hairline` bottom border. That token is `transparent` in dark mode by
    design, so rows rely on their padding there; that's fine. Long titles wrap; no truncation.
  - [x] Order: render `data` in the order received. The API already sorts A–Z
    case-insensitively (`api/src/routes/songs.ts:7`, `localeCompare(..., 'en',
    { sensitivity: 'base' })`) and `useSongs` returns it as-is. **Don't re-sort on the client.**
    The test asserts that rows appear in data order.
  - [x] Visible keyboard focus on rows and links (`focus-visible:outline` in `--color-accent`).
  - [x] Co-located `songs.test.tsx`: mock `../hooks/use-songs.js` the same way `home.test.tsx`
    does, render in `<MemoryRouter>`, and cover: rows in data order with the right `href`s; no
    key text rendered even when the song has a `key`; loading; error; empty; cached data
    shown despite `isError`; the home link points at `/`.

- [x] **Task 4: `/songs/:songId` stub route** (AC: 5)
  - [x] New `web/src/routes/song.tsx` exporting `Song` (it clashes with the shared `Song`
    type, so import that one as `type Song as SongRecord` if you need it, or name the
    component `SongPage`; pick one and stay consistent).
  - [x] Read `songId` with `useParams()`. Show a `<Link to="/songs">` (`SONGS.backToSongs`)
    at the top, then the body.
  - [x] Data: `useSong(songId)`, **falling back to the matching song in the `useSongs()` list
    cache** (`songs.data?.find(s => s.songId === songId)`). This makes the page appear
    instantly after a tap and work offline. Both queries are already persisted. Don't change
    either hook.
  - [x] Body order:
    1. a song from either source → `<h1>` with its title, `--text-perf-title` (36px),
       `--font-serif-editorial`.
    2. `useSong` returned `null` (server 404) and the list has no match → `SONGS.notFound`.
    3. still pending with nothing to show → `SONGS.loading`.
    4. otherwise → `SONGS.error`.
  - [x] Nothing else: no key, chart or notes. That's Story 7.4.
  - [x] Co-located `song.test.tsx`: mock both hooks and render inside a `MemoryRouter` at
    `/songs/abc` with a `<Route path="/songs/:songId">`. Cover: the title from `useSong`; the
    title from the list fallback while `useSong` is pending; not found; loading; the back link
    points at `/songs`.

- [x] **Task 5: Routing** (AC: 6)
  - [x] `web/src/router.tsx`: add two children under the authenticated `/` route next to the
    index: `{ path: 'songs', element: <Songs /> }` and `{ path: 'songs/:songId', element: <Song /> }`.
    Keep the `*` catch-all to `/` and `RequireAuth` exactly as they are.
  - [x] `app-bootstrap.test.tsx`: add one signed-in journey test. Land on `/`, click "Songs",
    see a song title from the stubbed `GET /api/v1/songs`, click it, and see the song page.
    Stub `GET /api/v1/songs/:id` as well. Follow the file's existing `fetch` stub pattern.
    Also confirm that signed out, `/songs` ends on the login.

- [x] **Task 6: e2e smoke** (AC: 9)
  - [x] `e2e/smoke/shell.spec.ts`: add one signed-out test. `/songs` and
    `/songs/anything` each end on `/login` showing the Password field. Keep the existing three
    tests. There is still no auth fixture; **don't build one**.
  - [x] Run `pnpm test:e2e` per the 7.1 note (real env values: `TABLE_NAME=gigbuddy-data`,
    `JWT_KEY_PARAM=/gigbuddy/jwt-key`, `PASSWORD_HASH_PARAM=/gigbuddy/password-hash`). Ask
    Sandy before running. If AWS credentials aren't available, record that honestly and leave
    this subtask unticked.

- [ ] **Task 7: Verify, commit, deploy** (AC: 7, 8, 9, 10)
  - [ ] `git diff --stat HEAD -- api shared infra` is empty.
  - [ ] From the repo root, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass. All
    text uses `--color-text-primary`/`-secondary`, which already have AA pairs, so no change
    to `contrast-report.ts` is expected.
  - [ ] One commit: `Implement story 7.3: Song list at /songs`. Push to `main` with Sandy's
    go-ahead; `deploy.yml` runs on push. Watch it with `gh run watch`. If the blackout check
    blocks the deploy, report it to Sandy; don't use `deploy-force.yml`.
  - [ ] Then set the story to `review` and hand over for Sandy's quick look on phone and laptop.
    No screenshots and no manual checklist for Sandy.

## Dev Notes

### What this story is

A thin front-end slice: one link on the landing page, one list page and one stub song page.
Everything it needs already exists: the songs API, `listSongs`/`getSong`, the `useSongs`/
`useSong` hooks, the persisted query cache and the token set. **No dependency is added.
`api/`, `shared/` and `infra/` don't change.**

### Current state of files being edited

- **`router.tsx`**: `/login`; authenticated `/` with `RequireAuth` → `AuthenticatedShell`
  and one index child `<Home />`; a `*` catch-all to `/`. `RequireAuth` lets `'unknown'`
  (offline) through (AR-16). This story adds two children only.
- **`routes/home.tsx`**: heading, `ACTIVE_BAND_NAME` and a counts line from `useSongs()` +
  `useSetlists()` with loading/error states. It must keep working and keep its tests green.
  The only addition is the link.
- **`routes/authenticated-shell.tsx`**: a centred `max-w-[40rem]` column with gutters, wrapping
  `<Outlet />`. New pages render inside it; **don't add nav chrome to the shell**.
- **`lib/microcopy.ts`**: "append, don't mutate". It has `BANNERS` and `HOME`.
- **`hooks/use-songs.ts`** (`['songs', bandId]`) and **`hooks/use-song.ts`**
  (`['song', bandId, songId]`; `null` → disabled; the server's 404 → `data: null`). **Don't
  change these hooks or their query keys.** The persister restores by key, and the flusher
  writes to the per-song key.

### Look

- Same visual language as the 7.1 landing page: Tailwind v4 arbitrary values over CSS vars,
  e.g. `text-[length:var(--text-perf-meta)] leading-[var(--text-perf-meta--line-height)]
  text-[color:var(--color-text-primary)]`.
- Generous type (Sandy is 55): list rows 22px, page headings at `--text-home-tonight` (28px) for
  "Songs" and `--text-perf-title` (36px) for the song title. Fit less rather than shrink.
- Back links sit at the top of the page in normal flow. They don't need to be fixed: these
  pages aren't performance-mode surfaces, and the list scrolls as a normal document.
- No breakpoints, no device detection, nothing wider than 360px. Light/dark comes from the
  tokens automatically.
- Lists use `list-none p-0 m-0` so no bullets or indent eat width at 360px.
- British English in copy.

### Architecture guardrails

- React Router 7: import `Link`, `useParams`, `MemoryRouter`, `Routes` and `Route` from
  `react-router`, not `react-router-dom`.
- Use the `Song` type from `@gigbuddy/shared`; don't define a local song type.
- TanStack Query is the server-state store; no other state library.
- Biome only. `kebab-case` files, tests co-located, no snapshot tests. Imports use the `.js`
  suffix, as in the existing files.
- `web` ↔ `api` over `/api/v1/*` only.

### Testing

- Vitest + Testing Library + jsdom. Route-component tests mock hooks with `vi.hoisted` +
  `vi.mock` (see `home.test.tsx`). Integration through `app-bootstrap.test.tsx` uses a fresh
  `QueryClient({ defaultOptions: { queries: { retry: false } } })`, `vi.stubGlobal('fetch', …)`
  and `fake-indexeddb/auto`.
- Known trap from 7.1: `<h1>GigBuddy</h1>` exists in both the boot shell and the landing page.
  Wait for something only the target page renders (the band name, the "Songs" link or a
  song title).
- Use made-up test titles that aren't real JR5 songs, e.g. "Alpha Test Tune" and
  "beta test tune" (lower-case to show the order comes from data).
- The web `pnpm test` runs `report:contrast` first.

### Out of scope (don't do)

- Showing the key, patch, chord chart or notes anywhere: Story 7.4 owns the song page content.
- Search, filtering, alphabet jump, editing, creating songs, gigs or setlists.
- Login returning you to the page you asked for (it still goes to `/` after login, as in 7.1).
- Nav chrome in the shell, a top bar or tabs.
- Any `api/`, `shared/`, `infra/` or manifest change.

### Previous-story intelligence (7.1)

- 7.1 left `useSongs`/`useSong` deliberately as plumbing for this slice; `use-songs.test.tsx`
  and `use-song.test.tsx` must stay green without edits.
- The 7.1 review deferred items still stand: an indefinite `Loading…` on a first offline
  launch with no cache, and `/login` not using `replace`. Don't fix them here.
- The smoke test has no auth fixture, by design. The signed-in journey is covered by the
  `app-bootstrap.test.tsx` integration test plus Sandy's look at the live app.
- Prod has 52 songs, so after deploy `/songs` should show 52 rows.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.3]
- [Source: _bmad-output/implementation-artifacts/7-1-front-end-reset-to-responsive-landing-page.md]
- [Source: _bmad-output/planning-artifacts/architecture.md#Course correction (2026-10-19), #Theme (amended 2026-10-19), API naming (lines 506–507)]
- [Source: api/src/routes/songs.ts:7 — server-side case-insensitive A–Z sort]
- [Source: web/src/hooks/use-song.ts — 404 → `null`; `null` songId → disabled]
- [Source: e2e/playwright.config.ts — no session-cookie fixture]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created (2026-10-19).

- Tasks 1–5 done; the signed-out e2e test is written (Task 6) and `pnpm test:e2e` passes (4/4). Task 7 (verify/commit/deploy) pending.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (shared 30, infra 55, api 121, web 164) and `pnpm build` pass. `git diff --stat HEAD -- api shared infra` is empty.
- The signed-in journey test stubs full song records, because `listSongs` validates with the shared Zod schema.

### File List

- web/src/lib/microcopy.ts
- web/src/routes/home.tsx, home.test.tsx
- web/src/routes/songs.tsx, songs.test.tsx
- web/src/routes/song.tsx, song.test.tsx
- web/src/router.tsx
- web/src/app-bootstrap.test.tsx
- e2e/smoke/shell.spec.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml, 7-3-song-list-at-songs.md

### Change Log

- 2026-10-19: Implemented tasks 1–5 and the e2e spec for story 7.3.
