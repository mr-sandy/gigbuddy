import { Link } from 'react-router';
import { PageTitle } from '../components/page-title.js';
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
      <div className="flex items-center justify-between gap-[calc(var(--spacing-unit)*4)]">
        <Link
          to="/"
          className="inline-flex min-h-tap items-center text-[length:var(--text-row)] leading-[var(--text-row--line-height)] text-[color:var(--color-text-primary)] underline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]"
        >
          {SONGS.backToHome}
        </Link>
        <Link
          to="/songs/new"
          className="inline-flex min-h-tap items-center text-[length:var(--text-row)] leading-[var(--text-row--line-height)] text-[color:var(--color-text-primary)] underline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]"
        >
          {SONG_FORM.addLink}
        </Link>
      </div>
      <PageTitle afterBackLink>{SONGS.heading}</PageTitle>
      {data !== undefined && data.length > 0 ? (
        <ul className="m-0 mt-[calc(var(--spacing-unit)*2)] list-none p-0">
          {data.map((song) => (
            <li key={song.songId} className="border-b border-[color:var(--color-border-hairline)]">
              <Link
                to={`/songs/${song.songId}`}
                className="block min-h-tap py-[calc(var(--spacing-unit)*3)] text-[length:var(--text-row)] leading-[var(--text-row--line-height)] text-[color:var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]"
              >
                {song.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p
          aria-live="polite"
          className="mt-[calc(var(--spacing-unit)*3)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[color:var(--color-text-secondary)]"
        >
          {statusLine}
        </p>
      )}
      <footer className="mt-[var(--spacing-section-gap)]">
        {/* Plain <a>, not Link: the router would swallow the click and the download would never fire. */}
        <a
          href="/api/v1/export"
          className="inline-flex min-h-tap items-center text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[color:var(--color-text-secondary)] underline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]"
        >
          {EXPORT.link}
        </a>
      </footer>
    </>
  );
}
