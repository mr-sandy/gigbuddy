import { ACTIVE_BAND_ID, type Setlist } from '@gigbuddy/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetDriftWarningForTests, setUnauthorizedHandler } from '../api/client.js';
import { useSetlists } from './use-setlists.js';

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

function makeSetlist(setlistId: string, date: string, venue: string): Setlist {
  return {
    bandId: ACTIVE_BAND_ID,
    setlistId,
    gigMeta: { venue, date, time: '20:00' },
    sections: [
      {
        name: 'Set 1',
        songs: [{ songId: 'song0000000001ab', titleSnapshot: 'Round Midnight' }],
      },
    ],
    clientWrittenAt: '2026-06-19T10:00:00.000Z',
    serverReceivedAt: '2026-06-19T10:00:01.000Z',
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
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  queryClient.clear();
});

describe('useSetlists', () => {
  it('resolves to the array on success', async () => {
    const setlists = [
      makeSetlist('a', '2026-06-21', 'Jazz Cafe'),
      makeSetlist('b', '2026-07-01', 'Blue Note'),
    ];
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: setlists }));
    const { result } = renderHook(() => useSetlists(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(setlists);
  });

  it('uses the [setlists, ACTIVE_BAND_ID] queryKey', async () => {
    const setlists = [makeSetlist('a', '2026-06-21', 'Jazz Cafe')];
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: setlists }));
    const { result } = renderHook(() => useSetlists(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(['setlists', ACTIVE_BAND_ID])).toEqual(setlists);
  });

  it('returns an empty array when the server returns no setlists', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: [] }));
    const { result } = renderHook(() => useSetlists(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
