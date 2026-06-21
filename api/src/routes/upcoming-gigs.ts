import { ACTIVE_BAND_ID } from '@gigbuddy/shared';
import { Hono } from 'hono';
import { listUpcomingGigs, londonIsoDate } from '../ddb/gigs.js';

/*
 * `/api/v1/upcoming-gigs` — Story 4.5 (AR-25, AR-40, FR-22).
 *
 * Returns the active Band's Setlists whose `gigMeta.date` falls inside a
 * 24h Europe/London window starting "today" (the Europe/London calendar
 * date at request time). The client-side `cache/prefetch.ts` consumes
 * this on every iPhone foreground transition to warm the TanStack Query
 * cache slots that `useSetlist` and `useSong` read from.
 *
 * Auth is enforced by the global `authMiddleware` registered in
 * `app.ts` — no explicit check needed here.
 *
 * `x-server-now` is stamped by `serverNowMiddleware` (also global).
 */
export const upcomingGigsRoute = new Hono().get('/', async (c) => {
  const now = new Date();
  const today = londonIsoDate(now);
  const tomorrow = londonIsoDate(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const gigs = await listUpcomingGigs(ACTIVE_BAND_ID, today, tomorrow);
  return c.json({ status: 'ok' as const, data: gigs });
});
