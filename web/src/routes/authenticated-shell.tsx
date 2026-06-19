import { Link, Outlet } from 'react-router';
import { BottomTabs } from '../components/bottom-tabs.js';
import { ReauthBanner } from '../components/reauth-banner.js';
import { TopNav } from '../components/top-nav.js';
import { useChromeVisible } from '../hooks/use-chrome-visible.js';
import { ACTIONS } from '../lib/microcopy.js';
import { isIPhone } from '../lib/platform.js';
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
