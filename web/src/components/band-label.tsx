import { ACTIVE_BAND_NAME } from '../lib/band.js';

/*
 * Passive informational label in the MacBook top nav (UX-DR4 BandLabel).
 * Renders as a non-interactive <span>: no tabindex, no role, no aria-*,
 * no cursor: pointer. Not focusable, not navigable by screen reader as
 * a control (it is announced as plain text content). FR-26 / story 1.5
 * AC-1: this label MUST remain inert in V1.
 */
export function BandLabel() {
  return (
    <span className="text-[length:var(--text-home-tonight)] leading-[var(--text-home-tonight--line-height)] text-[color:var(--color-text-primary)] [font-family:var(--font-serif-editorial)]">
      GigBuddy · {ACTIVE_BAND_NAME}
    </span>
  );
}
