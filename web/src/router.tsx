import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { useAuth } from './auth/auth-context.js';
import { shouldRedirectOn401 } from './auth/redirect-on-401.js';
import { AuthenticatedShell } from './routes/authenticated-shell.js';
import { Gig } from './routes/gig.js';
import { GigEdit } from './routes/gig-edit.js';
import { Gigs } from './routes/gigs.js';
import { Home } from './routes/home.js';
import { Login } from './routes/login.js';
import { Song } from './routes/song.js';
import { SongEdit } from './routes/song-edit.js';
import { Songs } from './routes/songs.js';

function RequireAuth({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  if (auth.status === 'unauthenticated' && shouldRedirectOn401({ wasNetworkSuccess: true })) {
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
      { path: 'songs', element: <Songs /> },
      { path: 'songs/new', element: <SongEdit /> },
      { path: 'songs/:songId', element: <Song /> },
      { path: 'songs/:songId/edit', element: <SongEdit /> },
      { path: 'gigs', element: <Gigs /> },
      { path: 'gigs/new', element: <GigEdit /> },
      { path: 'gigs/:setlistId', element: <Gig /> },
      { path: 'gigs/:setlistId/edit', element: <GigEdit /> },
      { path: 'gigs/:setlistId/songs/:songId', element: <Song /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
