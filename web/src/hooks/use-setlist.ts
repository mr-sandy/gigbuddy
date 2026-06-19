import { ACTIVE_BAND_ID, type Setlist } from '@gigbuddy/shared';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { getSetlist } from '../api/setlists.js';

/*
 * Per-Setlist query. Keyed on ['setlist', bandId, setlistId] — the same
 * shape the flusher's `queryKeyForSetlist()` produces (sync/flusher.ts) so
 * optimistic + stale-write cache writes hit the same store.
 *
 * `setlistId === null` matches the useSong nullable-id pattern: the route
 * mounts this hook but has no setlistId yet; `enabled: false` keeps the
 * queryFn dormant and the hook returns `data: undefined, isLoading: false`.
 *
 * Defaults inherited from the SyncProvider's QueryClient (gcTime: Infinity,
 * staleTime: 0). The queryFn resolves to `Setlist | null` directly — a 404
 * returns null without throwing (api/setlists.ts contract).
 */
export function useSetlist(setlistId: string | null): UseQueryResult<Setlist | null, Error> {
  return useQuery({
    queryKey: ['setlist', ACTIVE_BAND_ID, setlistId],
    queryFn: () => getSetlist(setlistId as string),
    enabled: setlistId !== null,
  });
}
