import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { BottomTabs } from '../components/bottom-tabs.js';
import { ReauthBanner } from '../components/reauth-banner.js';
import { TopNav } from '../components/top-nav.js';
import { useChromeVisible } from '../hooks/use-chrome-visible.js';
import { useNavigateAwayGuard } from '../hooks/use-navigate-away-guard.js';
import { ACTIONS } from '../lib/microcopy.js';
import { isIPhone } from '../lib/platform.js';
import { syncSessionMarker } from '../performance/session-resume.js';
import { StaleWriteBanner } from '../sync/stale-write-banner.js';

/*
 * Renders the global chrome around the route Outlet:
 *   - MacBook (isIPhone=false): TopNav above the Outlet, no bottom bar.
 *   - iPhone (isIPhone=true): fixed BottomTabs below the Outlet, no top bar.
 *
 * Chrome is omitted entirely when `useChromeVisible()` is false (Story 4.1
 * sets performanceActive=true → chrome hides during Performance Mode).
 * On iPhone with chrome visible, <main> reserves bottom padding so the
 * last row of route content isn't occluded by the fixed bar.
 */
export function AuthenticatedShell() {
  const chromeVisible = useChromeVisible();
  const iPhone = isIPhone();
  const location = useLocation();
  // Story 4.4 — navigate-away end-state detector (FR-21). Mounted here
  // because `AuthenticatedShell` is always rendered while Sandy is
  // authenticated; the hook returns void and runs as a pure effect on
  // every authenticated navigation. Calls `endPerformance()` when the
  // new pathname is outside the active Setlist chain.
  useNavigateAwayGuard();
  // Story 4.5 (AC-13) — session-resume marker writer. On every URL
  // change inside the authenticated shell, write the marker if we are
  // on a `/performance/:setlistId/:songIndex` path and clear it
  // otherwise. The reader runs once at boot from `main.tsx` BEFORE
  // React mounts, replacing `/` with the marked URL when present.
  useEffect(() => {
    syncSessionMarker(location.pathname);
  }, [location.pathname]);
  // Story 3.4: MacBook gets `+ New setlist` mounted in the TopNav's
  // `rightActions` slot. iPhone has no TopNav — the equivalent affordance
  // lives in the Home route (no chrome-level link).
  const newSetlistLink = (
    <Link
      to="/setlists/new"
      className="inline-flex min-h-tap items-center text-[color:var(--color-accent)] hover:text-[color:var(--color-accent-strong)] focus-visible:text-[color:var(--color-accent-strong)]"
    >
      {ACTIONS.newSetlist}
    </Link>
  );

  return (
    <>
      {chromeVisible && !iPhone ? <TopNav rightActions={newSetlistLink} /> : null}
      <ReauthBanner />
      <StaleWriteBanner />
      <main
        className="mx-auto max-w-[960px] px-[var(--spacing-gutter)] py-[var(--spacing-section-gap)]"
        style={
          iPhone && chromeVisible
            ? { paddingBottom: 'calc(50pt + env(safe-area-inset-bottom))' }
            : undefined
        }
      >
        <Outlet />
      </main>
      {chromeVisible && iPhone ? <BottomTabs /> : null}
    </>
  );
}
