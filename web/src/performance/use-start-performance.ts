import { ACTIVE_BAND_ID, type Section } from '@gigbuddy/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { getSetlist } from '../api/setlists.js';
import { getSong } from '../api/songs.js';
import { useSetPerformanceActive } from './performance-context.js';
import * as wakeLock from './wake-lock.js';

/*
 * Performance Mode entry orchestration — Story 4.1 (FR-15, AR-25, AR-28).
 *
 * `useStartPerformance()` returns the canonical `onStartPerformance(setlistId)`
 * handler. The single-arg signature matches the epic AC verbatim and keeps
 * prefetch + wake-lock + setActive + navigate together in one place — there
 * is no other call site that knows the entry sequence.
 *
 * Order of operations (epic AC narrative; do not reorder):
 *   1. Fetch the Setlist (cache → fall back to network) so we know which
 *      Songs to prefetch.
 *   2. `Promise.all` prefetch every SongRef in `sections[].songs[]` — the
 *      flat ordered list of every Song referenced by this Setlist. The
 *      Performance Card route then reads from cache (warm) on first paint.
 *   3. `wakeLock.acquire()` — V1 stub (Story 4.2 lands the real call). We
 *      `await` so the contract holds when Story 4.2 swaps in the async
 *      `navigator.wakeLock.request()`.
 *   4. `setActive(true)` — flips `performanceActive` so `useChromeVisible()`
 *      hides the bottom tabs and the 401-hold + flusher-pause invariants
 *      from AR-28 take effect before navigation.
 *   5. `navigate('/performance/:setlistId/0')` — first Song of the flat
 *      ordered list. The route renders the card from warm cache.
 *
 * Guard: if the flat song list is empty (all Sections empty, or a
 * cache-miss + 404), the function returns early without any side effects.
 * The CTA in `setlist-overview.tsx` is independently disabled per AC-2 —
 * this guard is defence-in-depth.
 *
 * Architecture pseudocode in `architecture.md` lines 643–649 references a
 * non-existent `setlist.songRefs` field. The real schema (shared/) uses
 * `sections: SectionSchema[]` each with `songs: SongRefSchema[]`. We flatten
 * `sections[].songs[]` to iterate every Song in Setlist order. See the
 * "Architecture.md pseudocode error" section of the story spec.
 */
export function useStartPerformance(): (setlistId: string) => Promise<void> {
  const queryClient = useQueryClient();
  const setActive = useSetPerformanceActive();
  const navigate = useNavigate();

  return useCallback(
    async (setlistId: string): Promise<void> => {
      // Pull the Setlist from cache; fall back to network via fetchQuery if
      // it isn't cached (warm caches are the common case — Story 4.5 will
      // add tonight-gig pre-fetch). `fetchQuery` resolves with the same
      // shape as `getSetlist` (Setlist | null) — null is a 404 / missing.
      const setlist = await queryClient.fetchQuery({
        queryKey: ['setlist', ACTIVE_BAND_ID, setlistId],
        queryFn: () => getSetlist(setlistId),
      });
      if (setlist === null) return;

      const flatSongs = setlist.sections.flatMap((s) => s.songs);
      if (flatSongs.length === 0) return;

      // Prefetch the Setlist itself so the cache entry is fresh (the
      // `fetchQuery` call above already populated it, but a parallel
      // `prefetchQuery` call documents the AC-1 ordering contract).
      await queryClient.prefetchQuery({
        queryKey: ['setlist', ACTIVE_BAND_ID, setlistId],
        queryFn: () => getSetlist(setlistId),
      });
      await Promise.all(
        flatSongs.map((ref) =>
          queryClient.prefetchQuery({
            queryKey: ['song', ACTIVE_BAND_ID, ref.songId],
            queryFn: () => getSong(ref.songId),
          }),
        ),
      );

      await wakeLock.acquire();
      setActive(true);
      navigate(`/performance/${setlistId}/0`);
    },
    [queryClient, setActive, navigate],
  );
}

/*
 * Plain helper exported for unit-test convenience — returns `0` if at least
 * one Song exists across all Sections (Performance Mode can be entered),
 * `null` if every Section is empty (CTA must be disabled per AC-2). The
 * Performance Card route uses the URL `:songIndex` directly; this helper
 * exists so the entry-point gate can be exercised without a React render.
 */
export function getFirstSongIndex(sections: Section[]): number | null {
  for (const section of sections) {
    if (section.songs.length > 0) return 0;
  }
  return null;
}
