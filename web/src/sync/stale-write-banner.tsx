import { useSyncExternalStore } from 'react';
import { BANNERS } from '../lib/microcopy.js';
import { isIPhone } from '../lib/platform.js';
import { usePerformanceActive } from '../performance/performance-context.js';
import { clearStaleNotice, getStaleNotice, subscribeStaleNotice } from './stale-notice-store.js';

/*
 * Surfaces the architecture's "your earlier edit was superseded" message
 * (microcopy.ts BANNERS.staleWrite) when the flusher receives a
 * `dropped-as-stale` response (architecture.md line 299, FR-30).
 *
 * Suppressed on iPhone entirely (FR-30 — iPhone is silent) and during
 * Performance Mode regardless of device (AR-28). The visual treatment
 * mirrors <ReauthBanner> — role="status", aria-live="polite", dismissable.
 */
export function StaleWriteBanner() {
  const notice = useSyncExternalStore(subscribeStaleNotice, getStaleNotice, () => null);
  const performanceActive = usePerformanceActive();
  if (!notice) return null;
  if (isIPhone()) return null;
  if (performanceActive) return null;
  return (
    <div role="status" aria-live="polite">
      <span>{BANNERS.staleWrite}</span>
      <button
        type="button"
        onClick={() => clearStaleNotice()}
        aria-label="Dismiss stale-write notice"
      >
        Dismiss
      </button>
    </div>
  );
}
