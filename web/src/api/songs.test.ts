import { ACTIVE_BAND_ID } from '@gigbuddy/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetDriftWarningForTests, setUnauthorizedHandler } from './client.js';
import { listSongs } from './songs.js';

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
