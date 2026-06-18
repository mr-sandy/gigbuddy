import { ACTIVE_BAND_ID, type Song } from '@gigbuddy/shared';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { getSong } from '../api/songs.js';

/*
 * Per-Song query (FR-3). Keyed on ['song', bandId, songId] — the same
 * shape the flusher's `queryKeyForSong()` produces (sync/flusher.ts:36-38)
 * so optimistic + stale-write cache writes hit the same store.
 *
 * `songId === null` is the `/songs/new` arm: the route mounts this hook
 * but has no songId yet; `enabled: false` keeps the queryFn dormant and
 * the hook returns `data: undefined, isLoading: false`.
 *
 * Defaults inherited from the SyncProvider's QueryClient (gcTime:
 * Infinity, staleTime: 0). The queryFn resolves to `Song | null`
 * directly — a 404 returns null without throwing (api/songs.ts contract).
 */
export function useSong(songId: string | null): UseQueryResult<Song | null, Error> {
  return useQuery({
    queryKey: ['song', ACTIVE_BAND_ID, songId],
    queryFn: () => getSong(songId as string),
    enabled: songId !== null,
  });
}
