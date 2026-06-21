import { useEffect, useState } from 'react';
import * as wakeLock from './wake-lock.js';

/*
 * React hook for the persistent wake-lock indicator on the Performance
 * Card — Story 4.2 (FR-18, NFR-27, UX-DR6).
 *
 * Responsibilities:
 *   - Subscribe to `wakeLock.onChange` on mount; reflect `isHeld()` into
 *     React state so the Performance Card can conditionally render the
 *     static indicator when the lock is NOT held.
 *   - Mark the wake-lock singleton as performance-active and trigger
 *     `acquire()` on mount. This is additive to the entry-path acquire
 *     in `useStartPerformance` — the card-mount acquire covers the case
 *     where the card is resumed (Story 4.3) after backgrounding cleared
 *     the sentinel.
 *
 * What this hook deliberately does NOT do:
 *   - It does NOT call `wakeLock.release()` on unmount. Unmounting the
 *     card (e.g. on the × exit from Story 4.3) must NOT drop the lock
 *     — `performanceActive` stays true so the sentinel survives.
 *   - It does NOT call `setPerformanceActiveForWakeLock(false)` on
 *     unmount for the same reason. Story 4.4's end-state cleanup is the
 *     only legitimate caller.
 *
 * The hook owns NO sentinel state — `wake-lock.ts` is the singleton
 * source of truth. The hook merely subscribes and renders.
 */
export function useWakeLockIndicator(): { wakeLockHeld: boolean } {
  const [wakeLockHeld, setWakeLockHeld] = useState<boolean>(() => wakeLock.isHeld());

  useEffect(() => {
    wakeLock.setPerformanceActiveForWakeLock(true);
    // Fire-and-forget — acquire() handles its own try/catch and the
    // module schedules backoff retries on failure.
    void wakeLock.acquire();
    const unsubscribe = wakeLock.onChange(() => {
      setWakeLockHeld(wakeLock.isHeld());
    });
    return () => {
      unsubscribe();
      // Do NOT release the wake lock or flip performanceActive off — see
      // header comment. Card unmount is not an end-of-performance signal.
    };
  }, []);

  return { wakeLockHeld };
}
