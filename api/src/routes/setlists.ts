import { ACTIVE_BAND_ID, type Setlist, SetlistPutInputSchema } from '@gigbuddy/shared';
import { Hono } from 'hono';
import { getSetlist, listSetlistsByBand, putSetlist } from '../ddb/setlists.js';
import { compareLww } from '../lww.js';

/*
 * Setlists route — mirrors routes/songs.ts shape. Reuses the generic
 * `compareLww` (AR-23: whole-record LWW; same comparator the songs route
 * uses). Whole-record PUT semantics: `sections[]` is replaced atomically
 * on every accepted write — no per-section or per-song merging.
 */

function summarizeZodIssues(error: {
  errors: { path: (string | number)[]; message: string }[];
}): string {
  return error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
}

export const setlistsRoute = new Hono()
  .get('/', async (c) => {
    const setlists = await listSetlistsByBand(ACTIVE_BAND_ID);
    return c.json({ status: 'ok' as const, data: setlists });
  })
  .get('/:setlistId', async (c) => {
    const setlistId = c.req.param('setlistId');
    const setlist = await getSetlist(ACTIVE_BAND_ID, setlistId);
    if (!setlist) {
      return c.json(
        {
          status: 'error' as const,
          error: { code: 'NOT_FOUND', message: 'setlist not found' },
        },
        404,
      );
    }
    return c.json({ status: 'ok' as const, data: setlist });
  })
  .put('/:setlistId', async (c) => {
    const setlistId = c.req.param('setlistId');
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
    const parsed = SetlistPutInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          status: 'error' as const,
          error: { code: 'VALIDATION_FAILED', message: summarizeZodIssues(parsed.error) },
        },
        400,
      );
    }
    if (parsed.data.setlistId !== setlistId) {
      return c.json(
        {
          status: 'error' as const,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'setlistId in path does not match body',
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
    const existing = await getSetlist(ACTIVE_BAND_ID, setlistId);
    const verdict = compareLww(parsed.data, existing);
    if (verdict === 'drop') {
      // existing is guaranteed defined when verdict is 'drop' — the only
      // way compareLww returns 'drop' is when an existing record is
      // strictly newer than incoming.
      if (!existing) throw new Error('invariant: drop verdict requires existing record');
      return c.json({ status: 'dropped-as-stale' as const, currentState: existing });
    }
    const record: Setlist = { ...parsed.data, serverReceivedAt: new Date().toISOString() };
    await putSetlist(record);
    return c.json({ status: 'applied' as const, data: record });
  });
