import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';
import { fetchMe } from './auth/auth-api.js';
import { AuthProvider, type AuthState } from './auth/auth-context.js';
import { isIPhone, isStandalone } from './lib/platform.js';
import { PerformanceModeProvider } from './performance/performance-context.js';
import { router } from './router.js';
import { InstallInstructions } from './routes/install-instructions.js';

/*
 * The architectural app-boot sequence (architecture.md "Auth flow"
 * canonical sequence, lines 692–702):
 *   1. Render shell (no data) immediately.
 *   2. Probe /api/v1/me.
 *   3. Resolve to authenticated | unauthenticated | unknown.
 *   4. The router decides where to land based on the resolved state.
 *
 * PerformanceModeProvider sits outermost so any subsystem (auth, sync,
 * router) can read `usePerformanceActive()` (Story 1.5 AC-7). The live
 * setter is wired in Story 4.1.
 *
 * The install gate (Story 2.2, AR-22) short-circuits the boot on iPhone
 * Safari (uninstalled). When `installGateActive` is true the surface
 * renders the install-instructions component BEFORE any /me probe; auth
 * and router are not mounted on that path.
 */
export function AppBootstrap() {
  const installGateActive = isIPhone() && !isStandalone();
  const [initial, setInitial] = useState<AuthState>({ status: 'unknown' });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (installGateActive) return;
    let cancelled = false;
    fetchMe().then((state) => {
      if (cancelled) return;
      setInitial(state);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [installGateActive]);

  return (
    <PerformanceModeProvider>
      {installGateActive ? (
        <InstallInstructions />
      ) : !ready ? (
        // App shell: brand mark only, no data. Matches the architecture's
        // "render shell, no data" step.
        <h1>GigBuddy</h1>
      ) : (
        <AuthProvider initial={initial}>
          <RouterProvider router={router} />
        </AuthProvider>
      )}
    </PerformanceModeProvider>
  );
}
