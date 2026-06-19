import { ACTIVE_BAND_ID, type Setlist } from '@gigbuddy/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getJwtKeyMock,
  getSetlistMock,
  listSetlistsByBandMock,
  putSetlistMock,
  getSongMock,
  listSongsByBandMock,
  putSongMock,
} = vi.hoisted(() => ({
  getJwtKeyMock: vi.fn(),
  getSetlistMock: vi.fn(),
  listSetlistsByBandMock: vi.fn(),
  putSetlistMock: vi.fn(),
  getSongMock: vi.fn(),
  listSongsByBandMock: vi.fn(),
  putSongMock: vi.fn(),
}));

vi.mock('../secrets/ssm.js', () => ({
  getJwtKey: getJwtKeyMock,
  getPasswordHash: vi.fn(),
}));

vi.mock('../ddb/setlists.js', () => ({
  getSetlist: getSetlistMock,
  listSetlistsByBand: listSetlistsByBandMock,
  putSetlist: putSetlistMock,
}));

// Songs ddb is also mocked because app.ts wires the songs route and
// instantiates handlers eagerly; we don't want any test here to touch the
// real DDB client through that surface.
vi.mock('../ddb/songs.js', () => ({
  getSong: getSongMock,
  listSongsByBand: listSongsByBandMock,
  putSong: putSongMock,
}));

import { app } from '../app.js';
import { signSession } from '../auth/jwt.js';
import { SESSION_COOKIE_NAME } from '../middleware/auth.js';

const TEST_KEY = `test-key-${'x'.repeat(40)}`;
const SETLIST_ID_A = 'setlist0000000aa';
const SETLIST_ID_B = 'setlist0000000bb';

function makeSetlist(overrides: Partial<Setlist> = {}): Setlist {
  return {
    bandId: ACTIVE_BAND_ID,
    setlistId: SETLIST_ID_A,
    gigMeta: { venue: 'The Jazz Cafe', date: '2026-06-21', time: '20:00' },
    sections: [
      {
        name: 'Set 1',
        songs: [
          { songId: 'song0000000001ab', titleSnapshot: 'Round Midnight' },
          {
            songId: 'song0000000002cd',
            titleSnapshot: 'Autumn Leaves',
            perGigAnnotation: 'start slow',
          },
        ],
      },
    ],
    clientWrittenAt: '2026-06-19T10:00:00.000Z',
    serverReceivedAt: '2026-06-19T10:00:01.000Z',
    version: 1,
    ...overrides,
  };
}

let authCookie: string;

beforeEach(async () => {
  getJwtKeyMock.mockReset();
  getJwtKeyMock.mockResolvedValue(TEST_KEY);
  getSetlistMock.mockReset();
  listSetlistsByBandMock.mockReset();
  putSetlistMock.mockReset();
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

describe('GET /api/v1/setlists', () => {
  it('returns 200 with { status: "ok", data: [] } when band has no Setlists', async () => {
    listSetlistsByBandMock.mockResolvedValue([]);
    const res = await authedRequest('/api/v1/setlists');
    expect(res.status).toBe(200);
    expect(isIso(res.headers.get('x-server-now'))).toBe(true);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok', data: [] });
  });

  it('returns 200 with { status: "ok", data: [setlist] } when Setlists exist', async () => {
    const setlist = makeSetlist();
    listSetlistsByBandMock.mockResolvedValue([setlist]);
    const res = await authedRequest('/api/v1/setlists');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; data: Setlist[] };
    expect(body.status).toBe('ok');
    expect(body.data).toEqual([setlist]);
  });

  it('returns 401 without an auth cookie', async () => {
    const res = await app.request('/api/v1/setlists');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/setlists/:setlistId', () => {
  it('returns 200 with the Setlist when present', async () => {
    const setlist = makeSetlist();
    getSetlistMock.mockResolvedValue(setlist);
    const res = await authedRequest(`/api/v1/setlists/${SETLIST_ID_A}`);
    expect(res.status).toBe(200);
    expect(isIso(res.headers.get('x-server-now'))).toBe(true);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok', data: setlist });
  });

  it('returns 404 with the NOT_FOUND envelope when absent', async () => {
    getSetlistMock.mockResolvedValue(undefined);
    const res = await authedRequest(`/api/v1/setlists/${SETLIST_ID_A}`);
    expect(res.status).toBe(404);
    expect(isIso(res.headers.get('x-server-now'))).toBe(true);
    const body = await res.json();
    expect(body).toEqual({
      status: 'error',
      error: { code: 'NOT_FOUND', message: 'setlist not found' },
    });
  });

  it('returns 401 without an auth cookie', async () => {
    const res = await app.request(`/api/v1/setlists/${SETLIST_ID_A}`);
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/v1/setlists/:setlistId', () => {
  function putInput(overrides: Partial<Setlist> = {}): Omit<Setlist, 'serverReceivedAt'> {
    const { serverReceivedAt: _s, ...rest } = makeSetlist(overrides);
    return rest;
  }

  it('returns 200 applied when no existing record (new setlist — compareLww returns "apply" for undefined existing)', async () => {
    getSetlistMock.mockResolvedValue(undefined);
    putSetlistMock.mockResolvedValue(undefined);
    const input = putInput();
    const res = await authedRequest(`/api/v1/setlists/${SETLIST_ID_A}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    expect(res.status).toBe(200);
    expect(isIso(res.headers.get('x-server-now'))).toBe(true);
    const body = (await res.json()) as { status: string; data: Setlist };
    expect(body.status).toBe('applied');
    expect(body.data).toMatchObject(input);
    expect(isIso(body.data.serverReceivedAt)).toBe(true);
    expect(putSetlistMock).toHaveBeenCalledTimes(1);
    expect(putSetlistMock).toHaveBeenCalledWith(body.data);
  });

  it('returns 200 applied when incoming clientWrittenAt >= existing (same-timestamp wins)', async () => {
    const existing = makeSetlist({ clientWrittenAt: '2026-06-19T10:00:00.000Z' });
    getSetlistMock.mockResolvedValue(existing);
    putSetlistMock.mockResolvedValue(undefined);
    const input = putInput({ clientWrittenAt: '2026-06-19T10:00:00.000Z' });
    const res = await authedRequest(`/api/v1/setlists/${SETLIST_ID_A}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; data: Setlist };
    expect(body.status).toBe('applied');
    expect(putSetlistMock).toHaveBeenCalledTimes(1);
  });

  it('returns 200 dropped-as-stale when incoming is strictly older than existing', async () => {
    const existing = makeSetlist({ clientWrittenAt: '2026-06-19T13:00:00.000Z' });
    getSetlistMock.mockResolvedValue(existing);
    const stale = putInput({ clientWrittenAt: '2026-06-19T12:00:00.000Z' });
    const res = await authedRequest(`/api/v1/setlists/${SETLIST_ID_A}`, {
      method: 'PUT',
      body: JSON.stringify(stale),
    });
    expect(res.status).toBe(200);
    expect(isIso(res.headers.get('x-server-now'))).toBe(true);
    const body = await res.json();
    expect(body).toEqual({ status: 'dropped-as-stale', currentState: existing });
    expect(putSetlistMock).not.toHaveBeenCalled();
  });

  it('atomicity: a PUT that reorders + edits sections AND annotation at the same clientWrittenAt is applied verbatim with no merging', async () => {
    const existing = makeSetlist({
      clientWrittenAt: '2026-06-19T10:00:00.000Z',
      sections: [
        {
          name: 'Set 1',
          songs: [
            { songId: 'songA', titleSnapshot: 'Song A' },
            { songId: 'songB', titleSnapshot: 'Song B', perGigAnnotation: 'mellow' },
          ],
        },
      ],
    });
    getSetlistMock.mockResolvedValue(existing);
    putSetlistMock.mockResolvedValue(undefined);

    // Reorder, change annotation, and add a new section — all in one body
    // at the SAME clientWrittenAt. Same-timestamp wins per LWW.
    const replacement = putInput({
      clientWrittenAt: '2026-06-19T10:00:00.000Z',
      sections: [
        {
          name: 'Set 1',
          songs: [
            { songId: 'songB', titleSnapshot: 'Song B', perGigAnnotation: 'opener — punch' },
            { songId: 'songA', titleSnapshot: 'Song A' },
          ],
        },
        {
          name: 'Set 2',
          songs: [{ songId: 'songC', titleSnapshot: 'Song C' }],
        },
      ],
    });

    const res = await authedRequest(`/api/v1/setlists/${SETLIST_ID_A}`, {
      method: 'PUT',
      body: JSON.stringify(replacement),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; data: Setlist };
    expect(body.status).toBe('applied');
    // The entire sections[] is replaced verbatim — no merging with existing.
    expect(body.data.sections).toEqual(replacement.sections);
    expect(putSetlistMock).toHaveBeenCalledTimes(1);
    const persisted = putSetlistMock.mock.calls[0]?.[0] as Setlist;
    expect(persisted.sections).toEqual(replacement.sections);
  });

  it('returns 400 VALIDATION_FAILED on a malformed body (missing sections)', async () => {
    const input = putInput();
    const { sections: _sections, ...without } = input;
    const res = await authedRequest(`/api/v1/setlists/${SETLIST_ID_A}`, {
      method: 'PUT',
      body: JSON.stringify(without),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { status: string; error: { code: string } };
    expect(body.status).toBe('error');
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(putSetlistMock).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_FAILED when body is not JSON', async () => {
    const res = await authedRequest(`/api/v1/setlists/${SETLIST_ID_A}`, {
      method: 'PUT',
      body: 'not-json',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { status: string; error: { code: string; message: string } };
    expect(body.error.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when path :setlistId does not match body.setlistId', async () => {
    const input = putInput({ setlistId: SETLIST_ID_A });
    const res = await authedRequest(`/api/v1/setlists/${SETLIST_ID_B}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { status: string; error: { code: string; message: string } };
    expect(body.error.message).toBe('setlistId in path does not match body');
  });

  it('returns 400 when body.bandId does not match ACTIVE_BAND_ID', async () => {
    const input = putInput({ bandId: 'someOtherBandIdXY' });
    const res = await authedRequest(`/api/v1/setlists/${SETLIST_ID_A}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { status: string; error: { code: string; message: string } };
    expect(body.error.message).toBe('bandId does not match the active band');
  });

  it('returns 400 when body includes serverReceivedAt (strict() rejects extra keys)', async () => {
    // Strict() schema rejects unknown keys including serverReceivedAt
    // (server stamps it, client must not send it).
    const input = makeSetlist();
    const res = await authedRequest(`/api/v1/setlists/${SETLIST_ID_A}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { status: string; error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(putSetlistMock).not.toHaveBeenCalled();
  });

  it('returns 401 without an auth cookie', async () => {
    const input = putInput();
    const res = await app.request(`/api/v1/setlists/${SETLIST_ID_A}`, {
      method: 'PUT',
      body: JSON.stringify(input),
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });
});

describe('AC-9 — titleSnapshot independence', () => {
  it('a Song PUT does not call putSetlist (the routes never co-write)', async () => {
    // The Song write path is isolated to ddb/songs.ts; setlist writes only
    // happen on the setlists route. Asserting putSetlist is untouched after
    // a Song PUT confirms the structural separation.
    putSongMock.mockResolvedValue(undefined);
    getSongMock.mockResolvedValue(undefined);
    const songInput = {
      bandId: ACTIVE_BAND_ID,
      songId: 'song0000000001ab',
      title: 'Round About Midnight',
      clientWrittenAt: '2026-06-19T11:00:00.000Z',
      version: 1 as const,
    };
    const res = await authedRequest('/api/v1/songs/song0000000001ab', {
      method: 'PUT',
      body: JSON.stringify(songInput),
    });
    expect(res.status).toBe(200);
    expect(putSetlistMock).not.toHaveBeenCalled();
    expect(getSetlistMock).not.toHaveBeenCalled();
  });

  it('a subsequent GET on the setlist still returns the original titleSnapshot', async () => {
    // The setlist DDB read path returns whatever was stored; the song write
    // never touches the setlist record. Mocking getSetlist to return a
    // record with the original titleSnapshot demonstrates the contract:
    // the route never reads the Songs table to refresh titleSnapshot.
    const stored = makeSetlist({
      sections: [
        {
          name: 'Set 1',
          songs: [{ songId: 'song0000000001ab', titleSnapshot: 'Round Midnight' }],
        },
      ],
    });
    getSetlistMock.mockResolvedValue(stored);
    const res = await authedRequest(`/api/v1/setlists/${SETLIST_ID_A}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; data: Setlist };
    expect(body.data.sections[0]?.songs[0]?.titleSnapshot).toBe('Round Midnight');
  });
});
