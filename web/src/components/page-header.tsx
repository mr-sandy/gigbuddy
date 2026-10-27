import { ACTIVE_BAND_NAME } from '@gigbuddy/shared';
import type { ReactNode } from 'react';

/*
 * The header every signed-in page starts with (STYLE.md "Header"): `left` and
 * `right` slots on one row, a hairline under it. It bleeds across the gutters
 * so the hairline runs edge to edge on a phone, while ghost-button text (10px
 * side padding) still lines up with the 16px gutter. Empty slots keep `right`
 * on the right.
 */
export function PageHeader({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="-mx-[var(--spacing-gutter)] mb-[calc(var(--spacing-unit)*4)] flex min-h-header items-center justify-between gap-[calc(var(--spacing-unit)*4)] border-b border-border px-[calc(var(--spacing-gutter)-10px)]">
      <div>{left}</div>
      <div>{right}</div>
    </header>
  );
}

/* The band name on the list pages: plain text until the settings sheet (7.22). */
export function BandName() {
  return (
    <p className="m-0 px-2.5 text-[length:var(--text-nav)] leading-[var(--text-nav--line-height)] text-foreground [font-family:var(--font-serif-editorial)]">
      {ACTIVE_BAND_NAME}
    </p>
  );
}
