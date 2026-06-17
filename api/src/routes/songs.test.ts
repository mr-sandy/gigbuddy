import { ACTIVE_BAND_ID, type Song } from '@gigbuddy/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getJwtKeyMock, getSongMock, listSongsByBandMock, putSongMock } = vi.hoisted(() => ({
  getJwtKeyMock: vi.fn(),
  getSongMock: vi.fn(),
  listSongsByBandMock: vi.fn(),
  putSongMock: vi.fn(),
}));

vi.mock('../secrets/ssm.js', () => ({
  getJwtKey: getJwtKeyMock,
  getPasswordHash: vi.fn(),
}));

vi.mock('../ddb/songs.js', () => ({
  getSong: getSongMock,
  listSongsByBand: listSongsByBandMock,
  putSong: putSongMock,
}));

import { app } from '../app.js';
import { signSession } from '../auth/jwt.js';
import { SESSION_COOKIE_NAME } from '../middleware/auth.js';

const TEST_KEY = `test-key-${'x'.repeat(40)}`;
const SONG_ID_A = 'aaaaaaaaaaaaaaaa';
const SONG_ID_B = 'bbbbbbbbbbbbbbbb';
const SONG_ID_C = 'cccccccccccccccc';

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    bandId: ACTIVE_BAND_ID,
    songId: SONG_ID_A,
    title: 'Round Midnight',
    clientWrittenAt: '2026-06-16T12:00:00.000Z',
    serverReceivedAt: '2026-06-16T12:00:01.000Z',
    version: 1,
    ...overrides,
  };
}

let authCookie: string;

beforeEach(async () => {
  getJwtKeyMock.mockReset();
  getJwtKeyMock.mockResolvedValue(TEST_KEY);
  getSongMock.mockReset();
  listSongsByBandMock.mockReset();
  putSongMock.mockReset();

  const now = Math.floor(Date.now() / 1000);
  const token = await signSession(now);
  authCookie = `${SESSION_COOKIE_NAME}=${token}`;
});

async function authedRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Cookie', authCookie);
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  return app.request(path, { ...init, headers });
}

function isIso(v: string | null): boolean {
  return !!v && new Date(v).toISOString() === v;
}

describe('GET /api/v1/songs', () => {
  it('returns 200 with the song list alphabetized by title (case-insensitive)', async () => {
    listSongsByBandMock.mockResolvedValue([
      makeSong({ songId: SONG_ID_C, title: 'Charleston' }),
      makeSong({ songId: SONG_ID_A, title: 'autumn leaves' }),
      makeSong({ songId: SONG_ID_B, title: 'Blue Bossa' }),
    ]);
    const res = await authedRequest('/api/v1/songs');
    expect(res.status).toBe(200);
    expect(isIso(res.headers.get('x-server-now'))).toBe(true);
    const body = (await res.json()) as { status: string; data: Song[] };
    expect(body.status).toBe('ok');
    expect(body.data.map((s) => s.title)).toEqual(['autumn leaves', 'Blue Bossa', 'Charleston']);
  });

  it('returns 200 with an empty array when the band has no Songs', async () => {
    listSongsByBandMock.mockResolvedValue([]);
    const res = await authedRequest('/api/v1/songs');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; data: Song[] };
    expect(body).toEqual({ status: 'ok', data: [] });
  });
});

describe('GET /api/v1/songs/:songId', () => {
  it('returns 200 with the Song when present', async () => {
    const song = makeSong();
    getSongMock.mockResolvedValue(song);
    const res = await authedRequest(`/api/v1/songs/${SONG_ID_A}`);
    expect(res.status).toBe(200);
    expect(isIso(res.headers.get('x-server-now'))).toBe(true);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok', data: song });
  });

  it('returns 404 with the NOT_FOUND envelope when absent', async () => {
    getSongMock.mockResolvedValue(undefined);
    const res = await authedRequest(`/api/v1/songs/${SONG_ID_A}`);
    expect(res.status).toBe(404);
    expect(isIso(res.headers.get('x-server-now'))).toBe(true);
    const body = await res.json();
    expect(body).toEqual({
      status: 'error',
      error: { code: 'NOT_FOUND', message: 'song not found' },
    });
  });
});

describe('PUT /api/v1/songs/:songId', () => {
  function putInput(overrides: Partial<Song> = {}): Omit<Song, 'serverReceivedAt'> {
    const { serverReceivedAt: _s, ...rest } = makeSong(overrides);
    return rest;
  }

  it('returns 200 applied when LWW-new (no existing record)', async () => {
    getSongMock.mockResolvedValue(undefined);
    putSongMock.mockResolvedValue(undefined);
    const input = putInput();
    const res = await authedRequest(`/api/v1/songs/${SONG_ID_A}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    expect(res.status).toBe(200);
    expect(isIso(res.headers.get('x-server-now'))).toBe(true);
    const body = (await res.json()) as { status: string; data: Song };
    expect(body.status).toBe('applied');
    expect(body.data).toMatchObject(input);
    expect(isIso(body.data.serverReceivedAt)).toBe(true);
    expect(putSongMock).toHaveBeenCalledTimes(1);
    expect(putSongMock).toHaveBeenCalledWith(body.data);
  });

  it('returns 200 dropped-as-stale when incoming is strictly older than existing', async () => {
    const existing = makeSong({ clientWrittenAt: '2026-06-16T13:00:00.000Z' });
    getSongMock.mockResolvedValue(existing);
    const stale = putInput({ clientWrittenAt: '2026-06-16T12:00:00.000Z' });
    const res = await authedRequest(`/api/v1/songs/${SONG_ID_A}`, {
      method: 'PUT',
      body: JSON.stringify(stale),
    });
    expect(res.status).toBe(200);
    expect(isIso(res.headers.get('x-server-now'))).toBe(true);
    const body = await res.json();
    expect(body).toEqual({ status: 'dropped-as-stale', currentState: existing });
    expect(putSongMock).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_FAILED on a malformed body (missing title)', async () => {
    const input = putInput();
    const { title: _t, ...without } = input;
    const res = await authedRequest(`/api/v1/songs/${SONG_ID_A}`, {
      method: 'PUT',
      body: JSON.stringify(without),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { status: string; error: { code: string } };
    expect(body.status).toBe('error');
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(putSongMock).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_FAILED when body is not JSON', async () => {
    const res = await authedRequest(`/api/v1/songs/${SONG_ID_A}`, {
      method: 'PUT',
      body: 'not-json',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { status: string; error: { code: string; message: string } };
    expect(body.error.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when path :songId does not match body.songId', async () => {
    const input = putInput({ songId: SONG_ID_A });
    const res = await authedRequest(`/api/v1/songs/${SONG_ID_B}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { status: string; error: { code: string; message: string } };
    expect(body.error.message).toBe('songId in path does not match body');
  });

  it('returns 400 when body.bandId does not match ACTIVE_BAND_ID', async () => {
    const input = putInput({ bandId: 'someOtherBandIdXY' });
    const res = await authedRequest(`/api/v1/songs/${SONG_ID_A}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { status: string; error: { code: string; message: string } };
    expect(body.error.message).toBe('bandId does not match the active band');
  });
});
