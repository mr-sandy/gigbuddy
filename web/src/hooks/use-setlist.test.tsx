import { ACTIVE_BAND_ID, type Setlist } from '@gigbuddy/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetDriftWarningForTests, setUnauthorizedHandler } from '../api/client.js';
import { useSetlist } from './use-setlist.js';

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

describe('useSetlist', () => {
  it('resolves to the Setlist on a 200 ok envelope', async () => {
    const setlist = makeSetlist('abc', '2026-06-21', 'Jazz Cafe');
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: setlist }));
    const { result } = renderHook(() => useSetlist('abc'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(setlist);
  });

  it('uses the [setlist, ACTIVE_BAND_ID, setlistId] queryKey', async () => {
    const setlist = makeSetlist('abc', '2026-06-21', 'Jazz Cafe');
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: setlist }));
    const { result } = renderHook(() => useSetlist('abc'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(['setlist', ACTIVE_BAND_ID, 'abc'])).toEqual(setlist);
  });

  it('resolves to null (not an error) on a 404 NOT_FOUND envelope', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonRes(404, { status: 'error', error: { code: 'NOT_FOUND', message: 'gone' } }),
    );
    const { result } = renderHook(() => useSetlist('missing'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('does NOT fire the fetch when setlistId === null (enabled: false)', () => {
    const { result } = renderHook(() => useSetlist(null), { wrapper });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
