import { Link } from 'react-router';
import { useSongs } from '../hooks/use-songs.js';
import { SONGS } from '../lib/microcopy.js';

/*
 * Song list (Story 7.3). Rendered in the order received: the API already
 * sorts A–Z case-insensitively. Cached data wins over a background error.
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
      <Link
        to="/"
        className="inline-flex min-h-tap items-center text-[length:var(--text-perf-meta)] leading-[var(--text-perf-meta--line-height)] text-[color:var(--color-text-primary)] underline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]"
      >
        {SONGS.backToHome}
      </Link>
      <h1 className="mt-[var(--spacing-unit)] text-[length:var(--text-home-tonight)] leading-[var(--text-home-tonight--line-height)] text-[color:var(--color-text-primary)] [font-family:var(--font-serif-editorial)]">
        {SONGS.heading}
      </h1>
      {data !== undefined && data.length > 0 ? (
        <ul className="m-0 mt-[calc(var(--spacing-unit)*2)] list-none p-0">
          {data.map((song) => (
            <li key={song.songId} className="border-b border-[color:var(--color-border-hairline)]">
              <Link
                to={`/songs/${song.songId}`}
                className="block min-h-tap py-[calc(var(--spacing-unit)*3)] text-[length:var(--text-perf-meta)] leading-[var(--text-perf-meta--line-height)] text-[color:var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]"
              >
                {song.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p
          aria-live="polite"
          className="mt-[calc(var(--spacing-unit)*3)] text-[length:var(--text-perf-body)] leading-[var(--text-perf-body--line-height)] text-[color:var(--color-text-secondary)]"
        >
          {statusLine}
        </p>
      )}
    </>
  );
}
