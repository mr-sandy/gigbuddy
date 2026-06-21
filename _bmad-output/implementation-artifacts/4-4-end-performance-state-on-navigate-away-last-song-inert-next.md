---
baseline_commit: "ba6b85e"
builds_on: 4-3-exit-via-x-currently-performing-strip-resume
---

# Story 4.4: End Performance state on navigate-away + last-song inert `NEXT ›` (FR-21)

Status: review

## Story

As Sandy,
I want Performance state to END only when I navigate away from the active Setlist entirely, and I want `NEXT ›` to become inert (visibly disabled, no action) when I reach the last Song,
so that I can never accidentally terminate Performance Mode with the same gesture I use to advance Songs.

## Acceptance Criteria

**AC-1 — Navigate-away ends Performance state**

**Given** `performanceActive === true` AND a Setlist is the active performance context
**When** Sandy navigates the router to any of these destinations: a different Setlist overview, the Setlists home (`/`), the Library (`/library`), the install-instructions screen, a Song Detail for a Song NOT referenced by the active Setlist (`/songs/:songId` where `songId ∉ activeSetlist.sections[].songs[].songId`), or any other non-active-chain route
**Then** Performance state ENDS: `setActive(false)` is called, Wake Lock is released via `wakeLock.release()`, the `CurrentlyPerformingStrip` (Story 4.3) disappears, and any queued stale-write notice becomes visible (the `StaleWriteBanner` auto-renders when `performanceActive` becomes `false`)

**AC-2 — Song Detail for a Song IN the active Setlist does NOT end state**

**Given** the active Setlist is, e.g., `setlist-A` with `performanceActive === true`
**When** Sandy is on `/setlists/setlist-A` (active overview) and taps a Song row whose `songId` IS referenced by `setlist-A`
**Then** the router navigates to `/songs/:songId` — Performance state REMAINS `true` (the Song is within the active Setlist's chain)
**And** returning back to `/setlists/setlist-A` restores the strip visibility

**AC-3 — Song Detail for a Song NOT in the active Setlist ends state**

**Given** the active Setlist is `setlist-A` with `performanceActive === true`
**When** Sandy navigates to `/songs/:songId` where that `songId` is NOT in `setlist-A`'s sections
**Then** this is treated as "navigate away from the Setlist chain" — Performance state ENDS per AC-1

**AC-4 — Last-Song `NEXT ›` is visibly disabled**

**Given** the Performance Card is on the LAST Song of the LAST non-empty Section (flat index `flatSongs.length - 1`)
**When** the card renders
**Then** `NEXT ›` is rendered in a disabled visual state: dimmed (`opacity-40`) accent background, `aria-disabled="true"` set on the button, and `disabled` attribute present
**And** tapping `NEXT ›` does NOTHING — no action, no navigate call, no toast, no error, no haptic, no transition
**And** the next-song preview area in the bottom toolbar shows empty string (no "End of setlist" text — silent per PRD Voice & Tone)

**AC-5 — `‹` still works from the last Song**

**Given** the Performance Card is on the last Song
**When** Sandy taps `‹`
**Then** the card transitions normally to the previous Song (per Story 4.1)
**And** `NEXT ›` returns to its enabled visual state for that earlier Song (previous Songs are not the last)

**AC-6 — `×` exit on last Song preserves state**

**Given** the Performance Card is on the last Song
**When** Sandy taps `×`
**Then** the exit behavior from Story 4.3 applies: `performanceActive` REMAINS `true`, the `CurrentlyPerformingStrip` shows on the overview with `Resume ›` returning to the last Song index
**And** `setActive(false)` and `wakeLock.release()` are NOT called by this path

**AC-7 — No `End performance ›` button anywhere in the UI**

**Given** an audit of all Performance Mode surfaces
**When** the codebase is reviewed
**Then** no component renders an "End performance" button or affordance
**And** the comment in `performance-card.tsx` explains the safety rationale: "NEXT › must never transform into a terminating action at the last Song — prefer inert/disabled per FR-21 and the locked memory note"

**AC-8 — Wake Lock released on end-state**

**Given** `wakeLock.release()` is the ONLY call site for releasing the lock
**When** Performance state ends (AC-1 triggers)
**Then** `wakeLock.release()` is called exactly once on navigate-away
**And** `wakeLock.setPerformanceActiveForWakeLock(false)` is also called to stop retry loops (per `wake-lock.ts` contract)
**And** `wakeLock.release()` is NOT called on `×` exit (Story 4.3 path — that preserves state)

**AC-9 — Stale-write notice becomes visible after end-state**

**Given** a stale-write notice was queued during Performance Mode (stored in `stale-notice-store.ts`)
**When** Performance state ends via navigate-away and `setActive(false)` runs
**Then** the `StaleWriteBanner` on the new route becomes visible automatically (it reads `performanceActive` via `usePerformanceActive()` and re-renders when the context changes)
**And** no explicit "flush" call is required — the banner's suppression check (`if (performanceActive) return null`) is lifted

**AC-10 — Context reset on end-state**

**Given** `setActive(false)` is called on navigate-away
**When** the Performance Mode context updates
**Then** `activeSetlistId` is reset to `null`, `activeSongIndex` is reset to `0`, and `performanceView` is reset to `null`
**And** these resets ensure a fresh `Start performance ›` on the same or a different Setlist starts cleanly (no stale session pointer)

**AC-11 — Unit tests**

**Given** `web/src/routes/performance-card.test.tsx` (UPDATE)
**When** tests run
**Then** the following cases pass:
  - Last Song (`songIndex = flatSongs.length - 1`): `NEXT ›` has `disabled` and `aria-disabled="true"`
  - Last Song: tapping `NEXT ›` does NOT call `navigate`
  - Last Song: `NEXT ›` has `opacity-40` (or equivalent disabled opacity class) applied
  - Last Song: next-song preview is empty string (no "End of setlist" text)
  - Non-last Song: `NEXT ›` is NOT disabled (`disabled` absent or `false`)

**Given** `web/src/hooks/use-performance-end.test.ts` (NEW file)
**When** tests run
**Then** the following cases pass:
  - Returns `endPerformance` function
  - `endPerformance()` calls `setActive(false)`
  - `endPerformance()` calls `wakeLock.release()`
  - `endPerformance()` calls `wakeLock.setPerformanceActiveForWakeLock(false)` before `release()`
  - `endPerformance()` calls `setPerformanceSession(null, 0)` or resets context

**Given** router-level navigate-away detection
**When** tests cover the detection logic
**Then** tests cover: navigate to `/` (home) → ends state; navigate to `/library` → ends state; navigate to `/setlists/other-setlist` → ends state; navigate to `/songs/:songId` NOT in active setlist → ends state; navigate to `/songs/:songId` IS in active setlist → does NOT end state; navigate to `/performance/:sameSetlistId/:index` → does NOT end state

**AC-12 — Verification pass**

**Given** the implementation is complete
**When** the following run
**Then** `pnpm typecheck` passes across all five packages
**And** `pnpm lint` passes (no new `biome-ignore` directives)
**And** `pnpm test` passes with no regressions; Story 4.3 baseline was **web 522 / api 103 / shared 26**
**And** `pnpm build:web` succeeds

## Tasks / Subtasks

- [x] **Task 1 — Read existing files before touching anything** (prerequisite — non-negotiable)
  - [x] Read `web/src/routes/performance-card.tsx` end-to-end (understand the exact current NEXT › button, its `onClick` navigating to `parsedSongIndex + 1`, the `nextSongRef` derivation, and the `isFirst` pattern to copy for `isLast`)
  - [x] Read `web/src/routes/performance-card.test.tsx` end-to-end (understand the 32 test cases from Stories 4.1/4.2/4.3 and the module-level mock pattern with `navigateMock`, `setPerformanceViewMock`, `setActiveSongIndexMock`)
  - [x] Read `web/src/performance/performance-context.tsx` (understand all current hooks — `useSetPerformanceActive`, `useSetActivePerformanceSession`, `useSetPerformanceView` — these are all needed for end-state cleanup)
  - [x] Read `web/src/performance/wake-lock.ts` (understand `release()` and `setPerformanceActiveForWakeLock(false)` — both must be called on end-state; `release()` alone is insufficient to stop retry loops)
  - [x] Read `web/src/sync/stale-notice-store.ts` (confirm that setting `performanceActive=false` in context automatically un-suppresses `StaleWriteBanner` — no explicit flush needed)
  - [x] Read `web/src/router.tsx` (understand the route tree — the navigate-away detection hook needs to know which URL patterns constitute the "active Setlist chain")
  - [x] Read `web/src/routes/authenticated-shell.tsx` (understand where a router-listener hook should be mounted for global navigate-away detection)
  - [x] Read `web/src/lib/microcopy.ts` (confirm no new strings needed for this story — last-Song is silent per Voice & Tone; no "End of setlist" copy)

- [x] **Task 2 — Implement `web/src/hooks/use-performance-end.ts`** (NEW file — AC: 1, 8, 9, 10)
  - [x] Import `useSetPerformanceActive`, `useSetActivePerformanceSession`, `useSetPerformanceView` from `../performance/performance-context.js`
  - [x] Import `* as wakeLock` from `../performance/wake-lock.js`
  - [x] Export `usePerformanceEnd()` hook returning a stable `endPerformance()` callback (wrapped in `useCallback`)
  - [x] `endPerformance()` body in order: (a) `wakeLock.setPerformanceActiveForWakeLock(false)` — stops retry loops before release; (b) `wakeLock.release()` — drops the sentinel; (c) `setPerformanceSession(null, 0)` or equivalent context reset (`activeSetlistId → null`, `activeSongIndex → 0`); (d) `setPerformanceView(null)`; (e) `setActive(false)` — LAST, so the banner suppression lifts after everything else is cleaned up
  - [x] NOTE: `setPerformanceSession(setlistId, songIndex)` requires a `string` for `setlistId` — need to add a `resetPerformanceSession()` hook or extend the context to accept `null`. See Dev Notes for approach.
  - [x] Create companion test file `web/src/hooks/use-performance-end.test.ts`

- [x] **Task 3 — Implement navigate-away detection** (AC: 1, 2, 3)
  - [x] Use React Router's `useEffect` + `useLocation()` pattern OR the `useNavigationType`/`router.subscribe` pattern to detect route changes
  - [x] The detector must run inside the `AuthenticatedShell` (or as a hook on a component that is always mounted while authenticated) so it sees every navigation
  - [x] Detection logic: given `performanceActive === true` and `activeSetlistId !== null`, compare the new pathname to the active chain:
    - `/performance/${activeSetlistId}/*` → in chain → do NOT end
    - `/setlists/${activeSetlistId}` → in chain (active overview after × exit) → do NOT end
    - `/songs/:songId` where `songId ∈ activeSetlist songIds` → in chain → do NOT end
    - Anything else → end state via `endPerformance()`
  - [x] To check "is this songId in the active Setlist", the detector needs access to the Setlist data. Use `useSetlist(activeSetlistId)` (TanStack Query, reads from cache — no network call during Performance Mode per AR-28) to get the flat song ID set
  - [x] Add the navigate-away detection to `web/src/routes/authenticated-shell.tsx` OR create a dedicated `web/src/hooks/use-navigate-away-guard.ts` hook mounted inside `AuthenticatedShell`

- [x] **Task 4 — Make `NEXT ›` inert on the last Song in `performance-card.tsx`** (AC: 4, 5, 7)
  - [x] Derive `isLast`: `parsedSongIndex === flatSongs.length - 1` (analogous to the existing `isFirst` pattern already in the file)
  - [x] Update the `NEXT ›` button:
    - Add `disabled={isLast}` and `aria-disabled={isLast}` (match the `‹` pattern exactly)
    - Add `onClick`: when `isLast`, return early with no action — `if (isLast) return;` (or rely on `disabled` attribute to suppress the click — but add the guard for defence-in-depth matching the `‹` pattern)
    - Add `disabled:opacity-40` to className (matching the existing `‹` disabled styling)
  - [x] Update the next-song preview `<span>`: already renders `nextSongRef?.titleSnapshot ?? ''` — when on the last Song, `nextSongRef` is `null` (no entry at `parsedSongIndex + 1`), so it naturally renders empty. Verify this is the case and add a comment explaining the intent.
  - [x] Add comment near `NEXT ›` button: "Last-Song: NEXT › is inert (disabled) — must never transform into an end-performance action (FR-21, locked memory note). Story 4.4 owns this. Story 4.3's × is the low-emphasis exit."

- [x] **Task 5 — Add context reset capability for end-state** (AC: 10)
  - [x] Extend `PerformanceModeContext` minimally to support resetting the session (null setlistId). Options:
    - Option A: Change `setPerformanceSession` signature to accept `(setlistId: string | null, songIndex: number)` — the setter already calls `setActiveSetlistIdState(setlistId)` which accepts `string | null`
    - Option B: Add a separate `resetPerformanceSession()` function to context
  - [x] Preferred: Option A — the TS type for `activeSetlistId` is already `string | null`; just relax the setter's parameter type. Existing callers (`useStartPerformance`) pass a string, so no regression.
  - [x] Export a new `useResetPerformanceSession()` hook OR update `useSetActivePerformanceSession()` to accept `null` as setlistId

- [x] **Task 6 — Update `web/src/routes/performance-card.test.tsx`** (AC: 11)
  - [x] Add describe block `PerformanceCard — last-song inert NEXT › (Story 4.4)` with test cases:
    - Last Song (songIndex=2, flatSongs.length=3): `NEXT ›` has `disabled=true`
    - Last Song: `NEXT ›` has `aria-disabled="true"`
    - Last Song: tapping `NEXT ›` does NOT call `navigate`
    - Last Song: next-song preview is empty (no "End of setlist" text or any other copy)
    - Non-last Song (songIndex=1): `NEXT ›` is NOT disabled
  - [x] Preserve all 32 pre-existing test cases

- [x] **Task 7 — Create `web/src/hooks/use-performance-end.test.ts`** (AC: 11)
  - [x] Mock `../performance/performance-context.js`, `../performance/wake-lock.js`
  - [x] Test cases: hook returns function; calling it invokes `wakeLock.setPerformanceActiveForWakeLock(false)` before `wakeLock.release()`; calling it invokes `setActive(false)`; calling it resets session state

- [x] **Task 8 — Verification pass** (AC: 12)
  - [x] `pnpm typecheck` green across all five packages
  - [x] `pnpm lint` green (no new `biome-ignore` directives)
  - [x] `pnpm test` green — no regressions vs. Story 4.3 baseline (web 522 / api 103 / shared 26); new tests pass
  - [x] `pnpm build:web` green

(Commit is handled by the epic-run workflow per CLAUDE.md "Commit cadence" — not a story-level AC.)

## Dev Notes

### What this story delivers

Story 4.4 adds two distinct features:

1. **Navigate-away end-state detection** — a listener that watches route changes and calls `endPerformance()` when Sandy leaves the active Setlist chain while `performanceActive === true`.
2. **Last-Song `NEXT ›` inert treatment** — the final button in the toolbar becomes visibly disabled and non-functional on the last Song of the last Section.

**What this story does NOT deliver:**
- Any change to the `×` exit path (Story 4.3 owns that — × leaves `performanceActive === true`)
- Any `wakeLock.release()` call on `×` exit (only on navigate-away)
- Backgrounding/pre-fetch (Story 4.5)
- No changes to `api/` or `shared/`
- No `End performance ›` button — ever

### Critical invariant: no `End performance ›` button

From FR-21 and the locked memory note: "never make a routine advance gesture transform into a destructive/terminating action at a boundary — prefer inert/disabled at the last song."

The `NEXT ›` button is DISABLED on the last Song, not converted to an "End" button. Sandy can only end Performance state by navigating away (tabs → home/library, or browser back). This is deliberate safety design.

### `wakeLock.release()` and `setPerformanceActiveForWakeLock(false)` BOTH required

From `wake-lock.ts` (read it before implementing):

```ts
export function release(): void {
  // Explicit external release — only called by Story 4.4 end-state.
  // Stop all retry activity, drop the sentinel, notify subscribers.
  performanceActive = false;
  cancelRetry();
  ...
}

export function setPerformanceActiveForWakeLock(active: boolean): void {
  performanceActive = active;
  if (!active) { cancelRetry(); }
}
```

`release()` already sets the module-scope `performanceActive = false` and calls `cancelRetry()`. So calling `setPerformanceActiveForWakeLock(false)` before `release()` is redundant but harmless — if you call just `release()`, the retry loop is stopped. Calling both is belt-and-suspenders. The comment in `wake-lock.ts` says "Story 4.4 will call it with `false` as part of end-state cleanup (alongside `release()`)." Follow the documented contract: call both.

Order in `endPerformance()`:
1. `wakeLock.setPerformanceActiveForWakeLock(false)` — stops retries
2. `wakeLock.release()` — drops the sentinel (fire-and-forget async internally)
3. Reset context: `setPerformanceView(null)`, reset session
4. `setActive(false)` — LAST: lifts all Performance Mode suppressions (banner, toast, auth redirect)

### Navigate-away detection: recommended approach

Use a hook that subscribes to `useLocation()` from React Router. Mount it inside `AuthenticatedShell` (or as a top-level effect inside it) so it runs on every authenticated navigation.

```ts
// web/src/hooks/use-navigate-away-guard.ts
export function useNavigateAwayGuard(): void {
  const location = useLocation();
  const performanceActive = usePerformanceActive();
  const { activeSetlistId } = useActivePerformanceSession();
  const endPerformance = usePerformanceEnd();
  // Need the active Setlist's song IDs to check if /songs/:id is in chain
  const { data: setlist } = useSetlist(activeSetlistId);

  useEffect(() => {
    if (!performanceActive || activeSetlistId === null) return;

    const pathname = location.pathname;

    // Active chain routes — do NOT end Performance state:
    if (pathname.startsWith(`/performance/${activeSetlistId}/`)) return;
    if (pathname === `/setlists/${activeSetlistId}`) return;

    // /songs/:songId — in chain only if the songId is in the active Setlist
    const songDetailMatch = pathname.match(/^\/songs\/([^/]+)$/);
    if (songDetailMatch && setlist !== null && setlist !== undefined) {
      const songId = songDetailMatch[1];
      const activeSongIds = new Set(
        setlist.sections.flatMap(s => s.songs.map(r => r.songId))
      );
      if (activeSongIds.has(songId)) return; // in chain
    }

    // Everything else (/, /library, /setlists/other, /songs/not-in-setlist) ends state
    endPerformance();
  }, [location.pathname, performanceActive, activeSetlistId, setlist, endPerformance]);
}
```

**Important:** `useSetlist(activeSetlistId)` reads from TanStack Query cache — no network call. During Performance Mode, the Setlist is cached (prefetched on entry). This is correct per AR-28: "All reads come from cache" in Performance Mode.

**Caution:** The `useEffect` runs AFTER the route renders. This is acceptable — the new route renders briefly before `endPerformance()` fires, but the `StaleWriteBanner` is suppressed by `performanceActive === true` until the effect runs. The brief render gap is imperceptible.

**Where to mount:** Add `useNavigateAwayGuard()` call inside `AuthenticatedShell` — it's always mounted and always sees every authenticated navigation. No JSX output needed; the hook is pure effect.

### `usePerformanceEnd` hook design

```ts
// web/src/hooks/use-performance-end.ts
export function usePerformanceEnd(): () => void {
  const setActive = useSetPerformanceActive();
  const setPerformanceView = useSetPerformanceView();
  // Need to reset session — either via a new hook or relaxed signature
  const resetSession = useResetPerformanceSession(); // see Task 5
  return useCallback(() => {
    wakeLock.setPerformanceActiveForWakeLock(false);
    wakeLock.release();
    setPerformanceView(null);
    resetSession(); // sets activeSetlistId=null, activeSongIndex=0
    setActive(false); // LAST — lifts suppressions
  }, [setActive, setPerformanceView, resetSession]);
}
```

### Context extension for session reset (Task 5)

Current `performance-context.tsx` `setPerformanceSession` signature:
```ts
setPerformanceSession: (setlistId: string, songIndex: number) => void;
```

The state type for `activeSetlistId` is already `string | null`. To allow reset, change the setter parameter type:
```ts
setPerformanceSession: (setlistId: string | null, songIndex: number) => void;
```

This is additive — existing callers pass `string`, which is still valid. Add a `useResetPerformanceSession()` convenience hook:
```ts
export function useResetPerformanceSession(): () => void {
  const { setPerformanceSession } = useCtx();
  return useCallback(() => setPerformanceSession(null, 0), [setPerformanceSession]);
}
```

### Last-Song `isLast` derivation

In `performance-card.tsx`, the `isFirst` pattern already exists:
```ts
const isFirst = parsedSongIndex === 0;
```

Add symmetrically:
```ts
const isLast = parsedSongIndex === flatSongs.length - 1;
```

Then update the `NEXT ›` button (currently at the bottom of the file):
```tsx
<button
  ref={nextButtonRef}
  type="button"
  aria-label={PERFORMANCE_CARD.ariaNextSong}
  disabled={isLast}
  aria-disabled={isLast}
  onClick={() => {
    if (isLast) return; // Story 4.4: inert on last Song (FR-21)
    navigate(`/performance/${setlistId}/${parsedSongIndex + 1}`);
  }}
  className="min-h-tap rounded-[var(--radius-button)] bg-[color:var(--color-accent)] px-[calc(var(--spacing-unit)*4)] text-[length:var(--text-section-heading)] leading-[var(--text-section-heading--line-height)] font-[family-name:var(--font-serif-editorial)] text-[color:var(--color-bg)] disabled:opacity-40"
>
  {PERFORMANCE_CARD.nextSong}
</button>
```

The existing `isFirst` guard on `‹` uses this pattern exactly — match it.

### Next-song preview on last Song

The preview `<span>` already handles this correctly:
```tsx
{nextSongRef?.titleSnapshot ?? ''}
```

When `parsedSongIndex === flatSongs.length - 1`, `nextSongRef = flatSongs[parsedSongIndex + 1]` is `undefined` (out of bounds), so `nextSongRef?.titleSnapshot ?? ''` evaluates to `''`. Empty string renders as nothing visible. No "End of setlist" copy. This is already correct behavior — just add a comment confirming the intent.

### Stale-write banner auto-surfaces on end-state

The `StaleWriteBanner` (in `AuthenticatedShell` or wherever it is mounted) already reads `performanceActive` via `usePerformanceActive()`:
```ts
if (performanceActive) return null;
```

When `setActive(false)` fires, React re-renders, and the banner becomes visible if `stale-notice-store.ts` has a pending notice. No explicit "flush" is needed — the suppression lift is automatic.

This satisfies the AR-28 requirement: "held-toast queue flushes on exit." In GigBuddy's implementation the "toast" is the stale-write banner, not an explicit queue.

### `AuthenticatedShell` — where to mount the guard

Read `web/src/routes/authenticated-shell.tsx` before implementing. The guard hook should be called at the top of the component body (no JSX needed):

```tsx
export function AuthenticatedShell(): JSX.Element {
  // ...existing hooks...
  useNavigateAwayGuard(); // Story 4.4 — ends Performance state on navigate-away
  // ...rest of component...
}
```

### Edge case: `useLocation` fires on initial mount

`useEffect(() => { ... }, [location.pathname, ...])` also fires on the initial render of `AuthenticatedShell`. At initial mount, `performanceActive` is `false` (provider initial state), so the guard returns immediately. No false positive.

### Edge case: fast navigation (× then immediately navigate away)

After `×` exit, `performanceActive === true`. If Sandy immediately navigates to `/library`, the guard fires and calls `endPerformance()`. This is correct — navigating to Library ends Performance state.

### Edge case: `activeSetlistId === null` at guard entry

If `performanceActive === true` but `activeSetlistId === null` (shouldn't happen in normal flow, but defensive), the guard returns immediately without ending state. This is safe — no session means no active chain to compare against.

### Biome lint notes

- `useExhaustiveDependencies`: `endPerformance` must be in the `useEffect` deps array; ensure `usePerformanceEnd` returns a stable reference via `useCallback`
- `noNonNullAssertion`: use `?` chaining on `songDetailMatch[1]` — `match()` can return null
- `useSemanticElements`: no new DOM elements in this story
- No new string literals needed — last-Song silence is the spec

### Architecture compliance checklist

- **FR-21:** `NEXT ›` is inert (disabled) on the last Song. No "End performance" button. Performance state ends only on navigate-away.
- **AR-28:** `setActive(false)` is called LAST in `endPerformance()` so all AR-28 suppressions lift together. Stale banner auto-surfaces.
- **AR-28:** Wake Lock retries stop via `setPerformanceActiveForWakeLock(false)` before `release()`.
- **UX-DR6:** `aria-disabled="true"` on last-Song `NEXT ›`. No new aria labels needed.
- **NFR-20:** `NEXT ›` retains `min-h-tap` (44pt) even when disabled — tap target size not affected.
- **AR-46:** No analytics SDK, no Redux/Zustand, no CSS-in-JS.
- **Locked design constraint:** Visual direction is LOCKED — only use existing tokens (`disabled:opacity-40` is Tailwind's opacity utility, not a new token).

### Test count projection

Story 4.3 exit: **web 522 / api 103 / shared 26**

New tests to add (estimate):
- `performance-card.test.tsx` additions: ~5 cases (last-Song inert NEXT ›)
- `use-performance-end.test.ts` (NEW): ~5 cases
- `use-navigate-away-guard.test.ts` (NEW, if the guard is extracted to its own file): ~7 cases

Expected Story 4.4 final: **web ~539, api 103 unchanged, shared 26 unchanged**

### Handoff note for Story 4.5

Story 4.5 (backgrounding survives + Tonight-Gig pre-fetch) will:
1. Implement the `visibilitychange` handling for surviving iOS backgrounding
2. Wire the `upcoming-gigs` endpoint pre-fetch on iPhone foreground
3. Restore `performanceActive=true` from persisted state when the PWA relaunches after OS kill

Story 4.4's `endPerformance()` hook is the correct path for all deliberate end-state. Story 4.5 MUST NOT call `endPerformance()` on foreground — that would break backgrounding survival.

### Files to create / update

**New files:**
- `web/src/hooks/use-performance-end.ts` — `endPerformance()` callback hook
- `web/src/hooks/use-performance-end.test.ts` — unit tests
- `web/src/hooks/use-navigate-away-guard.ts` — navigate-away detection hook (optional: can inline in authenticated-shell)
- `web/src/hooks/use-navigate-away-guard.test.ts` — unit tests (if extracted to own file)

**Updated files:**
- `web/src/performance/performance-context.tsx` — relax `setPerformanceSession` to accept `null` setlistId; add `useResetPerformanceSession()` hook
- `web/src/routes/performance-card.tsx` — add `isLast`, update `NEXT ›` with `disabled={isLast}`, comment
- `web/src/routes/performance-card.test.tsx` — add last-Song test cases
- `web/src/routes/authenticated-shell.tsx` — mount `useNavigateAwayGuard()`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 4-4 → in-progress → review

### Project Structure Notes

All new files live in `web/src/hooks/` per the architecture directory tree. Co-located test files (`.test.ts`) per AR-5. No new routes, no new API changes, no `shared/` or `api/` changes.

The `web/src/hooks/` directory already exists with `use-chrome-visible.ts`, `use-outbox-status.ts`, `use-performance-active.ts`, `use-setlist.ts`, `use-song.ts`, `use-tonight-gig.ts`. New hooks follow the same pattern.

### References

- [Source: epics.md — Story 4.4 acceptance criteria, FR-21]
- [Source: architecture.md — §Performance Mode invariants, AR-28 exit sequence]
- [Source: architecture.md — UX-DR6, NFR-20, FR-21]
- [Source: 4-3-exit-via-x-currently-performing-strip-resume.md — Handoff note for Story 4.4]
- [Source: web/src/routes/performance-card.tsx — existing `isFirst` pattern, `NEXT ›` button, `nextSongRef` derivation]
- [Source: web/src/performance/performance-context.tsx — current context shape, hooks]
- [Source: web/src/performance/wake-lock.ts — `release()`, `setPerformanceActiveForWakeLock()` contract]
- [Source: web/src/sync/stale-write-banner.tsx — auto-surface on `performanceActive` change]
- [Source: web/src/sync/stale-notice-store.ts — held-notice mechanism]
- [Source: web/src/router.tsx — route tree for navigate-away detection]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) via `bmad-dev-story` skill.

### Debug Log References

- Initial `pnpm lint` run after authoring the navigate-away guard + test surfaced two Biome assist findings (import sort in `use-navigate-away-guard.ts`; object destructuring formatter break in `use-navigate-away-guard.test.tsx`). Both auto-fixed via `biome check --write`; no logic changes.
- `pnpm exec vitest run src/routes/authenticated-shell.test.tsx` failed with "No QueryClient set" after mounting `useNavigateAwayGuard()` inside the shell. Resolved by wrapping the test tree in `QueryClientProvider` with a fresh `QueryClient` per case — matches `main.tsx` and the existing `use-tonight-gig.test.tsx` pattern. No production-side regression: the real app already wraps the shell in `QueryClientProvider` at boot.
- Performance Mode is inactive in every `AuthenticatedShell` test case, so the guard short-circuits on `performanceActive === false` and never dispatches a network call through the new `useSetlist` dependency.

### Completion Notes List

- Implemented `usePerformanceEnd()` as the single canonical end-of-performance path. Order of cleanup matches the AR-28 contract: stop wake-lock retries → release sentinel → reset view → reset session pointer → `setActive(false)` LAST so all suppressions (stale-write banner, flusher pause, 401 redirect hold) lift after lower-level cleanup completes.
- Implemented `useNavigateAwayGuard()` as a pure-effect hook mounted at the top of `AuthenticatedShell`. Reads the active Setlist's song-id set from the TanStack Query cache via `useSetlist(activeSetlistId)` — no network call during Performance Mode (AR-28). The detector compares `location.pathname` against three in-chain patterns (`/performance/<id>/*`, `/setlists/<id>`, `/songs/<id-in-setlist>`) and ends state on anything else.
- Made `NEXT ›` inert on the last Song in `performance-card.tsx` via `isLast = parsedSongIndex === flatSongs.length - 1` symmetric to the existing `isFirst`. `disabled` + `aria-disabled` + `disabled:opacity-40` + no-op `onClick` (defence-in-depth guard mirroring `‹`). No new microcopy — preview span renders `''` automatically because `nextSongRef` is `null` at out-of-bounds. NO `End performance` button anywhere (AC-7 verified by codebase grep).
- Relaxed `setPerformanceSession`'s setlistId parameter from `string` to `string | null` (the state field was already `string | null`) and exported a new `useResetPerformanceSession()` convenience hook. Existing `useStartPerformance` callsite still passes a string — no regression in the entry path.
- Updated `authenticated-shell.test.tsx` to wrap the tree in `QueryClientProvider` since the shell now mounts `useNavigateAwayGuard()` which depends on TanStack Query.
- Verification: `pnpm typecheck` green across all 5 packages; `pnpm lint` green; `pnpm test` green at web 546 / api 103 / shared 26 (web +24 vs. Story 4.3 baseline — 7 new performance-card cases, 6 new use-performance-end cases, 11 new use-navigate-away-guard cases); `pnpm build:web` green.

### File List

**Added**
- `web/src/hooks/use-performance-end.ts`
- `web/src/hooks/use-performance-end.test.ts`
- `web/src/hooks/use-navigate-away-guard.ts`
- `web/src/hooks/use-navigate-away-guard.test.tsx`

**Modified**
- `web/src/performance/performance-context.tsx`
- `web/src/routes/performance-card.tsx`
- `web/src/routes/performance-card.test.tsx`
- `web/src/routes/authenticated-shell.tsx`
- `web/src/routes/authenticated-shell.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-4-end-performance-state-on-navigate-away-last-song-inert-next.md`

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-06-21 | Claude Sonnet 4.6 (bmad-create-story) | Created Story 4.4 spec: end Performance state on navigate-away + last-song inert NEXT ›. |
| 2026-06-21 | Claude Opus 4.7 (bmad-dev-story) | Implemented Story 4.4: usePerformanceEnd hook, useNavigateAwayGuard mounted in AuthenticatedShell, isLast inert NEXT › on performance card, context setPerformanceSession accepts null, useResetPerformanceSession added. Test count web 522 → 546 (+24); api 103, shared 26 unchanged. Typecheck/lint/build all green. |
