import { ACTIVE_BAND_ID, type Section, type Setlist } from '@gigbuddy/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * `useStartPerformance` test suite — Story 4.1.
 *
 * The hook orchestrates the Performance Mode entry sequence: setlist
 * prefetch → song prefetch (all referenced songs in flat order) → wake
 * lock acquire → setActive(true) → navigate. Each step is mocked so the
 * test can assert the call order and the no-op guard.
 *
 * `getFirstSongIndex` is a plain helper exported from the same module —
 * a couple of pure-function cases live alongside the hook tests.
 */

const navigateMock = vi.fn();
const setActiveMock = vi.fn();
const setPerformanceSessionMock = vi.fn();
const acquireMock = vi.fn(async () => {});
const getSetlistMock = vi.fn();
const getSongMock = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigateMock };
});
vi.mock('./performance-context.js', () => ({
  useSetPerformanceActive: () => setActiveMock,
  useSetActivePerformanceSession: () => setPerformanceSessionMock,
}));
vi.mock('./wake-lock.js', () => ({
  acquire: () => acquireMock(),
  release: () => {},
  isHeld: () => false,
}));
vi.mock('../api/setlists.js', () => ({
  getSetlist: (id: string) => getSetlistMock(id),
}));
vi.mock('../api/songs.js', () => ({
  getSong: (id: string) => getSongMock(id),
}));

// Import AFTER the vi.mock calls so the hook sees the mocked modules.
import { getFirstSongIndex, useStartPerformance } from './use-start-performance.js';

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  // .test.ts files cannot host JSX, so the wrapper is built via createElement.
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

function makeSetlist(sections: Section[]): Setlist {
  return {
    bandId: ACTIVE_BAND_ID,
    setlistId: 'setlist000000001',
    gigMeta: { venue: 'The Jazz Cafe', date: '2026-06-21', time: '20:00' },
    sections,
    clientWrittenAt: '2026-06-19T10:00:00.000Z',
    serverReceivedAt: '2026-06-19T10:00:01.000Z',
    version: 1,
  };
}

beforeEach(() => {
  navigateMock.mockReset();
  setActiveMock.mockReset();
  setPerformanceSessionMock.mockReset();
  acquireMock.mockReset().mockImplementation(async () => {});
  getSetlistMock.mockReset();
  getSongMock.mockReset();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

afterEach(() => {
  queryClient.clear();
});

describe('getFirstSongIndex', () => {
  it('returns 0 when at least one Section has Songs', () => {
    expect(
      getFirstSongIndex([{ name: 'Set 1', songs: [{ songId: 'aaa', titleSnapshot: 'Foo' }] }]),
    ).toBe(0);
  });

  it('returns 0 when the first Section is empty but a later Section has Songs', () => {
    expect(
      getFirstSongIndex([
        { name: 'Set 1', songs: [] },
        { name: 'Set 2', songs: [{ songId: 'bbb', titleSnapshot: 'Bar' }] },
      ]),
    ).toBe(0);
  });

  it('returns null when every Section is empty', () => {
    expect(
      getFirstSongIndex([
        { name: 'Set 1', songs: [] },
        { name: 'Set 2', songs: [] },
      ]),
    ).toBeNull();
  });

  it('returns null on an empty sections array', () => {
    expect(getFirstSongIndex([])).toBeNull();
  });
});

describe('useStartPerformance', () => {
  it('prefetches the Setlist and every referenced Song, then acquires wake lock, then setActive(true), then navigates', async () => {
    const setlist = makeSetlist([
      {
        name: 'Set 1',
        songs: [
          { songId: 'song000000000001', titleSnapshot: 'Autumn Leaves' },
          { songId: 'song000000000002', titleSnapshot: 'Black Orpheus' },
        ],
      },
      {
        name: 'Set 2',
        songs: [{ songId: 'song000000000003', titleSnapshot: 'Take Five' }],
      },
    ]);
    getSetlistMock.mockResolvedValue(setlist);
    getSongMock.mockResolvedValue({});

    const { result } = renderHook(() => useStartPerformance(), { wrapper });
    await result.current('setlist000000001');

    // Setlist fetched/prefetched against the canonical key.
    expect(getSetlistMock).toHaveBeenCalledWith('setlist000000001');

    // Each Song in flat Setlist order is prefetched.
    const songIds = getSongMock.mock.calls.map((args: unknown[]) => args[0]);
    expect(songIds).toEqual(
      expect.arrayContaining(['song000000000001', 'song000000000002', 'song000000000003']),
    );
    expect(songIds).toHaveLength(3);

    expect(acquireMock).toHaveBeenCalledTimes(1);
    expect(setActiveMock).toHaveBeenCalledWith(true);
    expect(navigateMock).toHaveBeenCalledWith('/performance/setlist000000001/0');
  });

  it('writes the prefetched Songs into the QueryClient cache under [song, bandId, songId]', async () => {
    const setlist = makeSetlist([
      {
        name: 'Set 1',
        songs: [{ songId: 'song000000000001', titleSnapshot: 'Autumn Leaves' }],
      },
    ]);
    getSetlistMock.mockResolvedValue(setlist);
    getSongMock.mockResolvedValue({ songId: 'song000000000001', title: 'Autumn Leaves' });

    const { result } = renderHook(() => useStartPerformance(), { wrapper });
    await result.current('setlist000000001');

    await waitFor(() => {
      expect(queryClient.getQueryData(['song', ACTIVE_BAND_ID, 'song000000000001'])).toBeDefined();
    });
  });

  it('is a no-op when every Section is empty (no prefetch, no setActive, no navigate)', async () => {
    const setlist = makeSetlist([{ name: 'Set 1', songs: [] }]);
    getSetlistMock.mockResolvedValue(setlist);

    const { result } = renderHook(() => useStartPerformance(), { wrapper });
    await result.current('setlist000000001');

    // The first getSetlist resolves (we need to know the Sections to gate).
    expect(getSetlistMock).toHaveBeenCalled();
    // But no Songs are prefetched, no wake lock, no setActive, no navigate.
    expect(getSongMock).not.toHaveBeenCalled();
    expect(acquireMock).not.toHaveBeenCalled();
    expect(setActiveMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('is a no-op when the Setlist resolves to null (404)', async () => {
    getSetlistMock.mockResolvedValue(null);

    const { result } = renderHook(() => useStartPerformance(), { wrapper });
    await result.current('setlistmissing00');

    expect(getSongMock).not.toHaveBeenCalled();
    expect(acquireMock).not.toHaveBeenCalled();
    expect(setActiveMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('invokes prefetch → acquire → setActive → navigate strictly in order', async () => {
    const setlist = makeSetlist([
      {
        name: 'Set 1',
        songs: [{ songId: 'song000000000001', titleSnapshot: 'Autumn Leaves' }],
      },
    ]);
    getSetlistMock.mockResolvedValue(setlist);
    getSongMock.mockResolvedValue({});

    const calls: string[] = [];
    getSongMock.mockImplementation(async () => {
      calls.push('song-prefetch');
      return {};
    });
    acquireMock.mockImplementation(async () => {
      calls.push('acquire');
    });
    setActiveMock.mockImplementation(() => {
      calls.push('setActive');
    });
    navigateMock.mockImplementation(() => {
      calls.push('navigate');
    });

    const { result } = renderHook(() => useStartPerformance(), { wrapper });
    await result.current('setlist000000001');

    // song-prefetch resolves first; acquire after; setActive after; navigate last.
    expect(calls).toEqual(['song-prefetch', 'acquire', 'setActive', 'navigate']);
  });

  it('returns a referentially stable function across renders (useCallback contract)', () => {
    const { result, rerender } = renderHook(() => useStartPerformance(), { wrapper });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('seeds the Performance session pointer with (setlistId, 0) on entry (Story 4.3)', async () => {
    const setlist = makeSetlist([
      {
        name: 'Set 1',
        songs: [{ songId: 'song000000000001', titleSnapshot: 'Autumn Leaves' }],
      },
    ]);
    getSetlistMock.mockResolvedValue(setlist);
    getSongMock.mockResolvedValue({});

    const { result } = renderHook(() => useStartPerformance(), { wrapper });
    await result.current('setlist000000001');

    expect(setPerformanceSessionMock).toHaveBeenCalledWith('setlist000000001', 0);
  });
});
