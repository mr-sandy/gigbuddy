import type { Setlist } from '@gigbuddy/shared';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { PageTitle } from '../components/page-title.js';
import { Button } from '../components/ui/button.js';
import { useSetlists } from '../hooks/use-setlists.js';
import { formatGigDate, orderGigs, todayLondon } from '../lib/gig-date.js';
import { GIG_FORM, GIGS } from '../lib/microcopy.js';

/*
 * Gig list (Story 7.7). Upcoming gigs (today or later, London) soonest first,
 * then a "Past" group most recent first. Cached data wins over a background
 * error.
 */
function GigRows({ gigs }: { gigs: Setlist[] }) {
  return (
    <ul className="m-0 mt-[calc(var(--spacing-unit)*2)] list-none p-0">
      {gigs.map((s) => {
        const venue = s.gigMeta.venue.trim();
        const date = formatGigDate(s.gigMeta.date);
        return (
          <li key={s.setlistId} className="border-b border-border">
            <Link
              to={`/gigs/${s.setlistId}`}
              className="flex min-h-tap items-center justify-between gap-3 py-[calc(var(--spacing-unit)*3)] text-[length:var(--text-row)] leading-[var(--text-row--line-height)] text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
            >
              <span>{venue ? `${date} · ${venue}` : date}</span>
              <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function Gigs() {
  const gigs = useSetlists();
  const data = gigs.data;

  const statusLine =
    data !== undefined && data.length === 0
      ? GIGS.empty
      : data === undefined
        ? gigs.isPending
          ? GIGS.loading
          : GIGS.error
        : null;

  const { upcoming, past } = data ? orderGigs(data, todayLondon()) : { upcoming: [], past: [] };

  return (
    <>
      <div className="flex items-center justify-between gap-[calc(var(--spacing-unit)*4)]">
        <Button asChild variant="ghost" className="text-muted-foreground">
          <Link to="/">
            <ChevronLeft aria-hidden="true" />
            {GIGS.backToHome}
          </Link>
        </Button>
        <Button asChild variant="ghost" className="text-primary">
          <Link to="/gigs/new">
            <Plus aria-hidden="true" />
            {GIG_FORM.addLink}
          </Link>
        </Button>
      </div>
      <PageTitle afterBackLink>{GIGS.heading}</PageTitle>
      {data !== undefined && data.length > 0 ? (
        <>
          {upcoming.length > 0 ? <GigRows gigs={upcoming} /> : null}
          {past.length > 0 ? (
            <>
              <h2 className="m-0 mt-[var(--spacing-section-gap)] text-[length:var(--text-body)] font-normal leading-[var(--text-body--line-height)] text-muted-foreground">
                {GIGS.past}
              </h2>
              <GigRows gigs={past} />
            </>
          ) : null}
        </>
      ) : (
        <p
          aria-live="polite"
          className="mt-[calc(var(--spacing-unit)*3)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-muted-foreground"
        >
          {statusLine}
        </p>
      )}
    </>
  );
}
