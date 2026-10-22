import { Link, useParams } from 'react-router';
import { PageTitle } from '../components/page-title.js';
import { useSong } from '../hooks/use-song.js';
import { useSongs } from '../hooks/use-songs.js';
import { SONGS } from '../lib/microcopy.js';

/*
 * Song page (Story 7.3 shell, Story 7.5 content): title, key/patch line and
 * the chord chart verbatim. Falls back to the list cache so the title shows
 * instantly and works offline.
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

  const keyAndPatch = song
    ? [song.key, song.patch]
        .map((v) => v?.trim())
        .filter(Boolean)
        .join(' · ')
    : '';
  const hasChart = Boolean(song?.chordChart?.trim());

  return (
    <>
      <Link
        to="/songs"
        className="inline-flex min-h-tap items-center text-[length:var(--text-row)] leading-[var(--text-row--line-height)] text-[color:var(--color-text-primary)] underline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]"
      >
        {SONGS.backToSongs}
      </Link>
      {song ? (
        <>
          <PageTitle afterBackLink>{song.title}</PageTitle>
          {keyAndPatch ? (
            <p className="mt-[calc(var(--spacing-unit)*4)] text-[length:var(--text-reading)] leading-[var(--text-reading--line-height)] text-[color:var(--color-text-secondary)]">
              {keyAndPatch}
            </p>
          ) : null}
          {hasChart ? (
            <p
              data-testid="chord-chart"
              className="mt-[calc(var(--spacing-unit)*4)] whitespace-pre-wrap [overflow-wrap:anywhere] text-[length:var(--text-reading)] leading-[var(--text-reading--line-height)] text-[color:var(--color-text-primary)]"
            >
              {song.chordChart}
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
