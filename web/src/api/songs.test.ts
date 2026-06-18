import { ACTIVE_BAND_ID, type SongPutInput } from '@gigbuddy/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetDriftWarningForTests, setUnauthorizedHandler } from './client.js';
import { getSong, listSongs, putSong } from './songs.js';

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

function makeSong(songId: string, title: string) {
  return {
    bandId: ACTIVE_BAND_ID,
    songId,
    title,
    clientWrittenAt: '2026-06-17T12:00:00.000Z',
    serverReceivedAt: '2026-06-17T12:00:01.000Z',
    version: 1 as const,
  };
}

function makePutInput(songId: string, title: string): SongPutInput {
  return {
    bandId: ACTIVE_BAND_ID,
    songId,
    title,
    clientWrittenAt: '2026-06-18T09:00:00.000Z',
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

describe('listSongs', () => {
  it('returns the unwrapped array on a 200 ok envelope', async () => {
    const songs = [
      makeSong('a', 'Autumn Leaves'),
      makeSong('b', 'Blue Bossa'),
      makeSong('c', 'Charleston'),
    ];
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: songs }));
    const result = await listSongs();
    expect(result).toEqual(songs);
  });

  it('throws when the response body is missing the data field', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok' }));
    await expect(listSongs()).rejects.toThrow();
  });

  it('uses the GET method against /api/v1/songs without a body', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: [] }));
    await listSongs();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/v1/songs');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers).toBeUndefined();
  });
});

describe('getSong', () => {
  it('returns the unwrapped Song on a 200 ok envelope', async () => {
    const song = makeSong('abc', 'Autumn Leaves');
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: song }));
    const result = await getSong('abc');
    expect(result).toEqual(song);
  });

  it('returns null on a 404 NOT_FOUND error envelope', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonRes(404, { status: 'error', error: { code: 'NOT_FOUND', message: 'not here' } }),
    );
    const result = await getSong('missing');
    expect(result).toBeNull();
  });

  it('throws on a malformed envelope (missing status field)', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, { weird: true }));
    await expect(getSong('abc')).rejects.toThrow();
  });

  it('uses GET against /api/v1/songs/<songId> without a body', async () => {
    const song = makeSong('abc', 'Autumn Leaves');
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'ok', data: song }));
    await getSong('abc');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/v1/songs/abc');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });
});

describe('putSong', () => {
  it('returns { kind: "applied", data } on a 200 applied envelope', async () => {
    const input = makePutInput('abc', 'Autumn Leaves');
    const stored = makeSong('abc', 'Autumn Leaves');
    fetchMock.mockResolvedValueOnce(jsonRes(200, { status: 'applied', data: stored }));
    const result = await putSong(input);
    expect(result).toEqual({ kind: 'applied', data: stored });
  });

  it('returns { kind: "dropped-as-stale", currentState } on a 200 dropped envelope', async () => {
    const input = makePutInput('abc', 'Autumn Leaves');
    const current = makeSong('abc', 'Autumn Leaves Remix');
    fetchMock.mockResolvedValueOnce(
      jsonRes(200, { status: 'dropped-as-stale', currentState: current }),
    );
    const result = await putSong(input);
    expect(result).toEqual({ kind: 'dropped-as-stale', currentState: current });
  });

  it('uses PUT against /api/v1/songs/<songId> with the input as the JSON body, and throws on 400 error', async () => {
    const input = makePutInput('abc', 'Autumn Leaves');
    fetchMock.mockResolvedValueOnce(
      jsonRes(400, { status: 'error', error: { code: 'BAD_REQUEST', message: 'bad' } }),
    );
    await expect(putSong(input)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/v1/songs/abc');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify(input));
  });
});
