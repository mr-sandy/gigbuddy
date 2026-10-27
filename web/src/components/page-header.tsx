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
