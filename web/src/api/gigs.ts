import { OkResponseSchema, type Setlist, SetlistSchema } from '@gigbuddy/shared';
import { z } from 'zod';
import { apiFetch } from './client.js';

/*
 * `listUpcomingGigs` — Story 4.5 (AR-25, AR-40).
 *
 * Wire-side helper that `web/src/cache/prefetch.ts` and
 * `web/src/hooks/use-upcoming-gigs.ts` both call. The API returns full
 * `Setlist[]` records (per the epic AC-1 "full Setlist record can be
 * returned too" contract note), so we reuse `SetlistSchema` from `shared/`
 * directly — no parallel `UpcomingGigSchema`, no hand-written `UpcomingGig`
 * type (CLAUDE.md "Zod schemas in `shared/` are the single source of
 * truth").
 */

export async function listUpcomingGigs(): Promise<Setlist[]> {
  const response = await apiFetch('/api/v1/upcoming-gigs', {
    method: 'GET',
    schema: OkResponseSchema(z.array(SetlistSchema)),
  });
  return response.data.data;
}
