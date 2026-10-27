import { ChevronRight, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { BandName, PageHeader } from '../components/page-header.js';
import { PageTitle } from '../components/page-title.js';
import { Button } from '../components/ui/button.js';
import { useSongs } from '../hooks/use-songs.js';
import { EXPORT, SONG_FORM, SONGS } from '../lib/microcopy.js';

/*
 * Song list (Story 7.3). Rendered in the order received: the API already
 * sorts A–Z case-insensitively. Cached data wins over a background error.
 * Story 7.17: export link at the foot.
 */
export function Songs() {
  const songs = useSongs();
  const data = songs.data;

  const statusLine =
    data !== undefined && data.length === 0
      ? SONGS.empty
      : data === undefined
        ? songs.isPending
          ? SONGS.loading
          : SONGS.error
        : null;

  return (
    <>
      <PageHeader
        left={<BandName />}
        right={
          <Button asChild variant="ghost" className="text-primary">
            <Link to="/songs/new">
              <Plus aria-hidden="true" />
              {SONG_FORM.addLink}
            </Link>
          </Button>
        }
      />
      <PageTitle>{SONGS.heading}</PageTitle>
      {data !== undefined && data.length > 0 ? (
        <ul className="m-0 mt-[calc(var(--spacing-unit)*2)] list-none p-0">
          {data.map((song) => (
            <li key={song.songId} className="border-b border-border">
              <Link
                to={`/songs/${song.songId}`}
                className="flex min-h-tap items-center justify-between gap-3 py-[calc(var(--spacing-unit)*3)] text-[length:var(--text-row)] leading-[var(--text-row--line-height)] text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
              >
                <span>{song.title}</span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-5 shrink-0 text-muted-foreground"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p
          aria-live="polite"
          className="mt-[calc(var(--spacing-unit)*3)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-muted-foreground"
        >
          {statusLine}
        </p>
      )}
      <footer className="mt-[var(--spacing-section-gap)]">
        {/* Plain <a>, not Link: the router would swallow the click and the download would never fire. */}
        <Button asChild variant="link">
          <a href="/api/v1/export">{EXPORT.link}</a>
        </Button>
      </footer>
    </>
  );
}
