import { Link, useParams } from 'react-router';
import { PageTitle } from '../components/page-title.js';
import { useSetlistOrCached } from '../hooks/use-setlist-or-cached.js';
import { formatGigDate } from '../lib/gig-date.js';
import { GIGS } from '../lib/microcopy.js';

/*
 * Gig page (Story 7.7 shell): venue as the title, date beneath. The setlist
 * itself arrives in a later story. Falls back to the list cache.
 */
export function Gig() {
  const { setlistId } = useParams();
  const { setlist, statusLine } = useSetlistOrCached(setlistId);

  const venue = setlist?.gigMeta.venue.trim() ?? '';
  const date = setlist ? formatGigDate(setlist.gigMeta.date) : '';

  return (
    <>
      <Link
        to="/gigs"
        className="inline-flex min-h-tap items-center text-[length:var(--text-row)] leading-[var(--text-row--line-height)] text-[color:var(--color-text-primary)] underline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]"
      >
        {GIGS.backToGigs}
      </Link>
      {setlist ? (
        <>
          <PageTitle afterBackLink>{venue || date}</PageTitle>
          {venue ? (
            <p className="mt-[calc(var(--spacing-unit)*4)] text-[length:var(--text-reading)] leading-[var(--text-reading--line-height)] text-[color:var(--color-text-secondary)]">
              {date}
            </p>
          ) : null}
        </>
      ) : (
        <p
          aria-live="polite"
          className="mt-[calc(var(--spacing-unit)*3)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[color:var(--color-text-secondary)]"
        >
          {statusLine}
        </p>
      )}
    </>
  );
}
