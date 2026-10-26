import { ACTIVE_BAND_ID, type Song, type SongPutInput } from '@gigbuddy/shared';
import { useCallback } from 'react';
import { deleteSong as deleteSongRequest } from '../api/songs.js';
import { flushOnce } from '../sync/flusher.js';
import { enqueue, removePending } from '../sync/outbox.js';
import { queryClient } from '../sync/query-client.js';
import { songRecordKey } from '../sync/record-key.js';

/*
 * Song write seam (AR-23, AR-45). The UI never imports the outbox or the
 * flusher directly — this hook is the legal boundary. `saveSong()`
 * optimistically writes BOTH the per-song cache (`['song', bandId, songId]`)
 * and the list cache (`['songs', bandId]`) so the Library re-renders
 * instantly on title changes / new songs, then enqueues a whole-record PUT
 * (AR-23) and kicks the flusher.
 *
 * The hook imports `queryClient` directly (not via `useQueryClient()`)
 * because the optimistic writes must hit the singleton the SyncProvider
 * exposes — the same store the flusher writes to on the `dropped-as-stale`
 * path. This mirrors the flusher's module-scope `queryClientRef` pattern.
 *
 * Per FR-2 the call is silent: `saveSong` does not throw, does not return
 * an error state, does not surface progress. The outbox owns retry; the
 * flusher owns stale-write reconciliation.
 *
 * `deleteSong()` (Story 7.11) is the exception: it needs a connection, goes
 * straight to the API rather than the outbox, and throws on failure. On
 * success it drops any queued edit to the song (so the flusher can't recreate
 * it) and removes the song from both caches.
 */

export function mergeSongIntoList(current: Song[], next: Song): Song[] {
  const filtered = current.filter((s) => s.songId !== next.songId);
  const inserted = [...filtered, next];
  return inserted.sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));
}

export function useSongMutation(): {
  saveSong: (record: SongPutInput) => Promise<void>;
  deleteSong: (songId: string) => Promise<'deleted' | 'in-use'>;
} {
  const saveSong = useCallback(async (record: SongPutInput): Promise<void> => {
    const optimistic: Song = { ...record, serverReceivedAt: new Date().toISOString() };
    queryClient.setQueryData(['song', record.bandId, record.songId], optimistic);
    queryClient.setQueryData<Song[]>(['songs', record.bandId], (current) =>
      mergeSongIntoList(current ?? [], optimistic),
    );
    await enqueue({
      recordKey: songRecordKey(record.bandId, record.songId),
      payload: record,
      clientWrittenAt: record.clientWrittenAt,
    });
    void flushOnce();
  }, []);
  const deleteSong = useCallback(async (songId: string): Promise<'deleted' | 'in-use'> => {
    const result = await deleteSongRequest(songId);
    if (result === 'deleted') {
      await removePending(songRecordKey(ACTIVE_BAND_ID, songId));
      queryClient.setQueryData<Song[]>(['songs', ACTIVE_BAND_ID], (current) =>
        current?.filter((s) => s.songId !== songId),
      );
      queryClient.removeQueries({ queryKey: ['song', ACTIVE_BAND_ID, songId] });
    }
    return result;
  }, []);
  return { saveSong, deleteSong };
}
