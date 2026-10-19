import type { ReactNode } from 'react';

/*
 * The one <h1> on every page (STYLE.md "Page title"). Routes never set their
 * own title size.
 */
export function PageTitle({
  children,
  afterBackLink = false,
}: {
  children: ReactNode;
  afterBackLink?: boolean;
}) {
  return (
    <h1
      className={`${afterBackLink ? 'mt-[var(--spacing-unit)] ' : ''}text-[length:var(--text-page-title)] leading-[var(--text-page-title--line-height)] text-[color:var(--color-text-primary)] [font-family:var(--font-serif-editorial)]`}
    >
      {children}
    </h1>
  );
}
