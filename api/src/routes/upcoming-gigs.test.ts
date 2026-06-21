import { ACTIVE_BAND_ID, type Setlist } from '@gigbuddy/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getJwtKeyMock,
  listUpcomingGigsMock,
  getSetlistMock,
  listSetlistsByBandMock,
  putSetlistMock,
  getSongMock,
  listSongsByBandMock,
  putSongMock,
} = vi.hoisted(() => ({
  getJwtKeyMock: vi.fn(),
  listUpcomingGigsMock: vi.fn(),
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

// The route only consumes listUpcomingGigs + the inline londonIsoDate; we
// must mock listUpcomingGigs to avoid touching the real DDB client. We
// preserve the real londonIsoDate so the route still computes the window
// for the assertion in case-3.
vi.mock('../ddb/gigs.js', async () => {
  const actual = await vi.importActual<typeof import('../ddb/gigs.js')>('../ddb/gigs.js');
  return {
    ...actual,
    listUpcomingGigs: listUpcomingGigsMock,
  };
});

// Setlists/songs ddb modules are also mocked because app.ts wires those
// routes and instantiates handlers eagerly; we don't want any case here to
// touch the real DDB client through those surfaces.
vi.mock('../ddb/setlists.js', () => ({
  getSetlist: getSetlistMock,
  listSetlistsByBand: listSetlistsByBandMock,
  putSetlist: putSetlistMock,
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
const SETLIST_ID = 'setlist0000000aa';

function makeSetlist(overrides: Partial<Setlist> = {}): Setlist {
  return {
    bandId: ACTIVE_BAND_ID,
    setlistId: SETLIST_ID,
    gigMeta: { venue: 'The Jazz Cafe', date: '2026-06-21', time: '20:00' },
    sections: [
      {
        name: 'Set 1',
        songs: [{ songId: 'song0000000001ab', titleSnapshot: 'Round Midnight' }],
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
  listUpcomingGigsMock.mockReset();

  const now = Math.floor(Date.now() / 1000);
  const token = await signSession(now);
  authCookie = `${SESSION_COOKIE_NAME}=${token}`;
});

async function authedRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Cookie', authCookie);
  return app.request(path, { ...init, headers });
}

function isIso(v: string | null): boolean {
  return !!v && new Date(v).toISOString() === v;
}

describe('GET /api/v1/upcoming-gigs', () => {
  it('returns 200 with { status: "ok", data: [] } when no upcoming gigs', async () => {
    listUpcomingGigsMock.mockResolvedValue([]);
    const res = await authedRequest('/api/v1/upcoming-gigs');
    expect(res.status).toBe(200);
    expect(isIso(res.headers.get('x-server-now'))).toBe(true);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok', data: [] });
  });

  it('returns 200 with { status: "ok", data: [setlist] } when a gig is within 24h', async () => {
    const setlist = makeSetlist();
    listUpcomingGigsMock.mockResolvedValue([setlist]);
    const res = await authedRequest('/api/v1/upcoming-gigs');
    expect(res.status).toBe(200);
    expect(isIso(res.headers.get('x-server-now'))).toBe(true);
    const body = (await res.json()) as { status: string; data: Setlist[] };
    expect(body.status).toBe('ok');
    expect(body.data).toEqual([setlist]);
  });

  it('passes ACTIVE_BAND_ID and two consecutive Europe/London calendar dates to listUpcomingGigs', async () => {
    listUpcomingGigsMock.mockResolvedValue([]);
    await authedRequest('/api/v1/upcoming-gigs');
    expect(listUpcomingGigsMock).toHaveBeenCalledTimes(1);
    const [bandId, today, tomorrow] = listUpcomingGigsMock.mock.calls[0] as [
      string,
      string,
      string,
    ];
    expect(bandId).toBe(ACTIVE_BAND_ID);
    // YYYY-MM-DD shape
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(tomorrow).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // tomorrow is strictly after today (lexicographic compare works for ISO dates)
    expect(tomorrow > today).toBe(true);
  });

  it('returns 401 without an auth cookie', async () => {
    const res = await app.request('/api/v1/upcoming-gigs');
    expect(res.status).toBe(401);
    // The handler must not have been reached.
    expect(listUpcomingGigsMock).not.toHaveBeenCalled();
  });
});
