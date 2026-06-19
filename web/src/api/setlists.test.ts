import { ACTIVE_BAND_ID, type Setlist, type SetlistPutInput } from '@gigbuddy/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetDriftWarningForTests, setUnauthorizedHandler } from './client.js';
import { getSetlist, listSetlists, putSetlist } from './setlists.js';

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

function makePutInput(setlistId: string, date: string, venue: string): SetlistPutInput {
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
    clientWrittenAt: '2026-06-19T11:00:00.000Z',
    version: 1 as const,
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  __resetDriftWarningForTests();
  setUnauthorizedHandler(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('listSetlists', () => {
  it('returns the unwrapped array on a 200 ok envelope', async () => {
    const setlists = [
      makeSetlist('a', '2026-06-21', 'Jazz Cafe'),
      makeSetlist('b', '2026-07-01', 'Blue Note'),
    ];
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: setlists }));
    const result = await listSetlists();
    expect(result).toEqual(setlists);
  });

  it('returns an empty array on a 200 ok envelope with an empty data array', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: [] }));
    const result = await listSetlists();
    expect(result).toEqual([]);
  });

  it('throws when the response body is missing the data field', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok' }));
    await expect(listSetlists()).rejects.toThrow();
  });

  it('uses the GET method against /api/v1/setlists without a body', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: [] }));
    await listSetlists();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/v1/setlists');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers).toBeUndefined();
  });
});

describe('getSetlist', () => {
  it('returns the unwrapped Setlist on a 200 ok envelope', async () => {
    const setlist = makeSetlist('abc', '2026-06-21', 'Jazz Cafe');
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: setlist }));
    const result = await getSetlist('abc');
    expect(result).toEqual(setlist);
  });

  it('returns null on a 404 NOT_FOUND error envelope', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonRes(404, { status: 'error', error: { code: 'NOT_FOUND', message: 'gone' } }),
    );
    const result = await getSetlist('missing');
    expect(result).toBeNull();
  });

  it('throws on a malformed envelope (missing status field)', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, { weird: true }));
    await expect(getSetlist('abc')).rejects.toThrow();
  });

  it('uses GET against /api/v1/setlists/<setlistId> without a body', async () => {
    const setlist = makeSetlist('abc', '2026-06-21', 'Jazz Cafe');
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: setlist }));
    await getSetlist('abc');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/v1/setlists/abc');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });
});

describe('putSetlist', () => {
  it('returns { kind: "applied", data } on a 200 applied envelope', async () => {
    const input = makePutInput('abc', '2026-06-21', 'Jazz Cafe');
    const stored = makeSetlist('abc', '2026-06-21', 'Jazz Cafe');
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'applied', data: stored }));
    const result = await putSetlist(input);
    expect(result).toEqual({ kind: 'applied', data: stored });
  });

  it('returns { kind: "dropped-as-stale", currentState } on a 200 dropped envelope', async () => {
    const input = makePutInput('abc', '2026-06-21', 'Jazz Cafe');
    const current = makeSetlist('abc', '2026-06-21', 'Jazz Cafe Renamed');
    fetchMock.mockResolvedValueOnce(
      jsonRes(200, { status: 'dropped-as-stale', currentState: current }),
    );
    const result = await putSetlist(input);
    expect(result).toEqual({ kind: 'dropped-as-stale', currentState: current });
  });

  it('uses PUT against /api/v1/setlists/<setlistId> with the input as the JSON body, and throws on 400 error', async () => {
    const input = makePutInput('abc', '2026-06-21', 'Jazz Cafe');
    fetchMock.mockResolvedValueOnce(
      jsonRes(400, { status: 'error', error: { code: 'BAD_REQUEST', message: 'bad' } }),
    );
    await expect(putSetlist(input)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/v1/setlists/abc');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify(input));
  });
});
