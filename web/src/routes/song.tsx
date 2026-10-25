import { Link, useParams } from 'react-router';
import { PageTitle } from '../components/page-title.js';
import { useSongOrCached } from '../hooks/use-song-or-cached.js';
import { SONG_FORM, SONGS } from '../lib/microcopy.js';

/*
 * Song page (Story 7.3 shell, Story 7.5 content): title, key/patch line and
 * the chord chart verbatim. Falls back to the list cache so the title shows
 * instantly and works offline.
 */
export function Song() {
  const { songId } = useParams();
  const { song, statusLine } = useSongOrCached(songId);

  const keyAndPatch = song
    ? [song.key, song.patch]
        .map((v) => v?.trim())
        .filter(Boolean)
        .join(' · ')
    : '';
  const hasChart = Boolean(song?.chordChart?.trim());

  return (
    <>
      <div className="flex items-center justify-between gap-[calc(var(--spacing-unit)*4)]">
        <Link
          to="/songs"
          className="inline-flex min-h-tap items-center text-[length:var(--text-row)] leading-[var(--text-row--line-height)] text-[color:var(--color-text-primary)] underline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]"
        >
          {SONGS.backToSongs}
        </Link>
        {song ? (
          <Link
            to={`/songs/${song.songId}/edit`}
            className="inline-flex min-h-tap items-center text-[length:var(--text-row)] leading-[var(--text-row--line-height)] text-[color:var(--color-text-primary)] underline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]"
          >
            {SONG_FORM.editLink}
          </Link>
        ) : null}
      </div>
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
