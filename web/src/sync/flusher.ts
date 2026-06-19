import {
  AppliedResponseSchema,
  DroppedAsStaleResponseSchema,
  ErrorResponseSchema,
} from '@gigbuddy/shared';
import type { QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from '../api/client.js';
import { listAll, markInFlight, markPending, peek, remove } from './outbox.js';
import { parseRecordKey } from './record-key.js';
import { setStaleNotice } from './stale-notice-store.js';

/*
 * Outbox flusher (architecture.md "Outbox state machine" lines 605–623).
 *
 * `flushOnce` is the unit of work — peek the oldest pending entry, mark
 * it in-flight, send the PUT, dispatch on the response envelope:
 *   - `applied`           → remove + invalidate the record's queryKey
 *   - `dropped-as-stale`  → remove + replace cache atomically + post notice
 *   - 4xx (not 401)       → remove (schema bug) — log and move on
 *   - 401                 → markPending (the wrapper has already triggered
 *                            the unauthorized handler — leave the entry
 *                            pending so the next-auth retry can drain it)
 *   - 5xx / network error → markPending + schedule retry per backoffMs
 *
 * `startFlusher` wires the retry triggers (`online`, `visibilitychange`,
 * 30s timer while non-empty) and returns an unsubscribe for test teardown.
 */

// queryKey contract per recordKey kind — Story 2.6's `useSong()` hook will
// consume the same per-song key. Story 2.5 (`useSongs()` list) uses the
// `['songs', bandId]` key, NOT the per-song key — invalidating the per-song
// key alone does not force a list refetch (acceptable: the list query owns
// its own cache; the optimistic-write flow updates list cache separately).
function queryKeyForSong(bandId: string, songId: string): readonly unknown[] {
  return ['song', bandId, songId];
}

function queryKeyForSetlist(bandId: string, setlistId: string): readonly unknown[] {
  return ['setlist', bandId, setlistId];
}

function routeForRecordKey(
  recordKey: string,
):
  | { kind: 'song'; method: 'PUT'; url: string; queryKey: readonly unknown[] }
  | { kind: 'setlist'; method: 'PUT'; url: string; queryKey: readonly unknown[] }
  | { kind: 'unknown' } {
  const parsed = parseRecordKey(recordKey);
  if (parsed.kind === 'song') {
    return {
      kind: 'song',
      method: 'PUT' as const,
      url: `/api/v1/songs/${parsed.songId}`,
      queryKey: queryKeyForSong(parsed.bandId, parsed.songId),
    };
  }
  if (parsed.kind === 'setlist') {
    return {
      kind: 'setlist',
      method: 'PUT' as const,
      url: `/api/v1/setlists/${parsed.setlistId}`,
      queryKey: queryKeyForSetlist(parsed.bandId, parsed.setlistId),
    };
  }
  return { kind: 'unknown' };
}

// Story 3.1 widens the inner data types to z.unknown() so the flusher
// accepts both Song and Setlist envelopes. The flusher only needs the
// envelope `status` field to dispatch — `data` and `currentState` are
// passed verbatim to the cache, and the consuming hooks
// (useSong / useSetlist) validate via their own schema on read.
const PutResponseSchema = z.discriminatedUnion('status', [
  AppliedResponseSchema(z.unknown()),
  DroppedAsStaleResponseSchema(z.unknown()),
  ErrorResponseSchema,
]);

let isFlushing = false;
let queryClientRef: QueryClient | null = null;

export function setFlusherQueryClient(client: QueryClient | null): void {
  queryClientRef = client;
}

/** Test-only — reset module-scope state between cases. */
export function __resetFlusherForTests(): void {
  isFlushing = false;
  if (retryTimeout !== null) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }
  if (periodicInterval !== null) {
    clearInterval(periodicInterval);
    periodicInterval = null;
  }
}

export type FlushOutcome = 'idle' | 'flushed' | 'retry-scheduled' | 'busy';

export function backoffMs(attempts: number): number {
  if (attempts <= 0) return 0;
  if (attempts === 1) return 5_000;
  if (attempts === 2) return 30_000;
  return 60_000;
}

export async function flushOnce(): Promise<FlushOutcome> {
  if (isFlushing) return 'busy';
  isFlushing = true;
  try {
    const entry = await peek();
    if (!entry) return 'idle';

    const route = routeForRecordKey(entry.recordKey);
    if (route.kind === 'unknown') {
      console.error('outbox-flush — unrecognised recordKey, dropping', {
        recordKey: entry.recordKey,
      });
      await remove(entry.id);
      return 'flushed';
    }

    await markInFlight(entry.id);

    let response: { status: number; data: z.infer<typeof PutResponseSchema> };
    try {
      response = await apiFetch(route.url, {
        method: route.method,
        body: entry.payload,
        schema: PutResponseSchema,
      });
    } catch (err) {
      // Network failure OR body-parse failure (schema mismatch on success
      // bodies is treated as a transient — the server response shape is the
      // contract; a parse failure here is more likely a network/proxy issue
      // than a server bug, since we just shipped 2.3's envelopes).
      const next = entry.attempts + 1;
      await markPending(entry.id, next);
      scheduleRetry(next);
      console.warn('outbox-flush — fetch failed, will retry', { recordKey: entry.recordKey, err });
      return 'retry-scheduled';
    }

    if (response.status === 401) {
      // The fetch wrapper has already invoked the unauthorized handler.
      // Leave the entry pending; do NOT invalidate the cache.
      await markPending(entry.id, entry.attempts + 1);
      return 'retry-scheduled';
    }

    if (response.status >= 400 && response.status < 500) {
      console.error('outbox-flush 4xx — schema bug, dropping entry', {
        recordKey: entry.recordKey,
        status: response.status,
        body: response.data,
      });
      await remove(entry.id);
      return 'flushed';
    }

    if (response.status >= 500) {
      const next = entry.attempts + 1;
      await markPending(entry.id, next);
      scheduleRetry(next);
      return 'retry-scheduled';
    }

    // 2xx — discriminate on envelope status.
    const body = response.data;
    if (body.status === 'applied') {
      await remove(entry.id);
      queryClientRef?.invalidateQueries({ queryKey: route.queryKey });
      return 'flushed';
    }
    if (body.status === 'dropped-as-stale') {
      await remove(entry.id);
      queryClientRef?.setQueryData(route.queryKey, body.currentState);
      setStaleNotice({ recordKey: entry.recordKey, at: new Date().toISOString() });
      return 'flushed';
    }
    // body.status === 'error' on a 2xx response — treat as a schema bug too.
    console.error('outbox-flush 2xx error envelope — dropping entry', {
      recordKey: entry.recordKey,
      body,
    });
    await remove(entry.id);
    return 'flushed';
  } finally {
    isFlushing = false;
  }
}

let retryTimeout: ReturnType<typeof setTimeout> | null = null;
let periodicInterval: ReturnType<typeof setInterval> | null = null;

function scheduleRetry(attempts: number): void {
  if (retryTimeout !== null) clearTimeout(retryTimeout);
  retryTimeout = setTimeout(() => {
    retryTimeout = null;
    void runFlushCycle();
  }, backoffMs(attempts));
}

async function runFlushCycle(): Promise<void> {
  await flushOnce();
  await maintainPeriodicInterval();
}

async function maintainPeriodicInterval(): Promise<void> {
  const remaining = await listAll();
  if (remaining.length === 0) {
    if (periodicInterval !== null) {
      clearInterval(periodicInterval);
      periodicInterval = null;
    }
    return;
  }
  if (periodicInterval === null) {
    periodicInterval = setInterval(() => {
      void flushOnce().then(() => maintainPeriodicInterval());
    }, 30_000);
  }
}

export function startFlusher(): () => void {
  const onOnline = (): void => {
    void runFlushCycle();
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'visible') void runFlushCycle();
  };
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisibility);
  // Kick off an immediate drain so a pending entry persisted across a
  // reload doesn't have to wait for an event to fire. runFlushCycle()
  // also calls maintainPeriodicInterval() at the end, so the 30s timer
  // arms itself if the outbox still has entries after the first flush.
  void runFlushCycle();
  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisibility);
    if (retryTimeout !== null) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
    if (periodicInterval !== null) {
      clearInterval(periodicInterval);
      periodicInterval = null;
    }
  };
}
