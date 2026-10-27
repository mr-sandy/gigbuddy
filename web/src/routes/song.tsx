import type { Setlist } from '@gigbuddy/shared';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { PageHeader } from '../components/page-header.js';
import { PageTitle } from '../components/page-title.js';
import { Button } from '../components/ui/button.js';
import { useSetlistOrCached } from '../hooks/use-setlist-or-cached.js';
import { useSongOrCached } from '../hooks/use-song-or-cached.js';
import { useWakeLock } from '../hooks/use-wake-lock.js';
import { gigSongPath, playOrder, resolvePlace } from '../lib/gig-position.js';
import { GIG_PLAY, GIG_SETLIST, SONG_FORM, SONGS, WAKE_LOCK } from '../lib/microcopy.js';
import { cn } from '../lib/utils.js';

/*
 * Song page (Story 7.3 shell, Story 7.5 content): title, key/patch line and
 * the chord chart verbatim. Falls back to the list cache so the title shows
 * instantly and works offline. Under /gigs/:setlistId/songs/:songId (Story 7.8)
 * it is the same page with "Back to gig" and no Edit link, plus (Story 7.14)
 * a fixed bottom bar of two chevron tap regions (Story 7.19) stepping
 * previous/next through the gig's setlist.
 * Both routes keep the screen awake while open (Story 7.15).
 */
function GigPlayBar({ setlist, place }: { setlist: Setlist; place: number }) {
  const order = playOrder(setlist);
  const region =
    'box-content flex min-h-play-bar max-w-[18rem] flex-1 items-center justify-center pb-[env(safe-area-inset-bottom)] [-webkit-tap-highlight-color:transparent]';
  const step = (index: number, label: string, Icon: typeof ChevronLeft) =>
    index >= 0 && index < order.length ? (
      <Button
        asChild
        variant="ghost"
        className={cn(region, 'h-auto rounded-none px-0 active:bg-primary/15')}
      >
        <Link replace to={gigSongPath(setlist.setlistId, order, index)} aria-label={label}>
          <Icon aria-hidden="true" strokeWidth={2.25} className="size-7.5 text-primary" />
        </Link>
      </Button>
    ) : (
      // biome-ignore lint/a11y/useFocusableInteractive: inert end, deliberately not focusable (Story 7.19)
      // biome-ignore lint/a11y/useSemanticElements: an <a> without href would still be announced as a plain link; aria-disabled marks it unavailable
      <span role="link" aria-disabled="true" aria-label={label} className={region}>
        <Icon
          aria-hidden="true"
          strokeWidth={2.25}
          className="size-7.5 text-muted-foreground opacity-30"
        />
      </span>
    );
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-background">
      <div className="flex items-stretch justify-center">
        {step(place - 1, GIG_PLAY.previousSong, ChevronLeft)}
        <span className="flex items-center whitespace-nowrap border-x border-border px-3.5 pb-[env(safe-area-inset-bottom)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] tabular-nums text-muted-foreground">
          {GIG_PLAY.position(place + 1, order.length)}
        </span>
        {step(place + 1, GIG_PLAY.nextSong, ChevronRight)}
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
  const wakeLock = useWakeLock();

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
          ? 'pb-[calc(var(--spacing-play-bar)+1px+var(--spacing-unit)*4+env(safe-area-inset-bottom))]'
          : undefined
      }
    >
      <PageHeader
        left={
          <Button asChild variant="ghost" className="text-muted-foreground">
            <Link to={setlistId ? `/gigs/${setlistId}` : '/songs'}>
              <ChevronLeft aria-hidden="true" />
              {setlistId ? GIG_SETLIST.backToGig : SONGS.backToSongs}
            </Link>
          </Button>
        }
        right={
          song && !setlistId ? (
            <Button asChild variant="ghost" className="text-primary">
              <Link to={`/songs/${song.songId}/edit`}>
                <Pencil aria-hidden="true" />
                {SONG_FORM.editLink}
              </Link>
            </Button>
          ) : null
        }
      />
      {wakeLock.failed ? (
        <p className="mt-[calc(var(--spacing-unit)*2)] text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-muted-foreground">
          {WAKE_LOCK.maySleep}
        </p>
      ) : null}
      {song ? (
        <>
          <PageTitle>{song.title}</PageTitle>
          {keyAndPatch ? (
            <p className="mt-[calc(var(--spacing-unit)*4)] text-[length:var(--text-reading)] leading-[var(--text-reading--line-height)] text-muted-foreground">
              {keyAndPatch}
            </p>
          ) : null}
          {hasChart ? (
            <p
              data-testid="chord-chart"
              className="mt-[calc(var(--spacing-unit)*4)] whitespace-pre-wrap [overflow-wrap:anywhere] text-[length:var(--text-reading)] leading-[var(--text-reading--line-height)] text-foreground"
            >
              {song.chordChart}
            </p>
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
      {showBar ? <GigPlayBar setlist={setlist} place={place} /> : null}
    </div>
  );
}
