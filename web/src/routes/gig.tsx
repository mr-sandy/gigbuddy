import type { Setlist } from '@gigbuddy/shared';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { Link, Outlet, useParams } from 'react-router';
import { PageHeader } from '../components/page-header.js';
import { PageTitle } from '../components/page-title.js';
import { Button } from '../components/ui/button.js';
import { useSetlistOrCached } from '../hooks/use-setlist-or-cached.js';
import { useSongs } from '../hooks/use-songs.js';
import { formatGigDate } from '../lib/gig-date.js';
import { gigSongPath, playOrder } from '../lib/gig-position.js';
import { GIG_FORM, GIG_SETLIST, GIGS, SETLIST_TEXT } from '../lib/microcopy.js';

function EditSetlistButton({ setlistId }: { setlistId: string }) {
  return (
    <Button asChild variant="secondary" size="sm">
      <Link to={`/gigs/${setlistId}/setlist`}>
        <Pencil aria-hidden="true" />
        {SETLIST_TEXT.editLink}
      </Link>
    </Button>
  );
}

const HEADING_ROW =
  'mt-[var(--spacing-section-gap)] flex items-center justify-between gap-[calc(var(--spacing-unit)*4)]';

/*
 * Gig page (Story 7.7 shell, Story 7.8 setlist): venue as the title, date
 * beneath, then the setlist's songs by section, each opening the song page
 * inside the gig. Falls back to the list cache. Rows show each song's current
 * library title (Story 7.29), or the stored snapshot until the songs list has it.
 */
function SetlistSections({ setlist }: { setlist: Setlist }) {
  const { data: songs } = useSongs();
  const titles = new Map((songs ?? []).map((s) => [s.songId, s.title]));
  const firstWithSongs = setlist.sections.findIndex((s) => s.songs.length > 0);
  if (firstWithSongs === -1) {
    return (
      <div className={HEADING_ROW}>
        <p className="m-0 text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-muted-foreground">
          {GIG_SETLIST.empty}
        </p>
        <EditSetlistButton setlistId={setlist.setlistId} />
      </div>
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
            {sectionIndex === firstWithSongs ? (
              <div className={HEADING_ROW}>
                {name ? (
                  <h2 className="m-0 text-[length:var(--text-body)] font-normal leading-[var(--text-body--line-height)] text-muted-foreground">
                    {name}
                  </h2>
                ) : (
                  <div />
                )}
                <EditSetlistButton setlistId={setlist.setlistId} />
              </div>
            ) : name ? (
              <h2 className="m-0 mt-[var(--spacing-section-gap)] text-[length:var(--text-body)] font-normal leading-[var(--text-body--line-height)] text-muted-foreground">
                {name}
              </h2>
            ) : null}
            <ul
              className={`m-0 list-none p-0 ${name || sectionIndex === firstWithSongs ? 'mt-[calc(var(--spacing-unit)*2)]' : 'mt-[var(--spacing-section-gap)]'}`}
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
                    <span>{titles.get(song.songId) ?? song.titleSnapshot}</span>
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
      <PageHeader
        left={
          <Button asChild variant="ghost" className="text-muted-foreground">
            <Link to="/gigs">
              <ChevronLeft aria-hidden="true" />
              {GIGS.backToGigs}
            </Link>
          </Button>
        }
        right={
          setlist ? (
            <Button asChild variant="ghost" className="text-primary">
              <Link to={`/gigs/${setlist.setlistId}/edit`}>
                <Pencil aria-hidden="true" />
                {GIG_FORM.editLink}
              </Link>
            </Button>
          ) : null
        }
      />
      {setlist ? (
        <>
          <PageTitle>{venue || date}</PageTitle>
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
      <Outlet />
    </>
  );
}
