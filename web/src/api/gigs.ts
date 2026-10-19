import { OkResponseSchema, type Setlist, SetlistSchema } from '@gigbuddy/shared';
import { z } from 'zod';
import { apiFetch } from './client.js';

/*
 * `listUpcomingGigs` — Story 4.5 (AR-25, AR-40).
 *
 * Wire-side helper for `/api/v1/upcoming-gigs`. Its callers (the Tonight
 * Gig prefetch and `use-upcoming-gigs`) were removed in Story 7.1; it is
 * kept as `api/` plumbing for a later slice. The API returns full
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
