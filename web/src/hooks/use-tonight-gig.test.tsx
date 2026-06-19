import { ACTIVE_BAND_ID, type Setlist } from '@gigbuddy/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetDriftWarningForTests, setUnauthorizedHandler } from '../api/client.js';
import { useTonightGig } from './use-tonight-gig.js';

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

function makeSetlist(setlistId: string, date: string, venue = 'Venue'): Setlist {
  return {
    bandId: ACTIVE_BAND_ID,
    setlistId,
    gigMeta: { venue, date, time: '20:00' },
    sections: [],
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

// Fix "today" so the pure sectioning logic is deterministic regardless of
// when CI runs. We use vi.useFakeTimers + vi.setSystemTime so
// `todayLondon()` inside the hook returns a known date.
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  __resetDriftWarningForTests();
  setUnauthorizedHandler(null);
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  // Only fake Date so todayLondon() is deterministic; leave timers alone so
  // React Query's microtasks / waitFor scheduling still works.
  vi.useFakeTimers({ toFake: ['Date'] });
  // 12:00 UTC is mid-day London (BST or GMT) — always "2026-06-21" London.
  vi.setSystemTime(new Date('2026-06-21T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  queryClient.clear();
});

describe('useTonightGig', () => {
  it('returns null while the underlying useSetlists query is loading', () => {
    // Pending promise — never resolves during the assertion.
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useTonightGig(), { wrapper });
    expect(result.current).toBeNull();
  });

  it('returns null when the setlists list is empty', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: [] }));
    const { result } = renderHook(() => useTonightGig(), { wrapper });
    await waitFor(() => {
      expect(queryClient.getQueryData(['setlists', ACTIVE_BAND_ID])).toEqual([]);
    });
    expect(result.current).toBeNull();
  });

  it('returns the today-dated setlist when one exists', async () => {
    const today = makeSetlist('today1', '2026-06-21', 'Today Venue');
    const future = makeSetlist('future1', '2026-07-01');
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: [today, future] }));
    const { result } = renderHook(() => useTonightGig(), { wrapper });
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.setlistId).toBe('today1');
  });

  it('returns the soonest future setlist when no today gig exists', async () => {
    const soon = makeSetlist('soon', '2026-06-22');
    const later = makeSetlist('later', '2026-07-04');
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: [soon, later] }));
    const { result } = renderHook(() => useTonightGig(), { wrapper });
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.setlistId).toBe('soon');
  });

  it('returns null when no today gig and no upcoming gigs exist (only past)', async () => {
    const past = makeSetlist('past', '2026-05-01');
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: [past] }));
    const { result } = renderHook(() => useTonightGig(), { wrapper });
    await waitFor(() => {
      expect(queryClient.getQueryData(['setlists', ACTIVE_BAND_ID])).toEqual([past]);
    });
    expect(result.current).toBeNull();
  });
});
