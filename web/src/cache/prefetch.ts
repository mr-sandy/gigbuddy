/// <reference lib="dom" />

import { ACTIVE_BAND_ID, type Setlist } from '@gigbuddy/shared';
import { listUpcomingGigs } from '../api/gigs.js';
import { getSetlist } from '../api/setlists.js';
import { getSong } from '../api/songs.js';
import { UPCOMING_GIGS_QUERY_KEY } from '../hooks/use-upcoming-gigs.js';
import { isIPhone } from '../lib/platform.js';
import { queryClient } from '../sync/query-client.js';

/*
 * Foreground pre-fetch — Story 4.5 (AR-25, AC-3/4/5).
 *
 * Wired at module-load time as a singleton `visibilitychange` listener
 * (same pattern as `wake-lock.ts`). On every iPhone foreground:
 *   1. Warm the `useUpcomingGigs()` cache slot via `prefetchQuery`
 *      keyed on `UPCOMING_GIGS_QUERY_KEY` — shared with the hook so any
 *      future consumer gets the warm data for free.
 *   2. For each upcoming gig, warm the per-Setlist cache slot keyed
 *      `['setlist', ACTIVE_BAND_ID, setlistId]` — the EXACT key
 *      `useSetlist` uses (see `web/src/hooks/use-setlist.ts:20`).
 *   3. For each Song referenced by an upcoming Setlist, warm the
 *      per-Song cache slot keyed `['song', ACTIVE_BAND_ID, songId]` —
 *      the EXACT key `useSong` uses (see `web/src/hooks/use-song.ts:20`).
 *
 * If the keys do not match exactly, there is no cache hit and the
 * prefetch is pointless. The architecture-compliance comments above
 * point to the source-of-truth lines so future edits stay in lockstep.
 *
 * MacBook is excluded — the `isIPhone()` early-return at the top of
 * `onForeground` makes this an iPhone-only path (AR-25).
 *
 * Silent failure mode (AR-28, FR-31): any thrown error from the fetch
 * is swallowed inside a top-level `try/catch`. No toast, no banner, no
 * console-error past the silent catch. If a Gig was already cached from
 * a previous online prefetch, the cached data remains usable.
 *
 * Non-blocking: the per-Setlist + per-Song prefetches use `void
 * queryClient.prefetchQuery(...)` — they fire-and-forget so the function
 * returns quickly. The UI never awaits the prefetch (it's a side-effect
 * listener, not a render-blocking call).
 */

export async function onForeground(): Promise<void> {
  if (!isIPhone()) return;
  try {
    await queryClient.prefetchQuery({
      queryKey: UPCOMING_GIGS_QUERY_KEY,
      queryFn: () => listUpcomingGigs(),
    });
    const gigs = queryClient.getQueryData<Setlist[]>(UPCOMING_GIGS_QUERY_KEY) ?? [];
    for (const gig of gigs) {
      void queryClient.prefetchQuery({
        queryKey: ['setlist', ACTIVE_BAND_ID, gig.setlistId],
        queryFn: () => getSetlist(gig.setlistId),
      });
      for (const ref of gig.sections.flatMap((s) => s.songs)) {
        void queryClient.prefetchQuery({
          queryKey: ['song', ACTIVE_BAND_ID, ref.songId],
          queryFn: () => getSong(ref.songId),
        });
      }
    }
  } catch {
    // Silent — no toast, no banner, no log (AR-28, FR-31).
  }
}

/*
 * Module-scope singleton: register the `visibilitychange` listener once
 * at load time. The handler only fires `onForeground()` when the document
 * transitions to `visible`. Same pattern as `wake-lock.ts`.
 */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void onForeground();
    }
  });
}
