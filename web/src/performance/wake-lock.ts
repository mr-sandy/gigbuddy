/// <reference lib="dom" />

/*
 * Wake Lock — Story 4.2 (FR-18, NFR-27, NFR-28).
 *
 * Real W3C Screen Wake Lock implementation. Replaces the Story 4.1 stub.
 * The exported interface remains API-compatible with the stub: `acquire`,
 * `release`, `isHeld` keep their original signatures. New additive
 * exports: `onChange` (subscription) and `setPerformanceActiveForWakeLock`
 * (internal setter the hook uses to tell the singleton whether retries
 * should continue).
 *
 * State at module scope (intentional — sentinel survives React unmount /
 * remount cycles such as song-to-song navigation, and the visibilitychange
 * listener is a singleton too):
 *   - `sentinel`: the live WakeLockSentinel or `null`
 *   - `performanceActive`: whether Performance Mode is active. Drives
 *     whether failed acquires schedule a retry.
 *   - `backoffAttempts`: count of consecutive failed acquires used to
 *     index into `BACKOFF_MS`.
 *   - `backoffTimer`: the pending retry timer handle (or `null`).
 *   - `subscribers`: callbacks that fire when the held/not-held state
 *     changes.
 *
 * Backoff: NFR-28 — attempt 1 immediate, attempt 2 at 1s, attempt 3 at
 * 5s, attempt 4 at 30s, attempt 5+ at 60s cap. Retries are always
 * `setTimeout`-scheduled, never synchronous recursion.
 *
 * Failure model: AR-28 / NFR-27 — no toast, no banner, no thrown error.
 * The persistent static indicator on the Performance Card (rendered by
 * `useWakeLockIndicator`) is the only user-visible signal.
 *
 * Singleton listener: `visibilitychange` is registered once at module
 * load — never inside a React effect. The handler checks
 * `performanceActive` to decide whether to call `acquire()` on
 * foreground transitions.
 */

const BACKOFF_MS = [0, 1000, 5000, 30000, 60000] as const;

let sentinel: WakeLockSentinel | null = null;
let performanceActive = false;
let backoffAttempts = 0;
let backoffTimer: ReturnType<typeof setTimeout> | null = null;
const subscribers = new Set<() => void>();

function notifySubscribers(): void {
  for (const callback of subscribers) {
    callback();
  }
}

function cancelRetry(): void {
  if (backoffTimer !== null) {
    clearTimeout(backoffTimer);
    backoffTimer = null;
  }
}

function scheduleRetry(): void {
  if (!performanceActive) return;
  // If a retry is already pending, don't stack another — the in-flight
  // one will call acquire() and trigger the next reschedule itself if it
  // fails again.
  if (backoffTimer !== null) return;
  const delay = BACKOFF_MS[Math.min(backoffAttempts, BACKOFF_MS.length - 1)];
  backoffAttempts += 1;
  backoffTimer = setTimeout(() => {
    backoffTimer = null;
    // Fire-and-forget — acquire() handles its own try/catch and will
    // reschedule via the failure branch if needed.
    void acquire();
  }, delay);
}

function handleSentinelRelease(): void {
  // OS-initiated release (battery low, tab hidden too long, etc.).
  sentinel = null;
  notifySubscribers();
  if (performanceActive) {
    // Reset attempts so the reacquire starts at attempt 1 (immediate).
    // The OS release is not itself a "failure" in the backoff sense —
    // we attempt once immediately, then back off only if that fails.
    backoffAttempts = 0;
    scheduleRetry();
  }
}

export async function acquire(): Promise<void> {
  // Acquiring is an explicit "we want the lock" signal — mark performance
  // active so subsequent failures or OS releases trigger retries. The
  // setter from `setPerformanceActiveForWakeLock` is the canonical way to
  // toggle this off; `acquire()` itself only flips it on.
  performanceActive = true;

  if (
    typeof navigator === 'undefined' ||
    !('wakeLock' in navigator) ||
    navigator.wakeLock == null
  ) {
    // API unsupported — silent failure per AR-28; schedule a retry in
    // case the environment changes (rare but cheap to allow).
    notifySubscribers();
    scheduleRetry();
    return;
  }

  try {
    const result = await navigator.wakeLock.request('screen');
    sentinel = result;
    backoffAttempts = 0;
    cancelRetry();
    sentinel.addEventListener('release', handleSentinelRelease);
    notifySubscribers();
  } catch {
    // OS denied, browser policy, or any other rejection — silent.
    sentinel = null;
    notifySubscribers();
    scheduleRetry();
  }
}

export function release(): void {
  // Explicit external release — only called by Story 4.4 end-state.
  // Stop all retry activity, drop the sentinel, notify subscribers.
  performanceActive = false;
  cancelRetry();
  if (sentinel !== null && !sentinel.released) {
    // sentinel.release() returns a Promise — fire-and-forget. We don't
    // await because callers (Story 4.4 navigate-away cleanup) are
    // synchronous.
    void sentinel.release();
  }
  sentinel = null;
  backoffAttempts = 0;
  notifySubscribers();
}

export function isHeld(): boolean {
  return sentinel !== null && !sentinel.released;
}

export function onChange(callback: () => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

/*
 * Internal setter — the `useWakeLockIndicator` hook calls this on mount
 * with `true` so the singleton knows it should keep retrying. Story 4.4
 * will call it with `false` as part of end-state cleanup (alongside
 * `release()`).
 */
export function setPerformanceActiveForWakeLock(active: boolean): void {
  performanceActive = active;
  if (!active) {
    cancelRetry();
  }
}

/*
 * Test-only state reset. Lives in production code because the module is
 * a singleton and unit tests need a way to start from a known state.
 * Calling this in production has no observable user effect except
 * dropping subscribers — which would never happen in real flows.
 */
export function _resetForTests(): void {
  cancelRetry();
  sentinel = null;
  performanceActive = false;
  backoffAttempts = 0;
  subscribers.clear();
}

/*
 * Module-scope singleton: register the `visibilitychange` listener once
 * at load time. The handler is idempotent — it only fires `acquire()`
 * when both the document is visible AND Performance Mode is active.
 */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && performanceActive) {
      void acquire();
    }
  });
}
