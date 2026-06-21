/*
 * Wake Lock — Story 4.1 stub.
 *
 * Story 4.1 introduces the import surface so `useStartPerformance()` and the
 * Performance Card can call into it without a hard dependency on the W3C
 * Screen Wake Lock implementation (which Story 4.2 lands). The three exports
 * below are the locked interface — Story 4.2 replaces the bodies with the
 * real `navigator.wakeLock.request('screen')` calls and persistent-indicator
 * wiring without changing the export shape.
 *
 * Stub semantics for V1:
 *   - `acquire()` resolves immediately (no-op). On a gig night before
 *     Story 4.2 ships, the device may dim — that's a known V1 limitation
 *     captured in the epic.
 *   - `release()` returns void.
 *   - `isHeld()` reports `false` so any "wake lock down" UI (Story 4.2)
 *     would correctly show the indicator if rendered. Story 4.1 itself does
 *     not render that indicator.
 *
 * No test file accompanies the stub — pure no-ops add no signal. Story 4.2
 * adds the test suite alongside the real implementation.
 */
export async function acquire(): Promise<void> {
  // Intentionally empty — Story 4.2 implements navigator.wakeLock.request('screen').
}

export function release(): void {
  // Intentionally empty — Story 4.2 implements sentinel.release().
}

export function isHeld(): boolean {
  return false;
}
