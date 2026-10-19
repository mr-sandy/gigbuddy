import { Link, useParams } from 'react-router';
import { useSong } from '../hooks/use-song.js';
import { useSongs } from '../hooks/use-songs.js';
import { SONGS } from '../lib/microcopy.js';

/*
 * Song page stub (Story 7.3); content arrives in Story 7.5. Falls back to
 * the list cache so the title shows instantly and works offline.
 */
export function Song() {
  const { songId } = useParams();
  const one = useSong(songId ?? null);
  const list = useSongs();

  const song = one.data ?? list.data?.find((s) => s.songId === songId);
  const statusLine = song
    ? null
    : one.data === null
      ? SONGS.notFound
      : one.isPending || list.isPending
        ? SONGS.loading
        : SONGS.error;

  return (
    <>
      <Link
        to="/songs"
        className="inline-flex min-h-tap items-center text-[length:var(--text-perf-meta)] leading-[var(--text-perf-meta--line-height)] text-[color:var(--color-text-primary)] underline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]"
      >
        {SONGS.backToSongs}
      </Link>
      {song ? (
        <h1 className="mt-[var(--spacing-unit)] text-[length:var(--text-perf-title)] leading-[var(--text-perf-title--line-height)] text-[color:var(--color-text-primary)] [font-family:var(--font-serif-editorial)]">
          {song.title}
        </h1>
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
