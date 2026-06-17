import 'fake-indexeddb/auto';
import { ACTIVE_BAND_ID } from '@gigbuddy/shared';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setUnauthorizedHandler } from '../api/client.js';
import {
  __resetFlusherForTests,
  backoffMs,
  flushOnce,
  setFlusherQueryClient,
  startFlusher,
} from './flusher.js';
import { __resetOutboxForTests, enqueue, listAll } from './outbox.js';
import { songRecordKey } from './record-key.js';
import { __resetStaleNoticeForTests, getStaleNotice } from './stale-notice-store.js';

const fetchMock = vi.fn();

const SONG_ID = 'songABCDEF123456';
const RECORD_KEY = songRecordKey(ACTIVE_BAND_ID, SONG_ID);

function songPayload(overrides: Partial<{ title: string; clientWrittenAt: string }> = {}) {
  return {
    bandId: ACTIVE_BAND_ID,
    songId: SONG_ID,
    title: overrides.title ?? 'Song Title',
    clientWrittenAt: overrides.clientWrittenAt ?? '2026-06-17T12:00:00.000Z',
    version: 1 as const,
  };
}

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

let queryClient: QueryClient;

beforeEach(async () => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  await __resetOutboxForTests();
  __resetStaleNoticeForTests();
  __resetFlusherForTests();
  queryClient = new QueryClient();
  setFlusherQueryClient(queryClient);
  setUnauthorizedHandler(null);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  setFlusherQueryClient(null);
  vi.restoreAllMocks();
});

describe('backoffMs', () => {
  it('returns the documented schedule', () => {
    expect([0, 1, 2, 3, 4].map(backoffMs)).toEqual([0, 5_000, 30_000, 60_000, 60_000]);
  });
});

describe('flushOnce', () => {
  it('returns idle when the outbox is empty', async () => {
    await expect(flushOnce()).resolves.toBe('idle');
  });

  it('on 200 applied → removes the entry and invalidates the per-song queryKey', async () => {
    queryClient.setQueryData(['song', ACTIVE_BAND_ID, SONG_ID], { stale: true });
    await enqueue({
      recordKey: RECORD_KEY,
      payload: songPayload(),
      clientWrittenAt: '2026-06-17T12:00:00.000Z',
    });
    const applied = {
      status: 'applied' as const,
      data: { ...songPayload(), serverReceivedAt: '2026-06-17T12:00:00.500Z' },
    };
    fetchMock.mockResolvedValueOnce(jsonRes(200, applied));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const outcome = await flushOnce();
    expect(outcome).toBe('flushed');
    expect(await listAll()).toEqual([]);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['song', ACTIVE_BAND_ID, SONG_ID],
    });
  });

  it('on 200 dropped-as-stale → removes the entry, replaces cache, posts notice', async () => {
    await enqueue({
      recordKey: RECORD_KEY,
      payload: songPayload({ title: 'mine' }),
      clientWrittenAt: '2026-06-17T12:00:00.000Z',
    });
    const dropped = {
      status: 'dropped-as-stale' as const,
      currentState: {
        ...songPayload({ title: 'theirs', clientWrittenAt: '2026-06-17T12:01:00.000Z' }),
        serverReceivedAt: '2026-06-17T12:01:00.500Z',
      },
    };
    fetchMock.mockResolvedValueOnce(jsonRes(200, dropped));
    const outcome = await flushOnce();
    expect(outcome).toBe('flushed');
    expect(await listAll()).toEqual([]);
    expect(queryClient.getQueryData(['song', ACTIVE_BAND_ID, SONG_ID])).toEqual(
      dropped.currentState,
    );
    expect(getStaleNotice()?.recordKey).toBe(RECORD_KEY);
  });

  it('on 4xx (not 401) → removes the entry (schema bug)', async () => {
    await enqueue({
      recordKey: RECORD_KEY,
      payload: songPayload(),
      clientWrittenAt: '2026-06-17T12:00:00.000Z',
    });
    fetchMock.mockResolvedValueOnce(
      jsonRes(400, { status: 'error', error: { code: 'VALIDATION_FAILED', message: 'no' } }),
    );
    const outcome = await flushOnce();
    expect(outcome).toBe('flushed');
    expect(await listAll()).toEqual([]);
  });

  it('on 401 → leaves the entry pending (does NOT remove)', async () => {
    await enqueue({
      recordKey: RECORD_KEY,
      payload: songPayload(),
      clientWrittenAt: '2026-06-17T12:00:00.000Z',
    });
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    fetchMock.mockResolvedValueOnce(
      jsonRes(401, { status: 'error', error: { code: 'UNAUTHORIZED', message: 'no' } }),
    );
    const outcome = await flushOnce();
    expect(outcome).toBe('retry-scheduled');
    const remaining = await listAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.status).toBe('pending');
    expect(remaining[0]?.attempts).toBe(1);
    expect(onUnauthorized).toHaveBeenCalled();
  });

  it('on 5xx → marks pending with attempts+1', async () => {
    await enqueue({
      recordKey: RECORD_KEY,
      payload: songPayload(),
      clientWrittenAt: '2026-06-17T12:00:00.000Z',
    });
    fetchMock.mockResolvedValueOnce(
      jsonRes(503, { status: 'error', error: { code: 'INTERNAL', message: 'oops' } }),
    );
    const outcome = await flushOnce();
    expect(outcome).toBe('retry-scheduled');
    const remaining = await listAll();
    expect(remaining[0]?.status).toBe('pending');
    expect(remaining[0]?.attempts).toBe(1);
  });

  it('on network error → marks pending with attempts+1', async () => {
    await enqueue({
      recordKey: RECORD_KEY,
      payload: songPayload(),
      clientWrittenAt: '2026-06-17T12:00:00.000Z',
    });
    fetchMock.mockRejectedValueOnce(new TypeError('network down'));
    const outcome = await flushOnce();
    expect(outcome).toBe('retry-scheduled');
    const remaining = await listAll();
    expect(remaining[0]?.status).toBe('pending');
    expect(remaining[0]?.attempts).toBe(1);
  });

  it('returns "busy" when a second flushOnce is invoked while the first is in flight', async () => {
    await enqueue({
      recordKey: RECORD_KEY,
      payload: songPayload(),
      clientWrittenAt: '2026-06-17T12:00:00.000Z',
    });
    let resolveFetch!: (res: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const firstPromise = flushOnce();
    // The first flush is awaiting fetch — the second must short-circuit.
    const second = await flushOnce();
    expect(second).toBe('busy');
    resolveFetch(
      jsonRes(200, {
        status: 'applied',
        data: { ...songPayload(), serverReceivedAt: '2026-06-17T12:00:00.500Z' },
      }),
    );
    await expect(firstPromise).resolves.toBe('flushed');
  });

  it('drops an entry with an unrecognised recordKey prefix (poisoned)', async () => {
    await enqueue({
      recordKey: 'setlist:not:wired',
      payload: { whatever: true },
      clientWrittenAt: '2026-06-17T12:00:00.000Z',
    });
    const outcome = await flushOnce();
    expect(outcome).toBe('flushed');
    expect(await listAll()).toEqual([]);
    // fetch must NOT have been called for an unknown recordKey.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

async function tick(ms = 50): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('startFlusher event wiring', () => {
  it('flushes on `online` event', async () => {
    await enqueue({
      recordKey: RECORD_KEY,
      payload: songPayload(),
      clientWrittenAt: '2026-06-17T12:00:00.000Z',
    });
    fetchMock.mockResolvedValue(
      jsonRes(200, {
        status: 'applied',
        data: { ...songPayload(), serverReceivedAt: '2026-06-17T12:00:00.500Z' },
      }),
    );
    const unsub = startFlusher();
    // Let the initial drain run.
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await listAll()).toEqual([]);

    // Enqueue again and dispatch the online event.
    await enqueue({
      recordKey: RECORD_KEY,
      payload: songPayload({ title: 'second' }),
      clientWrittenAt: '2026-06-17T12:01:00.000Z',
    });
    fetchMock.mockResolvedValueOnce(
      jsonRes(200, {
        status: 'applied',
        data: {
          ...songPayload({ title: 'second' }),
          serverReceivedAt: '2026-06-17T12:01:00.500Z',
        },
      }),
    );
    window.dispatchEvent(new Event('online'));
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    unsub();
  });

  it('flushes on visibilitychange to visible', async () => {
    await enqueue({
      recordKey: RECORD_KEY,
      payload: songPayload(),
      clientWrittenAt: '2026-06-17T12:00:00.000Z',
    });
    fetchMock.mockResolvedValue(
      jsonRes(200, {
        status: 'applied',
        data: { ...songPayload(), serverReceivedAt: '2026-06-17T12:00:00.500Z' },
      }),
    );
    const unsub = startFlusher();
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await enqueue({
      recordKey: RECORD_KEY,
      payload: songPayload({ title: 'visible' }),
      clientWrittenAt: '2026-06-17T12:01:00.000Z',
    });
    fetchMock.mockResolvedValueOnce(
      jsonRes(200, {
        status: 'applied',
        data: {
          ...songPayload({ title: 'visible' }),
          serverReceivedAt: '2026-06-17T12:01:00.500Z',
        },
      }),
    );
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    unsub();
  });

  it('unsubscribe removes the online listener', async () => {
    fetchMock.mockResolvedValue(
      jsonRes(200, {
        status: 'applied',
        data: { ...songPayload(), serverReceivedAt: '2026-06-17T12:00:00.500Z' },
      }),
    );
    const unsub = startFlusher();
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(0); // outbox was empty at startup
    unsub();
    // After unsub, dispatching online should NOT fire a flush even when an
    // entry is now present.
    await enqueue({
      recordKey: RECORD_KEY,
      payload: songPayload(),
      clientWrittenAt: '2026-06-17T12:00:00.000Z',
    });
    window.dispatchEvent(new Event('online'));
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('the 30s periodic interval is set after a 5xx leaves entries pending', async () => {
    // Direct test: install a setInterval spy, prime a 5xx so the entry
    // stays pending, then verify flusher sets the 30s interval.
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    await enqueue({
      recordKey: RECORD_KEY,
      payload: songPayload(),
      clientWrittenAt: '2026-06-17T12:00:00.000Z',
    });
    fetchMock.mockResolvedValue(
      jsonRes(503, { status: 'error', error: { code: 'INTERNAL', message: 'down' } }),
    );
    const unsub = startFlusher();
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Periodic interval should now be armed at 30_000ms because the entry
    // is still pending after the 5xx.
    const intervalCalls = setIntervalSpy.mock.calls.filter(([, ms]) => ms === 30_000);
    expect(intervalCalls.length).toBeGreaterThanOrEqual(1);
    unsub();
  });
});
