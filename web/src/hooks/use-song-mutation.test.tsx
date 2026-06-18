import 'fake-indexeddb/auto';

import { ACTIVE_BAND_ID, type Song, type SongPutInput } from '@gigbuddy/shared';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetOutboxForTests, listAll } from '../sync/outbox.js';
import { queryClient } from '../sync/query-client.js';
import { songRecordKey } from '../sync/record-key.js';
import { mergeSongIntoList, useSongMutation } from './use-song-mutation.js';

vi.mock('../sync/flusher.js', () => ({
  flushOnce: vi.fn().mockResolvedValue('flushed'),
}));

function makePutInput(songId: string, title: string, clientWrittenAt: string): SongPutInput {
  return {
    bandId: ACTIVE_BAND_ID,
    songId,
    title,
    clientWrittenAt,
    version: 1 as const,
  };
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

beforeEach(async () => {
  await __resetOutboxForTests();
  queryClient.clear();
});

afterEach(() => {
  queryClient.clear();
});

describe('useSongMutation.saveSong', () => {
  it('enqueues a new song: outbox + per-song cache + list cache all hold the record', async () => {
    const { result } = renderHook(() => useSongMutation());
    const input = makePutInput('abc', 'Black Orpheus', '2026-06-18T09:00:00.000Z');

    await act(async () => {
      await result.current.saveSong(input);
    });

    const all = await listAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.recordKey).toBe(songRecordKey(ACTIVE_BAND_ID, 'abc'));
    expect(all[0]?.payload).toEqual(input);
    expect(all[0]?.clientWrittenAt).toBe(input.clientWrittenAt);

    const cachedSong = queryClient.getQueryData<Song>(['song', ACTIVE_BAND_ID, 'abc']);
    expect(cachedSong?.title).toBe('Black Orpheus');

    const cachedList = queryClient.getQueryData<Song[]>(['songs', ACTIVE_BAND_ID]);
    expect(cachedList).toHaveLength(1);
    expect(cachedList?.[0]?.title).toBe('Black Orpheus');
  });

  it('coalesces edits to the same song: outbox holds one entry; both caches reflect the latest', async () => {
    queryClient.setQueryData(['songs', ACTIVE_BAND_ID], [makeSong('abc', 'Original Title')]);

    const { result } = renderHook(() => useSongMutation());

    await act(async () => {
      await result.current.saveSong(makePutInput('abc', 'Edit One', '2026-06-18T09:00:00.000Z'));
    });
    await act(async () => {
      await result.current.saveSong(makePutInput('abc', 'Edit Two', '2026-06-18T09:00:05.000Z'));
    });

    const all = await listAll();
    expect(all).toHaveLength(1);
    expect((all[0]?.payload as SongPutInput).title).toBe('Edit Two');

    const cachedSong = queryClient.getQueryData<Song>(['song', ACTIVE_BAND_ID, 'abc']);
    expect(cachedSong?.title).toBe('Edit Two');

    const cachedList = queryClient.getQueryData<Song[]>(['songs', ACTIVE_BAND_ID]);
    expect(cachedList).toHaveLength(1);
    expect(cachedList?.[0]?.title).toBe('Edit Two');
  });
});

describe('mergeSongIntoList', () => {
  it('inserts into an empty list', () => {
    const result = mergeSongIntoList([], makeSong('a', 'Autumn Leaves'));
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Autumn Leaves');
  });

  it('inserts at the correct alphabetical position (case-insensitive)', () => {
    const existing = [makeSong('a', 'Autumn Leaves'), makeSong('c', 'Charleston')];
    const result = mergeSongIntoList(existing, makeSong('b', 'Blue Bossa'));
    expect(result.map((s) => s.title)).toEqual(['Autumn Leaves', 'Blue Bossa', 'Charleston']);
  });

  it('replaces an existing entry by songId (does NOT duplicate) and re-sorts on title change', () => {
    const existing = [
      makeSong('a', 'Autumn Leaves'),
      makeSong('b', 'Blue Bossa'),
      makeSong('c', 'Charleston'),
    ];
    const renamed = { ...makeSong('b', 'Zephyr Song') };
    const result = mergeSongIntoList(existing, renamed);
    expect(result).toHaveLength(3);
    expect(result.map((s) => s.title)).toEqual(['Autumn Leaves', 'Charleston', 'Zephyr Song']);
  });
});
