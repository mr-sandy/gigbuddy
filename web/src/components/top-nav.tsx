import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { BandLabel } from './band-label.js';

interface TopNavProps {
  /** Slot for additional action items appended after Library. Empty in Epic 1.
   *  Story 3.4 mounts `+ New setlist` here without modifying this component. */
  rightActions?: ReactNode;
}

/*
 * MacBook top nav (UX-DR4 Top nav). Renders the passive Band label on the
 * left and the primary nav items on the right, with a hairline divider
 * underneath. Hidden on iPhone (handled by `AuthenticatedShell` device
 * branch). Hidden during Performance Mode via `useChromeVisible()`.
 *
 * `rightActions` is the slot Story 3.4 mounts `+ New setlist` into; this
 * component does NOT need to change to accept new action items.
 */
export function TopNav({ rightActions }: TopNavProps) {
  return (
    <header className="border-b-[1px] border-[color:var(--color-border-hairline)]">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-[960px] items-center justify-between px-[var(--spacing-gutter)] py-[calc(var(--spacing-unit)*4)]"
      >
        <BandLabel />
        <ul className="flex items-center gap-[calc(var(--spacing-unit)*6)]">
          <li>
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive
                  ? 'text-[color:var(--color-accent)]'
                  : 'text-[color:var(--color-text-secondary)]'
              }
            >
              Setlists
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/library"
              className={({ isActive }) =>
                isActive
                  ? 'text-[color:var(--color-accent)]'
                  : 'text-[color:var(--color-text-secondary)]'
              }
            >
              Library
            </NavLink>
          </li>
          {rightActions ? <li>{rightActions}</li> : null}
        </ul>
      </nav>
    </header>
  );
}
