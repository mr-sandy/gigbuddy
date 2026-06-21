import { usePerformanceActive, usePerformanceView } from '../performance/performance-context.js';

/*
 * Chrome (top nav on MacBook, bottom tabs on iPhone) is visible whenever
 * Performance Mode is NOT active. Story 4.1 sets `performanceActive=true`
 * to hide chrome on Performance Mode entry.
 *
 * Story 4.3 adds the "active Setlist overview" exception: after the × exit
 * from the Performance Card, `performanceActive` stays `true` (FR-19 state
 * preservation), but the user has navigated back to the Setlist overview
 * and needs the tab bar to navigate away. We read `performanceView` and
 * keep chrome visible when the view is `'overview'`. Story 4.4 ends the
 * Performance Mode state when the user navigates AWAY from the active
 * Setlist chain entirely — that path will reset `performanceView` to
 * `null` and `performanceActive` to `false`.
 */
export function useChromeVisible(): boolean {
  const performanceActive = usePerformanceActive();
  const performanceView = usePerformanceView();
  if (!performanceActive) return true;
  return performanceView === 'overview';
}
