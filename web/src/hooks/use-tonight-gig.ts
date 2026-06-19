import type { Setlist } from '@gigbuddy/shared';
import { sectionSetlists, todayLondon } from '../lib/gig-date.js';
import { useSetlists } from './use-setlists.js';

/*
 * Computed selector that returns just the "tonight" Setlist (today gig or
 * promoted next-upcoming gig), or `null` while loading / when neither
 * applies. Built on top of `useSetlists()` + the same pure sectioning
 * function used by the Home route, so they cannot disagree.
 *
 * Story 3.2 creates this hook as foundation for Epic 4 (AR-25) pre-fetch
 * wiring. It is intentionally NOT consumed in the Home UI in this story —
 * the Home route runs `sectionSetlists` itself to obtain all three
 * sections in one pass without redundant work.
 *
 * Returns `Setlist | null` rather than a `UseQueryResult` because callers
 * only care about the derived value; loading state can be inspected via
 * `useSetlists()` directly if needed.
 */
export function useTonightGig(): Setlist | null {
  const setlists = useSetlists();
  if (!setlists.data) return null;
  return sectionSetlists(setlists.data, todayLondon()).tonight;
}
