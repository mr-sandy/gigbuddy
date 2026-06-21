import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppBootstrap } from './app-bootstrap.js';
// Side-effect import — registers the `visibilitychange` listener that
// runs the iPhone Tonight-Gig pre-fetch on every foreground (Story 4.5,
// AR-25). Same wiring shape as the wake-lock singleton (Story 4.2).
import './cache/prefetch.js';
import { ErrorBoundary } from './components/error-boundary.js';
import { applyBootAtmosphere } from './lib/atmosphere.js';
import { startErrorReporter } from './lib/error-reporter.js';
import { readSessionMarker } from './performance/session-resume.js';
import { SyncProvider } from './sync/query-client.js';
import './styles/globals.css';

applyBootAtmosphere();
startErrorReporter();

/*
 * Story 4.5 (AC-8) — OS-kill / cold-relaunch session resume.
 *
 * iOS Safari/PWA resets the URL to the manifest `start_url` (`/`) on a
 * cold relaunch. If the marker says Sandy was mid-Gig, replace the URL
 * BEFORE React mounts so the router lands on the Performance Card on
 * first paint — no `/` → `/performance/...` flash. We use
 * `history.replaceState` (not `pushState`) so the browser back-stack
 * matches what the user expects after a cold restart.
 *
 * The session-resume writer (`syncSessionMarker`) is wired below
 * inside `AuthenticatedShell` (it subscribes to `useLocation()`); the
 * reader only runs once here at module load.
 */
if (typeof window !== 'undefined' && window.location.pathname === '/') {
  const marker = readSessionMarker();
  if (marker !== null) {
    window.history.replaceState(null, '', `/performance/${marker.setlistId}/${marker.songIndex}`);
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

createRoot(rootElement).render(
  <StrictMode>
    <SyncProvider>
      <ErrorBoundary>
        <AppBootstrap />
      </ErrorBoundary>
    </SyncProvider>
  </StrictMode>,
);
