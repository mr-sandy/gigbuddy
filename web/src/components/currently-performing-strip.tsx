import { forwardRef, type Ref } from 'react';
import { CURRENTLY_PERFORMING } from '../lib/microcopy.js';

/*
 * CurrentlyPerformingStrip — Story 4.3 (FR-19, FR-20, UX-DR4, UX-DR6).
 *
 * Top-anchored strip on the active Setlist's overview while Performance
 * Mode is active. Visible only when the user has tapped `×` to exit the
 * Performance Card without ending Performance state (FR-19 state
 * preservation). The strip surfaces the current Song title with a
 * right-aligned `Resume ›` affordance returning to the preserved Song
 * index.
 *
 * Locked visual treatment (UX-DR4):
 *   - Accent background, bg text — high-contrast band sitting above the
 *     gig metadata header
 *   - Approximately 48pt tall (`minHeight: '48pt'`) — comfortably above
 *     the 44pt tap-target minimum (NFR-20)
 *   - `Currently performing:` label + Song title left, `Resume ›` button
 *     right
 *
 * Accessibility (UX-DR6):
 *   - `role="region"` + `aria-label` so screen readers announce the
 *     strip's purpose
 *   - `Resume ›` button uses an explicit aria-label for parity with the
 *     other Performance Mode controls
 *   - The Resume button accepts a forwarded ref so the overview route can
 *     restore focus to it after × exit (AC-10).
 *
 * Story scope: the strip is presentational only — visibility logic and
 * Song title derivation live in `setlist-overview.tsx`.
 */
interface CurrentlyPerformingStripProps {
  currentSongTitle: string;
  onResume: () => void;
}

function CurrentlyPerformingStripImpl(
  { currentSongTitle, onResume }: CurrentlyPerformingStripProps,
  ref: Ref<HTMLButtonElement>,
) {
  // A `<section>` with `aria-label` automatically carries the `region`
  // role and satisfies Biome's `useSemanticElements` rule.
  return (
    <section
      aria-label={CURRENTLY_PERFORMING.ariaRegion}
      className="flex items-center justify-between gap-[calc(var(--spacing-unit)*3)] bg-[color:var(--color-accent)] px-[var(--spacing-gutter)] text-[color:var(--color-bg)]"
      style={{ minHeight: '48pt' }}
    >
      <p className="text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] font-[family-name:var(--font-serif-editorial)]">
        <span className="font-[family-name:var(--font-mono-slab)]">
          {CURRENTLY_PERFORMING.label}
        </span>{' '}
        {currentSongTitle}
      </p>
      <button
        ref={ref}
        type="button"
        aria-label={CURRENTLY_PERFORMING.ariaResumeButton}
        onClick={onResume}
        className="min-h-tap min-w-tap text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] font-[family-name:var(--font-serif-editorial)] text-[color:var(--color-bg)]"
      >
        {CURRENTLY_PERFORMING.resumeButton}
      </button>
    </section>
  );
}

export const CurrentlyPerformingStrip = forwardRef<
  HTMLButtonElement,
  CurrentlyPerformingStripProps
>(CurrentlyPerformingStripImpl);
CurrentlyPerformingStrip.displayName = 'CurrentlyPerformingStrip';
