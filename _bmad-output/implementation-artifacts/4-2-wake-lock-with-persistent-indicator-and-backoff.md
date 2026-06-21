---
baseline_commit: "6622390"
builds_on: 4-1-performance-mode-entry-card-layout-single-tap-navigation
---

# Story 4.2: Wake Lock with persistent indicator and backoff (FR-18, NFR-27, NFR-28)

Status: review

## Story

As Sandy,
I want a Wake Lock acquired on Performance Mode entry, maintained best-effort with reacquisition on every foreground transition, and a static indicator on the Performance Card whenever the lock is NOT held,
so that the phone resting on the Nord doesn't sleep mid-set and I can see at a glance if it might.

## Acceptance Criteria

**AC-1 — wake-lock.ts exports: real W3C implementation**

**Given** `web/src/performance/wake-lock.ts`
**When** reviewed after this story
**Then** it exposes `acquire(): Promise<void>`, `release(): void`, `isHeld(): boolean`, and `onChange(callback: () => void): () => void` (a subscription returning an unsubscribe function)
**And** internally `acquire()` calls `navigator.wakeLock.request('screen')` from the W3C Screen Wake Lock API
**And** on success, the `WakeLockSentinel` is stored in module-scope
**And** `isHeld()` returns `true` when the sentinel exists and has not been released, `false` otherwise
**And** `onChange` listeners are notified synchronously whenever the held/not-held state changes
**And** the export interface is API-compatible with the Story 4.1 stub (no callers in Story 4.1 need modification)

**AC-2 — Acquire on entry: real implementation**

**Given** entry to Performance Mode via `useStartPerformance()` (Story 4.1)
**When** `wakeLock.acquire()` is called during `onStartPerformance`
**Then** `navigator.wakeLock.request('screen')` is invoked
**And** on success, `isHeld()` returns `true`
**And** on failure (API unsupported, OS denial, browser policy), the error is caught silently — no throw, no toast, no banner (per AR-28)
**And** when acquisition fails, `isHeld()` returns `false` and the indicator (AC-5) is rendered

**AC-3 — Reacquire on foreground**

**Given** the Wake Lock is held (or was lost)
**When** `visibilitychange` fires to `'visible'` AND `performanceActive === true`
**Then** `wakeLock.acquire()` is called again
**And** the reacquisition attempt follows the backoff schedule (AC-4) if previous attempts have failed consecutively
**And** the `visibilitychange` listener is added when `performanceActive` becomes `true` and removed when it becomes `false`

**AC-4 — Backoff on persistent failure**

**Given** repeated calls to `wakeLock.acquire()` all fail (e.g., `navigator.wakeLock` is undefined or OS denies)
**When** failures accumulate
**Then** retries follow an exponential backoff schedule: attempt 1 → immediate, attempt 2 → 1s, attempt 3 → 5s, attempt 4 → 30s, attempt 5+ → 60s cap (NFR-28)
**And** no tight retry loop ever fires: each retry is scheduled via `setTimeout`, never synchronous recursion
**And** retries continue while `performanceActive === true`
**And** all pending retry timers are cancelled when `performanceActive === false` or when `wakeLock.release()` is called explicitly

**AC-5 — Persistent static indicator on Performance Card**

**Given** the Performance Card is rendered (`/performance/:setlistId/:songIndex`)
**When** `wakeLock.isHeld() === false`
**Then** a persistent static indicator appears in the top chrome area adjacent to the position indicator (top-right area)
**And** the indicator is small (16–20pt), uses a moon/sleep glyph (⌁ or similar; a Unicode moon symbol is acceptable), paired with `aria-label="Screen may sleep"` (per UX-DR6)
**And** the indicator uses `text-[color:var(--color-text-secondary)]` — subtle, not alarming
**And** the indicator is STATIC — no animation, no blinking, no pulse, no fade-in (NFR-27: no animations longer than 150ms in Performance Mode)
**And** it carries `aria-live="assertive"` so VoiceOver announces it when it first appears (per UX-DR6 / NFR-22)
**And** the indicator does NOT block input — Sandy can still tap `NEXT ›`, `‹`, or `×` normally

**AC-6 — Indicator disappears on reacquisition**

**Given** the indicator is visible (`isHeld() === false`)
**When** `wakeLock.acquire()` succeeds
**Then** the indicator disappears immediately (no transition, no animation — NFR-27)
**And** no toast, banner, or announcement fires (silent — per AR-28)

**AC-7 — OS-initiated sentinel release triggers reacquire**

**Given** the Wake Lock sentinel is held
**When** the OS fires a `'release'` event on the sentinel (OS-initiated revocation — e.g., battery low, tab hidden)
**Then** `isHeld()` is updated to `false`
**And** `onChange` subscribers are notified (driving the indicator to appear)
**And** `wakeLock.acquire()` is called to reacquire (if `performanceActive === true`)
**And** the reacquisition follows the backoff schedule

**AC-8 — Release on Performance state end**

**Given** Performance state ends via navigate-away (Story 4.4 calls `setActive(false)`)
**When** `wakeLock.release()` is called
**Then** the sentinel's `.release()` method is called if the sentinel is held
**And** `isHeld()` returns `false`
**And** all pending retry timers are cancelled
**And** `onChange` subscribers are notified

**AC-9 — Wake Lock preserved on × exit (Story 4.3 context)**

**Given** Sandy taps `×` to exit back to the Setlist overview (Story 4.3 behavior)
**When** the Performance Card unmounts (but `performanceActive` remains `true`)
**Then** `wakeLock.release()` is NOT called — the lock remains held
**And** the `visibilitychange` listener remains active (per `performanceActive === true`)
**And** the indicator state is preserved correctly on resume (Story 4.3 `Resume ›` returns to the same card)

**AC-9 is NOT implemented in this story** — Story 4.2 has no `×` button (that's Story 4.3). The critical constraint is: `wakeLock.release()` must ONLY be triggered by an explicit external call (Story 4.4 end-state), NOT by the Performance Card unmounting. The `wake-lock.ts` module is stateful at module-scope — unmounting the card component does not affect the sentinel.

**AC-10 — Performance Card integration: useWakeLockIndicator hook**

**Given** the Performance Card route (`web/src/routes/performance-card.tsx`)
**When** the route mounts
**Then** a `useWakeLockIndicator()` hook (new, in `web/src/performance/use-wake-lock-indicator.ts`) is called
**And** the hook returns `{ wakeLockHeld: boolean }` by subscribing to `wakeLock.onChange`
**And** the hook calls `wakeLock.acquire()` on mount (in addition to the acquire already triggered by `useStartPerformance` — the acquire on card mount handles the case where the card is resumed after backgrounding)
**And** the hook tears down the `onChange` subscription on unmount
**And** the `wakeLockHeld` boolean drives the conditional rendering of the indicator in the top chrome area

**AC-11 — Accessibility: aria-live on indicator**

**Given** the wake-lock indicator element
**When** it first appears in the DOM (state transitions from held → not-held)
**Then** `aria-live="assertive"` on the indicator container causes VoiceOver to announce `"Screen may sleep"` immediately
**And** when the indicator disappears (state transitions from not-held → held), no VoiceOver announcement fires (silent recovery per AR-28)

**AC-12 — Unit tests with mocked navigator.wakeLock**

**Given** `web/src/performance/wake-lock.test.ts` (new file)
**When** tests run with a mocked `navigator.wakeLock`
**Then** the following cases pass:
  - Successful acquire: `isHeld()` returns `true`; `onChange` subscribers notified
  - Failed acquire (API unsupported — `navigator.wakeLock` is undefined): `isHeld()` returns `false`; no throw
  - Failed acquire (OS denial — `navigator.wakeLock.request` rejects): `isHeld()` returns `false`; no throw
  - OS release event: `sentinel.dispatchEvent('release')` sets `isHeld()` to `false`; triggers reacquire
  - Foreground reacquire: `visibilitychange` to `'visible'` calls `acquire()` when `performanceActive === true`
  - Exponential backoff under persistent failure: delays follow 1s → 5s → 30s → 60s schedule
  - `release()` cancels timers and calls sentinel `.release()`
  - `onChange` returns an unsubscribe function that correctly deregisters the callback

**Given** `web/src/performance/use-wake-lock-indicator.test.ts` (new file)
**When** tests run
**Then** the following cases pass:
  - Hook subscribes to `onChange` on mount and unsubscribes on unmount
  - Hook calls `wakeLock.acquire()` on mount
  - `wakeLockHeld` reflects `isHeld()` state and updates on `onChange` notification
  - Returns `{ wakeLockHeld: false }` when the lock is not held

## Tasks / Subtasks

- [x] **Task 1 — Read existing files before touching anything** (prerequisite — non-negotiable)
  - [x] Read `web/src/performance/wake-lock.ts` end-to-end (the Story 4.1 stub — understand the exact current export shape)
  - [x] Read `web/src/routes/performance-card.tsx` end-to-end (understand the top-chrome structure, where `{/* × exit: Story 4.3 */}` and `{/* Wake lock indicator: Story 4.2 */}` placeholders live or should live)
  - [x] Read `web/src/performance/performance-context.tsx` (understand `usePerformanceActive()` and `getPerformanceActiveSnapshot()`)
  - [x] Read `web/src/performance/use-start-performance.ts` (understand how `wakeLock.acquire()` is already called; the card mount must NOT double-call in a way that resets backoff state)
  - [x] Read `web/src/routes/performance-card.test.tsx` (understand the existing 23 test cases to avoid breaking them)
  - [x] Read `web/src/lib/microcopy.ts` (check if a wake-lock microcopy constant is needed; PERFORMANCE_CARD already exists)
  - [x] Read `web/src/styles/tokens.css` (confirm `--color-text-secondary` token name is correct)

- [x] **Task 2 — Replace `web/src/performance/wake-lock.ts` stub with real implementation** (AC: 1, 2, 3, 4, 7, 8, 9)
  - [x] Declare module-scope state: `let sentinel: WakeLockSentinel | null = null`; `let performanceActive = false`; `let backoffAttempts = 0`; `let backoffTimer: ReturnType<typeof setTimeout> | null = null`; `const subscribers = new Set<() => void>()`
  - [x] Implement `notifySubscribers()` — iterates `subscribers`, calls each callback
  - [x] Implement `isHeld(): boolean` — returns `sentinel !== null && !sentinel.released`
  - [x] Implement `onChange(callback: () => void): () => void` — adds callback to `subscribers`, returns `() => subscribers.delete(callback)`
  - [x] Implement `acquire(): Promise<void>`:
    - If `navigator.wakeLock` is undefined (API unsupported), catch and return (no throw); notify subscribers; schedule next backoff retry if `performanceActive`
    - Call `await navigator.wakeLock.request('screen')` in a try/catch
    - On success: store as `sentinel`; reset `backoffAttempts = 0`; cancel any pending `backoffTimer`; attach `'release'` event listener to sentinel (see sentinel-release handling); notify subscribers
    - On failure (rejection): notify subscribers; schedule next backoff retry if `performanceActive` (see backoff schedule)
  - [x] Implement backoff schedule helper: `const BACKOFF_MS = [0, 1000, 5000, 30000, 60000]`; next delay = `BACKOFF_MS[Math.min(backoffAttempts, BACKOFF_MS.length - 1)]`; increment `backoffAttempts` after scheduling
  - [x] Implement sentinel `'release'` event handler: sets `sentinel = null`; notifies subscribers; schedules reacquire via backoff if `performanceActive === true`
  - [x] Implement `release(): void`:
    - Set `performanceActive = false` (signals no more retries)
    - Cancel `backoffTimer` if set
    - If `sentinel && !sentinel.released`, call `sentinel.release()` (may be async; fire-and-forget is fine)
    - Set `sentinel = null`; reset `backoffAttempts = 0`
    - Notify subscribers
  - [x] Implement `setPerformanceActiveForWakeLock(active: boolean): void` — internal setter called by the hook so the module knows whether to retry. Export this alongside the public API.
  - [x] Implement `visibilitychange` listener: add a **single** module-scope `document.addEventListener('visibilitychange', ...)` — on `'visible'` and `performanceActive === true`, call `acquire()`
  - [x] Ensure the `visibilitychange` listener is added once at module load (not inside a React effect) — the module is a singleton

- [x] **Task 3 — Create `web/src/performance/use-wake-lock-indicator.ts`** (AC: 10, 11)
  - [x] Export `useWakeLockIndicator(): { wakeLockHeld: boolean }` React hook
  - [x] Inside the hook:
    - `const [wakeLockHeld, setWakeLockHeld] = useState(() => wakeLock.isHeld())`
    - On mount: call `setPerformanceActiveForWakeLock(true)` then `wakeLock.acquire()` (fire-and-forget — do not await in useEffect unless the effect is explicitly async)
    - Subscribe to `wakeLock.onChange(() => setWakeLockHeld(wakeLock.isHeld()))` — store the unsubscribe function
    - On unmount: call the unsubscribe function. Do NOT call `wakeLock.release()` or `setPerformanceActiveForWakeLock(false)` here — unmounting the card (e.g. on × exit) must not release the lock
    - Return `{ wakeLockHeld }`
  - [x] Create companion test file `web/src/performance/use-wake-lock-indicator.test.ts`

- [x] **Task 4 — Add wake-lock indicator to `web/src/routes/performance-card.tsx`** (AC: 5, 6, 10, 11)
  - [x] Import `useWakeLockIndicator` from `../performance/use-wake-lock-indicator.js`
  - [x] Add `const { wakeLockHeld } = useWakeLockIndicator()` inside `PerformanceCard` (after the other hooks)
  - [x] In the top chrome `<header>`, in the right-hand slot next to the position indicator, add the indicator:
    ```tsx
    {/* Wake-lock indicator — Story 4.2 (FR-18, NFR-27) */}
    {!wakeLockHeld && (
      <span
        aria-live="assertive"
        aria-label="Screen may sleep"
        aria-atomic="true"
        className="ml-[calc(var(--spacing-unit)*2)] shrink-0 text-[length:var(--text-perf-meta)] text-[color:var(--color-text-secondary)]"
        role="status"
      >
        ⌁
      </span>
    )}
    ```
  - [x] The indicator must be placed adjacent to the position indicator in the top-right area — adjust the `flex items-start justify-between` header flex layout to accommodate both the position indicator and the wake-lock indicator in the right slot
  - [x] Confirm the indicator carries no CSS transition, animation, or pulse — it is purely conditional rendering (NFR-27)
  - [x] Do NOT add any onClick handler to the indicator (it must not block taps — AC-5)

- [x] **Task 5 — Add microcopy constant for wake-lock** (Voice & Tone)
  - [x] In `web/src/lib/microcopy.ts`, append to the `PERFORMANCE_CARD` object or export a new constant:
    ```ts
    ariaWakeLockNotHeld: 'Screen may sleep',
    ```
  - [x] Use the constant in `performance-card.tsx` instead of an inline string (per Voice & Tone UX-DR7)

- [x] **Task 6 — Create `web/src/performance/wake-lock.test.ts`** (AC: 12)
  - [x] Mock `navigator.wakeLock` using `vi.stubGlobal` or by assigning to `global.navigator`
  - [x] Test cases (minimum set):
    - `acquire()` when `navigator.wakeLock` is supported: `isHeld()` returns `true`; subscribers notified
    - `acquire()` when `navigator.wakeLock` is undefined: `isHeld()` returns `false`; no throw; no unhandled rejection
    - `acquire()` when `navigator.wakeLock.request()` rejects: `isHeld()` returns `false`; no throw
    - OS release event: sentinel's `'release'` event fires → `isHeld()` becomes `false` → subscribers notified → reacquire triggered
    - `release()`: cancels backoff timer; calls sentinel `.release()`; `isHeld()` returns `false`; subscribers notified
    - Exponential backoff: 3 consecutive failures → delays match `[0, 1000, 5000]` schedule (use `vi.useFakeTimers`)
    - `onChange` subscriber: receives notification on state change; returned unsubscribe function removes it
    - `visibilitychange` to `'visible'` when `performanceActive === true`: calls `acquire()`
    - `visibilitychange` to `'visible'` when `performanceActive === false`: does NOT call `acquire()`

- [x] **Task 7 — Create `web/src/performance/use-wake-lock-indicator.test.ts`** (AC: 12)
  - [x] Mock `web/src/performance/wake-lock.ts` via `vi.mock`
  - [x] Test cases:
    - Hook subscribes to `onChange` on mount; unsubscribes on unmount
    - Hook calls `wakeLock.acquire()` on mount
    - `wakeLockHeld` is `false` when `isHeld()` returns `false`
    - `wakeLockHeld` updates when `onChange` callback fires with new `isHeld()` state
    - Hook does NOT call `wakeLock.release()` on unmount

- [x] **Task 8 — Update existing Performance Card tests** (regression guard)
  - [x] In `web/src/routes/performance-card.test.tsx`, add a `vi.mock` for `../performance/use-wake-lock-indicator` that returns `{ wakeLockHeld: true }` by default (so indicator is hidden and existing tests don't see it)
  - [x] Add 2–3 new cases:
    - When `useWakeLockIndicator` returns `{ wakeLockHeld: false }`, indicator renders with `aria-label="Screen may sleep"`
    - When `useWakeLockIndicator` returns `{ wakeLockHeld: true }`, indicator is absent from the DOM
    - Indicator has `aria-live="assertive"` and `role="status"`

- [x] **Task 9 — Verification pass**
  - [x] `pnpm typecheck` green across all five packages (no TypeScript errors)
  - [x] `pnpm lint` green via Biome (no new `biome-ignore` directives)
  - [x] `pnpm test` green — no regressions; Story 4.1 baseline was web 473 / api 103 / shared 26
  - [x] `pnpm build:web` green

(Commit is handled by the epic-run workflow per CLAUDE.md "Commit cadence" — not a story-level AC.)

## Dev Notes

### This story's scope

Story 4.2 replaces the `wake-lock.ts` stub from Story 4.1 with the real W3C Screen Wake Lock implementation, adds the `useWakeLockIndicator` hook, and wires the static indicator into the existing `performance-card.tsx`.

**What this story delivers:**
- `web/src/performance/wake-lock.ts` (REPLACE stub body — interface unchanged)
- `web/src/performance/wake-lock.test.ts` (NEW)
- `web/src/performance/use-wake-lock-indicator.ts` (NEW hook)
- `web/src/performance/use-wake-lock-indicator.test.ts` (NEW)
- `web/src/routes/performance-card.tsx` (UPDATE — add `useWakeLockIndicator` + indicator element)
- `web/src/routes/performance-card.test.tsx` (UPDATE — mock + 2–3 new cases)
- `web/src/lib/microcopy.ts` (UPDATE — add `ariaWakeLockNotHeld`)

**What this story does NOT deliver:**
- `×` exit button (Story 4.3)
- `CurrentlyPerformingStrip` (Story 4.3)
- Explicit `wakeLock.release()` call (Story 4.4 calls this on navigate-away end-state)
- `setPerformanceActiveForWakeLock(false)` on unmount (Story 4.4 owns end-state logic)
- No changes to `useStartPerformance.ts` — the `wakeLock.acquire()` call on entry is already correct
- No changes to `api/` or `shared/` — this is entirely a `web/` story

### Critical design: wake-lock.ts as a module-scope singleton

The `wake-lock.ts` module holds all state at module scope (`sentinel`, `backoffAttempts`, `backoffTimer`, `subscribers`, `performanceActive`). This is intentional — the Wake Lock must survive React component unmount/remount cycles (e.g., when the card navigates between songs, the route re-renders but the sentinel persists).

**Do not put sentinel state inside a React hook or component.** The hook `useWakeLockIndicator` only subscribes for state change notifications to drive rendering — it does not own the sentinel.

### Interface contract from Story 4.1 (do not break)

Story 4.1's `useStartPerformance.ts` calls:
```ts
import * as wakeLock from '../performance/wake-lock.js';
// ...
wakeLock.acquire();  // called during onStartPerformance
```

The three existing exports (`acquire`, `release`, `isHeld`) must remain. The new `onChange` and `setPerformanceActiveForWakeLock` exports are additive — no callers change.

### W3C Screen Wake Lock API

```ts
// Check API availability
if (!('wakeLock' in navigator)) {
  // API unsupported — fall through to indicator
}

// Acquire
const sentinel: WakeLockSentinel = await navigator.wakeLock.request('screen');

// Sentinel properties
sentinel.released: boolean          // true if released (OS or explicit)
sentinel.addEventListener('release', handler)  // OS-initiated release
sentinel.release(): Promise<void>   // explicit release

// TypeScript global type (available in lib.dom since TypeScript 4.6)
// No extra @types needed — standard DOM lib includes WakeLockSentinel
```

**iOS PWA note:** The Screen Wake Lock API is supported in iOS 16.4+ Safari PWA (standalone mode). Sandy's iPhone 13 running a current iOS version should have support. However, the implementation must handle failure gracefully since OS policies can deny the request (battery-saver mode, low-power mode, certain iOS versions).

**NFR-25 / AR-22:** Wake Lock only works in PWA standalone mode. The install gate (Story 2.2) enforces this — users only reach Performance Mode after install. The `navigator.wakeLock` API is available when the PWA is in standalone mode on a supported iOS version.

### Backoff implementation pattern

```ts
const BACKOFF_MS = [0, 1000, 5000, 30000, 60000] as const;

function scheduleRetry(): void {
  if (!performanceActive) return;
  if (backoffTimer !== null) return;  // already scheduled
  const delay = BACKOFF_MS[Math.min(backoffAttempts, BACKOFF_MS.length - 1)];
  backoffAttempts += 1;
  backoffTimer = setTimeout(() => {
    backoffTimer = null;
    acquire();  // recursive re-entry; acquire() handles its own try/catch
  }, delay);
}

function cancelRetry(): void {
  if (backoffTimer !== null) {
    clearTimeout(backoffTimer);
    backoffTimer = null;
  }
}
```

**Important:** Reset `backoffAttempts = 0` and cancel the timer on successful acquire. The backoff is for consecutive failures — a single success resets the counter.

### visibilitychange listener (module-scope singleton)

The `visibilitychange` listener must be added **once** at module load time, not inside a React effect. React component lifecycle is irrelevant to the Wake Lock — the sentinel lives outside the component tree.

```ts
// Added once when the module is imported (module-scope side effect)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && performanceActive) {
    acquire();
  }
});
```

**Test isolation:** In unit tests, the module-scope listener will be registered for the test environment's `document`. Use `vi.stubGlobal` or mock `document.addEventListener` to intercept. Alternatively, export a `_handleVisibilityChange` helper function and test it directly (calling it with the mock state set). This avoids the complexity of observing `document.addEventListener` side effects.

### Indicator placement in performance-card.tsx top chrome

The existing top chrome flex layout is:
```tsx
<div className="flex items-start justify-between">
  <h1>{title}</h1>
  <span role="status" aria-label="Song N of M">{N} / {M}</span>
</div>
```

After Story 4.2, the right side of the header needs two elements: the position indicator and the wake-lock indicator. Restructure to:
```tsx
<div className="flex items-start justify-between">
  <h1>{title}</h1>
  <div className="flex shrink-0 items-center gap-[calc(var(--spacing-unit)*2)] ml-[calc(var(--spacing-unit)*2)]">
    {!wakeLockHeld && (
      <span
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        aria-label={PERFORMANCE_CARD.ariaWakeLockNotHeld}
        className="text-[length:var(--text-perf-meta)] text-[color:var(--color-text-secondary)]"
      >
        ⌁
      </span>
    )}
    <span role="status" aria-label={PERFORMANCE_CARD.ariaSongPosition(currentPosition, totalSongs)}>
      {currentPosition} / {totalSongs}
    </span>
  </div>
</div>
```

The wake-lock indicator comes **before** the position indicator so it's visually closer to the right edge when present — this keeps the position indicator always at the far right and the wake-lock indicator just inside it.

**Glyph choice:** `⌁` (U+2301 ELECTRIC ARROW) or `◌` or a simple symbol. A simple moon glyph `☽` (U+263D) or a power/sleep symbol works. The exact glyph is a V1 choice — pick one that reads as "dimming/sleep" at ~18pt in mono. `⌁` is used in the spec as a placeholder; the implementation can use `☽` or another appropriate Unicode sleep indicator.

### NFR-27: No animation — implementation checklist

The indicator is purely conditional rendering (`{!wakeLockHeld && <span>...`). There is no:
- CSS `transition` property on the span or its container
- CSS `animation` or `@keyframes`
- Framer Motion, React Spring, or any animation library
- Tailwind `animate-*` utility
- `opacity` fade

The indicator appears and disappears instantly via React's conditional rendering. The `prefers-reduced-motion` global CSS rule in `globals.css` already zeroes `transition-duration` and `animation-duration` globally — but that only matters if an animation were added accidentally. In this case, there is no animation to zero.

### Testing approach: mocking navigator.wakeLock

Vitest allows mocking browser globals via `vi.stubGlobal`:

```ts
// In wake-lock.test.ts
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';

const mockSentinel = {
  released: false,
  release: vi.fn().mockResolvedValue(undefined),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
};

const mockWakeLock = {
  request: vi.fn().mockResolvedValue(mockSentinel),
};

beforeEach(() => {
  vi.stubGlobal('navigator', { ...navigator, wakeLock: mockWakeLock });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
```

**Module state reset between tests:** The `wake-lock.ts` module holds state at module scope. To reset state between tests, either:
1. Export a `_reset()` helper for test use only (guarded by `process.env.NODE_ENV === 'test'`), or
2. Use `vi.resetModules()` and re-import between tests (slower but cleaner)

The `_reset()` pattern is simpler for this module. Add it as an export gated on `import.meta.env.DEV` or `typeof jest !== 'undefined'` if preferred, but a simple export is acceptable since this is a personal tool.

### Biome lint traps to avoid

- **`useExhaustiveDependencies`:** In `useWakeLockIndicator`, the `useEffect` that calls `acquire()` and subscribes should use `[]` as deps (runs once on mount). Biome accepts `[]` for mount-only effects.
- **`noExplicitAny`:** The `WakeLockSentinel` type is in the DOM lib. Use it directly. If TypeScript doesn't resolve it, add `/// <reference lib="dom" />` at the top of `wake-lock.ts`.
- **`noAsyncPromiseExecutor`:** The acquire function is async — do not put it inside a `new Promise()` executor. Just `await navigator.wakeLock.request('screen')` directly in the async function body.
- **`useAriaPropsSupportedByRole`:** The indicator uses `role="status"` (which supports `aria-label`, `aria-live`, `aria-atomic`) — this is accepted by Biome a11y rules, matching the pattern established for the position indicator in Story 4.1.

### Test count baseline

Story 4.1 exit count: **web 473 / api 103 / shared 26**.

New tests to add (estimate):
- `wake-lock.test.ts`: ~9 cases
- `use-wake-lock-indicator.test.ts`: ~5 cases
- `performance-card.test.tsx` additions: ~3 cases

Expected Story 4.2 final: **web ~490, api 103 unchanged, shared 26 unchanged**.

### Architecture compliance checklist

- **AR-28:** Wake Lock indicator is NOT a toast. It appears in the Performance Card chrome with no animation, no announcement except the `aria-live="assertive"` for accessibility. This satisfies the "no toasts in Performance Mode" rule.
- **AR-46:** No animation library added. No new npm runtime dependencies. The `WakeLockSentinel` type is from the TypeScript DOM lib — no `@types` package needed.
- **NFR-27:** Indicator is static — no animation longer than 150ms (there is no animation at all).
- **NFR-28:** Backoff schedule (1s → 5s → 30s → 60s cap) satisfies "back off appropriately on persistent failure."
- **UX-DR6:** `aria-label="Screen may sleep"` on the indicator; `aria-live="assertive"` for assertive announcement on first appearance.
- **AR-45:** `performance-card.tsx` does not import `outbox.ts`, `flusher.ts`, or any sync module directly. It only imports `useWakeLockIndicator` from the `performance/` subtree.

### Handoff note for Story 4.3

Story 4.3 (× exit + CurrentlyPerformingStrip) will:
1. Add the `×` button to `performance-card.tsx` top-left (the `{/* × exit: Story 4.3 */}` comment placeholder is already in the header)
2. Wire `×` tap → navigate back to overview WITHOUT calling `wakeLock.release()` or `setActive(false)`
3. The `useWakeLockIndicator` hook's mount/unmount on card navigation must not interfere with the sentinel

Story 4.3 must NOT call `wakeLock.release()` on × exit. Only Story 4.4 (navigate-away end-state) calls `release()`.

### Handoff note for Story 4.4

Story 4.4 (end-state on navigate-away) will:
1. Detect navigate-away via router listener or `useEffect` cleanup
2. Call `setActive(false)` on `PerformanceModeContext`
3. Call `wakeLock.release()` — this is the ONLY legitimate caller of `release()`
4. Call `setPerformanceActiveForWakeLock(false)` to stop retries

Story 4.4's implementation must import `wakeLock.release()` and call it as part of end-state cleanup.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — bmad-dev-story workflow.

### Debug Log References

- Lint round 1: 3 × `noNonNullAssertion` warnings in `wake-lock.test.ts` plus one Biome formatter rewrap on the `acquire()` guard in `wake-lock.ts`. Fixed by replacing `mock.results[i]!.value` access with a captured `lastReturnedSentinel` and by destructuring `request` from `stubWakeLock()` rather than re-reading `navigator.wakeLock!.request`. The formatter rewrap was applied to the three-condition `if` in `acquire()`. Re-ran lint → clean.
- All four verification passes (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build:web`) ran cleanly after the round 1 fix; no second iteration needed.

### Completion Notes List

- Real W3C Screen Wake Lock implementation lands in `wake-lock.ts` with module-scope sentinel/state, exponential backoff (0 → 1000 → 5000 → 30000 → 60000ms cap), a singleton `visibilitychange` listener that only acts when `performanceActive === true`, and an `onChange` subscription primitive driving the indicator.
- The `acquire()` function flips `performanceActive = true` itself so callers (`useStartPerformance`, `useWakeLockIndicator`) don't have to remember a two-step dance. `release()` flips it back off and cancels any pending retry timer.
- `_resetForTests()` is exported because the module is a true singleton and the test suite needs deterministic state. It is purely internal — production callers never touch it.
- The new `useWakeLockIndicator()` hook is intentionally minimal: it subscribes to `onChange`, calls `acquire()` once on mount, and tears down only the subscription on unmount. It does NOT release the lock — Story 4.4 owns that.
- `performance-card.tsx` header now has two right-slot children wrapped in a sibling flex container: the wake-lock indicator (conditional, Story 4.2) and the position indicator (always-on, Story 4.1). The wake-lock indicator sits inside the position indicator so the position number stays anchored to the far right of the header.
- Glyph choice: `☽` (U+263D first-quarter moon). The spec offered `⌁`, `◌`, or `☽` — I chose `☽` because it reads as "sleep/dimming" at glance in monospace contexts and renders consistently on iOS.
- Microcopy constant `PERFORMANCE_CARD.ariaWakeLockNotHeld = 'Screen may sleep'` lands in `microcopy.ts` alongside the existing Story 4.1 entries.
- Existing `performance-card.test.tsx` 23 cases preserved by adding a `vi.mock` that returns `{ wakeLockHeld: true }` by default. Three new cases cover the indicator's render-when-not-held, hidden-when-held, and `aria-live="assertive"` + `role="status"` semantics.
- Test counts: web 473 → 503 (+30: 18 new in `wake-lock.test.ts`, 9 new in `use-wake-lock-indicator.test.ts`, 3 new in `performance-card.test.tsx`). api 103 unchanged. shared 26 unchanged.
- AC-9 is explicitly NOT implemented in this story (the spec notes that × exit comes in Story 4.3); however the underlying contract — "card unmount does NOT release the lock" — is satisfied because `useWakeLockIndicator` only unsubscribes the `onChange` callback on unmount.
- Story 4.4 will be the sole legitimate caller of `wakeLock.release()` and `setPerformanceActiveForWakeLock(false)`.

### File List

**NEW files:**
- `web/src/performance/wake-lock.test.ts`
- `web/src/performance/use-wake-lock-indicator.ts`
- `web/src/performance/use-wake-lock-indicator.test.ts`

**UPDATED files:**
- `web/src/performance/wake-lock.ts` (replaced stub body with real W3C implementation; export shape extended additively with `onChange` and `setPerformanceActiveForWakeLock`; also exports `_resetForTests` for unit-test state isolation)
- `web/src/routes/performance-card.tsx` (added `useWakeLockIndicator` call; wrapped right-slot children in a flex container; added conditional wake-lock indicator span)
- `web/src/routes/performance-card.test.tsx` (added `vi.mock` for `use-wake-lock-indicator` with default `{ wakeLockHeld: true }`; 3 new indicator render cases)
- `web/src/lib/microcopy.ts` (added `ariaWakeLockNotHeld` to `PERFORMANCE_CARD`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status: ready-for-dev → in-progress → review)
- `_bmad-output/implementation-artifacts/4-2-wake-lock-with-persistent-indicator-and-backoff.md` (this file — tasks ticked, Dev Agent Record + Change Log populated, Status: review)

### Change Log

| Date       | Change                                                                              |
| ---------- | ----------------------------------------------------------------------------------- |
| 2026-06-21 | Story 4.2 spec created from Story 4.1 implementation context; status set to ready-for-dev. |
| 2026-06-21 | Story 4.2 implemented: real Wake Lock with exponential backoff, persistent static indicator on Performance Card, foreground reacquire via singleton `visibilitychange` listener, and new `useWakeLockIndicator` hook. Test counts: web 473 → 503 (+30). Status: ready-for-dev → review. |
