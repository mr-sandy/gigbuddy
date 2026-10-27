import 'fake-indexeddb/auto';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiFetch } from './api/client.js';
import { AppBootstrap } from './app-bootstrap.js';
import { GIG_PLAY } from './lib/microcopy.js';
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

const authedOk = () =>
  jsonResponse(200, { status: 'ok', data: { authenticated: true, daysUntilExpiry: 365 } });

const songFixture = {
  bandId: 'jack-ruby-5',
  songId: 'a1',
  title: 'Alpha Test Tune',
  clientWrittenAt: '2026-10-19T10:00:00.000Z',
  serverReceivedAt: '2026-10-19T10:00:00.000Z',
  version: 1,
};
const gigFixture = {
  bandId: 'jack-ruby-5',
  setlistId: 'g1',
  gigMeta: { venue: 'Test Venue', date: '2026-11-07' },
  sections: [{ name: 'Set 1', songs: [{ songId: 'a1', titleSnapshot: 'Alpha Test Tune' }] }],
  clientWrittenAt: '2026-10-19T10:00:00.000Z',
  serverReceivedAt: '2026-10-19T10:00:00.000Z',
  version: 1,
};

function mockSignedInWithData() {
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/auth/me') || url.endsWith('/me')) return Promise.resolve(authedOk());
    if (url.includes('/songs/a1')) {
      return Promise.resolve(jsonResponse(200, { status: 'ok', data: songFixture }));
    }
    if (url.includes('/setlists/g1')) {
      return Promise.resolve(jsonResponse(200, { status: 'ok', data: gigFixture }));
    }
    const data = url.includes('/songs')
      ? [songFixture]
      : url.includes('/setlists')
        ? [gigFixture]
        : [];
    return Promise.resolve(jsonResponse(200, { status: 'ok', data }));
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
    // Both the pre-ready boot shell and the authenticated landing page (the
    // Songs list) render an `<h1>` — the band name only appears once signed in.
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
    // Wait for the authenticated landing page (the band name in the Songs
    // header, not just the ambiguous "GigBuddy" boot-shell heading) so SyncWiring has definitely mounted.
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

  it('signed in: / → Songs → a song page', async () => {
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

  it('signed in: / → Gigs → a gig', async () => {
    const setlist = {
      bandId: 'jack-ruby-5',
      setlistId: 'g1',
      gigMeta: { venue: 'Test Venue', date: '2026-11-07' },
      sections: [
        {
          name: 'Set 1',
          songs: [
            { songId: 's1', titleSnapshot: 'Test Tune' },
            { songId: 's2', titleSnapshot: 'Second Test Tune' },
          ],
        },
      ],
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
    const song2 = { ...song, songId: 's2', title: 'Second Test Tune' };
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/me') || url.endsWith('/me')) {
        return Promise.resolve(
          jsonResponse(200, { status: 'ok', data: { authenticated: true, daysUntilExpiry: 365 } }),
        );
      }
      if (url.includes('/songs/s2')) {
        return Promise.resolve(jsonResponse(200, { status: 'ok', data: song2 }));
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
    await userEvent.click(await screen.findByRole('link', { name: GIG_PLAY.nextSong }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Second Test Tune' }),
    ).toBeInTheDocument();
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

  describe('header and tab bar (Story 7.20)', () => {
    const tabBar = () => screen.queryByRole('navigation', { name: 'Lists' });

    it('signed in: / redirects to /songs and shows the tab bar with Songs current', async () => {
      mockSignedInWithData();
      renderBootstrap();
      expect(await screen.findByRole('link', { name: 'Alpha Test Tune' })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/songs');
      expect(tabBar()).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Songs' })).toHaveAttribute('aria-current', 'page');
    });

    it('signed in: an unknown path also lands on /songs', async () => {
      mockSignedInWithData();
      window.history.replaceState(null, '', '/library');
      await router.navigate('/library', { replace: true });
      renderBootstrap();
      expect(await screen.findByRole('link', { name: 'Alpha Test Tune' })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/songs');
    });

    it('signed in: the tabs switch between the two lists', async () => {
      mockSignedInWithData();
      renderBootstrap();
      await userEvent.click(await screen.findByRole('link', { name: 'Gigs' }));
      expect(await screen.findByRole('link', { name: /Test Venue/ })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/gigs');
      expect(tabBar()).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Gigs' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: 'Songs' })).not.toHaveAttribute('aria-current');
    });

    it.each([
      ['a song page', '/songs/a1'],
      ['a gig page', '/gigs/g1'],
      ['a gig song page', '/gigs/g1/songs/a1'],
    ])('signed in: no tab bar on %s', async (_name, path) => {
      mockSignedInWithData();
      window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
      window.history.replaceState(null, '', path);
      await router.navigate(path, { replace: true });
      renderBootstrap();
      expect(await screen.findByRole('link', { name: /^Back to/ })).toBeInTheDocument();
      expect(tabBar()).toBeNull();
    });
  });

  describe('sheets over their page (Story 7.21)', () => {
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

    async function openDirectly(path: string) {
      mockSignedInWithData();
      window.history.replaceState(null, '', path);
      await router.navigate(path, { replace: true });
      renderBootstrap();
    }

    it.each([
      ['/songs/new', 'Add song', 'Songs'],
      ['/songs/a1/edit', 'Edit song', 'Alpha Test Tune'],
      ['/gigs/new', 'Add gig', 'Gigs'],
      ['/gigs/g1/edit', 'Edit gig', 'Test Venue'],
      ['/gigs/g1/setlist', 'Edit setlist', 'Test Venue'],
    ])('deep link %s shows the %s sheet over the right page', async (path, sheet, heading) => {
      await openDirectly(path);
      expect(await screen.findByRole('dialog', { name: sheet })).toBeInTheDocument();
      // Radix aria-hides the page behind a modal, which also blanks accessible names.
      const h1 = await screen.findByRole('heading', { level: 1, hidden: true });
      expect(h1).toHaveTextContent(heading);
    });

    it('keeps the list tab bar behind the add sheets', async () => {
      await openDirectly('/songs/new');
      await screen.findByRole('dialog', { name: 'Add song' });
      const nav = screen.getByRole('navigation', { hidden: true });
      expect(nav).toHaveAttribute('aria-label', 'Lists');
      const songsTab = Array.from(nav.querySelectorAll('a')).find((a) => a.textContent === 'Songs');
      expect(songsTab).toHaveAttribute('aria-current', 'page');
    });

    it('browser Back from an opened sheet closes it and leaves the page', async () => {
      mockSignedInWithData();
      renderBootstrap();
      await userEvent.click(await screen.findByRole('link', { name: 'Alpha Test Tune' }));
      await userEvent.click(await screen.findByRole('link', { name: 'Edit' }));
      expect(await screen.findByRole('dialog', { name: 'Edit song' })).toBeInTheDocument();
      await act(async () => {
        await router.navigate(-1);
      });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(router.state.location.pathname).toBe('/songs/a1');
      expect(
        screen.getByRole('heading', { level: 1, name: 'Alpha Test Tune' }),
      ).toBeInTheDocument();
    });
  });

  describe('delete and Back (Story 7.23)', () => {
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

    // The router counts history from window.history.state.idx, which the
    // beforeEach reset wipes. Start with a real depth: `before` is idx 0, the list
    // idx 1, the record idx 2 and its sheet idx 3.
    async function startAt(before: string, list: string, emptyGigList: boolean) {
      mockSignedInWithData();
      withDelete(emptyGigList);
      window.history.replaceState({ idx: 0 }, '', before);
      await router.navigate(before, { replace: true });
      await router.navigate(list);
      renderBootstrap();
    }

    // The fixture gig uses the fixture song, which would make the song's delete
    // an "in use" refusal; the gig list is empty for the song case.
    function withDelete(emptyGigList: boolean) {
      const base = fetchMock.getMockImplementation();
      fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
        if (emptyGigList && String(input).endsWith('/setlists')) {
          return Promise.resolve(jsonResponse(200, { status: 'ok', data: [] }));
        }
        return base?.(input, init) as Promise<Response>;
      });
    }

    it.each([
      ['song', '/gigs', '/songs', 'Alpha Test Tune', 'Edit song', 'Delete song', '/songs/a1'],
      ['gig', '/songs', '/gigs', /Test Venue/, 'Edit gig', 'Delete gig', '/gigs/g1'],
    ] as const)('deleting a %s leaves Back clear of it', async (_k, before, list, linkName, sheet, del, recordPath) => {
      await startAt(before, list, list === '/songs');
      await userEvent.click(await screen.findByRole('link', { name: linkName }));
      await userEvent.click(await screen.findByRole('link', { name: 'Edit' }));
      await screen.findByRole('dialog', { name: sheet });
      await userEvent.click(screen.getByRole('button', { name: new RegExp(del, 'i') }));
      await userEvent.click(await screen.findByRole('button', { name: /^Yes, delete/ }));
      await waitFor(() => expect(router.state.location.pathname).toBe(list));
      await act(async () => {
        await router.navigate(-1);
      });
      expect(router.state.location.pathname).not.toBe(recordPath);
      expect(router.state.location.pathname).toBe(before);
    });
  });

  describe('settings sheet (Story 7.22)', () => {
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    const bandButton = () => screen.queryByRole('button', { name: 'The Jack Ruby 5' });

    it.each([
      ['/songs', 'Alpha Test Tune'],
      ['/gigs', /Test Venue/],
    ])('opens and closes from %s, staying on the list', async (path, row) => {
      mockSignedInWithData();
      window.history.replaceState(null, '', path);
      await router.navigate(path, { replace: true });
      renderBootstrap();
      await screen.findByRole('link', { name: row });
      await userEvent.click(screen.getByRole('button', { name: 'The Jack Ruby 5' }));
      expect(await screen.findByRole('dialog', { name: 'GigBuddy' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Done' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(router.state.location.pathname).toBe(path);
    });

    it.each([
      ['a song page', '/songs/a1'],
      ['a gig page', '/gigs/g1'],
      ['a gig song page', '/gigs/g1/songs/a1'],
    ])('has no band button on %s', async (_name, path) => {
      mockSignedInWithData();
      window.history.replaceState(null, '', path);
      await router.navigate(path, { replace: true });
      renderBootstrap();
      expect(await screen.findByRole('link', { name: /^Back to/ })).toBeInTheDocument();
      expect(bandButton()).toBeNull();
    });
  });
});
