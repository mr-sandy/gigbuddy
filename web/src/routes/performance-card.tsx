import { type JSX, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChordChart } from '../components/chord-chart.js';
import { useSetlist } from '../hooks/use-setlist.js';
import { useSong } from '../hooks/use-song.js';
import { EMPTY_STATES, PERFORMANCE_CARD } from '../lib/microcopy.js';
import {
  usePerformanceActive,
  useSetActiveSongIndex,
  useSetPerformanceActive,
  useSetPerformanceView,
} from '../performance/performance-context.js';
import { useWakeLockIndicator } from '../performance/use-wake-lock-indicator.js';

/*
 * Performance Card route — Story 4.1 (FR-15, FR-16, FR-17, UX-DR4, UX-DR9).
 *
 * URL: `/performance/:setlistId/:songIndex` (flat index across all
 * Sections — Section boundaries are display-only). The route renders the
 * three-region Performance Card on a single Song:
 *
 *   ┌──────────────────────────────┐   shrink-0   ← fixed top chrome:
 *   │  ×           wake · n/N      │              × top-left, position
 *   │  title                       │              top-right, title on
 *   │  key · patch                 │              its own row below.
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
 * Last-Song behaviour (Story 4.4, FR-21): on the last Song, `NEXT ›` is
 * rendered inert — `disabled` + `aria-disabled="true"` + no-op onClick +
 * `disabled:opacity-40` styling. The next-song preview is empty (no
 * "End of setlist" copy — silent per Voice & Tone). NEXT › must NEVER
 * transform into a terminating action at the last Song (locked memory
 * note); Sandy ends Performance state exclusively by navigating away
 * from the active Setlist chain. Out-of-bounds `songIndex` (e.g. a stale
 * URL) still falls through to the graceful not-found branch below.
 *
 * Story 4.3 additions: × exit button (top-left of the header) navigates
 * back to `/setlists/:setlistId` without ending Performance state (FR-19
 * state preservation — `setActive(false)` and `wakeLock.release()` are
 * NOT called). Performance view + session pointer in context are kept in
 * sync as Sandy navigates between songs so the `CurrentlyPerformingStrip`
 * on the overview renders the correct Song title and `Resume ›` returns
 * to the preserved index.
 */
export function PerformanceCard(): JSX.Element {
  const { setlistId, songIndex } = useParams<{ setlistId: string; songIndex: string }>();
  const navigate = useNavigate();
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  // Story 4.2 — subscribe to the wake-lock state. The hook also calls
  // `wakeLock.acquire()` on mount (additive to the entry-path acquire in
  // `useStartPerformance`) so the lock is reacquired after card remount,
  // e.g. on Story 4.3 Resume ›.
  const { wakeLockHeld } = useWakeLockIndicator();
  // Story 4.3 — mark the current view as `'card'` so chrome (bottom tabs
  // on iPhone) stays hidden, and keep the context `activeSongIndex` in
  // sync with the URL `:songIndex` so the strip on the overview surfaces
  // the correct Song title and `Resume ›` returns to the preserved
  // index.
  const setPerformanceView = useSetPerformanceView();
  const setActiveSongIndex = useSetActiveSongIndex();
  // Story 4.5 (AC-8) — on cold-relaunch the session-resume marker in
  // `main.tsx` rewrites the URL to `/performance/...` before React mounts,
  // but `useStartPerformance` (the only other caller of `setActive(true)`)
  // never runs on that path. Without this mount-effect, `performanceActive`
  // would stay false on relaunch: chrome would show, 401 would redirect to
  // `/login`, and Wake Lock would not reacquire — all AR-28 violations.
  // The setter is idempotent (no-op when already true), so this is also
  // safe when entered via the normal `Start performance ›` path.
  const performanceActive = usePerformanceActive();
  const setPerformanceActive = useSetPerformanceActive();

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

  // Story 4.3 — mark `performanceView` = 'card' on mount so chrome stays
  // hidden, and clear it on unmount so a subsequent route (the Setlist
  // overview after × exit, or any post-end navigation) can re-decide the
  // view. Resetting to `null` is correct: the overview itself sets the
  // value to `'overview'` when it detects active performance for the
  // matching setlistId.
  useEffect(() => {
    setPerformanceView('card');
    return () => {
      setPerformanceView(null);
    };
  }, [setPerformanceView]);

  // Story 4.5 (AC-8) — ensure `performanceActive` is true while this
  // route is mounted. Story 4.4's `endPerformance` is the only place
  // that flips it back to false (on real navigate-away); unmounting the
  // card via × exit must NOT clear the flag (the strip on the overview
  // still needs it). So no cleanup here.
  useEffect(() => {
    if (!performanceActive) {
      setPerformanceActive(true);
    }
  }, [performanceActive, setPerformanceActive]);

  // Story 4.3 — mirror the URL `:songIndex` into the context
  // `activeSongIndex` so the `CurrentlyPerformingStrip` on the overview
  // surfaces the currently-playing Song title and `Resume ›` returns to
  // the preserved index after × exit.
  useEffect(() => {
    if (parsedSongIndex >= 0) {
      setActiveSongIndex(parsedSongIndex);
    }
  }, [parsedSongIndex, setActiveSongIndex]);

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
  // On the last Song, `nextSongRef` is `null` (out-of-bounds index) so the
  // preview `<span>` below renders an empty string — silent per Voice &
  // Tone (no "End of setlist" copy). Story 4.4 also disables `NEXT ›` so
  // the button can't navigate past the end.
  const nextSongRef = flatSongs[parsedSongIndex + 1] ?? null;
  const isFirst = parsedSongIndex === 0;
  // Story 4.4 — last-Song detection. When true, `NEXT ›` is rendered
  // inert (disabled visual + no-op onClick) per FR-21 and the locked
  // memory note. NEXT › must NEVER transform into an end-performance
  // action at the last Song — prefer inert/disabled. Sandy ends
  // Performance state only by navigating away from the active Setlist
  // chain (the navigate-away guard, Story 4.4, owns that path).
  const isLast = parsedSongIndex === flatSongs.length - 1;
  const chordChartText = song?.chordChart ?? '';

  return (
    <div className="flex h-dvh flex-col bg-[color:var(--color-bg)] text-[color:var(--color-text-primary)]">
      {/* Fixed top chrome — does not scroll. */}
      <header
        className="shrink-0 bg-[color:var(--color-surface)] px-[var(--spacing-gutter)] py-[calc(var(--spacing-unit)*4)]"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}
      >
        {/* Story 4.3 — top row: × exit (top-left) | wake-lock indicator +
            position indicator (top-right). The four Performance Card
            controls live in four separate corners per UX-DR9: × top-left,
            position indicator top-right, ‹ bottom-left, NEXT › bottom-right. */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label={PERFORMANCE_CARD.ariaExitPerformance}
            onClick={() => navigate(`/setlists/${setlistId}`)}
            className="min-h-tap min-w-tap flex items-center justify-center text-[length:var(--text-perf-meta)] leading-[var(--text-perf-meta--line-height)] text-[color:var(--color-text-secondary)]"
          >
            {PERFORMANCE_CARD.exitButton}
          </button>
          {/* Right-hand slot — wake-lock indicator (Story 4.2, conditional)
              then position indicator (Story 4.1, always present). The
              wake-lock indicator sits inside the position indicator so the
              position number stays at the far right edge for consistent
              spatial scanning. */}
          <div className="flex shrink-0 items-center gap-[calc(var(--spacing-unit)*2)]">
            {/* Wake-lock indicator — Story 4.2 (FR-18, NFR-27, UX-DR6).
                Static, no animation, no onClick. `aria-live="assertive"`
                announces "Screen may sleep" once on first appearance. */}
            {!wakeLockHeld && (
              <span
                role="status"
                aria-live="assertive"
                aria-atomic="true"
                aria-label={PERFORMANCE_CARD.ariaWakeLockNotHeld}
                className="text-[length:var(--text-perf-meta)] leading-[var(--text-perf-meta--line-height)] text-[color:var(--color-text-secondary)]"
              >
                ☽
              </span>
            )}
            {/* Position indicator — `role="status"` makes the span an
                accepted host for aria-label (Biome a11y rule
                `useAriaPropsSupportedByRole`) and gives assistive tech a
                live announcement of the current position. */}
            <span
              role="status"
              aria-label={PERFORMANCE_CARD.ariaSongPosition(currentPosition, totalSongs)}
              className="text-[length:var(--text-perf-meta)] leading-[var(--text-perf-meta--line-height)] font-[family-name:var(--font-mono-slab)] text-[color:var(--color-text-secondary)]"
            >
              {currentPosition} / {totalSongs}
            </span>
          </div>
        </div>
        <h1 className="mt-[calc(var(--spacing-unit)*2)] text-[length:var(--text-perf-title)] leading-[var(--text-perf-title--line-height)] font-[family-name:var(--font-serif-editorial)] text-[color:var(--color-text-primary)]">
          {song?.title ?? ''}
        </h1>
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
        {/* Story 4.4 — last-Song NEXT › is inert (disabled visual + no-op
            onClick). Mirrors the existing `‹`/`isFirst` pattern above for
            defence-in-depth. NEXT › must NEVER transform into a
            terminating action at the last Song (FR-21, locked memory
            note). Sandy ends Performance state via navigate-away only;
            the × exit (Story 4.3) PRESERVES state. */}
        <button
          ref={nextButtonRef}
          type="button"
          aria-label={PERFORMANCE_CARD.ariaNextSong}
          disabled={isLast}
          aria-disabled={isLast}
          onClick={() => {
            if (isLast) return;
            navigate(`/performance/${setlistId}/${parsedSongIndex + 1}`);
          }}
          className="min-h-tap rounded-[var(--radius-button)] bg-[color:var(--color-accent)] px-[calc(var(--spacing-unit)*4)] text-[length:var(--text-section-heading)] leading-[var(--text-section-heading--line-height)] font-[family-name:var(--font-serif-editorial)] text-[color:var(--color-bg)] disabled:opacity-40"
        >
          {PERFORMANCE_CARD.nextSong}
        </button>
      </footer>
    </div>
  );
}
