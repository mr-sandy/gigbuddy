import { ACTIVE_BAND_ID, type Setlist } from '@gigbuddy/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * `prefetch.ts` unit tests — Story 4.5 (AC-11).
 *
 * The module registers a `visibilitychange` listener at load time. We mock
 * the deps (`isIPhone`, `queryClient`, the API functions) BEFORE importing
 * the module so the singleton's setup runs against the mocks. The tests
 * call `onForeground()` directly to assert the behaviour without
 * dispatching real DOM events.
 */

const {
  isIPhoneMock,
  prefetchQueryMock,
  getQueryDataMock,
  listUpcomingGigsMock,
  getSetlistMock,
  getSongMock,
} = vi.hoisted(() => ({
  isIPhoneMock: vi.fn(),
  prefetchQueryMock: vi.fn(),
  getQueryDataMock: vi.fn(),
  listUpcomingGigsMock: vi.fn(),
  getSetlistMock: vi.fn(),
  getSongMock: vi.fn(),
}));

vi.mock('../lib/platform.js', () => ({
  isIPhone: isIPhoneMock,
  isStandalone: vi.fn(() => true),
}));

vi.mock('../sync/query-client.js', () => ({
  queryClient: {
    prefetchQuery: prefetchQueryMock,
    getQueryData: getQueryDataMock,
  },
}));

vi.mock('../api/gigs.js', () => ({
  listUpcomingGigs: listUpcomingGigsMock,
}));

vi.mock('../api/setlists.js', () => ({
  getSetlist: getSetlistMock,
}));

vi.mock('../api/songs.js', () => ({
  getSong: getSongMock,
}));

import { onForeground } from './prefetch.js';

function makeSetlist(overrides: Partial<Setlist> = {}): Setlist {
  return {
    bandId: ACTIVE_BAND_ID,
    setlistId: 'setlist0000000aa',
    gigMeta: { venue: 'The Jazz Cafe', date: '2026-06-21', time: '20:00' },
    sections: [
      {
        name: 'Set 1',
        songs: [
          { songId: 'song0000000001ab', titleSnapshot: 'Round Midnight' },
          { songId: 'song0000000002cd', titleSnapshot: 'Autumn Leaves' },
        ],
      },
    ],
    clientWrittenAt: '2026-06-19T10:00:00.000Z',
    serverReceivedAt: '2026-06-19T10:00:01.000Z',
    version: 1,
    ...overrides,
  };
}

beforeEach(() => {
  isIPhoneMock.mockReset();
  prefetchQueryMock.mockReset();
  prefetchQueryMock.mockResolvedValue(undefined);
  getQueryDataMock.mockReset();
  getQueryDataMock.mockReturnValue(undefined);
  listUpcomingGigsMock.mockReset();
  getSetlistMock.mockReset();
  getSongMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('onForeground — platform gate (AR-25)', () => {
  it('does NOT call prefetchQuery when isIPhone() returns false (MacBook)', async () => {
    isIPhoneMock.mockReturnValue(false);
    await onForeground();
    expect(prefetchQueryMock).not.toHaveBeenCalled();
  });

  it('does NOT call prefetchQuery for any setlist when there are no upcoming gigs', async () => {
    isIPhoneMock.mockReturnValue(true);
    getQueryDataMock.mockReturnValue([]);
    await onForeground();
    // It DOES call prefetchQuery once for the upcoming-gigs slot itself —
    // that's the only call.
    expect(prefetchQueryMock).toHaveBeenCalledTimes(1);
    expect(prefetchQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['upcoming-gigs', ACTIVE_BAND_ID] }),
    );
  });
});

describe('onForeground — happy path (AC-3/4)', () => {
  it('on iPhone with a gig within 24h: calls prefetchQuery for the upcoming-gigs slot, the setlist, and each referenced song', async () => {
    isIPhoneMock.mockReturnValue(true);
    const setlist = makeSetlist();
    getQueryDataMock.mockReturnValue([setlist]);

    await onForeground();

    // 1 upcoming-gigs + 1 setlist + 2 songs = 4 prefetch calls
    expect(prefetchQueryMock).toHaveBeenCalledTimes(4);

    // upcoming-gigs slot (exact key shared with useUpcomingGigs)
    expect(prefetchQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['upcoming-gigs', ACTIVE_BAND_ID] }),
    );
    // setlist slot — EXACT key shape `useSetlist` consumes
    expect(prefetchQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['setlist', ACTIVE_BAND_ID, setlist.setlistId] }),
    );
    // song slots — EXACT key shape `useSong` consumes
    expect(prefetchQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['song', ACTIVE_BAND_ID, 'song0000000001ab'] }),
    );
    expect(prefetchQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['song', ACTIVE_BAND_ID, 'song0000000002cd'] }),
    );
  });
});

describe('onForeground — silent failure (AC-5, AR-28)', () => {
  it('does not throw when prefetchQuery rejects', async () => {
    isIPhoneMock.mockReturnValue(true);
    prefetchQueryMock.mockRejectedValueOnce(new Error('offline'));
    await expect(onForeground()).resolves.toBeUndefined();
  });

  it('does not throw when the underlying fetch throws (listUpcomingGigs error)', async () => {
    isIPhoneMock.mockReturnValue(true);
    // Make the prefetchQuery wrapper propagate the queryFn's rejection.
    prefetchQueryMock.mockImplementationOnce(
      async ({ queryFn }: { queryFn: () => Promise<unknown> }) => {
        return queryFn();
      },
    );
    listUpcomingGigsMock.mockRejectedValueOnce(new Error('boom'));
    await expect(onForeground()).resolves.toBeUndefined();
  });
});

describe('onForeground — visibilitychange listener registration', () => {
  it('the module registers a visibilitychange listener at load time', () => {
    // The module-scope `if (typeof document !== 'undefined')` block runs
    // exactly once at import time. We can't reliably introspect listener
    // arrays in jsdom, but we can confirm the registration path is alive
    // by triggering a visible event and asserting prefetchQuery is called
    // (transitively via onForeground). Use a fresh isIPhone=true mock so
    // the inner body runs.
    isIPhoneMock.mockReturnValue(true);
    getQueryDataMock.mockReturnValue([]);

    // Simulate the foreground transition.
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // The handler is async; flush microtasks once.
    return Promise.resolve().then(() => {
      expect(prefetchQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['upcoming-gigs', ACTIVE_BAND_ID] }),
      );
    });
  });
});
