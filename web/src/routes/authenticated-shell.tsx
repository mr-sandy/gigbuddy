import { Outlet } from 'react-router';
import { ReauthBanner } from '../components/reauth-banner.js';

/**
 * Minimal authenticated shell. Story 1.5 replaces the body with the full
 * nav chrome scaffold (top nav + bottom tab bar + Setlists/Library
 * routes). For 1.4 the shell renders just the banner + the route Outlet
 * so the auth flow can be tested end-to-end against the placeholder.
 */
export function AuthenticatedShell() {
  return (
    <>
      <ReauthBanner />
      <Outlet />
    </>
  );
}
