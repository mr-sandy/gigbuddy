import { useEffect } from 'react';
import { useLocation } from 'react-router';
import {
  useActivePerformanceSession,
  usePerformanceActive,
} from '../performance/performance-context.js';
import { usePerformanceEnd } from './use-performance-end.js';
import { useSetlist } from './use-setlist.js';

/*
 * Story 4.4 — navigate-away end-state detector (FR-21).
 *
 * Mounted inside `AuthenticatedShell` so it sees every authenticated
 * navigation. Pure effect — returns void, no JSX.
 *
 * The detector compares the current pathname against the "active Setlist
 * chain":
 *
 *   - `/performance/${activeSetlistId}/...`  → in chain (Performance Card)
 *   - `/setlists/${activeSetlistId}`         → in chain (active overview
 *                                              after × exit per Story 4.3)
 *   - `/songs/:songId` WHERE songId is one of the active Setlist's songs
 *                                            → in chain (drilling into a
 *                                              Song referenced by THIS
 *                                              Setlist preserves state)
 *   - everything else (`/`, `/library`, `/setlists/<other>`,
 *     `/songs/<not-in-setlist>`, ...)        → ends Performance state via
 *                                              `endPerformance()`
 *
 * The active-Setlist song-id set is read from the TanStack Query cache via
 * `useSetlist(activeSetlistId)` — per AR-28 there are no network calls in
 * Performance Mode; the Setlist is already cached (prefetched at entry by
 * `useStartPerformance`).
 *
 * Initial-mount safety: `useEffect` fires on the first render of
 * `AuthenticatedShell`. At that point `performanceActive` is `false` (the
 * Provider's initial state), so the early-return short-circuits before
 * `endPerformance()` runs. No false positive.
 *
 * Defensive null check: if `performanceActive === true` but
 * `activeSetlistId === null` (shouldn't happen in normal flow — entry
 * always seeds the session), we return early. No active chain to compare
 * against, so we never end state from an inconsistent context.
 *
 * Race window: the effect runs AFTER React paints the new route. For a few
 * frames the new route renders with `performanceActive === true` still in
 * context, then `setActive(false)` propagates and the route rerenders.
 * The `StaleWriteBanner` is suppressed during this window so no flash —
 * the brief gap is imperceptible.
 */
export function useNavigateAwayGuard(): void {
  const location = useLocation();
  const performanceActive = usePerformanceActive();
  const { activeSetlistId } = useActivePerformanceSession();
  const endPerformance = usePerformanceEnd();
  // Reads from TanStack Query cache — no network call (AR-28). `enabled`
  // is keyed off non-null `activeSetlistId` inside `useSetlist`.
  const { data: setlist } = useSetlist(activeSetlistId);

  useEffect(() => {
    if (!performanceActive) return;
    if (activeSetlistId === null) return;

    const pathname = location.pathname;

    // Active chain — do NOT end Performance state.
    if (pathname.startsWith(`/performance/${activeSetlistId}/`)) return;
    if (pathname === `/setlists/${activeSetlistId}`) return;

    // `/songs/:songId` — in chain only when the songId is one of the
    // active Setlist's referenced songs (per AC-2/AC-3).
    const songDetailMatch = pathname.match(/^\/songs\/([^/]+)$/);
    if (songDetailMatch !== null && setlist !== null && setlist !== undefined) {
      const songId = songDetailMatch[1];
      if (songId !== undefined) {
        const activeSongIds = new Set(
          setlist.sections.flatMap((s) => s.songs.map((r) => r.songId)),
        );
        if (activeSongIds.has(songId)) return;
      }
    }

    // Anything else is a navigate-away — end Performance state.
    endPerformance();
  }, [location.pathname, performanceActive, activeSetlistId, setlist, endPerformance]);
}
