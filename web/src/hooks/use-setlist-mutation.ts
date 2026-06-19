import type { Setlist, SetlistPutInput } from '@gigbuddy/shared';
import { useCallback } from 'react';
import { flushOnce } from '../sync/flusher.js';
import { enqueue } from '../sync/outbox.js';
import { queryClient } from '../sync/query-client.js';
import { setlistRecordKey } from '../sync/record-key.js';

/*
 * Setlist write seam (AR-23, AR-45). Mirrors useSongMutation exactly,
 * replacing Song → Setlist throughout. The UI never imports the outbox or
 * the flusher directly — this hook is the legal boundary.
 *
 * `saveSetlist(record)`:
 *  1. Optimistically writes BOTH the per-setlist cache and the list cache
 *     so any subscribed view re-renders instantly.
 *  2. Enqueues the whole-record PUT (AR-23: sections[] replaces atomically).
 *  3. Kicks the flusher; the outbox owns retry; the flusher owns stale-write
 *     reconciliation.
 *
 * `mergeSetlistIntoList` replaces by setlistId or appends; no sorting —
 * the list order is by date per GSI1 server-side (Story 3.2 owns
 * Tonight/Upcoming/Past sectioning).
 *
 * The hook imports `queryClient` directly (not `useQueryClient()`) for the
 * same reason as useSongMutation: optimistic writes must hit the singleton
 * the SyncProvider exposes — the same store the flusher writes to on the
 * `dropped-as-stale` path.
 */
export function mergeSetlistIntoList(current: Setlist[], next: Setlist): Setlist[] {
  const idx = current.findIndex((s) => s.setlistId === next.setlistId);
  if (idx === -1) return [...current, next];
  const copy = current.slice();
  copy[idx] = next;
  return copy;
}

export function useSetlistMutation(): {
  saveSetlist: (record: SetlistPutInput) => Promise<void>;
} {
  const saveSetlist = useCallback(async (record: SetlistPutInput): Promise<void> => {
    const optimistic: Setlist = { ...record, serverReceivedAt: new Date().toISOString() };
    queryClient.setQueryData(['setlist', record.bandId, record.setlistId], optimistic);
    queryClient.setQueryData<Setlist[]>(['setlists', record.bandId], (current) =>
      mergeSetlistIntoList(current ?? [], optimistic),
    );
    await enqueue({
      recordKey: setlistRecordKey(record.bandId, record.setlistId),
      payload: record,
      clientWrittenAt: record.clientWrittenAt,
    });
    void flushOnce();
  }, []);
  return { saveSetlist };
}
