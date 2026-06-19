import 'fake-indexeddb/auto';

import { ACTIVE_BAND_ID, type Setlist, type SetlistPutInput } from '@gigbuddy/shared';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetOutboxForTests, listAll } from '../sync/outbox.js';
import { queryClient } from '../sync/query-client.js';
import { setlistRecordKey } from '../sync/record-key.js';
import { mergeSetlistIntoList, useSetlistMutation } from './use-setlist-mutation.js';

vi.mock('../sync/flusher.js', () => ({
  flushOnce: vi.fn().mockResolvedValue('flushed'),
}));

function makePutInput(
  setlistId: string,
  venue: string,
  date: string,
  clientWrittenAt: string,
): SetlistPutInput {
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
    clientWrittenAt,
    version: 1 as const,
  };
}

function makeSetlist(setlistId: string, venue: string, date: string): Setlist {
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

beforeEach(async () => {
  await __resetOutboxForTests();
  queryClient.clear();
});

afterEach(() => {
  queryClient.clear();
});

describe('useSetlistMutation.saveSetlist', () => {
  it('enqueues a new setlist: outbox + per-setlist cache + list cache all hold the record', async () => {
    const { result } = renderHook(() => useSetlistMutation());
    const input = makePutInput('abc', 'Jazz Cafe', '2026-06-21', '2026-06-19T11:00:00.000Z');

    await act(async () => {
      await result.current.saveSetlist(input);
    });

    const all = await listAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.recordKey).toBe(setlistRecordKey(ACTIVE_BAND_ID, 'abc'));
    expect(all[0]?.payload).toEqual(input);
    expect(all[0]?.clientWrittenAt).toBe(input.clientWrittenAt);

    const cachedSetlist = queryClient.getQueryData<Setlist>(['setlist', ACTIVE_BAND_ID, 'abc']);
    expect(cachedSetlist?.gigMeta.venue).toBe('Jazz Cafe');

    const cachedList = queryClient.getQueryData<Setlist[]>(['setlists', ACTIVE_BAND_ID]);
    expect(cachedList).toHaveLength(1);
    expect(cachedList?.[0]?.gigMeta.venue).toBe('Jazz Cafe');
  });

  it('coalesces edits to the same setlist: outbox holds one entry; both caches reflect the latest', async () => {
    queryClient.setQueryData(
      ['setlists', ACTIVE_BAND_ID],
      [makeSetlist('abc', 'Original Venue', '2026-06-21')],
    );

    const { result } = renderHook(() => useSetlistMutation());

    await act(async () => {
      await result.current.saveSetlist(
        makePutInput('abc', 'Edit One Venue', '2026-06-21', '2026-06-19T11:00:00.000Z'),
      );
    });
    await act(async () => {
      await result.current.saveSetlist(
        makePutInput('abc', 'Edit Two Venue', '2026-06-21', '2026-06-19T11:00:05.000Z'),
      );
    });

    const all = await listAll();
    expect(all).toHaveLength(1);
    expect((all[0]?.payload as SetlistPutInput).gigMeta.venue).toBe('Edit Two Venue');

    const cachedSetlist = queryClient.getQueryData<Setlist>(['setlist', ACTIVE_BAND_ID, 'abc']);
    expect(cachedSetlist?.gigMeta.venue).toBe('Edit Two Venue');

    const cachedList = queryClient.getQueryData<Setlist[]>(['setlists', ACTIVE_BAND_ID]);
    expect(cachedList).toHaveLength(1);
    expect(cachedList?.[0]?.gigMeta.venue).toBe('Edit Two Venue');
  });
});

describe('mergeSetlistIntoList', () => {
  it('inserts into an empty list', () => {
    const result = mergeSetlistIntoList([], makeSetlist('a', 'Jazz Cafe', '2026-06-21'));
    expect(result).toHaveLength(1);
    expect(result[0]?.gigMeta.venue).toBe('Jazz Cafe');
  });

  it('appends a new entry (no sorting — server orders by GSI1 date)', () => {
    const existing = [
      makeSetlist('a', 'Jazz Cafe', '2026-06-21'),
      makeSetlist('c', 'Blue Note', '2026-07-01'),
    ];
    const result = mergeSetlistIntoList(existing, makeSetlist('b', 'Vortex', '2026-06-25'));
    expect(result).toHaveLength(3);
    // No client-side sorting; new entry is appended.
    expect(result.map((s) => s.setlistId)).toEqual(['a', 'c', 'b']);
  });

  it('replaces an existing entry by setlistId (does NOT duplicate)', () => {
    const existing = [
      makeSetlist('a', 'Jazz Cafe', '2026-06-21'),
      makeSetlist('b', 'Blue Note', '2026-07-01'),
    ];
    const updated = makeSetlist('b', 'Blue Note (Renamed)', '2026-07-01');
    const result = mergeSetlistIntoList(existing, updated);
    expect(result).toHaveLength(2);
    const second = result.find((s) => s.setlistId === 'b');
    expect(second?.gigMeta.venue).toBe('Blue Note (Renamed)');
  });
});
