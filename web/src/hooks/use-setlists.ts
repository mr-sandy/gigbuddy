import { ACTIVE_BAND_ID, type Setlist } from '@gigbuddy/shared';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { listSetlists } from '../api/setlists.js';

/*
 * Setlists list query. Keyed on ['setlists', bandId] — the per-Setlist
 * key ['setlist', bandId, setlistId] is a SEPARATE cache namespace
 * (see web/src/sync/flusher.ts queryKeyForSetlist) so optimistic + flusher
 * cache writes hit the same store.
 *
 * Defaults inherited from the SyncProvider's QueryClient (gcTime: Infinity,
 * staleTime: 0, retry: 3 with exponential backoff).
 *
 * The server returns setlists in ascending date order (GSI1 gsi1sk).
 * Story 3.2 handles Tonight / Upcoming / Past sectioning at the UI layer.
 */
export function useSetlists(): UseQueryResult<Setlist[], Error> {
  return useQuery({
    queryKey: ['setlists', ACTIVE_BAND_ID],
    queryFn: listSetlists,
  });
}
