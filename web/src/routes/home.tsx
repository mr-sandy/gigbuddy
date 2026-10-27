import { ACTIVE_BAND_NAME } from '@gigbuddy/shared';
import { Link } from 'react-router';
import { PageTitle } from '../components/page-title.js';
import { useSetlists } from '../hooks/use-setlists.js';
import { useSongs } from '../hooks/use-songs.js';
import { formatCounts } from '../lib/counts.js';
import { GIGS, HOME, SONGS } from '../lib/microcopy.js';

/*
 * Landing page (Story 7.1). Shows cached data over a background error —
 * per the architecture's offline-cache rule, the app always renders
 * something useful from cache when it has it.
 */
export function Home() {
  const songs = useSongs();
  const gigs = useSetlists();

  const bodyLine =
    songs.data !== undefined && gigs.data !== undefined
      ? formatCounts(songs.data.length, gigs.data.length)
      : songs.isPending || gigs.isPending
        ? HOME.loading
        : HOME.error;

  return (
    <>
      <PageTitle>GigBuddy</PageTitle>
      <p className="mt-[calc(var(--spacing-unit)*3)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-muted-foreground">
        {ACTIVE_BAND_NAME}
      </p>
      <p
        aria-live="polite"
        className="mt-[var(--spacing-unit)] tabular-nums text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-muted-foreground"
      >
        {bodyLine}
      </p>
      <div className="mt-[var(--spacing-section-gap)] flex flex-col">
        <Link
          to="/songs"
          className="inline-flex min-h-tap items-center text-[length:var(--text-row)] leading-[var(--text-row--line-height)] text-foreground underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          {SONGS.heading}
        </Link>
        <Link
          to="/gigs"
          className="inline-flex min-h-tap items-center text-[length:var(--text-row)] leading-[var(--text-row--line-height)] text-foreground underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          {GIGS.heading}
        </Link>
      </div>
    </>
  );
}
