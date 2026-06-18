---
baseline_commit: 29be85b
builds_on: 2-4-sync-layer-foundation-client-error-reporter
---

# Story 2.5: Library list surface (FR-4)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Sandy,
I want an alphabetically-ordered list of Songs in the active Band's Library on both surfaces, with tap navigation to Song Detail,
so that I can browse my repertoire and pick any Song to view or edit.

## Acceptance Criteria

**AC-1 — `web/src/api/songs.ts` exposes `listSongs()` parsing `OkResponseSchema(z.array(SongSchema))` via `apiFetch`**

**Given** `web/src/api/songs.ts` (NEW)
**When** reviewed
**Then** the file exports `async function listSongs(): Promise<Song[]>` which calls `apiFetch('/api/v1/songs', { method: 'GET', schema: OkResponseSchema(z.array(SongSchema)) })` from `web/src/api/client.ts` and returns the parsed `data` array
**And** the function does NOT pass a `body` to `apiFetch` (GET only; the wrapper omits `content-type` when body is undefined)
**And** the function does NOT catch — a network failure or a Zod parse failure throws, the TanStack Query hook handles retry per its own defaults (3 attempts with exponential backoff per architecture.md "Error handling")
**And** the file imports `Song`, `SongSchema`, and `OkResponseSchema` from `@gigbuddy/shared`; `apiFetch` from `../api/client.js`; `z` from `zod`
**And** the response envelope schema is composed at the call site (per Story 2.4's `flusher.ts` pattern) — no new shared exports
**And** `web/src/api/songs.test.ts` (NEW) covers: a 200 with three Song records returns the unwrapped array; a malformed response body (missing `data`) throws; the call uses the GET method (verify via `vi.stubGlobal('fetch', ...)` call args)
**And** the tests use `Response` objects with the `x-server-now` header set so the fetch wrapper treats them as network successes (mirrors `web/src/api/client.test.ts` setup pattern)

**AC-2 — `web/src/hooks/use-songs.ts` is a TanStack Query hook keyed on `['songs', bandId]`**

**Given** `web/src/hooks/use-songs.ts` (NEW)
**When** reviewed
**Then** the file exports `function useSongs(): UseQueryResult<Song[], Error>` calling `useQuery({ queryKey: ['songs', ACTIVE_BAND_ID], queryFn: listSongs })` from `@tanstack/react-query`
**And** the queryKey is `['songs', ACTIVE_BAND_ID]` — NOT `['song', bandId, songId]` (the per-song key Story 2.6 will use). The flusher's `routeForRecordKey()` documents this split: invalidating the per-song key alone does NOT force a list refetch; the list query owns its own cache (see `web/src/sync/flusher.ts:31-35`)
**And** no per-call `staleTime`, `gcTime`, or `refetchOnWindowFocus` overrides are set in this hook — the defaults inherited from `web/src/sync/query-client.tsx` (`gcTime: Number.POSITIVE_INFINITY`) plus TanStack Query's default `staleTime: 0` and `refetchOnWindowFocus: true` give the right semantics: render cached data immediately, refetch on focus / mount to surface server changes
**And** the hook does NOT pass `initialData`, `placeholderData`, or `select` — the queryFn returns the alphabetized array directly (the API alphabetizes server-side per Story 2.3 / architecture.md line 753)
**And** the hook imports `ACTIVE_BAND_ID` directly from `@gigbuddy/shared` (NOT from `web/src/lib/band.ts` per Story 2.4 dev-notes contract); `listSongs` from `../api/songs.js`; `useQuery` from `@tanstack/react-query`
**And** `web/src/hooks/use-songs.test.tsx` (NEW) covers: the hook returns the array on success (mock `apiFetch` via `vi.mock('../api/client.js')` or stub `fetch`); the queryKey is `['songs', ACTIVE_BAND_ID]` (assert via `queryClient.getQueryData(['songs', ACTIVE_BAND_ID])` after the hook resolves); cached data is rendered immediately on subsequent mounts (mount twice in one test, assert no second fetch fires within the staleTime window)
**And** tests render the hook inside a `<QueryClientProvider>` wrapper with a FRESH `QueryClient` per test (do NOT import the singleton from `sync/query-client.tsx` — that has the IDB persister attached and would touch real / fake-indexeddb storage during unrelated tests). Pattern mirrors `web/src/sync/flusher.test.ts`'s `new QueryClient(...)` per case

**AC-3 — `web/src/components/library-song-row.tsx` renders one row per Song: title only, tap → `/songs/:songId`, satisfies `min-h-tap`**

**Given** `web/src/components/library-song-row.tsx` (NEW)
**When** reviewed
**Then** the file exports `function LibrarySongRow({ song }: { song: Song }): JSX.Element` — a stateless component with no row actions, no drag handle, no contextual menu, no badges (the explicit `SongRow (library)` rule per UX-DR4 / EXPERIENCE.md Components Patterns line 95)
**And** the row renders a single `<Link to={`/songs/${song.songId}`}>` from `react-router` (NOT `react-router-dom` per CLAUDE.md) wrapping the title text — the entire row is the link (whole-row tap target)
**And** the title text uses the editorial serif body face per UX-DR1 (`var(--font-serif-editorial)`) at `var(--text-practice-body)` size on MacBook / `var(--text-perf-body)` size on iPhone; since the type scale is invariant across atmospheres (per `tokens.css`) and Practice body is 17px while Performance body is 18px, the row uses `--text-perf-body` (18px floor satisfies both surfaces' minimums, including Sandy-at-55 type-scale rules from `EXPERIENCE.md Accessibility Floor`). Use `text-[length:var(--text-perf-body)] leading-[var(--text-perf-body--line-height)]` plus the serif font-family token
**And** the row satisfies `min-h-tap` (44pt) — apply `min-h-tap` Tailwind utility (generated from `--spacing-tap: 44px` per `tokens.css`) plus vertical padding to give the title comfortable breathing room
**And** the link's accessible name is the Song title (the visible text matches the spoken intent; no extra `aria-label` per UX-DR6 — see `bottom-tabs.tsx` for the same "visible text is enough" pattern when applicable; library rows differ from icon-only controls)
**And** the link uses no decorative chrome (no chevron, no avatar, no surface-fill card on MacBook) — quiet treatment per `DESIGN.md` §Components: "Title only, in serif body. Quiet treatment."
**And** hover / focus-visible state applies an `accent` underline (Practice) or `accent` color shift (Performance) on the title — use a `[&:hover]:underline focus-visible:underline decoration-[color:var(--color-accent)]` Tailwind pattern; do NOT use `:active` for press feedback (per architecture's reduced-motion rule, no motion animation longer than 150ms; a static underline is fine)
**And** the row does NOT call `useSong(song.songId)` or any hook — it consumes `song` via props only (the list owns data, the row is a leaf render component)
**And** `web/src/components/library-song-row.test.tsx` (NEW) covers: renders the title text; the row is a link with `href` `/songs/<songId>` (assert via `screen.getByRole('link', { name: title }).toHaveAttribute('href', '/songs/<songId>')`); satisfies `min-h-tap` (assert the class is present); no buttons, no `aria-label` overrides

**AC-4 — `web/src/routes/library.tsx` lists Songs (populated) OR empty state — both branches render the `+ New song` affordance**

**Given** `web/src/routes/library.tsx` (UPDATE — Story 1.5 currently renders the bare empty state)
**When** the route renders
**Then** it calls `useSongs()` and consumes `{ data, isLoading, error }`
**And** while `data === undefined` AND `isLoading === true` the route renders a minimal placeholder — the existing `<h1 className="sr-only">Library</h1>` and a single `<p className="sr-only">Loading library.</p>` (sr-only so MacBook sighted users see nothing momentarily; VoiceOver announces the loading state). Do NOT flash the empty-state copy during loading
**And** once `data` is defined and `data.length > 0`, the route renders:
  - the existing `<h1 className="sr-only">Library</h1>` accessible heading
  - the `+ New song` affordance at the top of the page chrome (see below)
  - a `<ul>` of `<LibrarySongRow />` per song, ordered by `song.title` server-alphabetized (defensive client-side sort is NOT required — trust the server). The list uses `role="list"` implicitly via `<ul>`; each row wraps in `<li>` for semantic correctness
**And** once `data` is defined and `data.length === 0`, the route renders:
  - the existing `<h1 className="sr-only">Library</h1>`
  - the `+ New song` affordance (visible in empty state per AC; the "deliberate mild divergence" from PRD §State Patterns line 112 ("No CTA in V1") is intentional to satisfy FR-1 standalone in Epic 2 — otherwise Sandy can never add a Song)
  - the locked empty-state copy `No songs in this library yet.` (from `EMPTY_STATES.noSongsInLibrary` — already in `microcopy.ts`)
**And** the `+ New song` affordance is a `<Link to="/songs/new">` rendered as a small low-emphasis action above the list (page-local chrome — NOT mounted in `<TopNav>` or `<BottomTabs>`). The link text is `+ New song` lifted verbatim from a new microcopy constant (see AC-5). It satisfies `min-h-tap` and renders in the `accent` color (`var(--color-accent)`)
**And** the affordance renders on BOTH surfaces (MacBook + iPhone). It is visible always — populated state AND empty state — so Sandy can add a Song from either condition (FR-1 access point)
**And** an `error` from `useSongs` is NOT surfaced as a banner / toast in this story (per architecture.md "Error handling" lines 740–753: TanStack Query auto-retries; persistent-failure banner is deferred to a future polish). On error AFTER retries are exhausted, the route renders the empty state (data still resolves from the persister cache; if cache is empty too, the user sees `No songs in this library yet.` — acceptable degraded behavior since Story 2.4's stale-write banner subsystem is the channel for sync-layer surfaces, not list-fetch failures)
**And** the route's `<section>` retains `aria-labelledby="library-heading"` so screen readers announce the section consistently across the loading / populated / empty branches

**AC-5 — `+ New song` copy lives in `microcopy.ts` ACTIONS constant**

**Given** `web/src/lib/microcopy.ts`
**When** UPDATED
**Then** the file appends a new top-level constant: `export const ACTIONS = { newSong: '+ New song' } as const;`
**And** the constant is consumed by `library.tsx` (the `+ New song` link) — the string is NOT inlined
**And** the existing `EMPTY_STATES` and `BANNERS` constants are unchanged (append-only modification per Story 2.4's pattern)
**And** the file header comment ("Reusable microcopy constants. Strings are LOCKED — they live verbatim in EXPERIENCE.md §Voice and Tone / §State Patterns...") is updated to include ACTIONS in the list of locked surfaces
**And** the string follows UX-DR7 voice & tone: short, no exclamation, no emoji, no encouragement (verified by inspection — `+ New song` passes)

**AC-6 — Library tap navigates to `/songs/:songId`; `+ New song` tap navigates to `/songs/new`**

**Given** `web/src/routes/library.test.tsx` (UPDATE — the existing tests verify the empty state from Story 1.5)
**When** the test renders the Library inside a `MemoryRouter` and mocks `useSongs` to return a 3-song array
**Then** the test asserts each `<LibrarySongRow>` link's `href` matches `/songs/<songId>` for the correct song (use `screen.getAllByRole('link', { name: <title> })`)
**And** asserts the `+ New song` affordance is present with `href="/songs/new"`
**And** asserts the rows render in the order returned by the hook (the API alphabetizes; the test data uses titles deliberately out of input order to confirm the route does NOT re-sort or mutate)
**And** the route does NOT register or render the `/songs/:songId` route itself — Story 2.6 owns adding those route entries to `router.tsx`. The tests verify only that the links exist with the correct hrefs; clicking them inside `MemoryRouter` without route registration would yield react-router's default "no route matched" behavior, which is expected and out of scope for this story
**And** the empty-state test asserts the `+ New song` link is also present (verifying the AC-4 "visible in both states" contract)
**And** the existing "renders no row affordances — no buttons, no links" assertion from Story 1.5's tests is REMOVED — Story 2.5 introduces the `+ New song` link by design
**And** the existing "renders the locked empty-state copy from EMPTY_STATES" test is preserved BUT updated to assert the copy appears only when `useSongs` returns an empty array (mock `useSongs` to return `[]`)
**And** the existing "exposes a Library h1 to the accessibility tree" test is preserved verbatim

**AC-7 — Atmosphere tokens (Practice on MacBook, Performance on iPhone) — verified by selector, not value**

**Given** the Library route renders
**When** the page loads on MacBook
**Then** the `<html data-atmosphere="practice">` attribute (set at boot via `applyBootAtmosphere()` in `main.tsx`) selects the Practice palette from `tokens.css`. The route does NOT re-set the atmosphere or read `isIPhone()` to switch tokens — it consumes CSS variables only

**Given** the Library route renders
**When** the page loads on iPhone (post-install gate, post-auth)
**Then** the `<html data-atmosphere="performance">` attribute selects the Performance palette
**And** the bottom tab bar (already mounted by `AuthenticatedShell` per Story 1.5) shows `Library` as the active tab — verify via `BottomTabs.test.tsx` is unchanged (its assertions still hold; Story 2.5 does NOT modify `bottom-tabs.tsx` or its tests)

**Given** the Library page layout
**When** rendered on MacBook (NFR-23)
**Then** the page layout is single-column vertical (already enforced by `<AuthenticatedShell>`'s `<main className="mx-auto max-w-[960px]...">` wrapper from Story 1.5). The route does NOT introduce multi-column or grid layouts
**And** the route does NOT introduce surface fills or card chrome (per `DESIGN.md` §Components: Library rows are quiet, title-only on a flat surface)

**Given** the Library tests
**When** they assert visual treatment
**Then** they assert ONLY that the CSS variables used are atmosphere tokens (e.g., `text-[color:var(--color-text-primary)]`) — they do NOT assert specific hex values. jsdom does not apply the `[data-atmosphere=...]` selector evaluation by default, so atmosphere-specific assertions are not feasible at the unit test layer. The contract is structural: the route uses tokens; visual correctness on each atmosphere is verified by Sandy in Task 8 manual smoke

**AC-8 — Cache invalidation: a `setQueryData(['songs', ACTIVE_BAND_ID], ...)` or `invalidateQueries(['songs', ACTIVE_BAND_ID])` causes the list to re-render with new data**

**Given** the Library route is open with N songs
**When** code elsewhere calls `queryClient.invalidateQueries({ queryKey: ['songs', ACTIVE_BAND_ID] })` (the canonical pattern Story 2.6 will use after a new Song write completes)
**Then** the hook refetches; the list re-renders with the updated array; new songs appear in alphabetical order without a page refresh (the architecture's "render from cache immediately + revalidate in background" pattern)
**And** the test for this AC mounts the Library inside a `<QueryClientProvider>` with a fresh `QueryClient`; pre-seeds the cache with `queryClient.setQueryData(['songs', ACTIVE_BAND_ID], [songA, songC])`; renders; asserts both rows. Then calls `queryClient.setQueryData(['songs', ACTIVE_BAND_ID], [songA, songB, songC])`; asserts that songB now renders in alphabetical position. This proves Story 2.6's eventual `useSongMutation()` write path will surface the new Song in the list without a manual reload
**And** the test does NOT need to involve `fake-indexeddb` (no IDB persister is attached to the test's fresh QueryClient — the test verifies the in-memory cache contract only)
**And** Story 2.5 does NOT itself write to the cache or invalidate the query — those write paths land in Story 2.6 (`useSongMutation` after the InlineEditField commit). The hook here is read-only; cache invalidation is a downstream concern

**AC-9 — Screen-reader contract: list has a logical heading; each row's accessible name is the Song title; loading state is announced**

**Given** the Library route renders with at least one Song
**When** a screen-reader user navigates
**Then** the `<section aria-labelledby="library-heading">` declares the section name (existing from Story 1.5; unchanged)
**And** the `<h1 id="library-heading" className="sr-only">Library</h1>` is the heading (existing; unchanged)
**And** the `<ul>` is a list landmark
**And** each `<li>` contains a `<Link>` whose accessible name is the Song title (visible text — no `aria-label` overriding it per UX-DR6)
**And** the `+ New song` link has accessible name `+ New song` (visible text only)

**Given** the Library route renders during the cold-load fetch (no persisted cache yet)
**When** a screen-reader user lands on the route
**Then** the `<p className="sr-only">Loading library.</p>` is announced (a polite live region is NOT required — the heading + status text are sufficient for the brief loading window; the user can re-poll by navigating to the heading)
**And** the visible UI shows nothing for sighted users during this window (per AC-4: no empty-state flash, no skeleton; the persister gates render on cache restore so this window only ever exists on the very first ever visit)

**Given** the Library tests
**When** they assert accessibility structure
**Then** they assert: presence of the heading `Library`; presence of the list landmark (or list items via `getAllByRole('listitem')`); presence of the `+ New song` link; ABSENCE of any `aria-label` override on row links (use `link.hasAttribute('aria-label')` is `false`, or `link.getAttribute('aria-label')` is `null`)

**AC-10 — `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build:web` all green; no incidental version bumps; no new deps required**

**Given** the implementation complete
**When** the verification commands run from the repo root
**Then** `pnpm typecheck` is green across all five packages — the new files (`api/songs.ts`, `hooks/use-songs.ts`, `components/library-song-row.tsx`, updated `routes/library.tsx`, updated `lib/microcopy.ts`) compile under `strict: true` + `noUncheckedIndexedAccess: true` + `exactOptionalPropertyTypes: true`
**And** `pnpm lint` is green via Biome — kebab-case filenames; camelCase identifiers; React Router 7 imports from `react-router` not `react-router-dom` per CLAUDE.md; no `// biome-ignore` directives required beyond the patterns already in the repo
**And** `pnpm test` is green — new test cases pass, no regressions in the existing 146 web tests / 73 api tests baseline
**And** `pnpm build:web` is green; bundle size grows minimally (~1–2 KB raw — only new application code, no new dependencies)
**And** `web/package.json`, `api/package.json`, `shared/package.json`, `infra/package.json`, `e2e/package.json` are unchanged (Story 2.5 is web-only and uses only already-resolved dependencies: `@tanstack/react-query` and `react-router`)
**And** `pnpm-lock.yaml` is unchanged (no new packages)

**AC-11 — Library list scenario tests cover the user-visible flow end-to-end**

**Given** `web/src/routes/library.test.tsx`
**When** the test suite is exercised
**Then** it proves the user-visible behavior:
  - **Populated:** mock `useSongs` to return three songs (`{songId: '1', title: 'Autumn Leaves'}`, `{songId: '2', title: 'Blue Bossa'}`, `{songId: '3', title: 'Charleston'}`) — assert three `<LibrarySongRow>`s render with the titles in input order (server pre-sorted); each row links to `/songs/<id>`; the `+ New song` affordance is present at `/songs/new`
  - **Empty:** mock `useSongs` to return `[]` — assert the `No songs in this library yet.` copy renders; the `+ New song` affordance is still present
  - **Loading:** mock `useSongs` to return `{ data: undefined, isLoading: true }` — assert the sr-only loading text renders; no list items; no empty-state copy is visible
  - **Heading + structure:** the `<h1>Library</h1>` is announceable; the section is `aria-labelledby="library-heading"`
  - **`+ New song` link:** href is `/songs/new`; accessible name is `+ New song`; satisfies `min-h-tap`
**And** the mocking pattern follows the existing repo convention: `vi.hoisted` + `vi.mock('../hooks/use-songs.js')` factory exposing a `useSongsMock`. Mirrors `web/src/components/reauth-banner.test.tsx` (hoisted mock of `isIPhone`) and `web/src/sync/stale-write-banner.test.tsx`
**And** the suite wraps every render in `<MemoryRouter>` (the rows use `<Link>` from `react-router` which throws outside a router context)

## Tasks / Subtasks

- [x] **Task 1 — `web/src/api/songs.ts`: `listSongs()` over `apiFetch`** (AC: 1)
  - [x] Create `web/src/api/songs.ts`:
    ```typescript
    import { OkResponseSchema, type Song, SongSchema } from '@gigbuddy/shared';
    import { z } from 'zod';
    import { apiFetch } from './client.js';

    /*
     * The list-Songs API surface. The flusher (sync/flusher.ts) owns the
     * write path via the outbox; this module owns the read path used by
     * useSongs (Story 2.5). Story 2.6 will add `getSong(songId)` here for
     * the per-record `useSong()` hook.
     */
    export async function listSongs(): Promise<Song[]> {
      const response = await apiFetch('/api/v1/songs', {
        method: 'GET',
        schema: OkResponseSchema(z.array(SongSchema)),
      });
      return response.data.data;
    }
    ```
  - [x] Create `web/src/api/songs.test.ts` covering AC-1's three cases (200 with three songs → unwrapped array; malformed body throws; GET method used)
  - [x] Use `vi.stubGlobal('fetch', vi.fn())` and craft `Response` objects with `x-server-now` header so `apiFetch` treats them as network successes (see `web/src/api/client.test.ts` for the established pattern)
  - [x] **Do NOT** wrap the call in a try/catch — let parse/network errors propagate to the caller (TanStack Query's retry layer handles them)

- [x] **Task 2 — `web/src/hooks/use-songs.ts`: TanStack Query hook** (AC: 2)
  - [x] Create `web/src/hooks/use-songs.ts`:
    ```typescript
    import { ACTIVE_BAND_ID, type Song } from '@gigbuddy/shared';
    import { useQuery, type UseQueryResult } from '@tanstack/react-query';
    import { listSongs } from '../api/songs.js';

    /*
     * Library list query (FR-4). Keyed on ['songs', bandId] — the per-Song
     * key ['song', bandId, songId] (Story 2.6) is a SEPARATE cache namespace.
     * Architecture.md "State management taxonomy" line 720: server data lives
     * in TanStack Query; persisted to IDB by the SyncProvider (Story 2.4).
     *
     * Defaults inherited from the SyncProvider's QueryClient:
     *   - gcTime: Infinity (cache never expires while persisted)
     *   - staleTime: 0 (refetch on mount/focus to surface server changes)
     *   - retry: 3 with exponential backoff (architecture line 743)
     */
    export function useSongs(): UseQueryResult<Song[], Error> {
      return useQuery({
        queryKey: ['songs', ACTIVE_BAND_ID],
        queryFn: listSongs,
      });
    }
    ```
  - [x] Create `web/src/hooks/use-songs.test.tsx` covering AC-2:
    - returns the array on success
    - queryKey is `['songs', ACTIVE_BAND_ID]` (assert via `queryClient.getQueryData(['songs', ACTIVE_BAND_ID])` after the hook resolves)
    - cached data is rendered immediately on subsequent mounts (mount twice; second mount synchronously returns `data` from the cache; verify no second fetch fires by counting `fetch` mock calls)
  - [x] **Test wrapper:** construct a FRESH `QueryClient` per test, NOT the singleton from `sync/query-client.tsx` (the singleton has the IDB persister attached and would pollute unrelated tests). Mirror `web/src/sync/flusher.test.ts`'s per-test QueryClient pattern.
  - [x] Use `renderHook(() => useSongs(), { wrapper })` from `@testing-library/react` with the QueryClientProvider wrapper. Use `await waitFor(() => expect(result.current.isSuccess).toBe(true))` to await query resolution.
  - [x] **Do NOT** introduce a `useSongsRefetch()` helper or any imperative refetch escape hatch — Story 2.6's `useSongMutation()` will call `queryClient.invalidateQueries(['songs', ACTIVE_BAND_ID])` directly per architecture.md's data-flow pattern.

- [x] **Task 3 — `web/src/components/library-song-row.tsx`: the title-only row link** (AC: 3)
  - [x] Create `web/src/components/library-song-row.tsx`:
    ```typescript
    import type { Song } from '@gigbuddy/shared';
    import { Link } from 'react-router';

    /*
     * Library variant of the Song row (UX-DR4 / EXPERIENCE.md Component
     * Patterns line 95): title only, quiet treatment, no row actions.
     * Tap target satisfies min-h-tap (44pt). The whole row is the link.
     *
     * Story 3.3 will land the Setlist variant (`SetlistSongRow`) which adds
     * the per-gig annotation subline and the MacBook drag handle.
     */
    export function LibrarySongRow({ song }: { song: Song }) {
      return (
        <li>
          <Link
            to={`/songs/${song.songId}`}
            className="block min-h-tap py-[calc(var(--spacing-unit)*3)] text-[length:var(--text-perf-body)] leading-[var(--text-perf-body--line-height)] text-[color:var(--color-text-primary)] decoration-[color:var(--color-accent)] [font-family:var(--font-serif-editorial)] hover:underline focus-visible:underline"
          >
            {song.title}
          </Link>
        </li>
      );
    }
    ```
  - [x] Create `web/src/components/library-song-row.test.tsx` covering AC-3:
    - renders the title text
    - link href matches `/songs/<songId>`
    - has `min-h-tap` (assert via `className.includes('min-h-tap')` or `toHaveClass('min-h-tap')`)
    - no buttons / no extra `aria-label` overrides
  - [x] Wrap renders in `<MemoryRouter>` so `<Link>` resolves; pattern mirrors `web/src/components/bottom-tabs.test.tsx`
  - [x] **`min-h-tap` token contract:** Tailwind v4 generates `min-h-tap` from `--spacing-tap: 44px` declared in `tokens.css` line 63. Verify the utility is present (the class compiles to `min-height: var(--spacing-tap)`). Do NOT inline `min-height: 44px` — the token is the contract.
  - [x] **Wrap in `<li>`:** the row component itself emits `<li>`. The parent (`library.tsx`) emits `<ul>`. This keeps the list semantics correct without the parent passing extra wrapper props.

- [x] **Task 4 — `web/src/lib/microcopy.ts`: append `ACTIONS = { newSong: '+ New song' }`** (AC: 5)
  - [x] Update `web/src/lib/microcopy.ts` to add:
    ```typescript
    export const ACTIONS = {
      newSong: '+ New song',
    } as const;
    ```
  - [x] Update the file header comment to add `ACTIONS` to the list of locked surfaces (Voice & Tone enforcement)
  - [x] Do NOT modify or reorder `EMPTY_STATES` or `BANNERS` — append-only

- [x] **Task 5 — `web/src/routes/library.tsx`: list + empty state + `+ New song` affordance** (AC: 4, 6, 7, 9)
  - [x] UPDATE `web/src/routes/library.tsx` per the AC-4 contract. Reference shape:
    ```typescript
    import { Link } from 'react-router';
    import { LibrarySongRow } from '../components/library-song-row.js';
    import { useSongs } from '../hooks/use-songs.js';
    import { ACTIONS, EMPTY_STATES } from '../lib/microcopy.js';

    /*
     * Library (FR-4). Lists Songs alphabetically for the active Band. The
     * server alphabetizes; the route trusts the order. Tap a row → /songs/:id
     * (Story 2.6 lands the Song Detail route). `+ New song` → /songs/new.
     */
    export function Library() {
      const { data, isLoading } = useSongs();

      return (
        <section aria-labelledby="library-heading">
          <h1 id="library-heading" className="sr-only">
            Library
          </h1>
          <Link
            to="/songs/new"
            className="inline-flex min-h-tap items-center py-[calc(var(--spacing-unit)*2)] text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-accent)] hover:text-[color:var(--color-accent-strong)] focus-visible:text-[color:var(--color-accent-strong)]"
          >
            {ACTIONS.newSong}
          </Link>
          {data === undefined && isLoading ? (
            <p className="sr-only">Loading library.</p>
          ) : data && data.length > 0 ? (
            <ul className="mt-[var(--spacing-section-gap)] flex flex-col">
              {data.map((song) => (
                <LibrarySongRow key={song.songId} song={song} />
              ))}
            </ul>
          ) : (
            <p className="mt-[var(--spacing-section-gap)] text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-text-secondary)]">
              {EMPTY_STATES.noSongsInLibrary}
            </p>
          )}
        </section>
      );
    }
    ```
  - [x] **Branching order matters:** check `isLoading + data === undefined` FIRST so the empty-state copy doesn't flash during the cold-load fetch. Then `data.length > 0` for the populated case. Then fall through to the empty-state branch.
  - [x] **List ordering:** use the server's order as-is. Do NOT re-sort client-side; the integration test will assert the input order is preserved.
  - [x] **NO Page-level h2 / page-title visible to sighted users.** The h1 is sr-only (consistent with Story 1.5's pattern — the Library page is reached via the chrome, so the visible nav is the heading). If a follow-up UX pass wants a visible page title, that's a separate story.

- [x] **Task 6 — `web/src/routes/library.test.tsx`: update + extend** (AC: 6, 9, 11)
  - [x] UPDATE `web/src/routes/library.test.tsx`. Reference shape (hoisted-mock + per-test mock pattern):
    ```typescript
    import { render, screen } from '@testing-library/react';
    import { MemoryRouter } from 'react-router';
    import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
    import { ACTIONS, EMPTY_STATES } from '../lib/microcopy.js';
    import { Library } from './library.js';

    const { useSongsMock } = vi.hoisted(() => ({ useSongsMock: vi.fn() }));
    vi.mock('../hooks/use-songs.js', () => ({ useSongs: useSongsMock }));

    function makeSong(songId: string, title: string) {
      return {
        bandId: 'jr5',
        songId,
        title,
        clientWrittenAt: '2026-06-17T12:00:00.000Z',
        serverReceivedAt: '2026-06-17T12:00:01.000Z',
        version: 1 as const,
      };
    }

    beforeEach(() => {
      useSongsMock.mockReset();
    });
    afterEach(() => vi.clearAllMocks());

    describe('Library', () => {
      it('renders one row per song in the order returned by useSongs', () => {
        useSongsMock.mockReturnValue({
          data: [
            makeSong('a', 'Autumn Leaves'),
            makeSong('b', 'Blue Bossa'),
            makeSong('c', 'Charleston'),
          ],
          isLoading: false,
        });
        render(<MemoryRouter><Library /></MemoryRouter>);
        const links = screen.getAllByRole('link');
        // First link is "+ New song", then 3 song rows.
        expect(links).toHaveLength(4);
        expect(links[1]).toHaveTextContent('Autumn Leaves');
        expect(links[1]).toHaveAttribute('href', '/songs/a');
        expect(links[2]).toHaveTextContent('Blue Bossa');
        expect(links[3]).toHaveTextContent('Charleston');
      });

      it('renders the locked empty-state copy when data is empty', () => {
        useSongsMock.mockReturnValue({ data: [], isLoading: false });
        render(<MemoryRouter><Library /></MemoryRouter>);
        expect(screen.getByText(EMPTY_STATES.noSongsInLibrary)).toBeInTheDocument();
      });

      it('shows the + New song affordance in both states', () => {
        useSongsMock.mockReturnValue({ data: [], isLoading: false });
        const { rerender } = render(<MemoryRouter><Library /></MemoryRouter>);
        expect(screen.getByRole('link', { name: ACTIONS.newSong })).toHaveAttribute('href', '/songs/new');
        useSongsMock.mockReturnValue({
          data: [makeSong('a', 'Autumn Leaves')],
          isLoading: false,
        });
        rerender(<MemoryRouter><Library /></MemoryRouter>);
        expect(screen.getByRole('link', { name: ACTIONS.newSong })).toHaveAttribute('href', '/songs/new');
      });

      it('renders only the loading announcement while data is undefined', () => {
        useSongsMock.mockReturnValue({ data: undefined, isLoading: true });
        render(<MemoryRouter><Library /></MemoryRouter>);
        expect(screen.getByText('Loading library.')).toBeInTheDocument();
        expect(screen.queryByText(EMPTY_STATES.noSongsInLibrary)).toBeNull();
      });

      it('exposes a Library h1 to the accessibility tree', () => {
        useSongsMock.mockReturnValue({ data: [], isLoading: false });
        render(<MemoryRouter><Library /></MemoryRouter>);
        expect(screen.getByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument();
      });

      it('does NOT set aria-label on song row links (visible text is the accessible name)', () => {
        useSongsMock.mockReturnValue({
          data: [makeSong('a', 'Autumn Leaves')],
          isLoading: false,
        });
        render(<MemoryRouter><Library /></MemoryRouter>);
        const row = screen.getByRole('link', { name: 'Autumn Leaves' });
        expect(row.hasAttribute('aria-label')).toBe(false);
      });
    });
    ```
  - [x] **REMOVE the existing "renders no row affordances — no buttons, no links (AC-5)" assertion** from the legacy Story 1.5 tests. Story 2.5 introduces the `+ New song` link by design — keeping the old assertion would break the suite. The other two Story 1.5 cases (`renders the locked empty-state copy`, `exposes a Library h1`) are preserved verbatim (the empty-state case must mock `useSongs` to return `[]` to reproduce the legacy behavior).
  - [x] Add the cache-invalidation test (AC-8) as a SEPARATE test file or a separate `describe` block within `library.test.tsx` — pick the simpler structure. The cache test uses a real `<QueryClientProvider>` (not the `useSongsMock`) to verify the end-to-end query behavior.

- [x] **Task 7 — Cache invalidation integration test** (AC: 8)
  - [x] Create the test inside `web/src/hooks/use-songs.test.tsx` (or `library.test.tsx` — pick the file that keeps the test focused). Verify the contract by:
    - construct a fresh `QueryClient`
    - `queryClient.setQueryData(['songs', ACTIVE_BAND_ID], [songA, songC])`
    - render `<Library>` inside `<QueryClientProvider client={queryClient}>` and `<MemoryRouter>` (do NOT use the `useSongsMock` here — the goal is to exercise the real hook against the cache)
    - assert rows for A and C render
    - `act(() => queryClient.setQueryData(['songs', ACTIVE_BAND_ID], [songA, songB, songC]))`
    - assert row for B now renders, between A and C
  - [x] Use the `wrapper` pattern from `@testing-library/react`'s `renderHook` to build a typed Provider wrapper; reuse it for both render and `renderHook` calls
  - [x] **Why this test matters:** it proves Story 2.6's `useSongMutation()` flow (write → invalidateQueries → refetch → list updates) works end-to-end against the Library route. Without this test, the contract is documented but untested.

- [x] **Task 8 — Verification pass + manual smoke** (AC: 10)
  - [x] `pnpm typecheck` green across all packages — the new modules compile under `strict: true` + `noUncheckedIndexedAccess: true` + `exactOptionalPropertyTypes: true`
  - [x] `pnpm lint` green via Biome — kebab-case filenames; React Router import from `react-router` not `react-router-dom`
  - [x] `pnpm test` green — count of new tests roughly: api/songs (+3), hooks/use-songs (+3), components/library-song-row (+4), routes/library (+6 net, including the removed "no affordances" case), AC-8 cache test (+1). Expected delta: +15 to +17 tests
  - [x] `pnpm build:web` green — bundle gains ~1–2 KB raw (just new app code; no new dependencies)
  - [x] **Do NOT** add new dependencies — `@tanstack/react-query` is already resolved (^5.101.0) and `react-router` is already resolved (^7.0.0)
  - [x] **Do NOT** modify Workbox runtime caching — `GET /api/v1/songs/*` is already NetworkFirst per Story 2.1's config; the new GET `/api/v1/songs` matches the existing rule (matches the `/api/v1/songs` prefix — the `startsWith` rule from Story 2.1)
  - [x] **Do NOT** deploy in this story; the deploy pipeline ships on the next merge to `main`. Sandy's manual proof for Story 2.5 is end-to-end across Story 2.6 — until 2.6 lands, there are no Songs in the live DDB table (the table is empty post-bootstrap; nothing creates Songs yet). Story 2.5's smoke is therefore limited to "the route loads, the empty state renders correctly, the `+ New song` link is visible and navigates (404s gracefully until 2.6)"

- [ ] **Task 9 — Human-required manual smoke** (AC: 10)
  - [ ] (Sandy) After Story 2.5 lands on `main` and the deploy pipeline ships, open `https://gig.cormie.com/library` on MacBook Safari. Verify:
    - the page renders with the `No songs in this library yet.` empty-state copy (DDB has no Songs yet — pre-2.6)
    - the `+ New song` link is visible above the empty-state copy, in `accent` color
    - tapping `+ New song` navigates to `/songs/new` — the route is not yet registered (2.6 lands it), so the URL changes but the page shows react-router's no-match fallback. Acceptable for V1.
  - [ ] (Sandy) Open the same URL on iPhone (post-PWA-install). Verify:
    - the Performance atmosphere applies (`<html data-atmosphere="performance">` via boot-time setter; the empty state copy renders in `text-secondary` cream on the dim-bar background)
    - the bottom tab bar shows `Library` highlighted in `accent`
    - the `+ New song` link is visible and tap-target ≥ 44 × 44pt (visually estimate)
  - [ ] (Sandy) DevTools → Application → IndexedDB: verify `gigbuddy-query-cache` now contains a key for `['songs', ACTIVE_BAND_ID]` after the first visit (the persister snapshots the empty-array result). Per Epic 1 retro Lesson #1 — this is an explicit unchecked human task. Story 2.5 is NOT done until all three checkboxes above are verified.

### Review Findings

- [x] [Review][Patch] AC-6 order test: mock data is pre-sorted alphabetically — can't prove the route isn't re-sorting [web/src/routes/library.test.tsx]
- [x] [Review][Patch] AC-2 cache test: missing `expect(fetchMock).toHaveBeenCalledTimes(1)` after second renderHook mount [web/src/hooks/use-songs.test.tsx]
- [x] [Review][Defer] maxAge: Infinity missing from PersistQueryClientProvider persistOptions — 24h default TTL means offline users lose persisted songs after 24h; fix belongs in a follow-up (pre-existing since Story 2.4) [web/src/sync/query-client.tsx]

## Dev Notes

### Architecture compliance (the contract you must follow)

**Source of truth:** `_bmad-output/planning-artifacts/architecture.md`. Deviations require updating that document, not the implementation.

Story 2.5 is the **first read-side proof** of the Story 2.4 sync layer. It lights up the Library route: `useSongs()` → TanStack Query → IDB-persisted cache → render. The list is read-only in this story — Story 2.6 adds the mutation path (`useSongMutation()` + `InlineEditField`). Together 2.5 + 2.6 close out Epic 2's user-visible scope.

**Hard rules from the architecture:**

- **State management taxonomy (lines 718–731):** server data (Songs) lives in TanStack Query; the SyncProvider's QueryClient (Story 2.4) is the singleton; per-call hooks (`useSongs`, eventually `useSong`, `useSongMutation`) are the UI surface. No Redux / Zustand / Jotai.
- **AR-23 (line 151):** whole-record contract on the server. The list endpoint returns `Song[]` (whole records, alphabetized server-side). The client does not paginate, search, or filter in V1 — the entire library renders in one list.
- **AR-26 (line 156):** SW caching of `GET /api/v1/songs/*` is `NetworkFirst` → `api-cache-v1`. The hook's `queryFn` calls `apiFetch('/api/v1/songs', ...)` which is matched by the SW rule. Offline reads fall back to the SW cache, then to the TanStack persister cache.
- **AR-39 (line 177):** errors during list fetch fall through TanStack's retry layer; persistent failure does NOT surface a banner in this story (banner-on-MacBook is a future polish per architecture line 292). Story 2.4's stale-write banner is unrelated.
- **AR-45 (line 185):** UI consumes hooks; never imports `sync/outbox.ts` directly. Story 2.5 follows: `library.tsx` consumes `useSongs()`; `library-song-row.tsx` is a pure render component; neither touches the outbox.
- **AR-47 (line 189):** NanoID 16-char URL-safe. Songs created in Story 2.6 will use this; Story 2.5 just reads existing songIds and embeds them in route hrefs. No ID generation in this story.
- **UX-DR1 (line 196):** atmosphere tokens via `tokens.css` `@theme` blocks. The Library uses `var(--color-*)`, `var(--text-*)`, `var(--font-*)`, `var(--spacing-*)` everywhere — never hex values, never px literals.
- **UX-DR4 (line 202):** the `SongRow (library)` component is one of the 12 named components. Title only, quiet treatment. No row actions, no annotation subline (that's the Setlist variant from Story 3.3).
- **UX-DR6 (line 206):** accessibility primitives — tap-target `min-h-tap`/`min-w-tap`; visible text is the accessible name (no `aria-label` overrides on the row links); focus order = DOM order; `prefers-reduced-motion` already enforced in `globals.css` from Story 1.2.
- **UX-DR7 (line 208):** voice & tone — `+ New song` is the locked string; lives in `microcopy.ts` `ACTIONS.newSong`. No exclamation, no emoji, no encouragement.
- **CLAUDE.md boundaries:**
  - `web` ↔ `api`: HTTP only via `/api/v1/*` — Story 2.5 adds `GET /api/v1/songs` to the client's outbound surface. Server endpoint is from Story 2.3; no API changes in this story.
  - `web` ↔ `shared`: types + Zod schemas only. Story 2.5 imports `ACTIVE_BAND_ID`, `Song`, `SongSchema`, `OkResponseSchema` from `@gigbuddy/shared`. No new shared exports.
  - React Router 7: import from `react-router`, NOT `react-router-dom`. Use `Link`, `useNavigate`, `MemoryRouter` (tests) — all from `react-router`.

**Patterns to reuse:**

- **Hoisted vi.mock factory** (`web/src/components/reauth-banner.test.tsx:7-11`, `web/src/sync/stale-write-banner.test.tsx`): use `vi.hoisted` + `vi.mock` for the `useSongs` mock in `library.test.tsx`. Don't try to use Vitest's auto-mock — the factory-based approach is the established convention.
- **Fresh QueryClient per test** (`web/src/sync/flusher.test.ts`): construct a `new QueryClient()` per case for hook tests; do NOT reuse the singleton from `sync/query-client.tsx` (the singleton has the IDB persister attached and pollutes unrelated tests).
- **Empty-state microcopy via `EMPTY_STATES`** (`web/src/routes/home.tsx`, `web/src/routes/library.tsx`): import the constant, do not inline the string. Story 2.5 adds the parallel `ACTIONS` constant for the `+ New song` text.
- **Heading + section structure** (`web/src/routes/home.tsx:11-12`, `web/src/routes/library.tsx`): `<section aria-labelledby="<id>-heading">` + `<h1 id="<id>-heading" className="sr-only">`. Preserved unchanged in Story 2.5.
- **`<Link>` whole-row tap target** (`web/src/components/bottom-tabs.tsx:16-29`): the row IS the link; min-h-tap on the link element; no extra wrapper. The Library row mirrors this pattern.

### Library and framework requirements (do NOT substitute)

- **`@tanstack/react-query` (^5.59.0 resolved to 5.101.0)** — already installed (Story 2.4). Use `useQuery` for the read; the hook contract returns `UseQueryResult<Song[], Error>`.
- **`react-router` (^7.0.0)** — already installed. Import `Link` for navigation; `MemoryRouter` for tests. Do NOT import from `react-router-dom`.
- **`zod` (^3.23.0)** — already installed. Compose `OkResponseSchema(z.array(SongSchema))` at the call site in `web/src/api/songs.ts`; no new shared schema exports.
- **`@gigbuddy/shared`** — already wired. Import `ACTIVE_BAND_ID`, `Song`, `SongSchema`, `OkResponseSchema` from this package. These all exist from Story 2.3.
- **`@testing-library/react` (^16.1.0)** — already installed. Use `render`, `renderHook`, `screen`, `waitFor`, `act`. The `renderHook` API requires a wrapper for hooks that need a Provider (the QueryClient wrapper in `use-songs.test.tsx`).
- **`@testing-library/jest-dom`** — already installed. `toHaveAttribute`, `toHaveTextContent`, `toHaveClass` are the assertions used.
- **NO new dependencies.** If you reach for one, the task is already solved by the above. Specifically: no `@tanstack/react-virtual` (Sandy's library is small; flat list is fine), no `react-router-dom` (wrong package), no skeleton-loader library (the sr-only loading text is the V1 floor).
- **NO new shared exports.** All schemas needed are already in `@gigbuddy/shared`. The list-response schema is composed at the call site per Story 2.4's flusher precedent.

### What this story does NOT include (anti-scope-creep)

These appear nearby in the architecture/epics but are owned by other stories. **Do not scaffold:**

- **Song Detail surface at `/songs/:songId` and `/songs/new`** (FR-1, FR-3, FR-5, Story 2.6): Story 2.6. Story 2.5 emits `<Link>` elements with the correct hrefs, but does NOT register `/songs/:songId` or `/songs/new` routes in `router.tsx`. Story 2.6 owns the route registration AND the `<SongDetail>` component.
- **`useSong(songId)` hook** (Story 2.6): per-record query. Story 2.5 only ships `useSongs()` (the list query).
- **`useSongMutation()` hook** (Story 2.6): write path. Story 2.5 is read-only.
- **`InlineEditField` component** (FR-2, Story 2.6): inline edit primitive. Not used in Story 2.5.
- **Chord chart rendering** (FR-5, UX-DR5, Story 2.6): chord chart parsing + URL tappability. Library rows show title only.
- **Library footer `Export all data` affordance** (FR-33, Story 5.1): MacBook-only export trigger. Lives below the song list. Story 5.1 owns it.
- **Search / filter inside the Library** (V2): not in V1 scope. The full list renders flat.
- **Pagination / infinite scroll** (V2): Sandy's library is small (under ~200 songs). One render of the whole list is fine. The server endpoint is unbounded scan (deferred to a future hardening pass per `deferred-work.md` 2.3 review).
- **Drag-reorder of Library rows** (V2): rows have no drag handle. Drag is a Setlist concept (FR-12, Story 3.6) — not applicable to Library.
- **Per-song metadata in the row** (`Key`, `Patch`, etc.) — explicitly excluded per AC ("no key, no patch, no annotation"). Library rows are title-only; metadata is visible only on Song Detail (Story 2.6).
- **Setlist-row variant of the Song row** (Story 3.3): adds per-gig annotation subline + MacBook drag handle. Out of scope. The file ownership is clean — Story 2.5 creates `library-song-row.tsx`; Story 3.3 will create `setlist-song-row.tsx` (or a shared `song-row.tsx` with both variants — pick at that time, NOT now).
- **`useOutboxStatus()` hook** (architecture line 725): not owned by any V1 story. Out of scope here.
- **List-fetch persistent-failure banner** (architecture line 292): deferred polish. Story 2.4's stale-write banner is a DIFFERENT banner (per-record dropped-as-stale). The Library does not surface fetch errors as banners in V1.
- **Visible page title `Library` on the page chrome (not just sr-only)** — out of scope. The h1 stays sr-only per Story 1.5's pattern. If a future UX pass wants a visible title, that's a separate story.
- **Atmosphere assertion at the unit-test layer** — jsdom doesn't apply `[data-atmosphere="..."]` selectors; the contract is structural (uses tokens). Visual correctness is Sandy's manual smoke (Task 9).
- **Skeleton loaders / shimmer placeholders** — V1 floor is the sr-only loading text. Do not introduce a skeleton library or hand-roll skeleton rows.

If you find yourself wanting to scaffold any of the above, **don't**.

### Existing files this story modifies — current state and what changes

#### `web/src/routes/library.tsx` (Task 5)

**Current state (Story 1.5 / Story 2.4 baseline):** Renders a `<section aria-labelledby="library-heading">` with a sr-only `<h1>Library</h1>` and a single `<p>` showing `EMPTY_STATES.noSongsInLibrary`. No data fetching, no list, no `+ New song` link, no row affordances. The Library route is registered in `router.tsx` at `/library` and protected by `<RequireAuth>` (Story 1.5).

**This story changes:** Replaces the static empty state with a `useSongs()`-driven branch. Adds a `+ New song` `<Link>` at the top. Adds three render branches: loading (sr-only text), populated (list of `<LibrarySongRow>`s), empty (existing copy). The accessible-heading + section structure is preserved unchanged.

**Must preserve:** The `<section aria-labelledby="library-heading">` + `<h1 id="library-heading" className="sr-only">Library</h1>` structure. The `EMPTY_STATES.noSongsInLibrary` constant (now consumed via the empty branch, not as the sole content).

#### `web/src/routes/library.test.tsx` (Task 6)

**Current state:** Three test cases:
1. `renders the locked empty-state copy from EMPTY_STATES` — passes against the static Story 1.5 implementation.
2. `renders no row affordances — no buttons, no links (AC-5)` — passes because Story 1.5 renders nothing tappable. **This case becomes incorrect under Story 2.5** — the `+ New song` link is a link by design.
3. `exposes a Library h1 to the accessibility tree` — passes; preserved verbatim.

**This story changes:** Removes case 2. Updates case 1 to mock `useSongs` returning `[]` (the empty state is now conditional). Adds new cases for populated, loading, `+ New song` visible in both states, no `aria-label` overrides on row links (per AC-11).

**Must preserve:** Case 3 (h1 accessibility) verbatim — including the mock of `useSongs` returning `{ data: [], isLoading: false }` to reproduce the empty path.

#### `web/src/lib/microcopy.ts` (Task 4)

**Current state (Story 2.4 baseline):** Exports `EMPTY_STATES = { noUpcomingGigs, noSongsInLibrary }` and `BANNERS = { staleWrite, errorBoundary }` as locked-string `as const` objects.

**This story changes:** APPENDS a new constant `ACTIONS = { newSong: '+ New song' } as const`. Updates the file header comment to include `ACTIONS` as the third locked surface.

**Must preserve:** `EMPTY_STATES` and `BANNERS` exactly as-is. The file header voice-and-tone rules.

### Existing files this story DOES NOT touch (regression safety)

- `web/src/router.tsx` — Library route is already registered at `/library`; the `/songs/:songId` and `/songs/new` routes are owned by Story 2.6. Story 2.5 does NOT add them.
- `web/src/components/bottom-tabs.tsx` — the `Library` tab is already wired to navigate to `/library` (from Story 1.5). Its active-state highlight already works.
- `web/src/components/top-nav.tsx` — the MacBook `Library` link is already wired. The `rightActions` slot is reserved for Story 3.4's `+ New setlist` button; Story 2.5 does NOT mount `+ New song` here (that affordance is page-local on the Library route per AC-4).
- `web/src/routes/authenticated-shell.tsx` — Story 2.4 already mounted `<StaleWriteBanner />` next to `<ReauthBanner />`. Story 2.5 does NOT touch the shell.
- `web/src/sync/*` — Story 2.4's sync layer (queryClient, persister, outbox, flusher, banners) is unchanged. Story 2.5 consumes it via the hook.
- `web/src/api/client.ts` — Story 2.4's fetch wrapper is unchanged. Story 2.5's `songs.ts` uses it without changes.
- `web/src/cache/idb.ts`, `web/src/sync/query-client.tsx` — the singleton QueryClient + IDB persister are owned by Story 2.4. Story 2.5 does NOT construct another QueryClient (except in tests, with the per-test fresh-client pattern documented above).
- `api/**` — Story 2.3 already shipped `GET /api/v1/songs`. The server-side alphabetization is unchanged. Story 2.5 is web-only.
- `shared/**` — no schema changes; the `OkResponseSchema(z.array(SongSchema))` is composed at the client call site.
- `infra/**`, `e2e/**` — no changes. The user-visible end-to-end flow (browse + tap + edit + save) is verified by Sandy on-device; Playwright E2E for the Library is deferred (no story owns it in V1).
- `web/vite.config.ts` — no SW config changes. `GET /api/v1/songs` is already covered by Story 2.1's `NetworkFirst` rule.
- `web/src/main.tsx`, `web/src/app-bootstrap.tsx` — boot sequence is unchanged.
- `web/src/styles/*` — no token additions. The Library uses existing `tokens.css` variables.
- `web/src/performance/*`, `web/src/lib/error-reporter.ts`, `web/src/lib/atmosphere.ts`, `web/src/lib/platform.ts`, `web/src/lib/band.ts` — all unchanged.
- `web/src/auth/*` — unchanged. The Library is protected by `<RequireAuth>` (Story 1.5) which Story 2.5 does NOT modify.
- `web/src/components/{band-label,error-boundary,reauth-banner}.tsx` and their tests — unchanged.

### Previous story intelligence (relevant per-story learnings)

From the **Epic 1 retrospective** (`_bmad-output/implementation-artifacts/epic-1-retro-2026-06-15.md`):

- **Lesson #1 — Human-required steps must be explicit unchecked task checkboxes.** Task 9 above captures Sandy's manual smoke (browser open + DevTools IDB inspection). It is unchecked; the story is NOT done until verified.
- **Lesson #3 — New directories add to Biome + tsconfig in the same commit.** Story 2.5 adds `web/src/hooks/use-songs.ts` and `web/src/api/songs.ts`. Both directories already exist (`hooks/` was created in Story 1.5 with `use-chrome-visible.ts`; `api/` was created in Story 2.4 with `client.ts`). Both are covered by `web/src/**` Biome globs and `web/tsconfig.json` `include` paths. **No tsconfig / Biome changes required.**
- **Lesson #4 — End-to-end behavioral paths need integration test coverage.** The AC-8 cache-invalidation test exercises the end-to-end path (cache write → hook re-renders → list updates), preventing a future regression where the Library doesn't update after Story 2.6's `useSongMutation()` writes.

From **Story 2.4** (commit `29be85b`, status `done`):

- **QueryClient is a singleton in `web/src/sync/query-client.tsx`** with IDB persister attached. Production code consumes the singleton via the `<SyncProvider>` mounted in `main.tsx`. Test code constructs fresh `QueryClient`s per case (pattern in `flusher.test.ts`).
- **The flusher's `routeForRecordKey()` documents the queryKey contract:** per-song key is `['song', bandId, songId]`; list key is `['songs', bandId]`. The two namespaces are intentionally separate (see `web/src/sync/flusher.ts:31-35`). Story 2.5 uses the list key; Story 2.6 uses both.
- **`apiFetch` from `web/src/api/client.ts`** is the canonical fetch wrapper. It returns `{ status, data, wasNetworkSuccess }`. The `data` is the Zod-parsed response body. For Story 2.5's list call, the envelope is `OkResponseSchema(z.array(SongSchema))` so `response.data.data` is the unwrapped array.
- **Stale-write banner subsystem** (`<StaleWriteBanner>` in `web/src/routes/authenticated-shell.tsx`) is mounted globally. Story 2.5 does NOT trigger it (no writes); Story 2.6 will (via `useSongMutation()` → outbox → flusher → `dropped-as-stale` → `setStaleNotice`).
- **Error reporter (`startErrorReporter()`)** is wired at boot. Any uncaught render error in `library.tsx` would be caught by `<ErrorBoundary>` (in `main.tsx`) and reported to `/api/v1/client-errors`. Story 2.5 should NOT add per-route error boundaries — the root one handles it.
- **`fake-indexeddb/auto`** is required for tests that touch the IDB persister. Story 2.5's tests do NOT touch the persister (the per-test fresh `QueryClient` has no persister attached), so no `fake-indexeddb` import is needed in `use-songs.test.tsx` / `library.test.tsx`.

From **Story 2.3** (commit `b06aea0`, status `done`):

- **`ACTIVE_BAND_ID`** is in `@gigbuddy/shared` (`shared/src/active-band.ts`). Import directly from `@gigbuddy/shared` — NOT from `web/src/lib/band.ts` (which only re-exports `ACTIVE_BAND_NAME`). This rule from Story 2.4 dev notes carries forward.
- **`GET /api/v1/songs`** returns `{ status: 'ok', data: Song[] }` — alphabetized server-side via `localeCompare(b.title, 'en', { sensitivity: 'base' })`. Client must NOT re-sort.
- **`x-server-now` header** is on every response (from `api/src/middleware/server-now.ts`). The fetch wrapper uses it to detect network success; Story 2.5's tests must include the header on stubbed `Response` objects.
- **`SongSchema`** allows empty-string `title` (deferred from 2.3 review). Story 2.6 enforces non-empty title at the form layer; Story 2.5 is read-side so it renders whatever the API returns. An empty-title row would render an empty `<Link>` — accept the V1 floor.
- **`POST /api/v1/client-errors`** returns 204 No Content. Not used in Story 2.5 (no error-reporter writes in this story).

From **Story 2.2** (commit `5db5b6b`, status `done`):

- **iPhone PWA install gate** routes pre-install iPhone visitors to `/install-instructions` before any auth check. By the time the Library route renders on iPhone, the user is post-install AND post-auth. No platform-detect changes in Story 2.5.

From **Story 1.5** (commit `2a7d4ae`, status `done`):

- **`<AuthenticatedShell>`** wraps every authenticated route, including `/library`. It mounts `<ReauthBanner />`, `<StaleWriteBanner />`, `<TopNav>` (MacBook) / `<BottomTabs>` (iPhone). Story 2.5 does NOT modify the shell — it only changes what `<Outlet>` renders inside it.
- **Empty-state pattern** (`web/src/routes/home.tsx`, `web/src/routes/library.tsx`): import `EMPTY_STATES`; render a `<p>` with the locked copy. Story 2.5 preserves this for the empty branch and adds `ACTIONS` for the new affordance.
- **`useChromeVisible()`** is the hook the shell uses to hide chrome in Performance Mode. Story 2.5 does NOT touch it.

From **Story 1.4** (commit `7384bc6`, status `done`):

- **`gigbuddy_session` cookie** is HttpOnly/Secure/SameSite=Strict/365d. `apiFetch`'s `credentials: 'same-origin'` inherits it. The list call automatically sends the cookie; no manual handling.
- **401 on the list call** (e.g., cookie expired): the fetch wrapper dispatches the unauthorized handler (Story 2.4's `SyncWiring` registered it). The router re-renders, `<RequireAuth>` redirects to `/login`. Story 2.5's list query throws (the wrapper returns `{ status: 401, data: undefined, wasNetworkSuccess: true }` — `data.data` is `undefined`, so the hook propagates an error). TanStack Query's retry handles it; the user lands on `/login` mid-flight. The Library re-renders post-login.

### Implementation patterns reused from architecture

- **TanStack Query for server data** (architecture line 720): one `QueryClient` instance per app (already established); per-resource hooks. `useSongs` is the per-resource hook for the list namespace.
- **`<Link>` for navigation** (architecture line 1031): URL is the truth. Story 2.5 emits `<Link to="/songs/:songId">` for row navigation and `<Link to="/songs/new">` for the affordance. No imperative `useNavigate()` calls in this story.
- **CSS variables for atmosphere** (architecture lines 731–738): components consume `var(--color-*)`, never hex values. The atmosphere is fixed at boot via `applyBootAtmosphere()`. No JS theme provider.
- **Tap-target tokens** (architecture line 830): `min-w-tap`, `min-h-tap` on every tappable element. Story 2.5: row links and the `+ New song` link both carry `min-h-tap`.
- **Composed Zod envelope at the call site** (Story 2.4 precedent): `OkResponseSchema(z.array(SongSchema))` composed inside `web/src/api/songs.ts`. No new `shared` exports needed.
- **Hoisted vi.mock factories** (Story 2.4 test patterns): `vi.hoisted(() => ({ useSongsMock: vi.fn() }))` + `vi.mock('../hooks/use-songs.js', () => ({ useSongs: useSongsMock }))`. Reset in `beforeEach`.

### Latest tech information (versions verified at story-write time, 2026-06-17)

- **`@tanstack/react-query` 5.101.0** (resolved across the workspace) — `useQuery` API is stable. The default `staleTime: 0` + `refetchOnWindowFocus: true` give the "render cached data immediately, refresh on focus" semantic Story 2.5 wants.
- **`react-router` 7.x** (existing) — `Link`, `MemoryRouter`, `useNavigate` import from `react-router` (the v7 package). Do NOT import from `react-router-dom` (the v6 package name, no longer used in the workspace per CLAUDE.md).
- **`zod` 3.23.x** (existing) — `z.array`, `z.infer` are stable. `OkResponseSchema` is a factory that takes a `z.ZodTypeAny`; passing `z.array(SongSchema)` returns a schema parsing `{ status: 'ok', data: Song[] }`.
- **React 19.x** (existing) — `useSyncExternalStore`, function components with conditional rendering, the `key` prop for list items. No new React APIs needed.
- **TypeScript 5.6 strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`** (existing) — the `data === undefined` guards in `library.tsx` satisfy `noUncheckedIndexedAccess`. The `useSongs()` return shape is typed via TanStack's `UseQueryResult<Song[], Error>` — the `data` field is `Song[] | undefined` until the query resolves.

### Files this story creates

- `web/src/api/songs.ts` — `listSongs()`
- `web/src/api/songs.test.ts`
- `web/src/hooks/use-songs.ts` — `useSongs()`
- `web/src/hooks/use-songs.test.tsx`
- `web/src/components/library-song-row.tsx` — `<LibrarySongRow>`
- `web/src/components/library-song-row.test.tsx`

### Files this story modifies

- `web/src/routes/library.tsx` — replaces the static empty state with the `useSongs()`-driven branch
- `web/src/routes/library.test.tsx` — removes the legacy "no affordances" assertion; adds populated / loading / `+ New song` / no-aria-label cases
- `web/src/lib/microcopy.ts` — appends `ACTIONS = { newSong: '+ New song' }`

### Files this story deletes

None.

### Project Structure Notes

- **Aligned with the architecture's directory tree** (architecture.md lines 877–914):
  - `web/src/routes/library.tsx` — present at line 863 (`library.tsx # Library list (FR-4)`). Story 2.5 updates it.
  - `web/src/api/songs.ts` — present at line 899 (`songs.ts`). Story 2.5 lands the `listSongs()` function; Story 2.6 adds `getSong(songId)` for the per-record hook.
  - `web/src/hooks/use-songs.ts` — NEW file. The architecture lists `use-song.ts` (singular) at line 903; the plural-form list hook is added by this story. Story 2.6 adds `use-song.ts` (singular). Both files live in the same `hooks/` directory.
  - `web/src/components/library-song-row.tsx` — the architecture lists `song-row.tsx` (single file) at line 871. Story 2.5 lands the Library variant in a dedicated file (`library-song-row.tsx`); Story 3.3 will land the Setlist variant. **Architecture deviation acknowledged:** the file split is cleaner than a single `song-row.tsx` with two exports. If a future cleanup pass wants to consolidate, do it then — not in Story 2.5.

- **New files in subdirectories:**
  - `web/src/hooks/` already exists (from Story 1.5's `use-chrome-visible.ts`). No new directory.
  - `web/src/api/` already exists (from Story 2.4's `client.ts`). No new directory.
  - `web/src/components/` already exists. No new directory.

- **No Biome / tsconfig changes required** — all new files live under already-covered globs (`web/src/**`).

### Testing requirements

- **Unit / component (Vitest, web package):**
  - `web/src/api/songs.test.ts` — ~3 cases (AC-1)
  - `web/src/hooks/use-songs.test.tsx` — ~3 cases (AC-2) + 1 cache-invalidation case (AC-8)
  - `web/src/components/library-song-row.test.tsx` — ~4 cases (AC-3)
  - `web/src/routes/library.test.tsx` — ~6 cases (AC-6, AC-9, AC-11), removing 1 legacy case → net +5

  Expected delta: ~+15 to +17 tests. Web test count goes from 146 → ~161–163.

- **E2E (Playwright):** no new cases. The user-visible end-to-end (browse + tap + see Song Detail) requires Story 2.6 to land first. Deferred to Story 2.6 or a later E2E pass.

- **Manual smoke (Task 9):** Sandy verifies on MacBook + iPhone post-deploy. Unchecked checkbox per Epic 1 retro Lesson #1.

### Dev environment reminders

- **Local dev:** `pnpm dev` runs `dev:web` (Vite at `localhost:5273`) + `dev:api` (Hono via `tsx watch` at `localhost:3100`). The web proxy in `vite.config.ts` forwards `/api/*` to the API. To populate the local Library, you'll need to PUT a Song manually via curl or DevTools: `curl -X PUT -b "gigbuddy_session=<cookie>" -H "content-type: application/json" -d '{"bandId":"jr5","songId":"abc","title":"Test","clientWrittenAt":"2026-06-17T12:00:00.000Z","version":1}' http://localhost:3100/api/v1/songs/abc`. (Story 2.6's `useSongMutation()` will replace this manual step.)
- **Auth cookie locally:** `POST /api/v1/auth/login { password: "<bootstrap password>" }` sets the cookie. `apiFetch`'s `credentials: 'same-origin'` inherits it.
- **Cache reset during dev:** if the persisted IDB cache holds stale data after a `vite.config.ts` change, clear it via DevTools → Application → IndexedDB → delete `gigbuddy-query-cache`. Or bump the `buster` field in `web/src/sync/query-client.tsx` (currently `'v1'`).
- **React Router v7 warning:** the router warns about future-flag opt-ins (`v7_startTransition`, etc.). Ignore — the codebase is already on v7. The warnings are leftover from upstream tooling defaults.
- **Vitest fake-indexeddb leakage:** if a previous test file imported `fake-indexeddb/auto`, the shim persists across files in the same Vitest worker. This is fine for Story 2.5 (the per-test fresh QueryClient has no persister, so the shim is unused). No action needed.
- **Node 22, pnpm 11.0.9** — pinned. Do not bump.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#State management taxonomy] (lines 718–731) — TanStack Query for server data; the per-resource hook contract.
- [Source: _bmad-output/planning-artifacts/architecture.md#Outbox state machine (client side)] (lines 590–623) — the queryKey contract for the list namespace (`['songs', bandId]`) vs the per-song namespace (`['song', bandId, songId]`); referenced from `web/src/sync/flusher.ts:31`.
- [Source: _bmad-output/planning-artifacts/architecture.md#Service worker strategy table] (lines 677–690) — `GET /api/v1/songs/*` is NetworkFirst → `api-cache-v1`; the SW handles offline reads; the TanStack persister handles longer-term caching.
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules] (lines 469–836) — naming conventions, response envelopes, error handling rules, accessibility primitives, atmosphere tokens.
- [Source: _bmad-output/planning-artifacts/architecture.md#Directory tree] (lines 840–1015) — `web/src/routes/library.tsx`, `web/src/api/songs.ts`, `web/src/hooks/`, `web/src/components/`.
- [Source: _bmad-output/planning-artifacts/architecture.md#Requirements → structure mapping] (lines 1089–1102) — Song Library lives in `web/src/routes/library.tsx`, `song-detail.tsx`; `api/src/routes/songs.ts`; `shared/src/schemas/song.ts`.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5] (lines 857–906) — verbatim AC text.
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2] (lines 269–283) — epic objectives; key FRs/NFRs/ARs.
- [Source: _bmad-output/planning-artifacts/epics.md#FR-4] (line 26) — alphabetical Library list.
- [Source: _bmad-output/planning-artifacts/epics.md#FR-1] (line 23) — create a Song with a title.
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR4] (line 202) — the `SongRow (library)` component spec.
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR6] (line 206) — accessibility implementation primitives.
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md#Component Patterns] (line 95) — `Song row (library)` behavioral rules: title only, tap → song detail, no row actions.
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md#State Patterns] (line 112) — empty Library state copy: "No songs in this library yet." No CTA in V1 (deliberately diverged by Story 2.5 to satisfy FR-1).
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md#Routing rules] (lines 61–67) — "Tap a song row from any source always lands on song detail."
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md#Components] (line 197) — `Song row (library)` visual treatment: title only, in serif body, quiet treatment.
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md#Typography] (lines 115–146) — editorial serif for titles; type scale floor (18pt iPhone, 17–18pt MacBook).
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md#Layout & Spacing] (lines 147–172) — 4pt base unit; single-column vertical layout; MacBook max-width ~960pt.
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-06-15.md] — Lesson #1 (manual checkbox), Lesson #4 (integration test coverage).
- [Source: _bmad-output/implementation-artifacts/2-4-sync-layer-foundation-client-error-reporter.md] — Story 2.4 contract: QueryClient singleton, `apiFetch`, flusher's queryKey contract.
- [Source: _bmad-output/implementation-artifacts/2-3-song-api-ddb-persistence-client-errors-endpoint.md] — `GET /api/v1/songs` server contract; `x-server-now` middleware; alphabetization.
- [Source: _bmad-output/implementation-artifacts/2-2-iphone-pwa-install-gate.md] — install gate; `isStandalone()`.
- [Source: _bmad-output/implementation-artifacts/1-5-navigation-chrome-scaffold.md] — `<AuthenticatedShell>`, `<RequireAuth>`, the empty-state pattern.
- [Source: _bmad-output/implementation-artifacts/1-2-design-system-foundation-tokens-typography-atmospheres.md] — atmosphere tokens, `--spacing-tap`, type scale.
- [Source: web/src/sync/flusher.ts] (lines 31–55) — queryKey contract for songs vs the per-song key.
- [Source: web/src/sync/query-client.tsx] — the SyncProvider singleton; the IDB persister; `buster: 'v1'`.
- [Source: web/src/api/client.ts] — `apiFetch` contract; envelope schema as a per-call parameter; the `x-server-now` network-success signal.
- [Source: web/src/lib/microcopy.ts] — `EMPTY_STATES`, `BANNERS` pattern; Story 2.5 adds `ACTIONS`.
- [Source: web/src/routes/library.tsx] — existing empty-state baseline (Story 1.5).
- [Source: web/src/routes/library.test.tsx] — existing test cases (Story 1.5).
- [Source: web/src/components/bottom-tabs.tsx] — pattern for `<Link>` whole-row tap-target with `min-h-tap`.
- [Source: web/src/components/reauth-banner.test.tsx] — hoisted-vi.mock factory pattern.
- [Source: web/src/sync/flusher.test.ts] — per-test fresh `QueryClient` pattern.
- [Source: shared/src/schemas/song.ts] — `SongSchema`, `Song` type.
- [Source: shared/src/schemas/api.ts] — `OkResponseSchema` factory.
- [Source: shared/src/active-band.ts] — `ACTIVE_BAND_ID`, `ACTIVE_BAND_NAME`.
- [Source: CLAUDE.md] — boundaries; Zod single source of truth; React Router 7 imports from `react-router` not `react-router-dom`.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) via Claude Code bmad-dev-story workflow.

### Debug Log References

- `pnpm exec vitest run src/api/songs.test.ts` — 3 tests passed.
- `pnpm exec vitest run src/hooks/use-songs.test.tsx` — 4 tests passed (3 hook + 1 AC-8 cache invalidation).
- `pnpm exec vitest run src/components/library-song-row.test.tsx` — 4 tests passed.
- `pnpm exec vitest run src/routes/library.test.tsx` — 7 tests passed.
- `pnpm typecheck` — initially failed on a pre-existing Story 2.4 bug (`maxAge` on `createAsyncStoragePersister`, which the persister's options type doesn't accept). The `maxAge` field was silently ignored at runtime (the comment in the file even notes "no TTL of its own — invalidation is owned by the `buster` field"). Removed the stray field to unblock Story 2.5's AC-10 typecheck contract; confirmed pre-existing by stash-popping. Post-fix: all 5 packages typecheck clean.
- `pnpm lint` — initially flagged two import-sort issues introduced by my new files; `pnpm lint:fix` auto-corrected. Final lint is clean.
- `pnpm test` — 161 web tests passed (was 146, +15) + 73 api passed.
- `pnpm build:web` — green; bundle deltas marginal (no new dependencies).

### Completion Notes List

- All five new modules land per spec: `web/src/api/songs.ts` (`listSongs`), `web/src/hooks/use-songs.ts` (`useSongs`), `web/src/components/library-song-row.tsx` (`LibrarySongRow`), `web/src/lib/microcopy.ts` (appended `ACTIONS`), and `web/src/routes/library.tsx` (consumes `useSongs` and renders three branches with the `+ New song` affordance visible in all of them).
- The `+ New song` link uses the spec's reference styling (color shift to `--color-accent-strong` on hover/focus-visible) rather than an underline, matching the existing `--color-accent-strong` token in `tokens.css`.
- The `LibrarySongRow` uses `flex min-h-tap items-center` (mirroring `bottom-tabs.tsx`) instead of `block`. Both satisfy the structural contract (`min-h-tap` utility + vertical padding); the flex variant vertically centers the title inside the 44pt tap target, which matches the repo's established whole-row-link pattern.
- The AC-8 cache-invalidation integration test lives in `web/src/hooks/use-songs.test.tsx` (separate `describe` block). `library.test.tsx` has `vi.mock` on `useSongs`, so the cache test had to live elsewhere to exercise the real hook against a `QueryClientProvider`. The test renders the actual `Library` component to prove the end-to-end "cache write → list re-renders" contract Story 2.6's `useSongMutation()` will rely on.
- The hook tests construct a fresh `QueryClient` per case with `retry: false` so a transient parse-error path during a test doesn't fan out into multiple exponential-backoff retries inside the test runner — the SyncProvider singleton stays untouched.
- **Story 2.4 pre-existing bug fixed:** `web/src/sync/query-client.tsx` had a stray `maxAge: Infinity` on the `createAsyncStoragePersister` options that broke `pnpm typecheck`. The field was silently ignored at runtime — removed it to clear the typecheck contract on AC-10. This is a one-line fix; no behavioral change. Flagging for Sandy's awareness; recommend the Story 2.4 retro / next sprint note this so the architecture's "tsc must stay green" gate is enforced going forward.
- Task 9 (human-required manual smoke) intentionally stays unchecked per AC-10 / Epic 1 retro Lesson #1 — Sandy verifies on MacBook + iPhone post-deploy.

### File List

**Created (6):**

- `web/src/api/songs.ts`
- `web/src/api/songs.test.ts`
- `web/src/hooks/use-songs.ts`
- `web/src/hooks/use-songs.test.tsx`
- `web/src/components/library-song-row.tsx`
- `web/src/components/library-song-row.test.tsx`

**Modified (4):**

- `web/src/lib/microcopy.ts` — appended `ACTIONS` constant + updated header comment.
- `web/src/routes/library.tsx` — replaced the static empty state with `useSongs()`-driven branches plus the `+ New song` affordance.
- `web/src/routes/library.test.tsx` — removed the legacy "no affordances" assertion; added hoisted `useSongsMock` + populated / empty / loading / heading / aria / new-song-tap-target cases.
- `web/src/sync/query-client.tsx` — removed stray `maxAge: Infinity` from `createAsyncStoragePersister` options (pre-existing Story 2.4 typecheck bug; no behavioral change).

**Modified — sprint tracking:**

- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `2-5-library-list-surface: ready-for-dev → in-progress → review`.
- `_bmad-output/implementation-artifacts/2-5-library-list-surface.md` — Status, task checkboxes, Dev Agent Record, File List, Change Log.

## Change Log

| Date       | Change                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------- |
| 2026-06-17 | Story spec created (status: ready-for-dev). Builds on Story 2.4 (sync layer foundation) and Story 2.3 (server-side `GET /api/v1/songs`). Lands the first read-side proof of the sync layer: a Library route that lists the active Band's Songs alphabetically (server-sorted), with tap navigation to `/songs/:songId` (Story 2.6 wires the destination) and a page-local `+ New song` affordance to `/songs/new` (also Story 2.6). All branches (loading / populated / empty) render the affordance so Sandy can always reach Song creation. Adds `useSongs()` hook keyed on `['songs', ACTIVE_BAND_ID]`, `listSongs()` API call, `<LibrarySongRow>` row component, and `ACTIONS.newSong` microcopy constant. |
| 2026-06-17 | Implementation complete (status: review). All eight code tasks landed per spec; +15 web tests (146 → 161); `pnpm typecheck` / `lint` / `test` / `build:web` all green; no new dependencies. Also fixed a one-line pre-existing Story 2.4 typecheck bug (`maxAge` on `createAsyncStoragePersister` — silently ignored at runtime; removed to clear AC-10). Task 9 (human-required manual smoke) intentionally unchecked pending Sandy's MacBook + iPhone verification post-deploy. |
