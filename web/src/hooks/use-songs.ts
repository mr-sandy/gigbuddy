import { ACTIVE_BAND_ID, type Song } from '@gigbuddy/shared';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { listSongs } from '../api/songs.js';

/*
 * Library list query (FR-4). Keyed on ['songs', bandId] — the per-Song
 * key ['song', bandId, songId] (Story 2.6) is a SEPARATE cache namespace
 * (see web/src/sync/flusher.ts:31-35). Architecture.md "State management
 * taxonomy" line 720: server data lives in TanStack Query; persisted to
 * IDB by the SyncProvider (Story 2.4).
 *
 * Defaults inherited from the SyncProvider's QueryClient:
 *   - gcTime: Infinity (cache never expires while persisted)
 *   - staleTime: 0 (refetch on mount/focus to surface server changes)
 *   - retry: 3 with exponential backoff (architecture line 743)
 *
 * The server alphabetizes — the hook returns the array as-is.
 */
export function useSongs(): UseQueryResult<Song[], Error> {
  return useQuery({
    queryKey: ['songs', ACTIVE_BAND_ID],
    queryFn: listSongs,
  });
}
