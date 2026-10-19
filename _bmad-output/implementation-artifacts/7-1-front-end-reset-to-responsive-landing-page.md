---
baseline_commit: 26ffc4df5b4a355fffc00beeb22577ced4d79085
---

# Story 7.1: Front-end reset to a responsive landing page

Status: in-progress

<!-- Source: epics.md "Epic 7 / Story 7.1"; sprint-change-proposal-2026-10-19.md §2.4, §3.2, §4.2, §4.5.b -->

## Story

As Sandy,
I want GigBuddy to open on one simple page that works on my phone and my laptop,
so that we have a clean, working base to grow from.

## Acceptance Criteria

1. Before any deletion, the current `main` commit is tagged `pre-reset` and the tag is pushed.
2. Signed in, `/` shows "GigBuddy", the band name "The Jack Ruby 5", and live counts from the
   API in the form `52 songs · 7 gigs` (values from data, not hard-coded). While loading it
   shows a plain loading line; on error a plain one-sentence message.
3. Signed out, any URL shows the existing login; after login the user lands on `/`.
   Any other path redirects to `/`.
4. One layout for all screen sizes: readable with no horizontal scroll from 360px to 1680px
   wide. No device detection anywhere in `web/src` (`lib/platform.ts`, `lib/atmosphere.ts`,
   install gate and install-instructions removed).
5. Light/dark follows `prefers-color-scheme`; one token set with two variants; text contrast
   meets WCAG AA in both.
6. Removed from `web/src` (with their tests): the library, song, setlist, setlist-creation and
   performance routes; `performance/`; `paste-parse/`; jump overlay; bottom tabs; top nav;
   band label; currently-performing strip; MacBook-only banners; components and hooks used
   only by removed code.
7. Kept and still passing their tests: `sync/`, `api/`, `auth/`, `cache/`, data hooks
   (`use-songs`, `use-setlists`, mutations), error boundary, error reporter, service worker
   and manifest. No change to `api/`, `shared/` or `infra/`.
8. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass; `e2e/smoke` is updated
   to the landing page and passes.
9. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] **Task 1: Tag `pre-reset`, before anything else** (AC: 1)
  - [x] Confirm the working tree is clean and `HEAD` is the latest `main` (expected `26ffc4d Apply sprint change proposal 2026-10-19` or later, if nothing else has landed).
  - [x] `git tag -a pre-reset -m "Front end before Story 7.1 reset (one responsive app)"` then `git push origin pre-reset`. The remote is `git@github.com:mr-sandy/gigbuddy.git`, using Sandy's personal SSH identity.
  - [x] If the tag already exists, check it points at a pre-7.1 commit and **do not move it**.

- [x] **Task 2: Delete the removed front end** (AC: 4, 6). See the "Delete list" in Dev Notes for the exact files.
  - [x] Delete every file on the Delete list, including its co-located `*.test.ts(x)`.
  - [x] Delete the empty directories `web/src/performance/` and `web/src/paste-parse/`.
  - [x] `grep -rn "isIPhone\|isStandalone\|atmosphere\|data-atmosphere\|performanceActive\|usePerformanceActive\|session-resume\|platform" web/src` should return nothing, except the `performanceActive: false` literal in `error-reporter.ts` (see Task 4) and its test. (Confirmed: remaining hits are all inside files Tasks 3–6 still rewrite, plus one unrelated literal in `api/client.test.ts`'s generic schema-body fixture.)

- [x] **Task 3: Rewire boot and routing** (AC: 3, 4)
  - [x] `web/src/main.tsx`: remove `applyBootAtmosphere`, the `./cache/prefetch.js` side-effect import, and the session-resume `readSessionMarker` / `replaceState` block. Keep `startErrorReporter()`, `SyncProvider`, `ErrorBoundary`, `AppBootstrap` and `globals.css`, in the same nesting.
  - [x] `web/src/app-bootstrap.tsx`: remove the install gate (`isIPhone`/`isStandalone`, `InstallInstructions`) and `PerformanceModeProvider`. Keep the boot sequence exactly as it is: `fetchMe()`, then `ready`, then `<AuthProvider initial>` + `<SyncWiring />` + `<RouterProvider>`. Before `ready`, it still renders the bare `<h1>GigBuddy</h1>` shell.
  - [x] `web/src/router.tsx`: routes are `/login` → `<Login />`; `/` → `<RequireAuth><AuthenticatedShell/></RequireAuth>` with an index child `<Home />`; and a catch-all `{ path: '*', element: <Navigate to="/" replace /> }`. `RequireAuth` redirects to `/login` when `auth.status === 'unauthenticated'`. The `'unknown'` (offline) status still falls through and renders the shell (AR-16).
  - [x] Signed out on an unknown path (e.g. `/library`): the catch-all sends it to `/`, then `RequireAuth` sends it to `/login`. This chain satisfies "any URL shows the login". Cover it with a test. (`app-bootstrap.test.tsx` — "sends any unknown path to /login when signed out".)
  - [x] `web/src/auth/redirect-on-401.ts`: drop the `performanceActive` argument. The function becomes `shouldRedirectOn401({ wasNetworkSuccess })`. Update its test. `RequireAuth` calls it with `wasNetworkSuccess: true`, as today.
  - [x] `web/src/routes/login.tsx`: remove the `clearSessionMarker` import and its `useEffect`. Everything else stays as it is: password form, `fetchMe` re-probe, `navigate('/')`. Update `login.test.tsx` to remove any session-marker assertions. (None existed; file needed no other changes and still passes.)
  - [x] `web/src/routes/authenticated-shell.tsx`: reduce it to a plain layout. It has no TopNav, BottomTabs, ReauthBanner, StaleWriteBanner, navigate-away guard or session-marker writer. It renders a single `<main>` with a centred, width-capped column (see Layout in Dev Notes) wrapping `<Outlet />`. Rewrite `authenticated-shell.test.tsx` to match.
  - [x] `web/src/sync/sync-wiring.tsx`: remove the `isIPhone()` gate and call `requestPersistentStorage()` unconditionally. This is still fire-and-forget and still safe: it no-ops when `navigator.storage.persist` is missing. Update the comment in `sync/persist.ts` that says "iPhone only".

- [x] **Task 4: Error reporter without Performance Mode** (AC: 7)
  - [x] `web/src/lib/error-reporter.ts`: remove the `getPerformanceActiveSnapshot` import. `ClientErrorReportSchema` in `shared/` still **requires** `performanceActive: z.boolean()`, and `shared/` must not change (AC 7). So send `performanceActive: false`, with a one-line comment saying Performance Mode was removed in Story 7.1 and the field stays because the shared schema requires it.
  - [x] `web/src/lib/error-reporter.test.ts`: remove any mocking of `performance-context` and assert `performanceActive: false` in the payload. (No such mocking existed; added the explicit assertion.)

- [x] **Task 5: Landing page** (AC: 2, 4)
  - [x] Rewrite `web/src/routes/home.tsx` as the landing page:
    - `<h1>` "GigBuddy"
    - band name from `ACTIVE_BAND_NAME`, imported directly from `@gigbuddy/shared`
    - a counts line built from `useSongs()` and `useSetlists()`
  - [x] Counts format: `${n} song(s) · ${m} gig(s)`, with a middle dot `·` (U+00B7) between them. Pluralise correctly (`1 song`, `0 songs`, `1 gig`). "Gigs" are setlists: `useSetlists().data.length`. Put the formatter in a small pure function, e.g. `formatCounts(songs, gigs)` in `web/src/lib/counts.ts`, with its own test.
  - [x] State logic, checked in this order:
    1. **Both** queries have `data` (from network or the restored IndexedDB cache): show the counts. Cached data wins over a background error, per the architecture rule that the app always renders something useful from cache.
    2. Either query is pending with no data: show the loading line `Loading…`.
    3. Otherwise (an error and no data): show the error line `Couldn't load your songs and gigs.`
    - Keep these two strings in `lib/microcopy.ts`.
    - Both lines are plain text: no spinner, toast or retry button.
  - [x] Give the counts/loading/error line `aria-live="polite"` so the change from loading to counts is announced.
  - [x] Rewrite `web/src/routes/home.test.tsx`. Cover: counts render from mocked data (use values like 52/7 and 1/1 to prove both pluralisation and data-driven values); the loading line; the error line; and cached data shown despite an error.

- [x] **Task 6: One token set, light and dark by system setting** (AC: 5)
  - [x] `web/src/styles/tokens.css`: keep the `@theme` block, which holds the light palette (current Practice values) plus the type, spacing, radii and font tokens. Delete the `[data-atmosphere="practice"]` and `[data-atmosphere="performance"]` blocks. Add a dark variant:
    ```css
    @media (prefers-color-scheme: dark) {
      :root { /* Club Warm values: current performance block */ }
    }
    ```
    - Put the colour variables and `--shadow-card` in it.
    - Drop `--color-attention-fuzzy` and `--color-attention-unknown`. They were only used by paste-to-parse.
    - Update the header comment to describe the new contract.
  - [x] `web/src/styles/globals.css`: update the comment (no atmosphere attribute). Add `color-scheme: light dark;` on `html` so native controls (the login input and button) and scrollbars follow the theme too.
  - [x] `web/index.html`: remove `data-atmosphere="practice"` from `<html>`. Replace the single `theme-color` meta with two:
    - `<meta name="theme-color" content="#faf9f5" media="(prefers-color-scheme: light)">`
    - `<meta name="theme-color" content="#1a1209" media="(prefers-color-scheme: dark)">`
    - Leave the `apple-mobile-web-app-*` metas.
  - [x] `web/scripts/contrast-report.ts`: rewrite the parser for the new structure. Read the `light` variant from the `@theme` block and the `dark` variant from the `:root` block inside `@media (prefers-color-scheme: dark)`. Rename `Atmosphere` to `Variant = 'light' | 'dark'`.
    - Pairs: `text-primary` and `text-secondary` on `bg` and on `surface`, target **AA (≥4.5)**, in both variants.
    - Keep the accent pairs with their existing `AA-large` reasons for light. Dark accent passes AA anyway.
    - Remove the attention-* pairs.
    - `pnpm test` (web) runs this report first and fails if it fails. (Verified: 12/12 pairs pass, 0 waived.)
  - [x] Login page: it is currently unstyled HTML. It must still be readable in both themes, which `color-scheme` plus the `html` background/colour handle. **Do not restyle it**; that is out of scope. (Not touched.)

- [x] **Task 7: Prune what only removed code used** (AC: 6)
  - [x] `web/src/lib/microcopy.ts`: delete the export groups no surviving file imports (`PASTE_TO_PARSE`, `DRAG_REORDER`, `PERFORMANCE_CARD`, `SECTION_HEADING`, `JUMP_OVERLAY`, `SECTION_BREAK`, `CURRENTLY_PERFORMING`, plus `EMPTY_STATES`/`ACTIONS`/`FIELD_LABELS`/`VALIDATION_MESSAGES` entries if nothing uses them any more). Keep `BANNERS.errorBoundary`. Add the two landing-page strings. Check usage with grep, file by file, before deleting. (Confirmed via grep: only `error-boundary.tsx` (`BANNERS`) and `home.tsx` import `microcopy.ts` now; every other group was unused and removed.)
  - [x] Delete `web/src/lib/band.ts` and import `ACTIVE_BAND_NAME` from `@gigbuddy/shared` instead. `band.ts` was a re-export that only `band-label.tsx` used.
  - [x] Run a final orphan sweep. For each remaining non-test file in `web/src`, grep that at least one surviving file imports it, apart from the entry point `main.tsx`. Keep the data hooks (`use-song`, `use-setlist`, `use-song-mutation`, `use-setlist-mutation`), the `api/` modules (including `api/gigs.ts`) and `lib/id.ts`. They are plumbing that later slices need, or `sync/` uses them. Delete anything else that turns up orphaned, and record it in the File List. (Swept every remaining `web/src` file; the only zero-importer files were exactly the explicitly-kept plumbing list above — nothing further to delete.)

- [x] **Task 8: Update the e2e smoke test** (AC: 8)
  - [x] Rewrite `e2e/smoke/shell.spec.ts`. The smoke run has **no session-cookie fixture** (see the comment in `e2e/playwright.config.ts`). The only state it can reach reliably is signed-out. Assert:
    - (a) `/` shows the login: heading "GigBuddy", a "Password" field and a "Sign in" button
    - (b) `/library` (a removed route) ends on `/login` showing the same form
    - (c) the page has no horizontal scroll at 360px and 1680px viewport widths (`document.documentElement.scrollWidth <= window.innerWidth`)
  - [x] The signed-in landing page is covered by the unit tests here and by the review snapshots in Story 7.2. Don't build an auth fixture in this story.
  - [x] Run `pnpm test:e2e`. It starts the local api, which needs AWS credentials and the `JWT_KEY_PARAM`, `PASSWORD_HASH_PARAM` and `TABLE_NAME` env vars. If those aren't available in the dev environment, record that honestly in the Dev Agent Record and don't mark this subtask done. Don't fake it. Run with Sandy's go-ahead against the real (only) environment values (`TABLE_NAME=gigbuddy-data`, `JWT_KEY_PARAM=/gigbuddy/jwt-key`, `PASSWORD_HASH_PARAM=/gigbuddy/password-hash` — read from `infra/lib/stacks/api-stack.ts`, no secrets exposed): all 3 smoke tests pass (read-only: no login submission, no writes).

- [x] **Task 9: Verify, commit, deploy** (AC: 7, 8, 9)
  - [x] `git diff --stat pre-reset -- api shared infra` must be empty. (Confirmed empty.)
  - [x] From the repo root, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` all pass. `build-output.test.ts` must still pass unchanged: the manifest and SW config are untouched. (121 api tests + 148 web tests pass; `pnpm build` succeeds; `build-output.test.ts` re-verified green against a clean `dist/`; built `index.html` has zero `data-atmosphere` occurrences.)
  - [ ] Commit as one commit: `Implement story 7.1: Front-end reset to a responsive landing page`. Push to `main`; `deploy.yml` runs on push.
  - [ ] Watch the deploy run (`gh run watch`). **Blackout check:** the test setlists carry made-up dates. If one falls within 24h, the blackout step blocks the deploy, as designed. Report it to Sandy rather than using `deploy-force.yml` on your own.
  - [ ] After deploy, `curl -fsS https://gig.cormie.com/index.html` should succeed and the response should not contain `data-atmosphere`.

## Dev Notes

### What this story is

This story is mostly deletion. About 4,000 lines of screens and device-specific logic go, roughly 3,500 lines of plumbing stay, and one small new screen is added. The back end (`api/`, `shared/`, `infra/`) is **untouched**. Everything removed can be recovered from the `pre-reset` tag, which is why Task 1 comes first and is not optional.

### Delete list (`web/src`, each with its `.test.*` sibling)

| Area | Files |
|---|---|
| Routes | `routes/library.tsx`, `routes/song-detail.tsx`, `routes/setlist-overview.tsx`, `routes/setlist-creation.tsx`, `routes/performance-card.tsx`, `routes/install-instructions.tsx` |
| Performance | `performance/performance-context.tsx`, `performance/session-resume.ts`, `performance/use-start-performance.ts`, `performance/use-wake-lock-indicator.ts`, `performance/wake-lock.ts` |
| Paste-to-parse | `paste-parse/matcher.ts`, `paste-parse/normalize.ts`, `paste-parse/parser.ts` |
| Components | `jump-overlay`, `bottom-tabs`, `top-nav`, `band-label`, `currently-performing-strip`, `reauth-banner`, `chord-chart`, `chord-notation`, `gig-card`, `inline-edit-field`, `library-song-row`, `parse-row-status`, `section-heading`, `setlist-song-row`, `song-search-row` |
| Hooks | `use-chrome-visible`, `use-navigate-away-guard`, `use-performance-end`, `use-tonight-gig`, `use-upcoming-gigs` |
| Lib | `lib/platform.ts`, `lib/atmosphere.ts`, `lib/gig-date.ts`, `lib/band.ts` |
| Sync | `sync/stale-write-banner.tsx` (MacBook-only banner). **Keep** `sync/stale-notice-store.ts`, because `flusher.ts` imports it. |
| Cache | `cache/prefetch.ts`. See the decision below. **Keep** `cache/idb.ts`. |

After deletion, `components/` should contain only `error-boundary.tsx` (+ test).

### Keep list (must stay green, unchanged unless a task says otherwise)

- `api/`: `client.ts`, `songs.ts`, `setlists.ts`, `gigs.ts`
- `auth/`: `auth-api.ts` and `auth-context.tsx`; `redirect-on-401.ts` is edited
- `sync/`: `flusher`, `outbox`, `persist`, `query-client`, `record-key` and `stale-notice-store` stay; `sync-wiring` is edited
- `cache/idb.ts`
- Hooks: `use-songs`, `use-song`, `use-setlists`, `use-setlist`, `use-song-mutation`, `use-setlist-mutation`
- Components: `components/error-boundary.tsx`
- Lib: `lib/error-reporter.ts` (edited), `lib/id.ts` (used by `outbox`), `lib/microcopy.ts` (pruned)
- PWA: `build-output.test.ts`, `vite.config.ts` (service worker, manifest, `/api/v1` proxy), `web/public/*`, `styles/fonts.css`

### Decision: `cache/prefetch.ts` is removed, `cache/` is otherwise kept

AC 7 says "keep `cache/`", but `cache/prefetch.ts` is the iPhone-only Tonight-Gig foreground pre-fetch (Story 4.5, AR-25). It starts with an `isIPhone()` early return, which breaks AC 4 ("no device detection anywhere"). The architecture course correction also explicitly **parks** "Performance-Mode pre-fetch rules", while "the offline cache itself (TanStack persist + outbox) stays" [Source: architecture.md#Course correction (2026-10-19)].

So: delete `prefetch.ts` and `use-upcoming-gigs.ts`, since the prefetch was their only reader. Keep `cache/idb.ts`, which is the IndexedDB store the persister and outbox use. Keep `api/gigs.ts` (the `api/` layer stays whole). The offline behaviour that matters for this slice is still fully there: the persisted query cache restores songs and setlists, so the counts render offline from cache.

### Current state of files being edited (read before touching)

- **`main.tsx`**: it runs `applyBootAtmosphere()` before render, imports `cache/prefetch.js` for its side effect, and rewrites `/` to `/performance/...` from a session-resume marker before React mounts. All three go.
- **`app-bootstrap.tsx`**: the install gate short-circuits on iPhone Safari before `/me`, and `PerformanceModeProvider` sits outermost. Both go. Keep the "render shell → probe /me → resolve → router" sequence [architecture.md "Auth flow"].
- **`router.tsx`**: today `RequireAuth` reads `usePerformanceActive()` and passes it to `shouldRedirectOn401`; there are seven child routes. After the change there is one index child plus a `*` catch-all.
- **`authenticated-shell.tsx`**: today it picks TopNav (MacBook) or BottomTabs (iPhone) with `isIPhone()` and mounts both banners, the navigate-away guard and the session-marker writer. Afterwards it is a plain layout.
- **`home.tsx`**: today it is the Tonight/Upcoming/Past setlist sections with `GigCard`. It is completely replaced.
- **`login.tsx`**: today it clears the session-resume marker on mount. That goes; nothing else changes. A stale `localStorage` marker key may linger on Sandy's devices. It is harmless because nothing reads it any more, so don't add migration code.
- **`sync-wiring.tsx`**: persistent storage is requested only on iPhone today. Afterwards it is requested on every device.
- **`lib/error-reporter.ts`**: reads `getPerformanceActiveSnapshot()` from `performance/`. Replace that with `false` (Task 4).
- **`styles/tokens.css`**: today it has an `@theme` block (light) plus `[data-atmosphere]` blocks. Afterwards it has `@theme` (light) plus a `@media (prefers-color-scheme: dark)` block.
- **`scripts/contrast-report.ts`**: it parses `[data-atmosphere="…"]` blocks and throws if they are missing, so **`pnpm test` will fail until it is rewritten**.

### Landing page: layout and look

- Sandy is 55. Use generous type: the headline at `--text-home-tonight` (28px) or larger, and band and counts at `--text-perf-body` (18px) or larger. Font: the existing `--font-serif-editorial` (Lora) from `fonts.css`.
- Use one centred column, roughly `max-w-[40rem]`, with `px-[var(--spacing-gutter)]` (16px) side gutters and generous top padding. There are no breakpoints and no device branches. Nothing has a fixed width larger than 360px, and long text wraps.
- Colours: `--color-text-primary` for the headline, `--color-text-secondary` for the band name and counts, and the page background is `--color-bg` (already set on `html` in `globals.css`).
- Use `font-variant-numeric: tabular-nums` (`tabular-nums` in Tailwind) on the counts line.
- Copy uses British English. The mockup step is skipped for this story: it is a deliberately plain MVP, and Sandy's quick look via the 7.2 snapshots is the design review.
- Tailwind v4 arbitrary-value classes with CSS vars match the existing code style, e.g. `text-[length:var(--text-home-tonight)]` and `text-[color:var(--color-text-secondary)]`.

### Architecture guardrails

- React Router 7: import from `react-router`, not `react-router-dom`.
- Tailwind v4 via the Vite plugin and `@import "tailwindcss";`. There is no PostCSS config.
- Zod schemas in `shared/` are the single source of truth. Don't define a local type for Song or Setlist; use `type Song`/`type Setlist` from `@gigbuddy/shared`.
- TanStack Query is the server-state store. Don't add Redux, Zustand or Jotai, and don't add a JS theme provider (architecture "Theme (amended 2026-10-19)").
- The query keys used by `useSongs`/`useSetlists` (`['songs', bandId]`, `['setlists', bandId]`) are what the persister restores. Don't change them, or Sandy's cached data won't hydrate.
- Biome is the only linter/formatter. Files are `kebab-case`, and tests are co-located; no snapshot tests.
- `web` ↔ `api` talk over HTTP only, through `/api/v1/*`.

### Testing

- Vitest + Testing Library + jsdom; `fake-indexeddb/auto` where IDB is touched (see `app-bootstrap.test.tsx`).
- In tests, use a fresh `QueryClient({ defaultOptions: { queries: { retry: false } } })` per test, wrapped in `QueryClientProvider`, as the current `app-bootstrap.test.tsx` does. Stub `fetch` with `vi.stubGlobal`.
- `app-bootstrap.test.tsx` needs these changes:
  - delete every iPhone/install-gate case (`stubIPhoneUA`, `stubIPhonePWA`, `stubMatchMedia` helpers if unused)
  - change the authenticated landing expectation from `EMPTY_STATES.noUpcomingGigs` to the landing page (heading + counts)
  - keep the shell-before-/me and unauthenticated → login cases
- `api/`, `sync/` and the remaining `auth/` tests should pass **without edits**. If one needs editing, that's a sign a kept module was changed by mistake.
- The web `pnpm test` runs `report:contrast` before `vitest run`.

### Out of scope (don't do)

- Story 7.2: the review-snapshot command, auth fixtures for e2e, and the README/CLAUDE.md snapshot docs.
- Restyling the login page.
- Any navigation, song, gig or library UI. The next slice is chosen after Sandy's look.
- Manifest changes. `orientation: 'portrait'` and `theme_color` stay as they are, because `build-output.test.ts` asserts them. Revisit in a later slice if needed.
- Any edit to `api/`, `shared/` or `infra/`, including the `performanceActive` field in `ClientErrorReportSchema`.
- The `/api/v1/export` NetworkOnly rule in `vite.config.ts` stays, even though the library-footer link is gone. The endpoint is kept, and the rule is harmless.

### Previous-work intelligence

- This is the first story of Epic 7, so there is no previous 7.x story. The last implemented work was Epic 6 (stories 6.1–6.6). It was superseded, and all of it is deleted here.
- Epic 3 retro: one commit per story; don't bundle. The sprint change proposal (`26ffc4d`) has already landed separately, so this story's commit holds only code plus this story file and the sprint-status update.
- An old smoke failure (`e2e/test-results/…/error-context.md`) shows the previous smoke test asserted MacBook chrome (`GigBuddy · The Jack Ruby 5`, Primary nav) and got stuck on the bare `<h1>GigBuddy</h1>` shell. It never had an authenticated fixture, which is why the rewrite targets signed-out behaviour.
- The real data in prod is 52 songs and 7 setlists (loaded 2026-10-05), so after deploy the landing page should read `52 songs · 7 gigs`. Use different numbers in the unit tests so they prove the values aren't hard-coded.

### Tech versions (no upgrades in this story)

React 19, React Router 7, TanStack Query 5 (+ persist-client), Tailwind 4 (Vite plugin), Vite 6, Vitest 2, vite-plugin-pwa 1.3, Playwright 1.49+. No dependency is added. Don't remove dependencies from `web/package.json` in this story either: every listed dependency is still used by the kept plumbing (`nanoid` by `lib/id`, `idb-keyval` by cache/sync, `zod` by `api/`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.1]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-10-19.md#2.4 Technical impact, #3.2 Working agreement, #4.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Course correction (2026-10-19), #Theme (amended 2026-10-19), #Error handling, Auth flow]
- [Source: shared/src/active-band.ts — `ACTIVE_BAND_NAME = 'The Jack Ruby 5'`]
- [Source: shared/src/schemas/client-error.ts — `performanceActive: z.boolean()` (required)]
- [Source: e2e/playwright.config.ts — no session-cookie fixture]
- [Source: .github/workflows/deploy.yml — push to main → lint/typecheck/test → blackout → cdk → S3 → CloudFront → smoke]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via Claude Code.

### Debug Log References

None — no blocking failures. One transient test-design issue surfaced and was fixed during implementation: `app-bootstrap.test.tsx`'s "SyncWiring" and "mounts the authenticated shell" tests originally waited for `getByRole('heading', { name: 'GigBuddy' })`, which matches both the pre-ready boot shell's `<h1>GigBuddy</h1>` and the new landing page's `<h1>GigBuddy</h1>` — the assertion was resolving against the boot shell, before `SyncWiring` had even mounted. Fixed by waiting for the band name text (`'The Jack Ruby 5'`), which only the authenticated landing page renders.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created (2026-10-19).
- Tasks 1–7 and the verification half of Task 9 are complete and verified: `pre-reset` tag pushed; full delete list removed; boot/routing/auth rewired; error reporter sends `performanceActive: false`; landing page built with live counts; one light/dark token set via `prefers-color-scheme`; microcopy pruned; orphan sweep found nothing further to delete. `pnpm lint`, `pnpm typecheck`, `pnpm test` (121 api + 148 web tests) and `pnpm build` all pass from the repo root; `build-output.test.ts` passes unchanged against a clean `dist/`; the built `index.html` has zero `data-atmosphere` occurrences; `git diff --stat pre-reset -- api shared infra` is empty.
- Task 8: `e2e/smoke/shell.spec.ts` was rewritten per the AC (login heading/fields, `/library` → `/login` redirect, no horizontal scroll at 360px/1680px). Ran `pnpm test:e2e` with Sandy's go-ahead, pointing the local api dev server at GigBuddy's one (and only) real environment — `TABLE_NAME=gigbuddy-data`, `JWT_KEY_PARAM=/gigbuddy/jwt-key`, `PASSWORD_HASH_PARAM=/gigbuddy/password-hash` (read from `infra/lib/stacks/api-stack.ts`, not secrets themselves) — since there's no separate dev/staging table or SSM namespace. The spec is read-only (no login submission, no writes): all 3 smoke tests passed.

### File List

**Deleted** (`web/src`, each with its co-located test):
- `cache/prefetch.ts`
- `components/band-label.tsx`, `components/bottom-tabs.tsx`, `components/chord-chart.tsx`, `components/chord-notation.tsx`, `components/currently-performing-strip.tsx`, `components/gig-card.tsx`, `components/inline-edit-field.tsx`, `components/jump-overlay.tsx`, `components/library-song-row.tsx`, `components/parse-row-status.tsx`, `components/reauth-banner.tsx`, `components/section-heading.tsx`, `components/setlist-song-row.tsx`, `components/song-search-row.tsx`, `components/top-nav.tsx`
- `hooks/use-chrome-visible.ts`, `hooks/use-navigate-away-guard.ts`, `hooks/use-performance-end.ts`, `hooks/use-tonight-gig.ts`, `hooks/use-upcoming-gigs.ts` (no test file existed for this one)
- `lib/atmosphere.ts`, `lib/band.ts` (no test file existed), `lib/gig-date.ts`, `lib/platform.ts`
- `paste-parse/` (whole directory: `matcher.ts`, `normalize.ts`, `parser.ts`)
- `performance/` (whole directory: `performance-context.tsx`, `session-resume.ts`, `use-start-performance.ts`, `use-wake-lock-indicator.ts`, `wake-lock.ts`)
- `routes/install-instructions.tsx`, `routes/library.tsx`, `routes/performance-card.tsx`, `routes/setlist-creation.tsx`, `routes/setlist-overview.tsx`, `routes/song-detail.tsx`
- `sync/stale-write-banner.tsx`

**Updated:**
- `web/index.html` — removed `data-atmosphere="practice"`; split `theme-color` into light/dark media-queried metas
- `web/scripts/contrast-report.ts` — rewritten for `Variant = 'light' | 'dark'`; reads `@theme` (light) + `@media (prefers-color-scheme: dark)` → `:root` (dark); dropped attention-* pairs; added dark accent AA pairs
- `web/src/app-bootstrap.tsx` — removed install gate and `PerformanceModeProvider`
- `web/src/app-bootstrap.test.tsx` — removed iPhone/install-gate cases; added catch-all→login test; fixed heading-ambiguity bug (see Debug Log)
- `web/src/auth/redirect-on-401.ts` — dropped `performanceActive` argument
- `web/src/auth/redirect-on-401.test.ts` — updated to match
- `web/src/hooks/use-songs.test.tsx` — removed the `Library`-rendering describe block (route deleted); removed now-unused imports
- `web/src/lib/error-reporter.ts` — sends `performanceActive: false` (shared schema still requires the field)
- `web/src/lib/error-reporter.test.ts` — asserts `performanceActive: false` in the payload
- `web/src/lib/microcopy.ts` — pruned to `BANNERS.errorBoundary` + new `HOME` (loading/error strings)
- `web/src/main.tsx` — removed `applyBootAtmosphere`, the `cache/prefetch.js` side-effect import, and the session-resume boot rewrite
- `web/src/router.tsx` — one index route (`Home`) + catch-all to `/`; `RequireAuth` no longer reads `performanceActive`
- `web/src/routes/authenticated-shell.tsx` — reduced to a plain centred-column layout wrapping `<Outlet />`
- `web/src/routes/authenticated-shell.test.tsx` — rewritten for the plain layout
- `web/src/routes/home.tsx` — rewritten as the landing page (heading, band name, live counts)
- `web/src/routes/home.test.tsx` — rewritten for the landing page
- `web/src/routes/login.tsx` — removed `clearSessionMarker` import/effect
- `web/src/styles/globals.css` — `color-scheme: light dark`; updated comment
- `web/src/styles/tokens.css` — one `@theme` (light) + `@media (prefers-color-scheme: dark)` variant; dropped attention-* tokens
- `web/src/sync/persist.ts` — comment update ("iPhone only" → "every device")
- `web/src/sync/sync-wiring.tsx` — `requestPersistentStorage()` called unconditionally
- `web/test-output/contrast-report.json` — regenerated output
- `e2e/smoke/shell.spec.ts` — rewritten for the signed-out-only smoke assertions (AC-8)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story status transitions

**New:**
- `web/src/lib/counts.ts` — `formatCounts()` pure formatter
- `web/src/lib/counts.test.ts`
- `_bmad-output/implementation-artifacts/7-1-front-end-reset-to-responsive-landing-page.md` — this file
