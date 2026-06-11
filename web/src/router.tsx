import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { useAuth } from './auth/auth-context.js';
import { shouldRedirectOn401 } from './auth/redirect-on-401.js';
import { usePerformanceActive } from './performance/performance-context.js';
import { AuthenticatedShell } from './routes/authenticated-shell.js';
import { Home } from './routes/home.js';
import { Library } from './routes/library.js';
import { Login } from './routes/login.js';

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
    ],
  },
]);
