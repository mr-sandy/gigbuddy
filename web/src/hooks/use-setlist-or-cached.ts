import type { Setlist } from '@gigbuddy/shared';
import { GIGS } from '../lib/microcopy.js';
import { useSetlist } from './use-setlist.js';
import { useSetlists } from './use-setlists.js';

/*
 * Resolves one gig for a page: the single-setlist query wins, the list cache
 * fills in while it loads. When no gig is available, `statusLine` says why
 * (not found / loading / error).
 */
export function useSetlistOrCached(setlistId: string | undefined): {
  setlist: Setlist | undefined;
  statusLine: string | null;
} {
  const one = useSetlist(setlistId ?? null);
  const list = useSetlists();

  const setlist = one.data ?? list.data?.find((s) => s.setlistId === setlistId);
  const statusLine = setlist
    ? null
    : one.data === null
      ? GIGS.notFound
      : one.isPending || list.isPending
        ? GIGS.loading
        : GIGS.error;
  return { setlist, statusLine };
}
