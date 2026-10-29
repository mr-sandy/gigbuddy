import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';
import { fetchMe } from './auth/auth-api.js';
import { AuthProvider, type AuthState } from './auth/auth-context.js';
import { router } from './router.js';
import { SyncWiring } from './sync/sync-wiring.js';

/*
 * The architectural app-boot sequence (architecture.md "Auth flow"
 * canonical sequence, lines 692–702):
 *   1. Render shell (no data) immediately.
 *   2. Probe /api/v1/me.
 *   3. Resolve to authenticated | unauthenticated | unknown.
 *   4. The router decides where to land based on the resolved state.
 */
export function AppBootstrap() {
  const [initial, setInitial] = useState<AuthState>({ status: 'unknown' });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((state) => {
      if (cancelled) return;
      setInitial(state);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return !ready ? (
    // App shell: brand mark only, no data. Matches the architecture's
    // "render shell, no data" step. Doubles as the home-screen splash, so the
    // icon is inlined (keep in step with public/icon-source.svg) to paint
    // without waiting on a network or cache fetch.
    <main className="flex min-h-dvh items-center justify-center bg-background">
      <svg role="img" aria-label="GigBuddy" viewBox="0 0 512 512" className="size-32">
        <rect width="512" height="512" rx="112" fill="#1a1209" />
        <rect x="88" y="96" width="104" height="320" rx="24" fill="#f1e6cf" />
        <rect x="204" y="96" width="104" height="320" rx="24" fill="#e6b855" />
        <rect x="320" y="96" width="104" height="320" rx="24" fill="#f1e6cf" />
        <rect x="156" y="64" width="72" height="224" rx="20" fill="#1a1209" />
        <rect x="284" y="64" width="72" height="224" rx="20" fill="#1a1209" />
      </svg>
    </main>
  ) : (
    <AuthProvider initial={initial}>
      <SyncWiring />
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
