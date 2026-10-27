import type { Setlist } from '@gigbuddy/shared';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { PageTitle } from '../components/page-title.js';
import { Button } from '../components/ui/button.js';
import { useSetlistOrCached } from '../hooks/use-setlist-or-cached.js';
import { formatGigDate } from '../lib/gig-date.js';
import { gigSongPath, playOrder } from '../lib/gig-position.js';
import { GIG_FORM, GIG_SETLIST, GIGS, SETLIST_TEXT } from '../lib/microcopy.js';

/*
 * Gig page (Story 7.7 shell, Story 7.8 setlist): venue as the title, date
 * beneath, then the setlist's songs by section, each opening the song page
 * inside the gig. Falls back to the list cache.
 */
function SetlistSections({ setlist }: { setlist: Setlist }) {
  const sections = setlist.sections.filter((s) => s.songs.length > 0);
  if (sections.length === 0) {
    return (
      <p className="mt-[var(--spacing-section-gap)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-muted-foreground">
        {GIG_SETLIST.empty}
      </p>
    );
  }
  const order = playOrder(setlist);
  let offset = 0;
  return (
    <>
      {setlist.sections.map((section, sectionIndex) => {
        const start = offset;
        offset += section.songs.length;
        if (section.songs.length === 0) return null;
        const name = section.name.trim();
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: static list; sections have no id
          <div key={sectionIndex}>
            {name ? (
              <h2 className="m-0 mt-[var(--spacing-section-gap)] text-[length:var(--text-body)] font-normal leading-[var(--text-body--line-height)] text-muted-foreground">
                {name}
              </h2>
            ) : null}
            <ul
              className={`m-0 list-none p-0 ${name ? 'mt-[calc(var(--spacing-unit)*2)]' : 'mt-[var(--spacing-section-gap)]'}`}
            >
              {section.songs.map((song, songIndex) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: a song may repeat in a setlist
                  key={`${sectionIndex}-${songIndex}`}
                  className="border-b border-border"
                >
                  <Link
                    to={gigSongPath(setlist.setlistId, order, start + songIndex)}
                    className="flex min-h-tap items-center justify-between gap-3 py-[calc(var(--spacing-unit)*3)] text-[length:var(--text-row)] leading-[var(--text-row--line-height)] text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                  >
                    <span>{song.titleSnapshot}</span>
                    <ChevronRight
                      aria-hidden="true"
                      className="size-5 shrink-0 text-muted-foreground"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}

export function Gig() {
  const { setlistId } = useParams();
  const { setlist, statusLine } = useSetlistOrCached(setlistId);

  const venue = setlist?.gigMeta.venue.trim() ?? '';
  const date = setlist ? formatGigDate(setlist.gigMeta.date) : '';

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-[calc(var(--spacing-unit)*4)]">
        <Button asChild variant="ghost" className="text-muted-foreground">
          <Link to="/gigs">
            <ChevronLeft aria-hidden="true" />
            {GIGS.backToGigs}
          </Link>
        </Button>
        {setlist ? (
          <div className="flex flex-wrap items-center gap-[calc(var(--spacing-unit)*4)]">
            <Button asChild variant="ghost" className="text-primary">
              <Link to={`/gigs/${setlist.setlistId}/setlist`}>
                <Pencil aria-hidden="true" />
                {SETLIST_TEXT.editLink}
              </Link>
            </Button>
            <Button asChild variant="ghost" className="text-primary">
              <Link to={`/gigs/${setlist.setlistId}/edit`}>
                <Pencil aria-hidden="true" />
                {GIG_FORM.editLink}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
      {setlist ? (
        <>
          <PageTitle afterBackLink>{venue || date}</PageTitle>
          {venue ? (
            <p className="mt-[calc(var(--spacing-unit)*4)] text-[length:var(--text-reading)] leading-[var(--text-reading--line-height)] text-muted-foreground">
              {date}
            </p>
          ) : null}
          <SetlistSections setlist={setlist} />
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
