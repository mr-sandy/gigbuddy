import type { Setlist } from '@gigbuddy/shared';
import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { PageTitle } from '../components/page-title.js';
import { useSetlistOrCached } from '../hooks/use-setlist-or-cached.js';
import { useSongOrCached } from '../hooks/use-song-or-cached.js';
import { gigSongPath, playOrder, resolvePlace } from '../lib/gig-position.js';
import { GIG_PLAY, GIG_SETLIST, SONG_FORM, SONGS } from '../lib/microcopy.js';

/*
 * Song page (Story 7.3 shell, Story 7.5 content): title, key/patch line and
 * the chord chart verbatim. Falls back to the list cache so the title shows
 * instantly and works offline. Under /gigs/:setlistId/songs/:songId (Story 7.8)
 * it is the same page with "Back to gig" and no Edit link, plus (Story 7.14)
 * a fixed bottom bar stepping Previous/Next through the gig's setlist.
 */
const LINK_CLASS =
  'inline-flex min-h-tap min-w-[var(--spacing-tap)] items-center text-[length:var(--text-row)] leading-[var(--text-row--line-height)]';

function GigPlayBar({ setlist, place }: { setlist: Setlist; place: number }) {
  const order = playOrder(setlist);
  const step = (index: number, label: string, align: string) =>
    index >= 0 && index < order.length ? (
      <Link
        replace
        to={gigSongPath(setlist.setlistId, order, index)}
        className={`${LINK_CLASS} ${align} text-[color:var(--color-text-primary)] underline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]`}
      >
        {label}
      </Link>
    ) : (
      <span
        aria-disabled="true"
        className={`${LINK_CLASS} ${align} text-[color:var(--color-text-secondary)]`}
      >
        {label}
      </span>
    );
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-[color:var(--color-text-secondary)] bg-[var(--color-bg)] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-[40rem] items-center justify-between px-[var(--spacing-gutter)] py-[calc(var(--spacing-unit)*2)]">
        {step(place - 1, GIG_PLAY.previous, 'justify-start')}
        <span className="text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[color:var(--color-text-secondary)]">
          {GIG_PLAY.position(place + 1, order.length)}
        </span>
        {step(place + 1, GIG_PLAY.next, 'justify-end')}
      </div>
    </nav>
  );
}

export function Song() {
  const { songId, setlistId } = useParams();
  const [searchParams] = useSearchParams();
  const at = searchParams.get('at');
  const { song, statusLine } = useSongOrCached(songId);
  const { setlist } = useSetlistOrCached(setlistId);
  const place =
    setlistId && setlist && songId ? resolvePlace(playOrder(setlist), songId, at) : null;
  const showBar = setlist !== undefined && place !== null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: songId and at are the trigger; Next re-renders this same mounted page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [songId, at]);

  const keyAndPatch = song
    ? [song.key, song.patch]
        .map((v) => v?.trim())
        .filter(Boolean)
        .join(' · ')
    : '';
  const hasChart = Boolean(song?.chordChart?.trim());

  return (
    <div
      className={
        showBar
          ? 'pb-[calc(var(--spacing-tap)+var(--spacing-unit)*4+env(safe-area-inset-bottom))]'
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-[calc(var(--spacing-unit)*4)]">
        <Link
          to={setlistId ? `/gigs/${setlistId}` : '/songs'}
          className="inline-flex min-h-tap items-center text-[length:var(--text-row)] leading-[var(--text-row--line-height)] text-[color:var(--color-text-primary)] underline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]"
        >
          {setlistId ? GIG_SETLIST.backToGig : SONGS.backToSongs}
        </Link>
        {song && !setlistId ? (
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
      {showBar ? <GigPlayBar setlist={setlist} place={place} /> : null}
    </div>
  );
}
