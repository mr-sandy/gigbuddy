import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { useAuth } from './auth/auth-context.js';
import { shouldRedirectOn401 } from './auth/redirect-on-401.js';
import { usePerformanceActive } from './performance/performance-context.js';
import { AuthenticatedShell } from './routes/authenticated-shell.js';
import { Home } from './routes/home.js';
import { Library } from './routes/library.js';
import { Login } from './routes/login.js';
import { PerformanceCard } from './routes/performance-card.js';
import { SetlistCreation } from './routes/setlist-creation.js';
import { SetlistOverview } from './routes/setlist-overview.js';
import { SongDetail } from './routes/song-detail.js';

function RequireAuth({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  const performanceActive = usePerformanceActive();
  if (
    auth.status === 'unauthenticated' &&
    shouldRedirectOn401({ performanceActive, wasNetworkSuccess: true })
  ) {
    return <Navigate to="/login" replace />;
  }
  // 'unknown' falls through and renders the shell — offline behavior per AR-16.
  return <>{children}</>;
}

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AuthenticatedShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: 'library', element: <Library /> },
      { path: 'songs/new', element: <SongDetail /> },
      { path: 'songs/:songId', element: <SongDetail /> },
      // `setlists/new` MUST precede `setlists/:setlistId` so the literal
      // "new" segment is not swallowed as a setlistId by the dynamic
      // route (Story 3.4).
      { path: 'setlists/new', element: <SetlistCreation /> },
      { path: 'setlists/:setlistId', element: <SetlistOverview /> },
      // Story 4.1: Performance Mode route. Lives inside `RequireAuth` like
      // the other protected routes; `AuthenticatedShell` hides its chrome
      // automatically when `performanceActive === true` via
      // `useChromeVisible`.
      { path: 'performance/:setlistId/:songIndex', element: <PerformanceCard /> },
    ],
  },
]);
