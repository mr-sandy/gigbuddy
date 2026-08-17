import { type JSX, useEffect, useState } from 'react';

/*
 * JumpOverlay — Story 6.3 (P1 jump-affordance A2 lock, minimal shell).
 *
 * Full-screen overlay ("on top of the performance card") reached by tapping
 * the `≡ jump` control in the Performance Card's bottom toolbar. This story
 * ships a MINIMAL SHELL only:
 *
 *   ┌──────────────────────────────┐   shrink-0   ← top chrome (dismiss only):
 *   │  ‹                           │              ‹ top-left, low-emphasis
 *   ├──────────────────────────────┤
 *   │                              │              ← empty content region:
 *   │  (empty in Story 6.3)        │   flex-1     Story 6.4 fills this with
 *   │                              │              pinned search + sectioned
 *   │                              │              setlist overview + library
 *   │                              │              reach.
 *   └──────────────────────────────┘
 *
 * Explicitly out of scope for this story:
 *   - no search field, no setlist rows, no library rows (Story 6.4)
 *   - no bottom tab bar, no top nav (Club Warm performance atmosphere)
 *   - no wake-lock indicator on the overlay chrome (the indicator stays
 *     exactly where it already is, in the underlying PerformanceCard header
 *     — the card is not unmounted, only visually painted over)
 *   - no API calls / no data fetching (AC-4 auth-hold rule is satisfied
 *     structurally by having nothing to 401)
 *
 * State ownership: overlay open/closed is single-route local UI state in
 * PerformanceCard's `useState<boolean>` — deliberately NOT part of
 * PerformanceModeContext (which is reserved for the four cross-cutting
 * fields: performanceActive, activeSetlistId, activeSongIndex,
 * performanceView). Mirrors the sheetOpen pattern in setlist-song-row.tsx.
 *
 * Positioning: `fixed inset-0` (full-screen), not `fixed inset-x-0 bottom-0`
 * (bottom sheet). The AnnotationSheet in setlist-song-row.tsx is a bottom
 * sheet — we reuse its `role="dialog" aria-modal="true"` accessibility
 * pattern but NOT its positioning.
 *
 * Transition: real 150ms opacity fade on mount and dismiss (AC-3). Mount
 * paints at `opacity-0`, a `useEffect` flips to `opacity-100` in a
 * requestAnimationFrame so the browser sees a distinct starting frame.
 * Dismiss sets `opacity-0` and defers the parent's `onDismiss` callback by
 * 150ms via setTimeout so the fade-out plays before React unmounts the DOM
 * node. `prefers-reduced-motion` is handled globally by the rule in
 * `globals.css` (zeroes `transition-duration` on every `*` selector) — this
 * component inherits that automatically; no story-specific override needed.
 * (The setTimeout still runs at 150ms even under reduced-motion — the fade
 * itself is instant, so the visible effect is a 150ms delay before unmount.
 * That is acceptable for a MotionOK-style trade-off; a follow-up story can
 * shorten the timer under reduced-motion if it becomes noticeable.)
 */

type JumpOverlayProps = {
  onDismiss: () => void;
};

export function JumpOverlay({ onDismiss }: JumpOverlayProps): JSX.Element {
  // Mount fade: start at opacity-0, then flip to opacity-100 after the
  // first paint. A requestAnimationFrame + microtask defer gives the
  // browser a distinct starting frame so the transition actually runs.
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  function handleDismiss(): void {
    if (closing) return;
    setClosing(true);
    // Wait for the fade-out to complete before telling the parent to
    // unmount. Matches the Tailwind `duration-150` on the root.
    setTimeout(() => {
      onDismiss();
    }, 150);
  }

  const visible = mounted && !closing;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Jump to a song"
      className={`fixed inset-0 z-50 flex flex-col bg-[color:var(--color-bg)] text-[color:var(--color-text-primary)] transition-opacity duration-150 ease-out ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Top chrome — dismiss control only (Club Warm, no top nav). The
          left-anchored ‹ mirrors the PerformanceCard's own bottom-left
          previous-song control but its aria-label is intentionally
          different so VoiceOver announces the two ‹ glyphs distinctly. */}
      <div
        className="shrink-0 bg-[color:var(--color-surface)] px-[var(--spacing-gutter)] py-[calc(var(--spacing-unit)*4)]"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}
      >
        <button
          type="button"
          aria-label="Dismiss jump overlay"
          onClick={handleDismiss}
          className="min-h-tap min-w-tap text-[length:var(--text-perf-meta)] leading-[var(--text-perf-meta--line-height)] text-[color:var(--color-text-secondary)]"
        >
          ‹
        </button>
      </div>

      {/*
       * Content region — deliberately empty in Story 6.3. Story 6.4 fills
       * this with the pinned search field + scrolling sectioned setlist
       * overview + `In library` results group. No bottom tab bar, no other
       * chrome: the shell renders exactly the top dismiss row and this
       * empty flex-1 region, per AC-3.
       */}
      <div className="flex-1" />
    </div>
  );
}
