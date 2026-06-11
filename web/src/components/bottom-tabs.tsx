import { NavLink } from 'react-router';

/*
 * iPhone bottom tab bar. Two tabs (FR-24 + UX-DR4 BottomTabs). Hidden in
 * Performance Mode (Story 4.1 via useChromeVisible → AuthenticatedShell
 * doesn't render this component when chrome is hidden). Respects the
 * home-indicator inset via env(safe-area-inset-bottom).
 */
export function BottomTabs() {
  return (
    <nav
      aria-label="Tabs"
      className="fixed bottom-0 left-0 right-0 flex border-t-[1px] border-[color:var(--color-border-hairline)] bg-[color:var(--color-bg)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <NavLink
        to="/"
        end
        aria-label="Setlists tab"
        className={({ isActive }) =>
          `flex min-h-tap min-w-tap flex-1 items-center justify-center py-[calc(var(--spacing-unit)*3)] ${
            isActive
              ? 'text-[color:var(--color-accent)]'
              : 'text-[color:var(--color-text-secondary)]'
          }`
        }
      >
        Setlists
      </NavLink>
      <NavLink
        to="/library"
        aria-label="Library tab"
        className={({ isActive }) =>
          `flex min-h-tap min-w-tap flex-1 items-center justify-center py-[calc(var(--spacing-unit)*3)] ${
            isActive
              ? 'text-[color:var(--color-accent)]'
              : 'text-[color:var(--color-text-secondary)]'
          }`
        }
      >
        Library
      </NavLink>
    </nav>
  );
}
