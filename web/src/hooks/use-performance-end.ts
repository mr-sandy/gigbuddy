import { useCallback } from 'react';
import {
  useResetPerformanceSession,
  useSetPerformanceActive,
  useSetPerformanceView,
} from '../performance/performance-context.js';
import * as wakeLock from '../performance/wake-lock.js';

/*
 * Story 4.4 — canonical end-of-performance cleanup.
 *
 * `usePerformanceEnd()` returns a stable `endPerformance()` callback. It is
 * the ONLY path that ends Performance state in V1 — Sandy ends a session
 * exclusively by navigating away from the active Setlist chain (the
 * navigate-away guard wires this up). There is deliberately no
 * `End performance ›` button anywhere in the UI: per FR-21 and the locked
 * memory note, the routine advance gesture (`NEXT ›`) must never transform
 * into a destructive/terminating action at the last Song; instead `NEXT ›`
 * is rendered inert when there is no next Song. See
 * `performance-card.tsx` for that companion behaviour.
 *
 * Order of cleanup (do not reorder — each step has a reason):
 *
 *   1. `wakeLock.setPerformanceActiveForWakeLock(false)` — stops the
 *      backoff retry loop FIRST. The wake-lock singleton runs retries
 *      whenever its internal `performanceActive` flag is `true`; flipping
 *      it off here means even if `release()` below races a scheduled
 *      retry, the retry resolves into a no-op.
 *   2. `wakeLock.release()` — drops the OS sentinel (fire-and-forget async
 *      internally). The function also flips its internal flag and cancels
 *      timers; calling `setPerformanceActiveForWakeLock(false)` first is
 *      belt-and-suspenders matching the documented `wake-lock.ts` contract.
 *   3. `setPerformanceView(null)` — clear the view marker so the next
 *      route renders with default chrome rules. (After `setActive(false)`
 *      `useChromeVisible()` no longer reads the view, but resetting now
 *      keeps the context state internally consistent.)
 *   4. `resetSession()` — sets `activeSetlistId → null`, `activeSongIndex
 *      → 0` so a subsequent `Start performance ›` (on this Setlist or
 *      another) begins from a clean slate. The `CurrentlyPerformingStrip`
 *      derives its visibility from `activeSetlistId`, so this prevents a
 *      stale strip after end-state.
 *   5. `setActive(false)` — LAST. Flipping this lifts every AR-28
 *      suppression at once: the `StaleWriteBanner` un-hides if a notice
 *      is queued in `stale-notice-store.ts`, the flusher resumes, the
 *      401 redirect is no longer held. Putting it last guarantees all
 *      lower-level cleanup completes before consumers observe the change.
 */
export function usePerformanceEnd(): () => void {
  const setActive = useSetPerformanceActive();
  const setPerformanceView = useSetPerformanceView();
  const resetSession = useResetPerformanceSession();

  return useCallback(() => {
    wakeLock.setPerformanceActiveForWakeLock(false);
    wakeLock.release();
    setPerformanceView(null);
    resetSession();
    setActive(false);
  }, [setActive, setPerformanceView, resetSession]);
}
