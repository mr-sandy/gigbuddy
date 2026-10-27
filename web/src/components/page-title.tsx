import type { ReactNode } from 'react';

/*
 * The one <h1> on every page (STYLE.md "Page title"). Routes never set their
 * own title size.
 */
export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1
      className={`text-[length:var(--text-page-title)] leading-[var(--text-page-title--line-height)] text-foreground [font-family:var(--font-serif-editorial)]`}
    >
      {children}
    </h1>
  );
}
