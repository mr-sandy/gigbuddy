import { ACTIVE_BAND_ID, ACTIVE_BAND_NAME, type Setlist, type Song } from '@gigbuddy/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Route-level tests for `GET /api/v1/export` (Story 5.1). DDB accessors
 * are mocked — the codebase has no dynamodb-local harness, so we follow
 * the established `songs.test.ts` / `upcoming-gigs.test.ts` pattern of
 * per-route module mocks.
 */
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

// Preserve the real `londonIsoDate` — the route uses it for the filename
// and this test asserts the header exactly matches today's Europe/London
// date. Only `listUpcomingGigs` needs mocking here (the upcoming-gigs
// route is wired eagerly in app.ts).
vi.mock('../ddb/gigs.js', async () => {
  const actual = await vi.importActual<typeof import('../ddb/gigs.js')>('../ddb/gigs.js');
  return {
    ...actual,
    listUpcomingGigs: listUpcomingGigsMock,
  };
});

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
import { londonIsoDate } from '../ddb/gigs.js';
import { SESSION_COOKIE_NAME } from '../middleware/auth.js';

const TEST_KEY = `test-key-${'x'.repeat(40)}`;

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    bandId: ACTIVE_BAND_ID,
    songId: 'song000000000001',
    title: 'Autumn Leaves',
    clientWrittenAt: '2026-06-16T12:00:00.000Z',
    serverReceivedAt: '2026-06-16T12:00:01.000Z',
    version: 1,
    ...overrides,
  };
}

function makeSetlist(overrides: Partial<Setlist> = {}): Setlist {
  return {
    bandId: ACTIVE_BAND_ID,
    setlistId: 'setl000000000001',
    gigMeta: { venue: 'The Jazz Cafe', date: '2026-07-20', time: '20:00' },
    sections: [
      {
        name: 'Set 1',
        songs: [{ songId: 'song000000000001', titleSnapshot: 'Autumn Leaves' }],
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
  listSongsByBandMock.mockReset();
  listSetlistsByBandMock.mockReset();
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

type ExportBody = {
  exportedAt: string;
  schemaVersion: 1;
  bands: Array<{ band: { bandId: string; name: string }; songs: Song[]; setlists: Setlist[] }>;
};

describe('GET /api/v1/export', () => {
  it('returns 200 with a full archive containing all fixture Songs and Setlists', async () => {
    // Fixture per AC-9: at least 3 Songs and 2 Setlists, one Setlist with a
    // perGigAnnotation and one with multiple Sections.
    const songs: Song[] = [
      makeSong({ songId: 'song000000000001', title: 'Autumn Leaves' }),
      makeSong({ songId: 'song000000000002', title: 'Blue Bossa', key: 'Cm' }),
      makeSong({
        songId: 'song000000000003',
        title: 'Charleston',
        chordChart: '|| C  | Am | Dm | G ||',
      }),
    ];
    const setlists: Setlist[] = [
      makeSetlist({
        setlistId: 'setl000000000001',
        gigMeta: { venue: 'The Jazz Cafe', date: '2026-07-20', time: '20:00' },
        sections: [
          {
            name: 'Set 1',
            songs: [
              {
                songId: 'song000000000001',
                titleSnapshot: 'Autumn Leaves',
                perGigAnnotation: 'half-time feel',
              },
              { songId: 'song000000000002', titleSnapshot: 'Blue Bossa' },
            ],
          },
        ],
      }),
      makeSetlist({
        setlistId: 'setl000000000002',
        gigMeta: { venue: 'Ronnie Scotts', date: '2026-08-01' },
        sections: [
          {
            name: 'Set 1',
            songs: [{ songId: 'song000000000003', titleSnapshot: 'Charleston' }],
          },
          {
            name: 'Set 2',
            songs: [{ songId: 'song000000000001', titleSnapshot: 'Autumn Leaves' }],
          },
        ],
      }),
    ];
    listSongsByBandMock.mockResolvedValue(songs);
    listSetlistsByBandMock.mockResolvedValue(setlists);

    const res = await authedRequest('/api/v1/export');
    expect(res.status).toBe(200);
    expect(isIso(res.headers.get('x-server-now'))).toBe(true);
    expect(res.headers.get('content-type')).toContain('application/json');

    // Content-Disposition must carry today's Europe/London calendar date.
    const expectedDate = londonIsoDate(new Date());
    expect(res.headers.get('content-disposition')).toBe(
      `attachment; filename="gigbuddy-${expectedDate}.json"`,
    );

    const body = (await res.json()) as ExportBody;
    expect(body.schemaVersion).toBe(1);
    expect(isIso(body.exportedAt)).toBe(true);
    expect(body.bands).toHaveLength(1);
    expect(body.bands[0]?.band).toEqual({ bandId: ACTIVE_BAND_ID, name: ACTIVE_BAND_NAME });
    expect(body.bands[0]?.songs).toEqual(songs);
    expect(body.bands[0]?.setlists).toEqual(setlists);
    // Structural spot-checks per AC-9.
    expect(body.bands[0]?.setlists[0]?.sections[0]?.songs[0]?.titleSnapshot).toBe('Autumn Leaves');
    expect(body.bands[0]?.setlists[0]?.sections[0]?.songs[0]?.perGigAnnotation).toBe(
      'half-time feel',
    );
    // Shape stability: keys present even when empty.
    expect(Object.keys(body.bands[0] ?? {})).toEqual(
      expect.arrayContaining(['band', 'songs', 'setlists']),
    );
  });

  it('returns a stable shape (songs:[], setlists:[]) for an empty library', async () => {
    listSongsByBandMock.mockResolvedValue([]);
    listSetlistsByBandMock.mockResolvedValue([]);

    const res = await authedRequest('/api/v1/export');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ExportBody;
    expect(body.schemaVersion).toBe(1);
    expect(body.bands).toHaveLength(1);
    expect(body.bands[0]?.songs).toEqual([]);
    expect(body.bands[0]?.setlists).toEqual([]);
    // Keys never omitted — shape must be identical to the populated case.
    expect(body.bands[0]).toHaveProperty('songs');
    expect(body.bands[0]).toHaveProperty('setlists');
    expect(body.bands[0]).toHaveProperty('band');
  });

  it('queries listSongsByBand and listSetlistsByBand with ACTIVE_BAND_ID', async () => {
    listSongsByBandMock.mockResolvedValue([]);
    listSetlistsByBandMock.mockResolvedValue([]);
    await authedRequest('/api/v1/export');
    expect(listSongsByBandMock).toHaveBeenCalledWith(ACTIVE_BAND_ID);
    expect(listSetlistsByBandMock).toHaveBeenCalledWith(ACTIVE_BAND_ID);
  });

  it('returns 401 without an auth cookie', async () => {
    const res = await app.request('/api/v1/export');
    expect(res.status).toBe(401);
    // The handler must not have been reached.
    expect(listSongsByBandMock).not.toHaveBeenCalled();
    expect(listSetlistsByBandMock).not.toHaveBeenCalled();
  });
});
