import { ACTIVE_BAND_ID, type Setlist } from '@gigbuddy/shared';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { listUpcomingGigs } from '../api/gigs.js';

/*
 * `useUpcomingGigs` — Story 4.5 (AR-25, AC-3).
 *
 * Reads the next 24h window of Setlists via `/api/v1/upcoming-gigs`. The
 * client-side foreground pre-fetch (`web/src/cache/prefetch.ts`) warms
 * this exact query slot via `queryClient.prefetchQuery({ queryKey:
 * UPCOMING_GIGS_QUERY_KEY })` so any consumer of this hook gets the warm
 * data for free.
 *
 * The query key is exported as a constant so prefetch + hook share the
 * exact same key — there is no cache hit if the keys diverge.
 *
 * Defaults inherited from the SyncProvider's QueryClient (gcTime:
 * Infinity, staleTime: 0). The queryFn resolves to `Setlist[]` directly.
 *
 * Story 4.5 does NOT mount this hook in any UI component — the prefetch
 * is the sole writer for now. The hook exists so future consumers (e.g.
 * a "Tonight" banner or a network-aware Home pill) can read the same
 * slot without re-implementing the fetch.
 */

export const UPCOMING_GIGS_QUERY_KEY = ['upcoming-gigs', ACTIVE_BAND_ID] as const;

export function useUpcomingGigs(): UseQueryResult<Setlist[], Error> {
  return useQuery({
    queryKey: UPCOMING_GIGS_QUERY_KEY,
    queryFn: () => listUpcomingGigs(),
  });
}
