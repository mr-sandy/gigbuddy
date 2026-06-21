---
baseline_commit: "6622390"
builds_on: 3-6-drag-reorder-on-macbook
---

# Story 4.1: Performance Mode entry + Card layout + single-tap navigation (FR-15, FR-16, FR-17)

Status: review

## Story

As Sandy,
I want a single tap on `Start performance ›` to enter Performance Mode with the first Song's Performance Card already rendered and single-tap `NEXT ›` / `‹` navigation that traverses Section boundaries,
so that on a gig night I can land on the first song and move through the set with one finger between songs.

## Acceptance Criteria

**AC-1 — Entry: synchronous prefetch + context + navigation**

**Given** the iPhone Setlist overview (`setlist-overview.tsx`) with a Setlist that has at least one Song in at least one non-empty Section
**When** Sandy taps the bottom-fixed `Start performance ›` CTA
**Then** `onStartPerformance(setlistId)` runs (the function returned by the `useStartPerformance()` hook) and performs, in order:
  1. Awaits `queryClient.prefetchQuery` for the Setlist AND for every Song referenced by the Setlist (per AR-25)
  2. Calls `wakeLock.acquire()` — a stub that resolves cleanly is acceptable if Story 4.2 has not yet shipped; the import path `web/src/performance/wake-lock.ts` must be present and exportable even if the stub body is a no-op
  3. Calls `PerformanceModeContext.setActive(true)` so `useChromeVisible()` returns false and the bottom tab bar disappears
  4. Navigates the router to `/performance/:setlistId/:songIndex` where `:songIndex` is the flat index of the first Song in the first non-empty Section across all Sections in Setlist order
**And** the wall-clock time from tap to Performance Card visible is < 300ms on a warm cache (NFR-2)

**AC-2 — Entry guard: empty Setlist**

**Given** the iPhone Setlist overview with a Setlist whose every Section has zero Songs
**When** Sandy taps `Start performance ›`
**Then** the button is disabled (via `disabled` attribute) so the tap produces no observable action
**And** no navigation occurs, no `setActive(true)` runs, no prefetch fires

**AC-3 — Performance Card: three-region layout**

**Given** the `/performance/:setlistId/:songIndex` route is mounted
**When** the route renders with a valid Setlist and a valid songIndex
**Then** the `<html>` element carries `data-atmosphere="performance"` (Club Warm palette: bg `#1a1209`, surface `#241910`, text-primary `#f1e6cf`, text-secondary `#c9b486`, accent `#e6b855`)
**And** the layout has three regions per FR-16 / UX-DR4:
  - **Fixed top chrome** (does NOT scroll): Song title at `--text-perf-title` (36px) in `--font-serif-editorial`; below it, Key in `--text-perf-meta` (22px) in `--font-mono-slab` + Patch in `--text-perf-meta` mono; all on `--color-surface` background
  - **Scrollable middle**: chord chart rendered per the `ChordChart` component from Story 2.6 (mono-slab, `{...}` lines as section breaks, blank lines preserved); URLs NOT tappable in Performance atmosphere per FR-5 / Story 2.6 existing logic; per-gig annotation (if present) rendered in `--text-perf-annotation` (20px) in italic editorial serif in `--color-accent` per FR-11 / DESIGN.md
  - **Fixed bottom toolbar** (does NOT scroll): `‹` back (left-biased, low emphasis, `--color-text-secondary`), `NEXT ›` (right-biased, ~half-width, `--color-accent` background, `--color-bg` text, `--text-section-heading` / 22px), next-song preview text in `--font-mono-slab` `--color-text-secondary` in the toolbar
**And** the `‹`, `NEXT ›`, and `×` exit controls (Story 4.3) are spatially separated per UX-DR9 — never in the same corner

**AC-4 — Sparse content: layout stability**

**Given** a Song with only a title (no key, no patch, no chord chart, no annotation)
**When** the Performance Card renders
**Then** the three regions maintain their proportions — fixed top, scrollable middle (empty), fixed bottom toolbar
**And** no `(not specified)` placeholder text appears (per EXPERIENCE.md §State Patterns voice & tone rule)
**And** empty key / patch slots collapse without leaving a blank line gap

**AC-5 — Long chord chart: scrolling within bounds**

**Given** a Song with a chord chart long enough to overflow the middle region's viewport height
**When** the Performance Card renders and Sandy scrolls in the middle region
**Then** the fixed top chrome (title, key, patch) does not scroll away
**And** the fixed bottom toolbar does not scroll away
**And** only the middle region scrolls vertically within its own bounds

**AC-6 — NEXT › advances and respects Section boundaries**

**Given** Sandy is on Song N of the Performance Card (not the last Song overall)
**When** Sandy taps `NEXT ›`
**Then** the Performance Card transitions to Song N+1 in flat Setlist order (Section boundaries traversed transparently)
**And** the transition completes in < 150ms (NFR-1); when `prefers-reduced-motion: reduce` is set the transition collapses to instant (0ms) via the global CSS rule in `globals.css` (NFR-21)
**And** the new card shows the correct title, key, patch, chord chart, and per-gig annotation for Song N+1
**And** the next-song preview text in the toolbar updates to Song N+2 (or is blank if N+1 is the last Song)

**AC-7 — ‹ retreats and respects Section boundaries**

**Given** Sandy is on Song N (N > 0)
**When** Sandy taps `‹`
**Then** the Performance Card transitions to Song N-1 (same 150ms / reduced-motion rule; Section boundaries traversed transparently going backward)

**AC-8 — ‹ is inert on the first Song**

**Given** Sandy is on Song 0 (the first Song of the first non-empty Section)
**When** Sandy taps `‹`
**Then** the tap produces no observable action — no navigation, no error, no toast

**AC-9 — Middle region scroll-only: no advance gesture**

**Given** Sandy taps anywhere in the scrollable middle region (chord chart area)
**When** the tap is registered
**Then** the tap does NOT advance or retreat the card (per EXPERIENCE.md Interaction Primitives "no tap-anywhere advance")

**AC-10 — No swipe navigation**

**Given** Sandy performs any swipe gesture anywhere on the Performance Card
**When** the gesture is detected
**Then** the swipe is ignored — no navigation results (per Interaction Primitives "no swipe gestures in performance mode")

**AC-11 — Pinch-zoom suppressed**

**Given** the Performance Card is open
**When** Sandy attempts a pinch or multi-finger gesture
**Then** the gesture is suppressed; the viewport does not zoom (viewport meta tag: `user-scalable=no` or equivalent enforced on entry to Performance Mode)

**AC-12 — Accessibility: aria-labels and focus management**

**Given** the Performance Card renders
**When** an accessibility audit runs against the icon-only controls
**Then** `‹` has `aria-label="Previous song"` (per UX-DR6)
**And** `NEXT ›` has `aria-label="Next song"`
**And** the position indicator has `aria-label="Song <n> of <total>"` where n is 1-based and total is the flat Song count across all Sections
**And** on Performance Mode entry, focus is programmatically moved to the `NEXT ›` button (the primary action, per UX-DR6 focus management)

**AC-13 — 401 held during Performance Mode (trigger-only contribution)**

**Given** `performanceActive === true`
**When** any API call returns a 401 from a successful network response
**Then** the 401 is held — no redirect to `/login` fires (per AR-28)
**And** all reads serve from cache (AR-28 invariant)

**Scope note:** the 401-hold mechanism itself lives in Epic 2's `PerformanceModeContext` and the flusher/error subsystems and is already unit-tested there. Story 4.1's only contribution is calling `setActive(true)` on entry (covered by AC-1). No new unit tests for the hold behavior are added in this story.

**AC-14 — Atmosphere set on entry**

**Given** the SPA enters Performance Mode (setlistId in URL under `/performance/`)
**When** the route mounts
**Then** the `<html>` element `data-atmosphere` attribute is set to `"performance"` (if it was `"practice"` on MacBook, it switches)
**And** on exit, the atmosphere is restored to the caller's prior value (or to the device default: `"performance"` for iPhone, `"practice"` for MacBook)

**AC-15 — Route wire-up**

**Given** `web/src/router.tsx`
**When** reviewed after Story 4.1
**Then** a route entry exists: `{ path: 'performance/:setlistId/:songIndex', element: <PerformanceCard /> }`
**And** the route lives inside the `RequireAuth` wrapper (same as other protected routes)
**And** the import `PerformanceCard` comes from `web/src/routes/performance-card.tsx`

**AC-16 — Wake lock stub**

**Given** `web/src/performance/wake-lock.ts`
**When** it exists (created by this story if Story 4.2 has not shipped)
**Then** it exports at minimum: `acquire(): Promise<void>`, `release(): void`, `isHeld(): boolean`
**And** in V1 the stub resolves `acquire()` immediately without error, `isHeld()` returns `false`
**And** Story 4.2 will replace the stub body with the real W3C Screen Wake Lock implementation without changing the export interface

**AC-17 — Setlist overview: Start performance › now wired**

**Given** `web/src/routes/setlist-overview.tsx`
**When** Sandy is on iPhone and the Setlist has at least one Song
**Then** the `Start performance ›` CTA button triggers the entry handler (no longer inert as in Epic 3)
**And** the handler is `onStartPerformance` imported from or defined in `web/src/performance/` or co-located with the route
**And** the CTA is disabled when all Sections are empty (AC-2)

## Tasks / Subtasks

- [x] **Task 1 — Read existing files before modifying** (prerequisite)
  - [x] Read `web/src/routes/setlist-overview.tsx` end-to-end (current CTA button, comment about Epic 4 wiring)
  - [x] Read `web/src/performance/performance-context.tsx` end-to-end (setActive, useSetPerformanceActive, provider)
  - [x] Read `web/src/hooks/use-chrome-visible.ts` (performanceActive → chrome toggle)
  - [x] Read `web/src/routes/authenticated-shell.tsx` (how chrome hide is consumed)
  - [x] Read `web/src/router.tsx` (current route tree, where to add `/performance/:setlistId/:songIndex`)
  - [x] Read `web/src/lib/microcopy.ts` (ACTIONS.startPerformance already defined; append PERFORMANCE_CARD section)
  - [x] Read `web/src/styles/tokens.css` (confirm token names: `--text-perf-title`, `--text-perf-meta`, `--text-perf-annotation`, `--color-accent`, `--color-bg`, `--color-surface`, `--color-text-secondary`, `--font-serif-editorial`, `--font-mono-slab`, `--spacing-tap`)
  - [x] Read `web/src/components/chord-chart.tsx` (ChordChart component API — props, atmosphere-aware URL suppression)
  - [x] Read `web/src/sync/query-client.tsx` (queryClient instance — for `queryClient.prefetchQuery`)
  - [x] Read `web/src/hooks/use-setlist.ts` (query key shape: `['setlist', ACTIVE_BAND_ID, setlistId]`)
  - [x] Read `web/src/hooks/use-song.ts` (query key shape: `['song', ACTIVE_BAND_ID, songId]`)
  - [x] Read `web/src/lib/platform.ts` (isIPhone helper)
  - [x] Read `web/src/lib/atmosphere.ts` (atmosphere switching helper if it exists)
  - [x] Read `web/src/lib/band.ts` (ACTIVE_BAND_ID constant)

- [x] **Task 2 — Create `web/src/performance/wake-lock.ts` stub** (AC: 16)
  - [x] Export `acquire(): Promise<void>` — resolves immediately (no-op stub)
  - [x] Export `release(): void` — no-op stub
  - [x] Export `isHeld(): boolean` — returns `false`
  - [x] Add a comment: "Stub for Story 4.1 — Story 4.2 replaces this body with the W3C Screen Wake Lock implementation. Interface must not change."
  - [x] No test file needed for the stub (pure no-op); Story 4.2 adds tests when the real implementation lands

- [x] **Task 3 — Create `web/src/performance/use-start-performance.ts`** (AC: 1, 2)
  - [x] Export a React hook `useStartPerformance(): (setlistId: string) => Promise<void>` that captures `queryClient`, `setActive` (from `useSetPerformanceActive()`), and `navigate` (from `useNavigate()`), and returns a stable async function with the single-arg signature `(setlistId) => Promise<void>` matching the epic's literal AC name `onStartPerformance(setlistId)`
  - [x] Inside the returned function, read the cached Setlist (or fetch via `queryClient.fetchQuery`) to determine its sections
  - [x] Compute `flatSongs` by flattening all sections' songs arrays into a single ordered list
  - [x] Guard: if `flatSongs.length === 0`, return early without doing anything (the CTA should already be disabled per AC-2; this is defence-in-depth)
  - [x] Await `queryClient.prefetchQuery({ queryKey: ['setlist', ACTIVE_BAND_ID, setlistId], queryFn: () => getSetlist(setlistId) })`
  - [x] Await `Promise.all(flatSongs.map(ref => queryClient.prefetchQuery({ queryKey: ['song', ACTIVE_BAND_ID, ref.songId], queryFn: () => getSong(ref.songId) })))` — prefetch all Songs in the Setlist
  - [x] Call `wakeLock.acquire()` (import from `web/src/performance/wake-lock.ts`)
  - [x] Call `setActive(true)`
  - [x] Call `navigate(`/performance/${setlistId}/0`)`
  - [x] Also export a plain helper `getFirstSongIndex(sections: SectionSchema[]): number | null` — returns 0 if at least one Song exists, null if all Sections are empty (testable without React)
  - [x] Import `getSong` from `web/src/api/songs.ts` and `getSetlist` from `web/src/api/setlists.ts` (raw API functions, not the hooks)
  - [x] Use `useCallback` so the returned function is referentially stable across renders

- [x] **Task 4 — Update `web/src/routes/setlist-overview.tsx`** (AC: 1, 2, 17)
  - [x] Import `useStartPerformance` from `web/src/performance/use-start-performance.ts`
  - [x] In the `SetlistOverview` component, call `const onStartPerformance = useStartPerformance()` — the returned function carries the `(setlistId) => Promise<void>` shape from AC-1
  - [x] Compute `hasAnySong: boolean` — true when at least one Section has at least one Song (`setlist.sections.some(s => s.songs.length > 0)`)
  - [x] Wire the CTA `onClick={() => onStartPerformance(setlist.setlistId)}` (guarded by `hasAnySong` and `setlist != null`)
  - [x] Apply `disabled={!hasAnySong}` to the CTA button
  - [x] Apply `aria-disabled={!hasAnySong}` alongside `disabled`
  - [x] Keep the existing Epic 4 comment (`/* Epic 4: <CurrentlyPerformingStrip /> mounts here. */`) — do not remove it

- [x] **Task 5 — Create `web/src/routes/performance-card.tsx`** (AC: 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14)
  - [x] Route params: `useParams<{ setlistId: string; songIndex: string }>()` from `react-router`
  - [x] Parse `songIndex` to integer via `Number.parseInt(songIndex, 10)`; guard against NaN
  - [x] `const { data: setlist } = useSetlist(setlistId ?? null)` — reads from cache (warm after prefetch)
  - [x] Derive `flatSongs: SongRef[]` by flattening `setlist.sections` across all sections in order
  - [x] Derive `currentSongRef: SongRef | undefined = flatSongs[parsedSongIndex]`
  - [x] `const { data: song } = useSong(currentSongRef?.songId ?? null)` — reads Song detail from cache
  - [x] If `setlist === undefined || song === undefined` (loading): render empty; if `setlist === null || currentSongRef === undefined`: render graceful not-found state
  - [x] Derive `totalSongs = flatSongs.length`; `currentPosition = parsedSongIndex + 1` (1-based for display)
  - [x] Derive `nextSongRef = flatSongs[parsedSongIndex + 1] ?? null` (for next-song preview)
  - [x] Derive `isFirst = parsedSongIndex === 0` (used by AC-8 `‹` inert). Do NOT derive or apply an `isLast` disabled state in this story — Story 4.4 owns the last-Song `NEXT ›` inert behavior per the epic.
  - [x] **Atmosphere:** set `document.documentElement.dataset.atmosphere = 'performance'` in a `useEffect` on mount; restore prior atmosphere on unmount (read from `document.documentElement.dataset.atmosphere` before setting)
  - [x] **Viewport zoom lock:** on mount, set `<meta name="viewport" content="...user-scalable=no">` or update the existing viewport meta via DOM API; restore on unmount (AC-11)
  - [x] **Focus management on mount:** `useEffect(() => { nextButton.current?.focus() }, [])` — move focus to `NEXT ›` on entry (AC-12, UX-DR6)
  - [x] **Layout structure** (three-region full-height — use `h-dvh`, NOT `h-screen`; see Dev Notes):
    ```tsx
    <div className="flex h-dvh flex-col bg-[color:var(--color-bg)]">
      {/* Fixed top chrome */}
      <header className="shrink-0 ...">title, key, patch</header>
      {/* Scrollable middle */}
      <main className="flex-1 overflow-y-auto ...">ChordChart + annotation</main>
      {/* Fixed bottom toolbar */}
      <footer className="shrink-0 ...">‹ | next-song preview | NEXT ›</footer>
    </div>
    ```
  - [x] **Top chrome:** title in `text-[length:var(--text-perf-title)] font-[family-name:var(--font-serif-editorial)]`; key and patch in `text-[length:var(--text-perf-meta)] font-[family-name:var(--font-mono-slab)]`; empty key/patch renders as absent (no placeholder, no blank line)
  - [x] **Middle region:** `<ChordChart value={song.chordChart ?? ''} atmosphere="performance" />` — reuse the existing component; `atmosphere="performance"` suppresses URL tappability per existing component logic; per-gig annotation rendered below chord chart if `currentSongRef.perGigAnnotation` is present: `text-[length:var(--text-perf-annotation)] font-[family-name:var(--font-serif-editorial)] italic text-[color:var(--color-accent)]`
  - [x] **`‹` button (back):** `aria-label="Previous song"`, `aria-disabled={isFirst}`, `disabled={isFirst}`, low-emphasis styling in `--color-text-secondary`; `onClick` navigates to `/performance/${setlistId}/${parsedSongIndex - 1}` (no-op guard if `isFirst`)
  - [x] **`NEXT ›` button:** `ref={nextButtonRef}`, `aria-label="Next song"`, `--color-accent` background `--color-bg` text; `onClick` navigates to `/performance/${setlistId}/${parsedSongIndex + 1}`. Do NOT add a `disabled`/`aria-disabled` last-Song treatment here — Story 4.4 introduces that. In this story, if Sandy reaches the last Song and taps `NEXT ›`, the resulting out-of-bounds `songIndex` renders the graceful not-found state from the loading-guard branch.
  - [x] **Next-song preview:** `nextSongRef?.titleSnapshot` or empty string (no "End of setlist" text — silent per Voice & Tone)
  - [x] **Position indicator:** `aria-label={"Song " + currentPosition + " of " + totalSongs}` on a `<span>` or `<div>` in the top chrome area
  - [x] **No swipe handlers** — do not add `onTouchStart`/`onTouchMove`/`onTouchEnd` navigation listeners; middle region may allow default scroll touch behavior
  - [x] **Middle region click guard:** `onClick` (or `onTouchEnd`) on the middle region must not trigger advance/retreat

- [x] **Task 6 — Update `web/src/router.tsx`** (AC: 15)
  - [x] Import `PerformanceCard` from `./routes/performance-card.js`
  - [x] Add inside the authenticated children array: `{ path: 'performance/:setlistId/:songIndex', element: <PerformanceCard /> }`
  - [x] Position after `setlists/:setlistId` to keep the routing tree readable

- [x] **Task 7 — Append Performance Card microcopy to `web/src/lib/microcopy.ts`** (Voice & Tone)
  - [x] Append a new export `PERFORMANCE_CARD` with:
    ```ts
    export const PERFORMANCE_CARD = {
      nextSong: 'NEXT ›',
      previousSong: '‹',
      ariaNextSong: 'Next song',
      ariaPreviousSong: 'Previous song',
      ariaSongPosition: (n: number, total: number) => `Song ${n} of ${total}`,
    } as const;
    ```
  - [x] `performance-card.tsx` uses these constants — no inline copy strings

- [x] **Task 8 — Tests** (AC: 1–17)
  - [x] **`web/src/performance/use-start-performance.test.ts`** (new) — uses `renderHook` from `@testing-library/react`:
    - `getFirstSongIndex` returns 0 when at least one Section has Songs (plain function test)
    - `getFirstSongIndex` returns null when all Sections are empty (plain function test)
    - The hook's returned function calls `queryClient.prefetchQuery` for setlist and each song (mock `queryClient`)
    - The hook's returned function calls `wakeLock.acquire()` (mock the module)
    - The hook's returned function calls `setActive(true)` (mock `useSetPerformanceActive`)
    - The hook's returned function calls `navigate('/performance/<setlistId>/0')` (mock `useNavigate`)
    - The hook's returned function is a no-op when `flatSongs` is empty (guard AC-2; no prefetch, no setActive, no navigate)
    - Call order is prefetch → wakeLock → setActive → navigate
  - [x] **`web/src/routes/performance-card.test.tsx`** (new, ~20 cases):
    - Renders title, key, patch for a Song with all fields
    - Title renders in `perf-title` size class (aria or class assertion)
    - Sparse Song: no key renders nothing; no patch renders nothing; no chord chart shows no placeholder text
    - `NEXT ›` has `aria-label="Next song"`; `‹` has `aria-label="Previous song"`
    - Position indicator shows `aria-label="Song 1 of 3"` for first of 3
    - `‹` is `disabled` and `aria-disabled` when on the first Song (songIndex=0) (AC-8)
    - Tapping `NEXT ›` navigates to `performance/:setlistId/1` when on songIndex=0
    - Tapping `‹` navigates to `performance/:setlistId/0` when on songIndex=1
    - Tapping `‹` on first Song produces no navigation call (inert; AC-8)
    - (Last-Song `NEXT ›` inert behavior is tested in Story 4.4 — do NOT add those cases here.)
    - Next-song preview shows `titleSnapshot` of Song N+1
    - Next-song preview is empty on last Song (no "End of setlist" text)
    - Per-gig annotation renders when present; does not render when absent (no placeholder)
    - Section boundaries: songIndex 2 in a layout where Section 1 has 2 songs and Section 2 has 1 song — advancing from index 1 lands on index 2 (cross-section)
    - ChordChart URLs are NOT tappable in Performance atmosphere (delegate to ChordChart test or assert via prop passed)
    - `aria-live` on position indicator (or relevant live region) if applicable
  - [x] **`web/src/routes/setlist-overview.test.tsx`** (extend, ~5 new cases):
    - Start performance CTA button exists on iPhone with a Setlist that has Songs
    - Start performance CTA is disabled when Setlist has no Songs
    - Tapping CTA invokes the function returned by `useStartPerformance` with the setlist id (mock the hook)
    - CTA not rendered on MacBook (`isIPhone() === false`)
    - Handler does not fire when Setlist is loading (CTA disabled or guard returns early)

- [x] **Task 9 — Verification pass** (run before handing off to review)
  - [x] `pnpm typecheck` green across all five packages
  - [x] `pnpm lint` green via Biome (kebab-case filenames; camelCase identifiers; no unjustified `biome-ignore` directives)
  - [x] `pnpm test` green — no regressions against Story 3.6 baseline (web 437, api 103, shared 26)
  - [x] `pnpm build:web` green

(Commit is handled by the epic-run workflow per CLAUDE.md "Commit cadence" — not a story-level AC.)

## Dev Notes

### This story's scope

Story 4.1 is the foundational Performance Mode story — it delivers the entry gesture, the Performance Card render, and single-tap navigation. Later stories extend this:

- **Story 4.2** replaces the `wake-lock.ts` stub with the real W3C Screen Wake Lock implementation and adds the persistent indicator.
- **Story 4.3** adds the `×` exit button and `CurrentlyPerformingStrip` to the overview.
- **Story 4.4** wires the end-state-on-navigate-away AND the last-Song `NEXT ›` inert behavior (disabled visual, aria-disabled, onClick no-op, suppressed preview). Story 4.1 leaves `NEXT ›` always-enabled.
- **Story 4.5** adds backgrounding survival and Tonight-Gig pre-fetch.

**What this story delivers:**
- `web/src/performance/wake-lock.ts` (NEW — stub)
- `web/src/performance/use-start-performance.ts` (NEW — hook returning `(setlistId) => Promise<void>`)
- `web/src/performance/use-start-performance.test.ts` (NEW)
- `web/src/routes/performance-card.tsx` (NEW)
- `web/src/routes/performance-card.test.tsx` (NEW)
- `web/src/routes/setlist-overview.tsx` (UPDATE — wire CTA handler via `useStartPerformance`)
- `web/src/routes/setlist-overview.test.tsx` (UPDATE — ~5 new cases)
- `web/src/router.tsx` (UPDATE — add performance route)
- `web/src/lib/microcopy.ts` (UPDATE — append PERFORMANCE_CARD)

**What this story does NOT deliver:**
- Real Wake Lock acquisition (Story 4.2)
- `×` exit button on Performance Card (Story 4.3)
- `CurrentlyPerformingStrip` on Setlist overview (Story 4.3)
- End-state-on-navigate-away logic AND last-Song `NEXT ›` inert behavior (both Story 4.4)
- Tonight-Gig pre-fetch loop (Story 4.5)
- API: no new endpoints (`/api/v1/upcoming-gigs` is Story 4.5)
- No `shared/` schema changes

### Last-Song safety is Story 4.4's responsibility (NOT this story)

Per the epic split, the locked memory note "no terminate on advance gesture" — i.e. `NEXT ›` becoming inert/disabled at the last Song — is implemented in **Story 4.4** (`### Story 4.4: End Performance state on navigate-away + last-song inert NEXT ›` in `epics.md`). Story 4.1 must NOT pre-empt that work: leave `NEXT ›` always-enabled. If a user reaches the last Song and taps `NEXT ›` in the Story 4.1 window, the resulting out-of-bounds `songIndex` renders the graceful not-found branch of the loading guard. Story 4.4 then introduces the disabled visual, `aria-disabled`, `onClick` no-op, and suppressed preview.

The locked memory note exists so Story 4.4's adversarial reviewer can keep an eye out for shortcuts. It is not a license for 4.1 to scope-creep.

### Architecture.md pseudocode error — `songRefs` does not exist

`architecture.md` lines 643–649 (and the duplicate sketch around the Performance Mode entry flow) show this pseudocode:

```ts
async function onStartPerformance(setlistId: string) {
  await queryClient.prefetchQuery(['setlist', setlistId])
  const setlist = queryClient.getQueryData(['setlist', setlistId])
  await Promise.all(
    setlist.songRefs.map(ref => queryClient.prefetchQuery(['song', ref.songId]))
  )
}
```

There is no `songRefs` field on `SetlistSchema`. The actual embedded shape (from `shared/`) is `sections: SectionSchema[]`, each with `songs: SongRefSchema[]`. **Do not follow the pseudocode literally.** This story uses `setlist.sections.flatMap(s => s.songs)` to iterate the SongRefs — matching the schema. The architecture doc is stale on this point; a follow-up should correct it, but that is out of scope for Story 4.1.

### Flat song index computation

The URL uses a flat song index (`/performance/:setlistId/:songIndex`), not a section+song pair. The "flat index" is the position of the Song when all Sections' songs arrays are concatenated in order:

```ts
// Given setlist.sections = [
//   { name: 'Set 1', songs: [{ songId: 'a', ... }, { songId: 'b', ... }] },
//   { name: 'Set 2', songs: [{ songId: 'c', ... }] },
// ]
// flatSongs = [songA, songB, songC]
// songA → songIndex=0, songB → songIndex=1, songC → songIndex=2
function flattenSongs(sections: Section[]): SongRef[] {
  return sections.flatMap(s => s.songs);
}
```

`NEXT ›` navigates to `parsedSongIndex + 1`; `‹` navigates to `parsedSongIndex - 1`. Section boundaries are transparent to the navigation model — they affect display only. The position indicator (`Song N of total`) is also flat.

### Three-region layout: CSS approach

Use `h-dvh flex-col` on the root container (NOT `h-screen` — see the note after the snippet on why iPhone Safari needs dvh). The fixed top and bottom regions use `shrink-0` (they don't shrink when content is large). The middle region uses `flex-1 overflow-y-auto`:

```tsx
<div className="flex h-dvh flex-col bg-[color:var(--color-bg)]">
  <header className="shrink-0 px-[var(--spacing-gutter)] py-[calc(var(--spacing-unit)*4)]">
    {/* title, key, patch, position indicator, × (Story 4.3) */}
  </header>
  <main className="flex-1 overflow-y-auto px-[var(--spacing-gutter)] py-[calc(var(--spacing-unit)*3)]">
    {/* ChordChart + per-gig annotation */}
  </main>
  <footer className="shrink-0 flex items-center gap-[calc(var(--spacing-unit)*3)] px-[var(--spacing-gutter)] py-[calc(var(--spacing-unit)*3)] bg-[color:var(--color-surface)]">
    {/* ‹  |  next-song preview  |  NEXT › */}
  </footer>
</div>
```

Use `h-dvh` (dynamic viewport height) rather than `h-screen` — on iPhone Safari the `dvh` unit accounts for the address bar collapsing/expanding without causing layout jank. `100vh` on iPhone Safari is the layout viewport (full height including address bar area), which can cause the bottom toolbar to be occluded.

Safe-area padding: add `env(safe-area-inset-bottom)` to the footer's bottom padding so the toolbar sits above the iPhone home indicator:
```tsx
style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
```

### Atmosphere switching

The app sets `data-atmosphere` on `<html>` at boot based on platform (Story 1.2 / `web/src/lib/atmosphere.ts`). Performance Mode overrides this to `"performance"`. The Performance Card route should:

```ts
useEffect(() => {
  const prev = document.documentElement.dataset.atmosphere ?? 'practice';
  document.documentElement.dataset.atmosphere = 'performance';
  return () => {
    document.documentElement.dataset.atmosphere = prev;
  };
}, []);
```

On iPhone, the default is already `"performance"`, so this is idempotent. On MacBook (where Sandy edits Setlists and could in theory reach this route in development), it correctly switches to `performance` for the card.

### Viewport zoom suppression (AC-11)

The existing `web/index.html` viewport meta likely reads:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

For Performance Mode, add `user-scalable=no` for the duration:
```ts
useEffect(() => {
  const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  if (!meta) return;
  const prev = meta.content;
  meta.content = 'width=device-width, initial-scale=1.0, user-scalable=no';
  return () => { meta.content = prev; };
}, []);
```

Per EXPERIENCE.md Interaction Primitives: "No double-taps, pinches, multi-finger gestures. Anywhere." This is the implementation mechanism.

### `useStartPerformance` as a React hook owning all entry orchestration

The entry handler is owned by a single React hook `useStartPerformance()` returning an async function with signature `(setlistId: string) => Promise<void>` — this matches the epic's literal AC name `onStartPerformance(setlistId)` and keeps prefetch + wakeLock + setActive + navigate together in one place per the epic AC narrative. The hook captures `queryClient`, `setActive` (via `useSetPerformanceActive()`), and `navigate` (via `useNavigate()`), and wraps the returned function in `useCallback` for referential stability.

Why a hook and not a plain function: the epic AC says "the handler sets `setActive(true)`" and "the router navigates …" — making the orchestration a hook returning a function preserves the epic's single-argument call shape (`onStartPerformance(setlistId)`) while keeping React-specific operations inside the unit of work. Tests use `renderHook` from `@testing-library/react` to obtain the function and exercise it against mocked `queryClient` / `useSetPerformanceActive` / `useNavigate`. The `getFirstSongIndex` helper is a plain function (not part of the hook) so it remains testable without a React environment.

### ChordChart component props

The existing `ChordChart` component from Story 2.6 accepts the current atmosphere via prop or reads it from the `data-atmosphere` attribute. Before calling it in `performance-card.tsx`, read the current component signature:

```tsx
// Likely interface (confirm by reading the file in Task 1):
<ChordChart value={song.chordChart ?? ''} atmosphere="performance" />
```

In Performance atmosphere, URLs in the chord chart are rendered as inert text (not tappable links) — this behavior is implemented inside `ChordChart` and activated by `atmosphere="performance"`. Story 4.1 does not need to re-implement this.

### prefetchQuery call pattern

TanStack Query v5 `prefetchQuery` signature:
```ts
await queryClient.prefetchQuery({
  queryKey: ['setlist', ACTIVE_BAND_ID, setlistId],
  queryFn: () => getSetlist(setlistId),
});
await Promise.all(
  flatSongs.map(ref =>
    queryClient.prefetchQuery({
      queryKey: ['song', ACTIVE_BAND_ID, ref.songId],
      queryFn: () => getSong(ref.songId),
    })
  )
);
```

Import `getSong` from `web/src/api/songs.ts` and `getSetlist` from `web/src/api/setlists.ts` (the raw API functions, not the hooks). Import `ACTIVE_BAND_ID` from `@gigbuddy/shared` (it's the V1 band ID constant used throughout).

### Spatial separation of controls (UX-DR9)

Per DESIGN.md Don'ts:
> "Place destructive controls (`× exit`, `‹ back`, `NEXT ›`) in the same corner. Spatial separation is a safety primitive."

Layout requirement (enforced by CSS/JSX structure, verified in code review):
- `×` exit → top-left (Story 4.3 adds this; leave a `{/* × exit: Story 4.3 */}` placeholder in top chrome)
- Position indicator → top-right area
- `‹` back → bottom-left
- `NEXT ›` → bottom-right

With `×` on the top-left and `‹` on the bottom-left, they are vertically separated. `NEXT ›` on the bottom-right is diagonally opposite `×`. This satisfies the spatial-separation rule.

### Transition timing (< 150ms NFR-1)

Navigation via React Router's `navigate()` with route URL change is the transition mechanism. No CSS animation is required — the card re-renders with new data. The 150ms budget is met by rendering from cache (pre-fetched on entry). If needed, a `transition-opacity` of `100ms` or `translate-x` of `100ms` on the card container is acceptable, but only if the `prefers-reduced-motion` global CSS rule collapses it (it will — `globals.css` sets `transition-duration: 0ms !important`).

### Test mocking approach

For `performance-card.test.tsx`:
- Mock `useParams` to return `{ setlistId: 'sl1', songIndex: '0' }`
- Mock `useSetlist` to return a cached Setlist
- Mock `useSong` to return a cached Song
- Mock `useNavigate` to capture navigation calls
- The `atmosphere` effect (DOM mutation) and `viewport` effect can be verified via `document.documentElement.dataset.atmosphere` after render

For `setlist-overview.test.tsx` updates:
- Mock `useStartPerformance` to return a vitest spy that resolves immediately
- Assert the spy is called with the setlist id on CTA tap
- (Assertions about `setActive(true)` and the navigation URL belong in `use-start-performance.test.ts`, where the hook's internals are exercised against mocked `useSetPerformanceActive` and `useNavigate`.)

### Architecture compliance checklist

- **AR-28:** `performanceActive === true` → no toasts, no banners, no auth redirects. The `PerformanceModeContext` is already wired to the flusher and error subsystems from Epic 2. Story 4.1 only needs to call `setActive(true)` — the rest activates automatically.
- **AR-25:** Synchronous prefetch on `Start performance ›` — this story implements it explicitly in `onStartPerformance`.
- **AR-45:** UI (`setlist-overview.tsx`) consumes `useSetPerformanceActive()` hook — never imports `outbox.ts` or `flusher.ts` directly.
- **AR-46:** No new npm runtime dependencies. No animation library. No state management library.
- **UX-DR9:** Spatial separation of controls is a structural invariant — `×`, `‹`, `NEXT ›` in three different corners.
- **NFR-17 (WCAG AAA contrast in Performance):** Performance atmosphere colors (`text-primary: #f1e6cf` on `bg: #1a1209`) already verified by Story 1.2 contrast report. The `NEXT ›` button uses `accent: #e6b855` background with `bg: #1a1209` text — verify this pair is in the contrast report; if not, add it.

### Biome lint traps (from Epic 3 patterns)

- **`noAutofocus`:** Do not use the `autoFocus` prop on the `NEXT ›` button; use programmatic `ref.current?.focus()` inside a `useEffect` instead.
- **`useExhaustiveDependencies`:** The atmosphere effect uses `[]` as deps (runs once on mount) — Biome will accept this if the effect has an empty deps array. The viewport meta effect also uses `[]`.
- **`noNoninteractiveDomHandlers`:** `<div onClick={...}>` is invalid. The middle region guard (AC-9) can be achieved by simply not adding any onClick to the scrollable div. If a wrapper div needs to capture clicks to prevent bubbling, use `role="presentation"` or restructure.
- **`noArrayIndexKey`:** flatSongs is derived from stable Setlist data — rendering via `flatSongs.map((ref, idx) => ...)` with `key={ref.songId}` (the songId is stable) avoids the index-key lint warning.

### Testing count baseline

Story 3.6 exit count: **web 437, api 103, shared 26**.

New tests to add (estimate):
- `use-start-performance.test.ts`: ~5 cases
- `performance-card.test.tsx`: ~20 cases
- `setlist-overview.test.tsx` updates: ~5 new cases

Expected Story 4.1 final: **web ~467, api 103 unchanged, shared 26 unchanged**.

### Handoff note for Story 4.2

Story 4.2 (Wake Lock with persistent indicator) will:
1. Replace the body of `web/src/performance/wake-lock.ts` with the real W3C `navigator.wakeLock.request('screen')` implementation
2. Call `wakeLock.acquire()` from the Performance Card's `useEffect` on mount (reacquire on foreground)
3. Render the persistent indicator when `wakeLock.isHeld() === false`

Story 4.1 must not change the export interface of `wake-lock.ts` (AC-16 contract).

### Handoff note for Story 4.3

Story 4.3 (× exit + CurrentlyPerformingStrip) will:
1. Add the `×` exit button to `performance-card.tsx` top-left (the placeholder comment should already be there)
2. Add `CurrentlyPerformingStrip` to `setlist-overview.tsx` (the `{/* Epic 4: <CurrentlyPerformingStrip /> mounts here. */}` comment is already present — Story 4.1 must NOT remove it)
3. Wire `×` tap → `navigate('/setlists/:setlistId')` while keeping `performanceActive === true`

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] via bmad-dev-story workflow.

### Debug Log References

- `pnpm test` — web 473 / api 103 / shared 26 / infra 51 passing. Web baseline was 437 (Story 3.6 exit count); +36 net (10 use-start-performance + 23 performance-card + 3 net setlist-overview changes — the pre-existing Epic-3 "CTA has no onClick handler" test was replaced by Story 4.1's 5 new wired-CTA cases).
- `pnpm typecheck` — all five packages green (web/api/shared/infra/e2e).
- `pnpm lint` — Biome clean. One a11y violation surfaced during the first lint pass: `aria-label` on a bare `<span>` triggered `useAriaPropsSupportedByRole`. Fix was to add `role="status"` to the position indicator — which also gives assistive tech a live region for the "Song N of total" announcement.
- `pnpm build:web` — vite production build green; bundle 457 kB (136 kB gzip), no new chunks.

### Completion Notes List

- All 17 ACs implemented. Performance Card three-region layout uses `h-dvh` (not `h-screen`) per the iPhone Safari viewport guidance in Dev Notes. Safe-area insets are applied to the top (under the iPhone notch) and bottom (above the home indicator) of the card.
- AC-1 prefetch sequence does an initial `queryClient.fetchQuery` for the Setlist so we know which Songs to prefetch, then issues a parallel `prefetchQuery` for the Setlist (documents the AC-1 contract) plus `Promise.all` for every Song in flat order. Order of operations: setlist fetch → song prefetch → wakeLock.acquire → setActive(true) → navigate. The strict-order unit test asserts the sequence with mock spies.
- AC-2 guard implemented at two layers: the CTA itself is `disabled`/`aria-disabled` when no Section contains a Song, and `useStartPerformance` short-circuits if `flatSongs.length === 0` (defence-in-depth). The `getFirstSongIndex` helper is exercised by plain-function tests without React.
- AC-3 layout uses three `<div>`s: `header.shrink-0`, `main.flex-1.overflow-y-auto`, `footer.shrink-0`. The footer hosts ‹ on the left, the next-song preview in the middle, and NEXT › on the right — spatially separated per UX-DR9.
- AC-4 sparse content: empty key/patch render as absent (no placeholder line, no "(not specified)" copy). The whole key/patch row is omitted when both are missing.
- AC-9/10/11 implemented by what we *don't* do: no `onTouchStart`/`onTouchMove`/`onTouchEnd` handlers anywhere on the card; no `onClick` on the middle region; `<meta name="viewport" content="...user-scalable=no">` is set on mount and restored on unmount.
- AC-12 focus management uses `useRef` + `useEffect` (Biome `noAutofocus` prohibits the `autoFocus` prop). The atmosphere effect and the viewport effect each run once on mount with an empty deps array; the restoration runs on unmount.
- AC-13 (trigger-only): `setActive(true)` is called inside `useStartPerformance` so the rest of the 401-hold machinery (already shipped in Epic 2's `PerformanceModeContext` + flusher + error subsystems) activates on entry. No new 401-hold unit tests added (per the spec scope note).
- AC-15 route entry added inside `RequireAuth`'s children, positioned after `setlists/:setlistId`.
- AC-16 wake-lock stub: `acquire`/`release`/`isHeld` exports match the contract; bodies are no-ops. Story 4.2 replaces the bodies without changing the interface.
- AC-17 Setlist overview now passes a real handler to the CTA `onClick`. Existing "CTA has no onClick handler in Epic 3" test was replaced with the new wired tests; the Epic 4 `<CurrentlyPerformingStrip />` placeholder comment is preserved per the spec.
- Biome a11y nuance: a bare `<span aria-label="...">` is rejected by `useAriaPropsSupportedByRole`. Adding `role="status"` both satisfies the lint and improves assistive-tech behaviour (the position indicator becomes a live region). This deviation from the spec's literal "on a `<span>` or `<div>`" wording is captured in the spec's own permissive language ("`<span>` or `<div>`") and noted here.
- The `useStartPerformance` test uses a `createElement(QueryClientProvider, ...)` wrapper so the file can stay `.test.ts` per the spec rather than being renamed to `.test.tsx`.

### File List

**NEW files:**
- `web/src/performance/wake-lock.ts` (stub — Story 4.2 replaces body)
- `web/src/performance/use-start-performance.ts`
- `web/src/performance/use-start-performance.test.ts`
- `web/src/routes/performance-card.tsx`
- `web/src/routes/performance-card.test.tsx`

**UPDATED files:**
- `web/src/routes/setlist-overview.tsx` (wire CTA entry handler)
- `web/src/routes/setlist-overview.test.tsx` (+~5 cases)
- `web/src/router.tsx` (add performance route)
- `web/src/lib/microcopy.ts` (append PERFORMANCE_CARD)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status: backlog → ready-for-dev → in-progress → review)
- `_bmad-output/implementation-artifacts/4-1-performance-mode-entry-card-layout-single-tap-navigation.md` (this file)

### Change Log

| Date       | Change                                                                              |
| ---------- | ----------------------------------------------------------------------------------- |
| 2026-06-20 | Story 4.1 spec created; status set to ready-for-dev.                                |
| 2026-06-21 | Spec-review fixes (round 1): `onStartPerformance` reshaped as a `useStartPerformance` hook with single-arg signature matching the epic; setActive/navigate moved inside the entry orchestration per epic AC narrative; AC-13 scoped as trigger-only with Epic 2 owning the 401-hold mechanism; AC-18 (verification) and AC-19 (commit) removed — workflow concerns, not story ACs; Task 5 layout snippet uses `h-dvh` (was `h-screen`); Task 3 prefetchQuery calls include `queryFn`; file rename `on-start-performance.ts` → `use-start-performance.ts`. |
| 2026-06-21 | Spec-review fixes (round 2): last-Song `NEXT ›` inert behavior moved out of 4.1 — that AC belongs to Story 4.4 per the epic split. Task 5 `NEXT ›` no longer applies `disabled`/`aria-disabled` for `isLast`; "Critical locked constraint" Dev Notes section rewritten to point at 4.4. Task 8 test list pruned of last-Song inert cases (those move to 4.4). File List + test list updated to use `use-start-performance.ts` (the round-1 rename was only partially propagated). Dev Notes "CSS approach" prose now says `h-dvh` (was `h-screen`). New Dev Notes section flags the `architecture.md` `songRefs` pseudocode error — the spec uses the real `sections[].songs[]` shape. |
| 2026-06-21 | Implementation complete. New: `web/src/performance/wake-lock.ts` (stub), `web/src/performance/use-start-performance.ts` (hook + `getFirstSongIndex` helper), `web/src/performance/use-start-performance.test.ts` (10 cases), `web/src/routes/performance-card.tsx`, `web/src/routes/performance-card.test.tsx` (23 cases). Updated: `web/src/routes/setlist-overview.tsx` (CTA wired via `useStartPerformance`), `web/src/routes/setlist-overview.test.tsx` (5 new wired-CTA cases replace the old Epic-3 inert-CTA case), `web/src/router.tsx` (added `performance/:setlistId/:songIndex` route), `web/src/lib/microcopy.ts` (appended `PERFORMANCE_CARD`). Tests: web 437 → 473 (+36); api 103, shared 26 unchanged. Typecheck, lint, build:web green. Status: in-progress → review. |
