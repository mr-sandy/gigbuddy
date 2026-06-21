---
baseline_commit: "35acd6e"
builds_on: 4-2-wake-lock-with-persistent-indicator-and-backoff
---

# Story 4.3: Exit via × + "Currently performing" strip + Resume (FR-19, FR-20)

Status: review

## Story

As Sandy,
I want a small `×` in the top-left of the Performance Card that returns me to the Setlist overview with Performance state preserved, plus a top-anchored `Currently performing: <song>` strip on the overview with a `Resume ›` button,
so that I can glance back at the setlist mid-gig and pick up where I left off with one tap.

## Acceptance Criteria

**AC-1 — `×` exit button on the Performance Card**

**Given** the Performance Card from Story 4.1 at `/performance/:setlistId/:songIndex`
**When** the card renders
**Then** an `×` exit control appears in the top-left corner of the fixed top chrome
**And** the `×` is small (~28pt icon target, `min-w-tap min-h-tap` enforced per UX-DR6) with low emphasis in `text-secondary` color
**And** the `×` has `aria-label="Exit performance mode"` (per UX-DR6 / UX-DR9 spatial-separation rule)
**And** `×` is spatially separated from `‹` (bottom-left), `NEXT ›` (bottom-right), and the position indicator (top-right) — the four controls occupy four separate corners per UX-DR9

**AC-2 — `×` tap navigates back without ending Performance state**

**Given** Sandy taps `×`
**When** the tap is registered
**Then** the router navigates back to `/setlists/:setlistId` (Setlist overview)
**And** `PerformanceModeContext.performanceActive` REMAINS `true` (NOT changed — state preserved per FR-19)
**And** `setActive(false)` is NOT called
**And** the current Song index is preserved in component/URL state so `Resume ›` can return to it
**And** `wakeLock.release()` is NOT called — the lock remains held (Story 4.2 contract — AC-9 confirmed)
**And** the wake-lock indicator (Story 4.2) may still appear on the card on resume if the lock was lost while on the overview

**AC-3 — Chrome behavior on the Setlist overview after × exit**

**Given** `performanceActive === true` AND the user is on `/setlists/:setlistId` (the active Setlist's overview)
**When** the overview renders
**Then** the bottom tab bar IS visible (chrome shows — `useChromeVisible()` returns `!performanceActive` only; override not needed since `performanceActive` stays true but the tab bar is conditionally shown via the currently-performing state)
**And** the `CurrentlyPerformingStrip` component renders at the very top of the overview, above the gig metadata header

**Important:** `useChromeVisible()` returns `!performanceActive`. When `performanceActive === true` the chrome is hidden globally. This is a problem — on the Setlist overview after × exit, Sandy needs to see tabs to navigate away. The implementation MUST make chrome visible on the active Setlist overview when performance is active. See Dev Notes for the required approach.

**AC-4 — `CurrentlyPerformingStrip` component**

**Given** the `CurrentlyPerformingStrip` component (`web/src/components/currently-performing-strip.tsx` — NEW file)
**When** rendered
**Then** it sits at the very top of the Setlist overview content area, before the `<header>` gig metadata block
**And** it has `accent` background (`bg-[color:var(--color-accent)]`) and `bg` text (`text-[color:var(--color-bg)]`)
**And** it is approximately 48pt tall (`min-h-[48pt]` or equivalent via `--size-tap` tokens)
**And** it displays `Currently performing:` label followed by the current Song's title (in `titleSnapshot` form from the Setlist record, retrieved from context or props)
**And** a `Resume ›` button sits right-aligned within the strip
**And** the entire strip satisfies `min-h-tap` and can be interacted with at 44pt target minimum

**AC-5 — `CurrentlyPerformingStrip` accessibility**

**Given** the `CurrentlyPerformingStrip` renders
**When** screen-reader audit runs
**Then** the strip has a landmark region or `role="region"` with `aria-label="Currently performing"` (or similar — a region that announces context clearly)
**And** the Song title within the strip is part of the readable content
**And** the `Resume ›` button has `aria-label="Resume performance"` (or uses visible text as accessible name via standard button semantics)

**AC-6 — Strip visibility rules**

**Given** the `CurrentlyPerformingStrip`
**When** conditions are evaluated
**Then** the strip renders ONLY when `performanceActive === true` AND the user is viewing the active Setlist's overview (the `setlistId` in the URL matches the active performance setlist)
**And** the strip is NOT shown on other Setlist overviews when `performanceActive === true` for a different setlist
**And** the strip is NOT shown when `performanceActive === false`
**And** the strip is NOT shown on the Performance Card itself (it lives on the overview only)

**AC-7 — `Resume ›` navigation**

**Given** Sandy taps `Resume ›`
**When** the tap is registered
**Then** the router navigates back to `/performance/:setlistId/:currentSongIndex` using the preserved Song index (the index that was active when `×` was tapped)
**And** the Performance Card renders the same Song that was active when `×` was tapped (no index reset)
**And** the chrome hides again on entry per Story 4.1 `useChromeVisible()` / `performanceActive === true` behavior
**And** `useWakeLockIndicator` in the card calls `acquire()` on mount (per Story 4.2 hook behavior) — this covers the reacquire-after-resume case

**AC-8 — Annotation edit does not clear the strip**

**Given** the `CurrentlyPerformingStrip` is showing on the active Setlist's overview
**When** Sandy edits a per-gig annotation (MacBook: inline InlineEditField; iPhone: bottom sheet per Story 3.3)
**Then** the strip remains visible (annotation edit does not navigate away from the active setlist)
**And** the PUT is enqueued normally per Epic 2 sync layer
**And** no Performance state change occurs

**AC-9 — Tapping a song row on the active overview (Story 4.4 handoff)**

**Given** the `CurrentlyPerformingStrip` is showing and Sandy taps a Song row
**When** the tap navigates to `/songs/:songId`
**Then** this is handled by Story 4.4's navigate-away detection (Performance state ENDS)
**And** Story 4.3 does NOT implement this navigation logic — it only owns the strip render and `×` exit

**AC-10 — Focus management on × exit**

**Given** Sandy taps `×` on the Performance Card
**When** navigation to the Setlist overview completes
**Then** focus is restored to a meaningful element on the overview (ideally the `Resume ›` button in the strip or the strip's first focusable element)
**And** focus is NOT left on the document body

**AC-11 — Unit tests**

**Given** `web/src/components/currently-performing-strip.test.tsx` (new file)
**When** tests run
**Then** the following cases pass:
  - Strip renders with `accent` background, `bg` text, `aria-label="Resume performance"` on button
  - Strip shows the Song title from the `titleSnapshot` prop
  - `Resume ›` button calls the `onResume` callback on click
  - Strip has a region/label for screen-readers

**Given** `web/src/routes/performance-card.test.tsx` (UPDATE)
**When** tests run
**Then** the following cases pass:
  - `×` button renders with `aria-label="Exit performance mode"`
  - Tapping `×` calls navigate back to the setlist overview URL
  - `×` does NOT call `setActive` (mock should not be called)
  - `×` does NOT call `wakeLock.release()`
  - `×` button satisfies spatial separation from `‹` (in DOM: `×` in top-left header area, `‹` in bottom footer)

**Given** `web/src/routes/setlist-overview.test.tsx` (UPDATE)
**When** tests run
**Then** the following cases pass:
  - `CurrentlyPerformingStrip` renders when `performanceActive === true` and the setlistId matches
  - Strip does NOT render when `performanceActive === false`
  - Strip does NOT render for a different setlistId

**AC-12 — Verification pass**

**Given** the implementation is complete
**When** the following run
**Then** `pnpm typecheck` passes across all five packages
**And** `pnpm lint` passes (no new `biome-ignore` directives)
**And** `pnpm test` passes with no regressions; Story 4.2 baseline was **web 503 / api 103 / shared 26**
**And** `pnpm build:web` succeeds

## Tasks / Subtasks

- [x] **Task 1 — Read existing files before touching anything** (prerequisite — non-negotiable)
  - [x] Read `web/src/routes/performance-card.tsx` end-to-end (understand the exact current top-chrome layout, where the `{/* × exit: Story 4.3 */}` comment placeholder sits, the header flex structure, and the `useWakeLockIndicator` import)
  - [x] Read `web/src/routes/performance-card.test.tsx` end-to-end (understand the 26 test cases from Stories 4.1 + 4.2 to avoid regressions; note the `useWakeLockIndicatorMock` and `navigateMock` patterns)
  - [x] Read `web/src/routes/setlist-overview.tsx` end-to-end (understand the `{/* Epic 4: <CurrentlyPerformingStrip /> mounts here. */}` placeholder comment, the `onStartPerformance` hook wiring, the `isIPhone` check, and the Start performance CTA position)
  - [x] Read `web/src/routes/setlist-overview.test.tsx` end-to-end (understand the mocking pattern: `useSetlistMock`, `isIPhoneMock`, `startPerformanceMock`, `navigateMock`)
  - [x] Read `web/src/performance/performance-context.tsx` (understand `usePerformanceActive()`, `useSetPerformanceActive()`, `getPerformanceActiveSnapshot()` — confirm `setActive` is the correct function to NOT call on × exit)
  - [x] Read `web/src/hooks/use-chrome-visible.ts` (understand that `useChromeVisible()` returns `!performanceActive()` — this is the core conflict to resolve for the Setlist overview after × exit)
  - [x] Read `web/src/routes/authenticated-shell.tsx` (understand how `useChromeVisible()` gates `<BottomTabs>` rendering — determines where the chrome-show override must live)
  - [x] Read `web/src/lib/microcopy.ts` (understand the existing PERFORMANCE_CARD constants and ACTIONS — the new strings for `×` exit and `Resume ›` go here)
  - [x] Read `web/src/performance/wake-lock.ts` (confirm that NOT calling `release()` on × exit is the correct behavior — the module is stateful and the sentinel persists across React unmount)

- [x] **Task 2 — Create `web/src/components/currently-performing-strip.tsx`** (AC: 4, 5, 6, 7)
  - [x] Define props interface: `{ currentSongTitle: string; onResume: () => void }`
  - [x] Render a `<section>` with implicit `region` role (via `aria-label`) announcing "Currently performing" — Biome's `useSemanticElements` rule rejects `<div role="region">` in favour of the semantic `<section>` element
  - [x] Apply accent background: `bg-[color:var(--color-accent)]` + bg text: `text-[color:var(--color-bg)]`
  - [x] Apply minimum height ~48pt: inline `style={{ minHeight: '48pt' }}`
  - [x] Left side: display `Currently performing:` label (from microcopy) + `{currentSongTitle}` in editorial serif
  - [x] Right side: `Resume ›` button with `aria-label="Resume performance"` calling `onResume` on click
  - [x] Ensure the button satisfies `min-w-tap min-h-tap` tap target size
  - [x] Layout: `flex items-center justify-between` with horizontal padding (`px-[var(--spacing-gutter)]`)
  - [x] Forward a `ref` to the Resume button so the Setlist overview can restore focus (AC-10)
  - [x] Create companion test file `web/src/components/currently-performing-strip.test.tsx`

- [x] **Task 3 — Add microcopy constants for Story 4.3** (AC: 4, 5, Voice & Tone)
  - [x] Appended `exitButton: '×'` and `ariaExitPerformance: 'Exit performance mode'` to `PERFORMANCE_CARD`
  - [x] Added new `CURRENTLY_PERFORMING` export with `label`, `ariaRegion`, `resumeButton`, `ariaResumeButton`
  - [x] Consuming files (`performance-card.tsx`, `currently-performing-strip.tsx`) read from these constants — no inline strings

- [x] **Task 4 — Add `×` exit button to `web/src/routes/performance-card.tsx`** (AC: 1, 2, 10)
  - [x] Restructured the header into a two-row layout (Row 1: `×` top-left + wake-lock/position indicators top-right; Row 2: `<h1>` title) — UX-DR9 four-corner separation satisfied.
  - [x] `×` button uses `min-h-tap min-w-tap` for the 44pt tap target and `text-[color:var(--color-text-secondary)]` for low emphasis (UX-DR4).
  - [x] `onClick` calls `navigate(/setlists/${setlistId})` — not `navigate(-1)`.
  - [x] Does NOT call `setActive(false)`. Does NOT call `wakeLock.release()`. Does NOT import `useSetPerformanceActive`.
  - [x] Added two `useEffect`s for Story 4.3 context sync: (a) `setPerformanceView('card')` on mount and `null` on unmount; (b) mirror `parsedSongIndex` into `setActiveSongIndex(parsedSongIndex)` so the strip surfaces the correct title after × exit.

- [x] **Task 5 — Wire `CurrentlyPerformingStrip` into `web/src/routes/setlist-overview.tsx`** (AC: 3, 4, 6, 7, 8)
  - [x] Imported `usePerformanceActive`, `useActivePerformanceSession`, `useSetPerformanceView` from `../performance/performance-context.js`
  - [x] Derived `isActiveSetlist = performanceActive && setlistId !== undefined && activeSetlistId === setlistId`
  - [x] Derived `currentPerformanceSongTitle` from the flattened setlist sections using `titleSnapshot` at `activeSongIndex` (AR-11 snapshot)
  - [x] Rendered the strip conditionally above the gig metadata `<header>` when `isActiveSetlist` is true
  - [x] Wired `setPerformanceView('overview')` on mount when `isActiveSetlist` is true (resets to `null` on unmount) — this drives the `useChromeVisible` override
  - [x] Wired focus restoration to the Resume button via `resumeButtonRef` once the strip mounts (AC-10)

- [x] **Task 6 — Implement performance state storage for Resume (Song index + active setlistId)**
  - [x] Extended `PerformanceModeContext` with `activeSetlistId: string | null`, `activeSongIndex: number`, `performanceView: 'card' | 'overview' | null` and the matching setters
  - [x] Added new hooks: `useActivePerformanceSession`, `useSetActivePerformanceSession`, `useSetActiveSongIndex`, `usePerformanceView`, `useSetPerformanceView`
  - [x] Wired `useStartPerformance` to call `setPerformanceSession(setlistId, 0)` immediately before `setActive(true)` so the strip's session pointer is correct from entry forward
  - [x] Wired the `PerformanceCard` route to mirror its URL `parsedSongIndex` into `setActiveSongIndex(parsedSongIndex)` on every change so the strip + Resume target stay accurate

- [x] **Task 7 — Resolve the chrome-visibility conflict** (AC: 3)
  - [x] Chose Option B from Dev Notes: encoded a `performanceView: 'card' | 'overview' | null` flag in `PerformanceModeContext`
  - [x] Updated `useChromeVisible()` so it returns `true` if Performance Mode is inactive OR `performanceView === 'overview'`
  - [x] `AuthenticatedShell` requires no further changes — it already reads from `useChromeVisible()` and gates `<BottomTabs>` accordingly
  - [x] Performance Card sets the view to `'card'` on mount and `null` on unmount; Setlist overview sets it to `'overview'` while `isActiveSetlist` is true and `null` on unmount

- [x] **Task 8 — Update `web/src/routes/performance-card.test.tsx`** (AC: 11)
  - [x] Added module mock for `../performance/performance-context.js` covering `useSetPerformanceView`, `useSetActiveSongIndex`, `useSetPerformanceActive`
  - [x] Added six new test cases for the × exit + session sync (aria, navigate target, setActive-not-called, DOM order check, view marker, song-index mirror)
  - [x] Preserved all 26 pre-existing test cases (no regressions; the new module-level mock keeps the prior assertions intact)

- [x] **Task 9 — Update `web/src/routes/setlist-overview.test.tsx`** (AC: 11)
  - [x] Added module mock for `../performance/performance-context.js` covering `usePerformanceActive`, `useActivePerformanceSession`, `useSetPerformanceView`
  - [x] Added seven new test cases for the strip — visibility (active, inactive, mismatched setlistId), title derivation, Resume navigation target, view marker, AC-10 focus restoration
  - [x] Preserved all existing setlist-overview test cases

- [x] **Task 10 — Verification pass** (AC: 12)
  - [x] `pnpm typecheck` green across all five packages
  - [x] `pnpm lint` green (Biome — no new `biome-ignore` directives)
  - [x] `pnpm test` green — **web 522 / api 103 / shared 26**; no regressions vs. Story 4.2 baseline (web +19 new cases)
  - [x] `pnpm build:web` green

(Commit is handled by the epic-run workflow per CLAUDE.md "Commit cadence" — not a story-level AC.)

## Dev Notes

### This story's scope

Story 4.3 adds two visible elements: the `×` exit button (top-left of Performance Card) and the `CurrentlyPerformingStrip` (top of Setlist overview when Performance state is active). It wires `Resume ›` back to the preserved Song index.

**What this story delivers:**
- `web/src/components/currently-performing-strip.tsx` (NEW)
- `web/src/components/currently-performing-strip.test.tsx` (NEW)
- `web/src/routes/performance-card.tsx` (UPDATE — add `×` button to top-left of header)
- `web/src/routes/performance-card.test.tsx` (UPDATE — `×` button test cases)
- `web/src/routes/setlist-overview.tsx` (UPDATE — render `CurrentlyPerformingStrip` when active)
- `web/src/routes/setlist-overview.test.tsx` (UPDATE — strip conditional render cases)
- `web/src/performance/performance-context.tsx` (UPDATE — add `activeSetlistId` + `activeSongIndex` to context)
- `web/src/hooks/use-chrome-visible.ts` (UPDATE — resolve chrome visibility after × exit)
- `web/src/lib/microcopy.ts` (UPDATE — add `ariaExitPerformance`, `exitButton`, `CURRENTLY_PERFORMING`)

**What this story does NOT deliver:**
- End Performance state on navigate-away (Story 4.4 owns this)
- `wakeLock.release()` on any exit path (Story 4.4 only)
- `setActive(false)` on any path (Story 4.4 owns end-state)
- Backgrounding / pre-fetch (Story 4.5)
- No changes to `api/` or `shared/`

### Critical invariant: FR-19 state preservation

The `×` button MUST NOT call `setActive(false)`. Performance state must remain `true` after × exit. `wakeLock.release()` must NOT be called. Only Story 4.4's navigate-away detection triggers these.

From architecture.md §Performance Mode invariants:
> **Exiting Performance Mode** (×, navigate-away):
> 1. Set `performanceActive = false` — ONLY for navigate-away, not × exit
> 2. Release Wake Lock only if state-ended via navigate-away (per FR-21); preserved on × (per FR-19)

From Story 4.2 Dev Notes "Handoff note for Story 4.3":
> Story 4.3 must NOT call `wakeLock.release()` on × exit. Only Story 4.4 (navigate-away end-state) calls `release()`.

### Critical challenge: chrome visibility after × exit

This is the most architecturally complex part of the story. `useChromeVisible()` returns `!usePerformanceActive()`. When `performanceActive === true`, the shell renders no tabs. After × exit `performanceActive` stays `true` — so without a fix, the Setlist overview renders without tabs.

FR-19 and the epics.md spec say:
> "the bottom tab bar reappears on iPhone (chrome shows when `performanceActive === true` BUT user is on the setlist that has active performance state)"

This is the spec's stated exception: the tab bar is visible on the active Setlist overview even when `performanceActive === true`.

**Recommended approach — extend `PerformanceModeContext`:**

Add a `performanceView: 'card' | 'overview' | null` field to context. The Performance Card sets it to `'card'` on mount and the Setlist overview sets it to `'overview'` when it detects active performance for its setlistId.

Then update `useChromeVisible()`:
```ts
export function useChromeVisible(): boolean {
  const { performanceActive, performanceView } = usePerformanceModeContext();
  // Chrome is visible when:
  // - Not in Performance Mode at all, OR
  // - In Performance Mode but viewing the Setlist overview (not the card)
  if (!performanceActive) return true;
  return performanceView === 'overview';
}
```

The `AuthenticatedShell` reads `useChromeVisible()` and shows/hides tabs based on this. No changes to `authenticated-shell.tsx` needed if `useChromeVisible()` is updated correctly.

**Alternative approach — URL-based detection:**

A lighter approach: `useChromeVisible()` checks if the current URL is `/setlists/*` when `performanceActive === true`. This avoids extending context but requires reading `useLocation()` inside `useChromeVisible`. The context approach is cleaner and more testable.

### Performance context extension

Current `performance-context.tsx` state:
- `performanceActive: boolean`
- `setActive: (active: boolean) => void`

Story 4.3 additions needed:
- `activeSetlistId: string | null` — which setlist is being performed
- `activeSongIndex: number` — which song index was last active
- A new setter `setPerformanceSession(setlistId: string, songIndex: number): void`
- `performanceView: 'card' | 'overview' | null` (for the chrome fix)

Story 4.1's `useStartPerformance` calls `setActive(true)` then navigates to `songIndex=0`. It must also call the new session setter. The task is to update `use-start-performance.ts` accordingly.

The Performance Card must update `activeSongIndex` in context whenever `parsedSongIndex` changes (each navigation between songs). Use a `useEffect(() => { setActiveSongIndex(parsedSongIndex); }, [parsedSongIndex])` or similar.

### Exact current `performance-card.tsx` header structure (must understand before modifying)

```tsx
<header className="shrink-0 bg-[color:var(--color-surface)] px-[var(--spacing-gutter)] py-[calc(var(--spacing-unit)*4)]"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
  {/* × exit: Story 4.3 lands the button here (top-left). */}
  <div className="flex items-start justify-between">
    <h1 className="...perf-title...">
      {song?.title ?? ''}
    </h1>
    {/* Right-hand slot — wake-lock indicator (Story 4.2) then position indicator */}
    <div className="ml-[...] flex shrink-0 items-center gap-[...]">
      {!wakeLockHeld && <span ...wake-lock-indicator... />}
      <span ...position-indicator... />
    </div>
  </div>
  {/* key + patch row */}
  ...
</header>
```

The `×` comment is OUTSIDE the flex row. Insert the `×` button inside the header, restructuring to achieve UX-DR9 spatial separation. Suggested restructure:

```tsx
<header ...>
  {/* Row 1: × (top-left) + wake-lock + position indicator (top-right) */}
  <div className="flex items-center justify-between">
    <button type="button" aria-label={PERFORMANCE_CARD.ariaExitPerformance}
            onClick={() => navigate(`/setlists/${setlistId}`)}
            className="min-h-tap min-w-tap text-[length:var(--text-perf-meta)] ... text-[color:var(--color-text-secondary)]">
      {PERFORMANCE_CARD.exitButton}
    </button>
    <div className="flex shrink-0 items-center gap-[...]">
      {!wakeLockHeld && <span ...wake-lock-indicator... />}
      <span ...position-indicator... />
    </div>
  </div>
  {/* Row 2: Song title */}
  <h1 className="... mt-[calc(var(--spacing-unit)*2)]">
    {song?.title ?? ''}
  </h1>
  {/* Row 3: key + patch */}
  ...
</header>
```

This satisfies UX-DR9 naturally: `×` top-left, position indicator top-right, `‹` bottom-left, `NEXT ›` bottom-right.

### Exact current `setlist-overview.tsx` strip placeholder

```tsx
<section aria-labelledby="setlist-overview-heading" className="flex flex-col gap-[var(--spacing-section-gap)]">
  {/* Epic 4: <CurrentlyPerformingStrip /> mounts here. */}
  <header className="flex flex-col gap-[calc(var(--spacing-unit)*1)]">
    ...
  </header>
  ...
</section>
```

Replace the comment with the conditional strip render ABOVE the `<header>`.

### `currentSongTitle` derivation for the strip

The `CurrentlyPerformingStrip` needs the title of the song currently being performed. Given `activeSongIndex` from context and `setlist.sections`, derive it via:
```ts
const flatSongs = setlist.sections.flatMap(s => s.songs);
const currentPerformanceSongTitle = flatSongs[activeSongIndex]?.titleSnapshot ?? '';
```
This uses `titleSnapshot` from the Setlist record — correct per AR-11 (the snapshot is what was authored at gig time).

### `×` navigate: use `setlistId` from params, not `activeSetlistId` from context

In `performance-card.tsx`, `setlistId` is already available from `useParams`. Use it directly for the navigate target. The context's `activeSetlistId` is for the overview to check if it should show the strip — the card doesn't need to look it up from context.

### UX-DR9 spatial separation rule

From architecture.md / epics.md: "`×` exit, `‹ back`, and `NEXT ›` are never placed in the same corner. Encoded as a component-layout invariant on `PerformanceCard`, surfaced in the component test plan."

The test for this: `×` is in the document BEFORE (above) the bottom toolbar containing `‹` and `NEXT ›`, and it is in the left-aligned position while `‹` is also left in the footer but physically at a different vertical position (the header vs. the footer). This is a layout invariant, not just a visual one. Tests can assert DOM order.

### Performance Mode invariants (architecture.md AR-28)

While `performanceActive === true`:
- No toasts shown (held in queue — NOT changed by this story)
- No banners shown
- No auth-failure redirects to `/login`
- All reads come from cache

The `CurrentlyPerformingStrip` is NOT a toast or banner — it is a persistent UI element on the overview. It is exempt from the "no toasts in Performance Mode" rule.

### Touch target sizing for `×`

From the spec: `×` is "~28pt icon target" but the AC says `min-w-tap min-h-tap` (44pt minimum). This means the visible `×` glyph may be ~28pt but the tappable button element is 44pt. Use negative margin or padding expansion to achieve this. Pattern from other components:
```tsx
className="min-h-tap min-w-tap flex items-center justify-center text-[length:var(--text-perf-meta)] ..."
```
The 44pt tap target wraps a smaller glyph. This is standard iOS practice.

### iOS safe-area inset handling

The Performance Card header has `style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}`. The `×` button is inside this header and therefore already clear of the iOS status bar notch. No special safe-area handling needed for the button itself.

### Voice & Tone compliance

From UX-DR7 / EXPERIENCE.md: short complete sentences, no exclamation marks, no emoji.
- `×` glyph: acceptable — it is an interactive control, not copy
- `Resume ›` button text: the `›` is a standard progress chevron used in the app (see `Start performance ›` in ACTIONS)
- `Currently performing:` label: short, direct, no marketing voice — compliant

### Biome lint notes

- `useAriaPropsSupportedByRole`: The `×` button uses `type="button"` with `aria-label` — standard and accepted
- `useExhaustiveDependencies`: Any `useEffect` for `activeSongIndex` sync needs `parsedSongIndex` and the setter in deps
- `noNonNullAssertion`: Avoid `!` assertions on setlistId from params; use `?? ''` or early return guards
- `noArrayIndexKey`: `currently-performing-strip.tsx` has no lists — not applicable

### Test count projection

Story 4.2 exit: **web 503 / api 103 / shared 26**

New tests to add (estimate):
- `currently-performing-strip.test.tsx`: ~5 cases
- `performance-card.test.tsx` additions: ~4 cases
- `setlist-overview.test.tsx` additions: ~4 cases
- `performance-context.test.tsx` additions (if needed): ~2 cases

Expected Story 4.3 final: **web ~518, api 103 unchanged, shared 26 unchanged**

### Architecture compliance checklist

- **FR-19:** `×` exit does NOT call `setActive(false)`. Performance state is preserved.
- **FR-20:** `CurrentlyPerformingStrip` is visible on the active Setlist overview with `Resume ›` returning to the preserved Song index.
- **AR-28:** `CurrentlyPerformingStrip` is NOT a toast or banner — it is a persistent UI element exempt from the "no toasts" rule.
- **UX-DR4:** `× exit` is "small (~28pt icon), low emphasis" in `text-secondary`. `CurrentlyPerformingStrip` is "top-anchored, accent background, Resume › right-aligned, ~48pt tall."
- **UX-DR6:** `aria-label="Exit performance mode"` on `×`; `aria-label="Resume performance"` on `Resume ›`; region label on the strip.
- **UX-DR9:** `×` top-left, `‹` bottom-left, `NEXT ›` bottom-right, position indicator top-right — four separate corners.
- **NFR-20:** Both `×` and `Resume ›` satisfy `min-w-tap min-h-tap` (44×44pt minimum).
- **AR-46:** No analytics SDK, no Redux/Zustand, no CSS-in-JS, no animation library added.

### Locked design constraints (from epic context)

- Visual direction is LOCKED — do not alter colors, typography, or layout philosophy
- Sandy IS the user — no persona ceremony
- iOS PWA + Safari cookie sharing is intentional
- Performance Mode: NEVER make a routine "advance" gesture transform into a destructive/terminating action. The `×` is a low-emphasis exit, not a primary action.
- The last Song `NEXT ›` is handled by Story 4.4 — Story 4.3 does NOT change `NEXT ›` behavior

### Handoff note for Story 4.4

Story 4.4 (end-state on navigate-away) will:
1. Detect navigate-away via router listener (watching for routes outside the active performance chain)
2. Call `setActive(false)` on `PerformanceModeContext` + reset `activeSetlistId` + `activeSongIndex`
3. Call `wakeLock.release()` — the ONLY legitimate caller
4. Flush held-toast queue

Story 4.4 must NOT be confused by the "× exit to overview" path — that path leaves `performanceActive === true` and the strip visible. Story 4.4 only fires when the user navigates AWAY from the active Setlist chain entirely.

### Project Structure Notes

New file locations (per architecture.md §Directory tree):
- `web/src/components/currently-performing-strip.tsx` — named reusable components live in `web/src/components/`
- `web/src/components/currently-performing-strip.test.tsx` — co-located test per AR-5 testing standards

Updated files:
- `web/src/routes/performance-card.tsx` — adds `×` button
- `web/src/routes/performance-card.test.tsx` — adds `×` test cases
- `web/src/routes/setlist-overview.tsx` — wires `CurrentlyPerformingStrip`
- `web/src/routes/setlist-overview.test.tsx` — adds strip conditional cases
- `web/src/performance/performance-context.tsx` — extends with session state
- `web/src/hooks/use-chrome-visible.ts` — resolves chrome visibility conflict
- `web/src/lib/microcopy.ts` — adds new constants (append-only, no mutations)
- `web/src/performance/use-start-performance.ts` — calls new session setter on entry

### References

- [Source: epics.md — Story 4.3 acceptance criteria]
- [Source: architecture.md — §Performance Mode invariants, §State management taxonomy]
- [Source: architecture.md — UX-DR4, UX-DR6, UX-DR9, AR-28]
- [Source: architecture.md — §Accessibility implementation primitives]
- [Source: 4-2-wake-lock-with-persistent-indicator-and-backoff.md — Handoff note for Story 4.3]
- [Source: web/src/routes/performance-card.tsx — existing header layout and comment placeholders]
- [Source: web/src/routes/setlist-overview.tsx — existing strip placeholder comment]
- [Source: web/src/performance/performance-context.tsx — current context shape]
- [Source: web/src/hooks/use-chrome-visible.ts — chrome visibility logic]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — bmad-dev-story workflow (epic-run wrapper).

### Debug Log References

- Initial lint run flagged six format issues (auto-fixed by `biome check --write`) and one `useSemanticElements` rule violation on the strip; resolved by switching `<div role="region">` to `<section aria-label="…">` which carries the implicit `region` role.
- First test run failed with "PerformanceMode hooks must be used inside <PerformanceModeProvider>" in both `performance-card.test.tsx` and `setlist-overview.test.tsx`. Resolved by adding module-level `vi.mock('../performance/performance-context.js', …)` in both files with hoisted setter/getter mocks.
- Build-time `tsc` (which includes test files via Vite plugin) failed once on hoisted mock type inference (`activeSetlistId: null` inferred as literal `null`). Resolved by typing the mock factory: `vi.fn<() => { activeSetlistId: string | null; activeSongIndex: number }>(…)`.
- Final post-fix lint pass surfaced one residual formatting issue in `performance-card.test.tsx` (collapsing two `await user.click(…)` calls onto one line); applied via `biome check --write`.

### Completion Notes List

- Story scope respected — no Story 4.4 logic (no `setActive(false)`, no `wakeLock.release()`, no navigate-away detection).
- `PerformanceModeContext` extended with three additive fields: `activeSetlistId`, `activeSongIndex`, `performanceView` plus matching setters. All existing `usePerformanceActive` / `useSetPerformanceActive` consumers continue to work without change.
- `useChromeVisible()` now returns `true` when the user is on the active Setlist overview (`performanceView === 'overview'`) even while `performanceActive === true`. This satisfies the epic spec's exception — the iPhone tab bar reappears on the active Setlist's overview only.
- `PerformanceCard` header was restructured into a two-row layout: row 1 = `×` top-left + wake-lock/position-indicator top-right; row 2 = `<h1>` title. UX-DR9 four-corner separation is now structural (not just visual).
- The `CurrentlyPerformingStrip` derives its title from `setlist.sections.flatMap(s => s.songs)[activeSongIndex]?.titleSnapshot` (AR-11 snapshot, not the latest Song record) so the strip always reflects the as-authored gig title.
- Focus restoration: `setlist-overview.tsx` calls `resumeButtonRef.current?.focus()` once the strip mounts under `isActiveSetlist`. Verified via `expect(document.activeElement).toBe(resume)` test.
- Voice & Tone compliance — the only new strings are `Currently performing:`, `Resume ›`, `Exit performance mode`, `Resume performance`, all matching EXPERIENCE.md rules (short complete sentences, no exclamation, no marketing voice, no emoji).
- Test counts: web 503 → 522 (+19), api 103 unchanged, shared 26 unchanged. Spec projected ~+15 new web tests; the +19 includes one additional case for the `useStartPerformance` session-pointer seed.
- Pre-flight `git rev-parse HEAD` recorded `35acd6e16c2b8cc2c0bf27ac5316af8896356c56` (matches existing `baseline_commit` in YAML frontmatter — unchanged).

### File List

**Added**
- `web/src/components/currently-performing-strip.tsx`
- `web/src/components/currently-performing-strip.test.tsx`

**Modified**
- `web/src/performance/performance-context.tsx` (added `activeSetlistId`, `activeSongIndex`, `performanceView` + setters + new hooks; existing API preserved)
- `web/src/performance/use-start-performance.ts` (seeds session pointer at entry via `setPerformanceSession(setlistId, 0)`)
- `web/src/performance/use-start-performance.test.ts` (added session-pointer mock + new assertion)
- `web/src/hooks/use-chrome-visible.ts` (reads `performanceView`; chrome visible when active view is `'overview'`)
- `web/src/routes/performance-card.tsx` (× exit button in top-left, two-row header, `performanceView` + `activeSongIndex` sync effects)
- `web/src/routes/performance-card.test.tsx` (added performance-context module mock + six new cases; preserved 26 existing cases)
- `web/src/routes/setlist-overview.tsx` (renders `CurrentlyPerformingStrip` above gig header when `isActiveSetlist`, focus restoration, view marker)
- `web/src/routes/setlist-overview.test.tsx` (added performance-context module mock + seven new strip cases; preserved existing cases)
- `web/src/lib/microcopy.ts` (added `exitButton`, `ariaExitPerformance` to `PERFORMANCE_CARD`; added new `CURRENTLY_PERFORMING` export)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (4-3 → in-progress → review)

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-06-21 | Claude Opus 4.7 (epic-run) | Implemented Story 4.3: × exit on Performance Card preserves Performance state; `CurrentlyPerformingStrip` on active Setlist overview with `Resume ›`; chrome-visibility override via `performanceView` context flag. web tests 503 → 522. |
