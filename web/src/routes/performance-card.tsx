import { type JSX, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChordChart } from '../components/chord-chart.js';
import { useSetlist } from '../hooks/use-setlist.js';
import { useSong } from '../hooks/use-song.js';
import { EMPTY_STATES, PERFORMANCE_CARD } from '../lib/microcopy.js';

/*
 * Performance Card route — Story 4.1 (FR-15, FR-16, FR-17, UX-DR4, UX-DR9).
 *
 * URL: `/performance/:setlistId/:songIndex` (flat index across all
 * Sections — Section boundaries are display-only). The route renders the
 * three-region Performance Card on a single Song:
 *
 *   ┌──────────────────────────────┐   shrink-0   ← fixed top chrome:
 *   │  title · key · patch         │              title + key + patch
 *   ├──────────────────────────────┤
 *   │                              │              ← scrollable middle:
 *   │  chord chart                 │   flex-1     ChordChart + per-gig
 *   │  per-gig annotation          │   overflow-y annotation. Default
 *   │                              │              touch scroll only —
 *   ├──────────────────────────────┤              no tap-anywhere or
 *   │  ‹  | next  | NEXT ›         │   shrink-0   swipe nav (AC-9/10).
 *   └──────────────────────────────┘              fixed bottom toolbar:
 *                                                  ‹ + preview + NEXT ›
 *
 * Atmosphere: on mount the route flips `data-atmosphere` on <html> to
 * `'performance'` (Club Warm palette) and restores the previous value on
 * unmount. On iPhone the default boot atmosphere is already 'performance'
 * (Story 1.2) so this is idempotent; on MacBook (dev only) it correctly
 * switches.
 *
 * Viewport zoom: on mount we patch the viewport `<meta>` to disable
 * `user-scalable` for the duration of the route (AC-11). Restored on
 * unmount.
 *
 * Focus management: on mount focus is moved to the `NEXT ›` button per
 * UX-DR6 (primary action; expected next gesture). `noAutofocus` Biome
 * rule prohibits the React `autoFocus` prop, so we use a ref +
 * `useEffect`.
 *
 * Last-Song behaviour: Story 4.4 owns the inert-`NEXT ›`-on-last-Song
 * treatment (disabled visual, aria-disabled, no-op onClick, suppressed
 * preview). Story 4.1 leaves `NEXT ›` always-enabled — if Sandy lands on
 * `songIndex == flatSongs.length` the route falls through to the
 * graceful not-found branch below.
 *
 * The `×` exit button (top-left) and the persistent wake-lock indicator
 * are introduced by Story 4.3 and Story 4.2 respectively. The
 * placeholder comments below mark their landing zones.
 */
export function PerformanceCard(): JSX.Element {
  const { setlistId, songIndex } = useParams<{ setlistId: string; songIndex: string }>();
  const navigate = useNavigate();
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  const parsedSongIndex = useMemo(() => {
    const parsed = Number.parseInt(songIndex ?? '', 10);
    return Number.isNaN(parsed) ? -1 : parsed;
  }, [songIndex]);

  const { data: setlist } = useSetlist(setlistId ?? null);

  const flatSongs = useMemo(() => {
    if (setlist === undefined || setlist === null) return [];
    return setlist.sections.flatMap((s) => s.songs);
  }, [setlist]);

  const currentSongRef = flatSongs[parsedSongIndex];
  const { data: song } = useSong(currentSongRef?.songId ?? null);

  // Atmosphere flip — runs once on mount, restores on unmount. The boot
  // atmosphere is set by `applyBootAtmosphere()` (iPhone → 'performance',
  // MacBook → 'practice'); we capture whatever is currently set so the
  // restore is exact.
  useEffect(() => {
    const prev = document.documentElement.dataset.atmosphere ?? 'practice';
    document.documentElement.dataset.atmosphere = 'performance';
    return () => {
      document.documentElement.dataset.atmosphere = prev;
    };
  }, []);

  // Viewport zoom suppression — AC-11. We mutate the existing viewport
  // meta tag rather than inserting a new one so the rest of the document
  // (login, library, etc.) keeps its default scaling behaviour after we
  // unmount.
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (!meta) return;
    const prev = meta.content;
    meta.content = 'width=device-width, initial-scale=1.0, user-scalable=no';
    return () => {
      meta.content = prev;
    };
  }, []);

  // Focus management on entry (AC-12). Runs once on mount; subsequent
  // re-renders (navigating between songs) do not steal focus a second
  // time.
  useEffect(() => {
    nextButtonRef.current?.focus();
  }, []);

  const isLoading = setlist === undefined || (currentSongRef !== undefined && song === undefined);
  const notFound =
    setlist === null || parsedSongIndex < 0 || currentSongRef === undefined || song === null;

  if (isLoading) {
    // Quiet skeleton — no spinner, no copy. Cache should be warm after
    // `useStartPerformance` prefetch (NFR-2 budget).
    return <div className="flex h-dvh flex-col bg-[color:var(--color-bg)]" />;
  }

  if (notFound) {
    // Graceful not-found state for an invalid setlist or out-of-bounds
    // songIndex (e.g. last-Song `NEXT ›` overshoot in this story window —
    // Story 4.4 lands the proper inert-NEXT treatment).
    return (
      <div className="flex h-dvh flex-col bg-[color:var(--color-bg)]">
        <main className="flex-1 px-[var(--spacing-gutter)] py-[calc(var(--spacing-unit)*3)]">
          <p className="text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-text-primary)]">
            {EMPTY_STATES.setlistNotFound}
          </p>
        </main>
      </div>
    );
  }

  // After the guards above, `song` is the loaded Song record and
  // `currentSongRef` is the matching SongRef from the Setlist.
  const totalSongs = flatSongs.length;
  const currentPosition = parsedSongIndex + 1; // 1-based for the indicator
  const nextSongRef = flatSongs[parsedSongIndex + 1] ?? null;
  const isFirst = parsedSongIndex === 0;
  const chordChartText = song?.chordChart ?? '';

  return (
    <div className="flex h-dvh flex-col bg-[color:var(--color-bg)] text-[color:var(--color-text-primary)]">
      {/* Fixed top chrome — does not scroll. */}
      <header
        className="shrink-0 bg-[color:var(--color-surface)] px-[var(--spacing-gutter)] py-[calc(var(--spacing-unit)*4)]"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}
      >
        {/* × exit: Story 4.3 lands the button here (top-left). */}
        <div className="flex items-start justify-between">
          <h1 className="text-[length:var(--text-perf-title)] leading-[var(--text-perf-title--line-height)] font-[family-name:var(--font-serif-editorial)] text-[color:var(--color-text-primary)]">
            {song?.title ?? ''}
          </h1>
          {/* Position indicator — `role="status"` makes the span an accepted
              host for aria-label (Biome a11y rule
              `useAriaPropsSupportedByRole`) and gives assistive tech a live
              announcement of the current position. */}
          <span
            role="status"
            aria-label={PERFORMANCE_CARD.ariaSongPosition(currentPosition, totalSongs)}
            className="ml-[calc(var(--spacing-unit)*2)] shrink-0 text-[length:var(--text-perf-meta)] leading-[var(--text-perf-meta--line-height)] font-[family-name:var(--font-mono-slab)] text-[color:var(--color-text-secondary)]"
          >
            {currentPosition} / {totalSongs}
          </span>
        </div>
        {(song?.key !== undefined && song.key !== '') ||
        (song?.patch !== undefined && song.patch !== '') ? (
          <div className="mt-[calc(var(--spacing-unit)*2)] flex flex-wrap gap-[calc(var(--spacing-unit)*4)] text-[length:var(--text-perf-meta)] leading-[var(--text-perf-meta--line-height)] font-[family-name:var(--font-mono-slab)] text-[color:var(--color-text-secondary)]">
            {song?.key !== undefined && song.key !== '' ? <span>{song.key}</span> : null}
            {song?.patch !== undefined && song.patch !== '' ? <span>{song.patch}</span> : null}
          </div>
        ) : null}
      </header>

      {/* Scrollable middle — ChordChart + per-gig annotation. No tap or
          swipe handlers wired here (AC-9, AC-10). Default touch scroll
          is the only interaction. */}
      <main className="flex-1 overflow-y-auto px-[var(--spacing-gutter)] py-[calc(var(--spacing-unit)*3)]">
        <ChordChart text={chordChartText} urlsTappable={false} />
        {currentSongRef.perGigAnnotation !== undefined && currentSongRef.perGigAnnotation !== '' ? (
          <p className="mt-[calc(var(--spacing-unit)*4)] text-[length:var(--text-perf-annotation)] leading-[var(--text-perf-annotation--line-height)] font-[family-name:var(--font-serif-editorial)] italic text-[color:var(--color-accent)]">
            {currentSongRef.perGigAnnotation}
          </p>
        ) : null}
      </main>

      {/* Fixed bottom toolbar — does not scroll. Spatial separation per
          UX-DR9: ‹ on the left, NEXT › on the right, preview between
          them. */}
      <footer
        className="shrink-0 flex items-center gap-[calc(var(--spacing-unit)*3)] bg-[color:var(--color-surface)] px-[var(--spacing-gutter)] py-[calc(var(--spacing-unit)*3)]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        <button
          type="button"
          aria-label={PERFORMANCE_CARD.ariaPreviousSong}
          disabled={isFirst}
          aria-disabled={isFirst}
          onClick={() => {
            if (isFirst) return;
            navigate(`/performance/${setlistId}/${parsedSongIndex - 1}`);
          }}
          className="min-h-tap min-w-tap text-[length:var(--text-perf-meta)] leading-[var(--text-perf-meta--line-height)] text-[color:var(--color-text-secondary)] disabled:opacity-40"
        >
          {PERFORMANCE_CARD.previousSong}
        </button>
        <span
          aria-hidden="true"
          className="flex-1 truncate text-[length:var(--text-perf-meta)] leading-[var(--text-perf-meta--line-height)] font-[family-name:var(--font-mono-slab)] text-[color:var(--color-text-secondary)]"
        >
          {nextSongRef?.titleSnapshot ?? ''}
        </span>
        <button
          ref={nextButtonRef}
          type="button"
          aria-label={PERFORMANCE_CARD.ariaNextSong}
          onClick={() => navigate(`/performance/${setlistId}/${parsedSongIndex + 1}`)}
          className="min-h-tap rounded-[var(--radius-button)] bg-[color:var(--color-accent)] px-[calc(var(--spacing-unit)*4)] text-[length:var(--text-section-heading)] leading-[var(--text-section-heading--line-height)] font-[family-name:var(--font-serif-editorial)] text-[color:var(--color-bg)]"
        >
          {PERFORMANCE_CARD.nextSong}
        </button>
      </footer>
    </div>
  );
}
