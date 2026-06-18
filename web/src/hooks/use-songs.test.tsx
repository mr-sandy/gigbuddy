import { ACTIVE_BAND_ID, type Song } from '@gigbuddy/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetDriftWarningForTests, setUnauthorizedHandler } from '../api/client.js';
import { Library } from '../routes/library.js';
import { useSongs } from './use-songs.js';

function jsonRes(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'x-server-now': new Date().toISOString(),
      ...headers,
    },
  });
}

function makeSong(songId: string, title: string): Song {
  return {
    bandId: ACTIVE_BAND_ID,
    songId,
    title,
    clientWrittenAt: '2026-06-17T12:00:00.000Z',
    serverReceivedAt: '2026-06-17T12:00:01.000Z',
    version: 1 as const,
  };
}

const fetchMock = vi.fn();

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  __resetDriftWarningForTests();
  setUnauthorizedHandler(null);
  // Fresh QueryClient per test — never reuse the SyncProvider's singleton.
  // retry: false — prevents exponential-backoff fan-out on transient failures.
  // staleTime: Infinity — isolates cache-correctness tests from the
  // production refetch-on-mount behavior (staleTime: 0 in the SyncProvider).
  // The "no second fetch" assertion in the cache test would otherwise fail
  // because staleTime: 0 schedules a background refetch on every mount.
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  queryClient.clear();
});

describe('useSongs', () => {
  it('returns the alphabetized array on success', async () => {
    const songs = [
      makeSong('a', 'Autumn Leaves'),
      makeSong('b', 'Blue Bossa'),
      makeSong('c', 'Charleston'),
    ];
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: songs }));
    const { result } = renderHook(() => useSongs(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(songs);
  });

  it('uses the [songs, ACTIVE_BAND_ID] queryKey', async () => {
    const songs = [makeSong('a', 'Autumn Leaves')];
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: songs }));
    const { result } = renderHook(() => useSongs(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(['songs', ACTIVE_BAND_ID])).toEqual(songs);
  });

  it('renders cached data immediately on a second mount without a second fetch', async () => {
    const songs = [makeSong('a', 'Autumn Leaves')];
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: songs }));
    const first = renderHook(() => useSongs(), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second mount: data is cached; isSuccess flips true synchronously
    // with the existing query data — no second fetch within the staleTime
    // window (staleTime is 0 by default but isSuccess is true on mount
    // because the cache has fresh data from the same tick).
    const second = renderHook(() => useSongs(), { wrapper });
    expect(second.result.current.data).toEqual(songs);
    expect(second.result.current.isSuccess).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('useSongs — cache invalidation drives Library re-render (AC-8)', () => {
  it('re-renders with new data when setQueryData updates the songs cache', async () => {
    const songA = makeSong('a', 'Autumn Leaves');
    const songB = makeSong('b', 'Blue Bossa');
    const songC = makeSong('c', 'Charleston');

    // Pre-seed the cache so the hook resolves synchronously without
    // hitting the network. The Library will render against this cache
    // immediately — this is the "render from cache" pattern Story 2.6's
    // useSongMutation() write path relies on.
    queryClient.setQueryData(['songs', ACTIVE_BAND_ID], [songA, songC]);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Library />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText('Autumn Leaves')).toBeInTheDocument());
    expect(screen.getByText('Charleston')).toBeInTheDocument();
    expect(screen.queryByText('Blue Bossa')).toBeNull();

    // Simulate a write-side cache update (canonical pattern Story 2.6
    // will use after a successful POST/PUT completes).
    act(() => {
      queryClient.setQueryData(['songs', ACTIVE_BAND_ID], [songA, songB, songC]);
    });

    await waitFor(() => expect(screen.getByText('Blue Bossa')).toBeInTheDocument());
    const rowLinks = screen
      .getAllByRole('link')
      .filter(
        (link) =>
          link.getAttribute('href')?.startsWith('/songs/') &&
          link.getAttribute('href') !== '/songs/new',
      );
    expect(rowLinks.map((link) => link.textContent)).toEqual([
      'Autumn Leaves',
      'Blue Bossa',
      'Charleston',
    ]);
  });
});
