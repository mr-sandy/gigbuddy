import { ACTIVE_BAND_ID, type Song, SongPutInputSchema } from '@gigbuddy/shared';
import { Hono } from 'hono';
import { listSetlistsByBand } from '../ddb/setlists.js';
import { deleteSong, getSong, listSongsByBand, putSong } from '../ddb/songs.js';
import { compareLww } from '../lww.js';

function alphabetizeByTitle(songs: Song[]): Song[] {
  return [...songs].sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));
}

function summarizeZodIssues(error: {
  errors: { path: (string | number)[]; message: string }[];
}): string {
  return error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
}

// Retired in Story 7.31. An old cached build may still send them; dropping
// beats a 400 that the outbox would discard along with the rest of the edit.
function dropRetiredKeys(body: unknown): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return body;
  const { performanceNotes: _p, practiceNotes: _n, ...rest } = body as Record<string, unknown>;
  return rest;
}

export const songsRoute = new Hono()
  .get('/', async (c) => {
    const songs = await listSongsByBand(ACTIVE_BAND_ID);
    return c.json({ status: 'ok' as const, data: alphabetizeByTitle(songs) });
  })
  .get('/:songId', async (c) => {
    const songId = c.req.param('songId');
    const song = await getSong(ACTIVE_BAND_ID, songId);
    if (!song) {
      return c.json(
        {
          status: 'error' as const,
          error: { code: 'NOT_FOUND', message: 'song not found' },
        },
        404,
      );
    }
    return c.json({ status: 'ok' as const, data: song });
  })
  .put('/:songId', async (c) => {
    const songId = c.req.param('songId');
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        {
          status: 'error' as const,
          error: { code: 'VALIDATION_FAILED', message: 'body is not JSON' },
        },
        400,
      );
    }
    const parsed = SongPutInputSchema.safeParse(dropRetiredKeys(body));
    if (!parsed.success) {
      return c.json(
        {
          status: 'error' as const,
          error: { code: 'VALIDATION_FAILED', message: summarizeZodIssues(parsed.error) },
        },
        400,
      );
    }
    if (parsed.data.songId !== songId) {
      return c.json(
        {
          status: 'error' as const,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'songId in path does not match body',
          },
        },
        400,
      );
    }
    if (parsed.data.bandId !== ACTIVE_BAND_ID) {
      return c.json(
        {
          status: 'error' as const,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'bandId does not match the active band',
          },
        },
        400,
      );
    }
    const existing = await getSong(ACTIVE_BAND_ID, songId);
    const verdict = compareLww(parsed.data, existing);
    if (verdict === 'drop') {
      // existing is guaranteed defined when verdict is 'drop' — the only
      // way compareLww returns 'drop' is when an existing record is
      // strictly newer than incoming. Narrow with a defensive assertion.
      if (!existing) throw new Error('invariant: drop verdict requires existing record');
      return c.json({ status: 'dropped-as-stale' as const, currentState: existing });
    }
    const record: Song = { ...parsed.data, serverReceivedAt: new Date().toISOString() };
    await putSong(record);
    return c.json({ status: 'applied' as const, data: record });
  })
  .delete('/:songId', async (c) => {
    const songId = c.req.param('songId');
    // Story 7.11: a song in any setlist stays, so setlist history never
    // points at a missing song. Deleting a missing song succeeds quietly.
    const setlists = await listSetlistsByBand(ACTIVE_BAND_ID);
    const inUse = setlists.some((setlist) =>
      setlist.sections.some((section) => section.songs.some((ref) => ref.songId === songId)),
    );
    if (inUse) {
      return c.json(
        {
          status: 'error' as const,
          error: { code: 'SONG_IN_USE', message: 'song is in a setlist' },
        },
        409,
      );
    }
    await deleteSong(ACTIVE_BAND_ID, songId);
    return c.body(null, 204);
  });
