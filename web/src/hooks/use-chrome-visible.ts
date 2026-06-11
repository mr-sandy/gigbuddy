import { usePerformanceActive } from '../performance/performance-context.js';

/*
 * Chrome (top nav on MacBook, bottom tabs on iPhone) is visible whenever
 * Performance Mode is NOT active. Story 4.1 sets `performanceActive=true`
 * to hide chrome on Performance Mode entry; Story 4.3 sets it back to
 * `false` on × exit. The structural path lives here so Epic 4 needs no
 * new chrome plumbing.
 */
export function useChromeVisible(): boolean {
  return !usePerformanceActive();
}
