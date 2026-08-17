import { type JSX, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChordChart } from '../components/chord-chart.js';
import { JumpOverlay } from '../components/jump-overlay.js';
import { useSetlist } from '../hooks/use-setlist.js';
import { useSong } from '../hooks/use-song.js';
import { EMPTY_STATES, PERFORMANCE_CARD } from '../lib/microcopy.js';
import {
  useActiveDetourSongId,
  usePerformanceActive,
  useSetActiveDetourSongId,
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
 *   │  ‹   ≡ jump   NEXT ›         │   shrink-0   swipe nav (AC-9/10).
 *   └──────────────────────────────┘              fixed bottom toolbar:
 *                                                  three controls, no
 *                                                  next-song preview span
 *                                                  (Story 6.3 removed the
 *                                                  Story 4.1 preview).
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
 *
 * Story 6.3 additions: `≡ jump` control in the bottom toolbar A2
 * placement; the toolbar's next-song preview span was removed.
 *
 * Story 6.4 additions: jump overlay wired to `onSelectSong` sets a
 * component-local detour override; `displaySongId`/`displaySongRef`
 * fetch and render the jumped-to song WITHOUT changing the URL /
 * plan cursor.
 *
 * Story 6.5 additions: the detour override was promoted out of
 * component-local state into `PerformanceModeContext` (survives `×` →
 * `Resume ›` remount, AC-6). The top-right position slot swaps from
 * `<n> / <total>` to the word `DETOUR` while detoured (D3 lock —
 * dropped-numeric, no hairline). The `‹` button becomes contextual:
 * while detoured, it undoes the jump (clears the override, no
 * navigation) rather than decrementing the plan cursor (AC-4). The
 * within-mount clearing effect is mount-preserving — it skips the
 * first render so `Resume ›`'s remount does not immediately wipe a
 * persisted detour.
 *
 * Story 6.6 additions: `NEXT ›` no longer unconditionally navigates
 * on tap. When the plan cursor sits on the last song of a non-final
 * section, tapping `NEXT ›` opens the jump overlay in "section-break"
 * orientation mode — no `navigate()`, no plan-cursor change. The
 * overlay carries a bottom-fixed `Start <sectionName> ›` CTA which,
 * when tapped (or when the auto-highlighted first-row of the next
 * section is tapped), fires the SAME `navigate()` call the shipped
 * `NEXT ›` used to fire directly. `overlayMode` replaces the boolean
 * `isJumpOverlayOpen` so the same JumpOverlay instance can be opened
 * in either `'jump'` (the toolbar's `≡ jump` control) or
 * `'section-break'` (auto-opened `NEXT ›` at a section boundary)
 * modes — one component, three contexts (mid-perf jump, section-break,
 * setlist-overview).
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

  // Story 6.3 / 6.6 — local UI state gating the jump overlay's mount.
  // Deliberately component-local (NOT PerformanceModeContext), matching
  // the sheetOpen pattern in setlist-song-row.tsx: the overlay's
  // open/closed-ness is transient single-route UI state that dies with
  // this component instance. Three-state mode replaces the Story 6.3
  // boolean so the same JumpOverlay can be opened in either 'jump'
  // (toolbar `≡ jump`) or 'section-break' (auto-opened `NEXT ›` at a
  // section boundary) modes.
  const [overlayMode, setOverlayMode] = useState<'closed' | 'jump' | 'section-break'>('closed');

  // Story 6.5 — detour override promoted into `PerformanceModeContext`
  // (was component-local `useState` in Story 6.4). The override must
  // survive the × exit → Resume › remount so the strip can signal the
  // detour on the overview and the card resumes with `DETOUR` in the
  // position slot (AC-6). See `performance-context.tsx` for the full
  // rationale.
  const activeDetourSongId = useActiveDetourSongId();
  const setActiveDetourSongId = useSetActiveDetourSongId();

  const parsedSongIndex = useMemo(() => {
    const parsed = Number.parseInt(songIndex ?? '', 10);
    return Number.isNaN(parsed) ? -1 : parsed;
  }, [songIndex]);

  // Story 6.5 — mount-preserving clearing effect. Compares against the
  // values captured at mount so a fresh mount (Start performance ›, cold
  // relaunch, or Resume › after × mid-detour) does NOT wipe a persisted
  // `activeDetourSongId` that Sandy explicitly wants preserved. Only
  // within-mount `parsedSongIndex` / `setlistId` changes (Sandy tapping
  // `NEXT ›` / `‹` while the card stays mounted) trigger the clear.
  // Value-based (not ref-flag-based) detection is deliberate: an
  // `isInitialRenderRef` boolean that flips on first setup gets
  // corrupted by React StrictMode's dev-only double-invoke (setup →
  // cleanup → setup preserves the fiber's ref state, so the second
  // setup mis-classifies as a re-render and clears the override on the
  // very first mount). `setlistId` is included defensively — no current
  // navigation path can reach a within-mount `setlistId` change without
  // going through `setPerformanceSession()` first (which resets the
  // override).
  const initialSongIndexRef = useRef(parsedSongIndex);
  const initialSetlistIdRef = useRef(setlistId);
  useEffect(() => {
    if (
      parsedSongIndex !== initialSongIndexRef.current ||
      setlistId !== initialSetlistIdRef.current
    ) {
      setActiveDetourSongId(null);
    }
  }, [parsedSongIndex, setlistId, setActiveDetourSongId]);

  const { data: setlist } = useSetlist(setlistId ?? null);

  const flatSongs = useMemo(() => {
    if (setlist === undefined || setlist === null) return [];
    return setlist.sections.flatMap((s) => s.songs);
  }, [setlist]);

  // Story 6.6 — `sectionBreakInfo` derives whether `parsedSongIndex` is
  // the LAST flat index of some section AND a next non-empty section
  // exists. Guard the setlist-loading branch even though the isLoading
  // return above already short-circuits render — hooks must run
  // unconditionally on every render, including loading-state renders.
  // The scan skips empty sections defensively so a `Set 1` → empty
  // interlude → `Set 2` layout still resolves the next non-empty
  // section as the target.
  const sectionBreakInfo = useMemo<{
    nextSectionName: string;
    nextSectionFirstSongId: string;
  } | null>(() => {
    if (setlist === undefined || setlist === null) return null;
    let cursor = -1;
    for (let i = 0; i < setlist.sections.length; i++) {
      const section = setlist.sections[i];
      if (section === undefined || section.songs.length === 0) continue;
      cursor += section.songs.length;
      if (cursor !== parsedSongIndex) continue;
      for (let j = i + 1; j < setlist.sections.length; j++) {
        const nextSection = setlist.sections[j];
        const firstSong = nextSection?.songs[0];
        if (nextSection !== undefined && firstSong !== undefined) {
          return {
            nextSectionName: nextSection.name,
            nextSectionFirstSongId: firstSong.songId,
          };
        }
      }
      return null;
    }
    return null;
  }, [setlist, parsedSongIndex]);

  const currentSongRef = flatSongs[parsedSongIndex];
  // Story 6.4 — `displaySongId` overrides the plan cursor for FETCH +
  // DISPLAY only. `displaySongRef` is used ONLY for the per-gig
  // annotation lookup (a library-only detour target may have no
  // matching SongRef, in which case no annotation renders).
  const displaySongId = activeDetourSongId ?? currentSongRef?.songId ?? null;
  const displaySongRef =
    activeDetourSongId !== null
      ? flatSongs.find((s) => s.songId === activeDetourSongId)
      : currentSongRef;
  const { data: song } = useSong(displaySongId);

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

  // Story 6.4 fix — a failed detour-target fetch (library-only song, cold
  // cache, no signal) must NOT tear down the Performance Card. The effect
  // below clears the detour when its target resolves to null; while that
  // clear is in flight we render the quiet loading skeleton (not the
  // not-found page) so wake lock, plan cursor, and atmosphere are all
  // preserved. Only a plan-cursor `song === null` (no detour active) is a
  // genuine not-found.
  useEffect(() => {
    if (song === null && activeDetourSongId !== null) {
      setActiveDetourSongId(null);
    }
  }, [song, activeDetourSongId, setActiveDetourSongId]);

  const isLoading =
    setlist === undefined ||
    (displaySongId !== null && song === undefined) ||
    (song === null && activeDetourSongId !== null);
  const notFound =
    setlist === null ||
    parsedSongIndex < 0 ||
    currentSongRef === undefined ||
    (song === null && activeDetourSongId === null);

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
  const isFirst = parsedSongIndex === 0;
  // Story 4.4 — last-Song detection. When true, `NEXT ›` is rendered
  // inert (disabled visual + no-op onClick) per FR-21 and the locked
  // memory note. NEXT › must NEVER transform into an end-performance
  // action at the last Song — prefer inert/disabled. Sandy ends
  // Performance state only by navigating away from the active Setlist
  // chain (the navigate-away guard, Story 4.4, owns that path).
  const isLast = parsedSongIndex === flatSongs.length - 1;
  // Story 6.5 — `isDetour` gates the D3 position-slot swap and the
  // contextual `‹` semantics. `NEXT ›` deliberately does NOT branch on
  // this — it already keys off `parsedSongIndex` (the plan cursor), so
  // AC-3 / AC-5 already fall out for free once the clearing effect fires
  // on the resulting URL change.
  const isDetour = activeDetourSongId !== null;
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
              aria-label={
                isDetour
                  ? PERFORMANCE_CARD.ariaOnDetour
                  : PERFORMANCE_CARD.ariaSongPosition(currentPosition, totalSongs)
              }
              className="text-[length:var(--text-perf-meta)] leading-[var(--text-perf-meta--line-height)] font-[family-name:var(--font-mono-slab)] text-[color:var(--color-text-secondary)]"
            >
              {isDetour ? (
                PERFORMANCE_CARD.detourLabel
              ) : (
                <>
                  {currentPosition} / {totalSongs}
                </>
              )}
            </span>
          </div>
        </div>
        <h1 className="mt-[calc(var(--spacing-unit)*2)] text-[length:var(--text-perf-title)] leading-[var(--text-perf-title--line-height)] font-[family-name:var(--font-serif-editorial)] text-[color:var(--color-text-primary)]">
          {song?.title ?? ''}
        </h1>
        {(song?.key !== undefined && song.key !== '') ||
        (song?.patch !== undefined && song.patch !== '') ? (
          // Story 6.2 (AC-1) — single inline row, no `KEY`/`PATCH` labels, no
          // bordered/shaded container. Key and patch share font family
          // (mono-slab) and colour (text-secondary), but the key is typeset
          // at the larger `--text-perf-meta` (22px) and the patch at the
          // smaller `--text-perf-body` (18px) — both are already-shipped
          // invariant type-scale tokens (no new tokens introduced). Missing
          // key or patch is rendered gracefully (empty slot, no placeholder);
          // when both are absent the row is omitted entirely by the outer
          // conditional above (AC-2, unchanged from the shipped behaviour).
          <div className="mt-[calc(var(--spacing-unit)*2)] flex flex-wrap items-baseline gap-[calc(var(--spacing-unit)*4)] font-[family-name:var(--font-mono-slab)] text-[color:var(--color-text-secondary)]">
            {song?.key !== undefined && song.key !== '' ? (
              <span className="text-[length:var(--text-perf-meta)] leading-[var(--text-perf-meta--line-height)]">
                {song.key}
              </span>
            ) : null}
            {song?.patch !== undefined && song.patch !== '' ? (
              <span className="text-[length:var(--text-perf-body)] leading-[var(--text-perf-body--line-height)]">
                {song.patch}
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      {/* Scrollable middle — ChordChart + per-gig annotation. No tap or
          swipe handlers wired here (AC-9, AC-10). Default touch scroll
          is the only interaction. */}
      <main className="flex-1 overflow-y-auto px-[var(--spacing-gutter)] py-[calc(var(--spacing-unit)*3)]">
        <ChordChart text={chordChartText} urlsTappable={false} />
        {displaySongRef?.perGigAnnotation !== undefined &&
        displaySongRef.perGigAnnotation !== '' ? (
          <p className="mt-[calc(var(--spacing-unit)*4)] text-[length:var(--text-perf-annotation)] leading-[var(--text-perf-annotation--line-height)] font-[family-name:var(--font-serif-editorial)] italic text-[color:var(--color-accent)]">
            {displaySongRef.perGigAnnotation}
          </p>
        ) : null}
      </main>

      {/* Fixed bottom toolbar — does not scroll. Spatial separation per
          UX-DR9: ‹ on the left, NEXT › on the right, `≡ jump` between
          them (interior, no preview span — removed in Story 6.3). Three
          controls, four-corners rule intact (‹ bottom-left, NEXT ›
          bottom-right; `≡ jump` never occupies a corner). */}
      <footer
        className="shrink-0 flex items-center gap-[calc(var(--spacing-unit)*3)] bg-[color:var(--color-surface)] px-[var(--spacing-gutter)] py-[calc(var(--spacing-unit)*3)]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        {/* Story 6.5 — `‹` is contextual. On the plan cursor it behaves
            as shipped (navigates to `parsedSongIndex - 1`, disabled on
            first song). While detoured it "undoes the jump" — clears the
            override with NO `navigate()` call, so the return-anchor at
            `parsedSongIndex` reappears with its plan-cursor position
            slot restored (AC-4). Undo is always available while
            detoured, regardless of the return anchor's position, so the
            `disabled` gate is skipped when `isDetour` is true (AC-5). */}
        <button
          type="button"
          aria-label={PERFORMANCE_CARD.ariaPreviousSong}
          disabled={!isDetour && isFirst}
          aria-disabled={!isDetour && isFirst}
          onClick={() => {
            if (isDetour) {
              setActiveDetourSongId(null);
              return;
            }
            if (isFirst) return;
            navigate(`/performance/${setlistId}/${parsedSongIndex - 1}`);
          }}
          className="min-h-tap min-w-tap text-[length:var(--text-perf-meta)] leading-[var(--text-perf-meta--line-height)] text-[color:var(--color-text-secondary)] disabled:opacity-40"
        >
          {PERFORMANCE_CARD.previousSong}
        </button>
        {/* Story 6.3 — `≡ jump` control, A2 placement. Low-emphasis to
            match ‹ (same type-scale, same text-secondary colour); no
            accent fill (that treatment is reserved for NEXT ›). `flex-1`
            + centred contents keeps the glyph visually centred in the
            toolbar interior regardless of the width of the flanking
            controls. Opens the JumpOverlay by setting local UI state —
            no context mutation, no navigate call. */}
        <button
          type="button"
          aria-label={PERFORMANCE_CARD.ariaOpenJumpOverlay}
          onClick={() => setOverlayMode('jump')}
          className="flex-1 min-h-tap min-w-tap text-[length:var(--text-perf-meta)] leading-[var(--text-perf-meta--line-height)] text-[color:var(--color-text-secondary)]"
        >
          {PERFORMANCE_CARD.jumpButton}
        </button>
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
            // Story 6.6 — at a section boundary (parsedSongIndex is the
            // last flat index of some section AND a next non-empty
            // section exists), open the jump overlay in
            // section-break mode instead of navigating directly. The
            // overlay's CTA (or the highlighted target row) will then
            // fire the same `navigate()` call that used to fire here.
            if (sectionBreakInfo !== null) {
              setOverlayMode('section-break');
              return;
            }
            navigate(`/performance/${setlistId}/${parsedSongIndex + 1}`);
          }}
          className="min-h-tap rounded-[var(--radius-button)] bg-[color:var(--color-accent)] px-[calc(var(--spacing-unit)*4)] text-[length:var(--text-section-heading)] leading-[var(--text-section-heading--line-height)] font-[family-name:var(--font-serif-editorial)] text-[color:var(--color-bg)] disabled:opacity-40"
        >
          {PERFORMANCE_CARD.nextSong}
        </button>
      </footer>
      {/* Story 6.3 — jump overlay renders on top of the card (fixed
          inset-0 z-50 inside the component). The card itself stays
          mounted underneath — wake lock, performanceActive, and the plan
          cursor are all unaffected by the overlay lifecycle. */}
      {overlayMode !== 'closed' ? (
        <JumpOverlay
          sections={setlist.sections}
          currentSongId={displaySongId ?? ''}
          onDismiss={() => setOverlayMode('closed')}
          onSelectSong={(songId) => {
            // Story 6.4 — selecting the plan-cursor's own row clears any
            // override (returns to plan); selecting anything else sets
            // the override. The URL / plan cursor is never touched here.
            // Story 6.5 — the setter is now the context-backed
            // `setActiveDetourSongId`; the logic is identical.
            setActiveDetourSongId(songId === currentSongRef?.songId ? null : songId);
          }}
          // Story 6.6 — pass `sectionBreak` via a spread so the prop is
          // OMITTED (not passed as `undefined`) when the overlay is in
          // `'jump'` mode. This respects `exactOptionalPropertyTypes`
          // and matches the `dragProps` spread precedent in
          // `setlist-overview.tsx`. `onEnterSection` reuses the exact
          // same `navigate()` expression the shipped `NEXT ›` used to
          // fire directly for this transition — Story 4.1's math is
          // unchanged; only the trigger moved from "immediate tap" to
          // "CTA / target-row tap in the auto-opened overlay."
          {...(overlayMode === 'section-break' && sectionBreakInfo !== null
            ? {
                sectionBreak: {
                  targetSongId: sectionBreakInfo.nextSectionFirstSongId,
                  sectionName: sectionBreakInfo.nextSectionName,
                  onEnterSection: () => {
                    navigate(`/performance/${setlistId}/${parsedSongIndex + 1}`);
                  },
                },
              }
            : {})}
        />
      ) : null}
    </div>
  );
}
