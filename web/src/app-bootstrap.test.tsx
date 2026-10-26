import 'fake-indexeddb/auto';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiFetch } from './api/client.js';
import { AppBootstrap } from './app-bootstrap.js';
import { router } from './router.js';

const fetchMock = vi.fn();
let queryClient: QueryClient;

function renderBootstrap(): ReturnType<typeof render> {
  // Production wraps <AppBootstrap /> in <SyncProvider> at main.tsx. In
  // tests we use a fresh per-test QueryClient so cached data from one test
  // can never leak into another.
  return render(
    <QueryClientProvider client={queryClient}>
      <AppBootstrap />
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  // The createBrowserRouter() instance is module-scoped; reset its location so
  // each test starts at '/' regardless of where a previous test left it.
  window.history.replaceState(null, '', '/');
  await router.navigate('/', { replace: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('AppBootstrap', () => {
  it('renders the GigBuddy shell heading while the /me probe is in-flight', () => {
    fetchMock.mockReturnValueOnce(new Promise(() => undefined)); // never resolves
    renderBootstrap();
    expect(screen.getByRole('heading', { name: 'GigBuddy' })).toBeInTheDocument();
  });

  it('mounts the authenticated shell with the landing page after a 200 /me response', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { status: 'ok', data: { authenticated: true, daysUntilExpiry: 365 } }),
      )
      // Fresh Response per call — useSongs and useSetlists each read the body.
      .mockImplementation(() => Promise.resolve(jsonResponse(200, { status: 'ok', data: [] })));
    renderBootstrap();
    // Both the pre-ready boot shell and the authenticated landing page render
    // an `<h1>GigBuddy</h1>` — the band name only appears once signed in.
    await waitFor(() => {
      expect(screen.getByText('The Jack Ruby 5')).toBeInTheDocument();
    });
  });

  it('redirects to /login when /me returns 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    renderBootstrap();
    await waitFor(() => {
      // The login route renders a password input with autocomplete="current-password".
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });
  });

  it('stays on the shell (no /login redirect) when fetch rejects (offline-cache path)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    renderBootstrap();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'GigBuddy' })).toBeInTheDocument();
    });
    // No login input should appear — AR-16 says we stay on the cached shell.
    expect(screen.queryByLabelText(/password/i)).toBeNull();
  });

  it('sends any unknown path to /login when signed out (catch-all → RequireAuth chain)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    window.history.replaceState(null, '', '/library');
    await router.navigate('/library', { replace: true });
    renderBootstrap();
    await waitFor(() => {
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });
  });

  it('SyncWiring installs the unauthorized handler: a 401 from apiFetch redirects to /login', async () => {
    // /me first → authenticated shell mounts → SyncWiring effect runs.
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { status: 'ok', data: { authenticated: true, daysUntilExpiry: 365 } }),
      )
      // Fresh Response per call — useSongs and useSetlists each read the body.
      .mockImplementation(() => Promise.resolve(jsonResponse(200, { status: 'ok', data: [] })));
    renderBootstrap();
    // Wait for the authenticated landing page (not just the ambiguous
    // "GigBuddy" boot-shell heading) so SyncWiring has definitely mounted.
    await waitFor(() => {
      expect(screen.getByText('The Jack Ruby 5')).toBeInTheDocument();
    });
    // Now fire a network call via apiFetch that returns 401 WITH x-server-now —
    // the SyncWiring handler should flip auth to 'unauthenticated' and the
    // router should redirect.
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'ok', data: [] }), {
        status: 401,
        headers: {
          'content-type': 'application/json',
          'x-server-now': new Date().toISOString(),
        },
      }),
    );
    await act(async () => {
      await apiFetch('/api/v1/songs', { method: 'GET', schema: z.unknown() });
    });
    await waitFor(() => {
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });
  });

  it('signed in: home → Songs → a song page', async () => {
    const song = {
      bandId: 'jack-ruby-5',
      songId: 'a1',
      title: 'Alpha Test Tune',
      clientWrittenAt: '2026-10-19T10:00:00.000Z',
      serverReceivedAt: '2026-10-19T10:00:00.000Z',
      version: 1,
    };
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/me') || url.endsWith('/me')) {
        return Promise.resolve(
          jsonResponse(200, { status: 'ok', data: { authenticated: true, daysUntilExpiry: 365 } }),
        );
      }
      if (url.includes('/songs/a1')) {
        return Promise.resolve(jsonResponse(200, { status: 'ok', data: song }));
      }
      return Promise.resolve(
        jsonResponse(200, { status: 'ok', data: url.includes('/songs') ? [song] : [] }),
      );
    });
    renderBootstrap();
    await userEvent.click(await screen.findByRole('link', { name: 'Songs' }));
    await userEvent.click(await screen.findByRole('link', { name: 'Alpha Test Tune' }));
    expect(await screen.findByRole('link', { name: 'Back to songs' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Alpha Test Tune' })).toBeInTheDocument();
  });

  it('signed in: home → Gigs → a gig', async () => {
    const setlist = {
      bandId: 'jack-ruby-5',
      setlistId: 'g1',
      gigMeta: { venue: 'Test Venue', date: '2026-11-07' },
      sections: [{ name: 'Set 1', songs: [{ songId: 's1', titleSnapshot: 'Test Tune' }] }],
      clientWrittenAt: '2026-10-19T10:00:00.000Z',
      serverReceivedAt: '2026-10-19T10:00:00.000Z',
      version: 1,
    };
    const song = {
      bandId: 'jack-ruby-5',
      songId: 's1',
      title: 'Test Tune',
      clientWrittenAt: '2026-10-19T10:00:00.000Z',
      serverReceivedAt: '2026-10-19T10:00:00.000Z',
      version: 1,
    };
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/me') || url.endsWith('/me')) {
        return Promise.resolve(
          jsonResponse(200, { status: 'ok', data: { authenticated: true, daysUntilExpiry: 365 } }),
        );
      }
      if (url.includes('/songs/s1')) {
        return Promise.resolve(jsonResponse(200, { status: 'ok', data: song }));
      }
      if (url.includes('/setlists/g1')) {
        return Promise.resolve(jsonResponse(200, { status: 'ok', data: setlist }));
      }
      return Promise.resolve(
        jsonResponse(200, { status: 'ok', data: url.includes('/setlists') ? [setlist] : [] }),
      );
    });
    renderBootstrap();
    await userEvent.click(await screen.findByRole('link', { name: 'Gigs' }));
    await userEvent.click(await screen.findByRole('link', { name: /Test Venue/ }));
    expect(await screen.findByRole('link', { name: 'Back to gigs' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Test Venue' })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('link', { name: 'Test Tune' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Test Tune' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Back to gig' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Test Venue' }),
    ).toBeInTheDocument();
  });

  it('sends /gigs to /login when signed out', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    window.history.replaceState(null, '', '/gigs');
    await router.navigate('/gigs', { replace: true });
    renderBootstrap();
    await waitFor(() => {
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });
  });

  it('sends /songs to /login when signed out', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    window.history.replaceState(null, '', '/songs');
    await router.navigate('/songs', { replace: true });
    renderBootstrap();
    await waitFor(() => {
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });
  });
});
