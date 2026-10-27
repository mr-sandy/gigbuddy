import { NavLink } from 'react-router';
import { GIGS, SONGS } from '../lib/microcopy.js';
import { cn } from '../lib/utils.js';

/*
 * Songs | Gigs, fixed to the bottom of the two list pages (STYLE.md "Tab bar").
 * Nav links, not Buttons, without `end` so a tab stays lit behind an add sheet. Each tab carries the home-indicator padding with
 * `box-content` (as the play bar does) so the 60px sits above the indicator.
 */
const TABS = [
  { to: '/songs', label: SONGS.heading },
  { to: '/gigs', label: GIGS.heading },
] as const;

export function TabBar() {
  return (
    <nav
      aria-label="Lists"
      className="fixed inset-x-0 bottom-0 border-t border-border bg-background"
    >
      <div className="flex justify-center">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                'box-content -mt-px flex min-h-tab-bar max-w-[12rem] flex-1 items-center justify-center border-t-[3px] pb-[env(safe-area-inset-bottom)] text-[length:var(--text-nav)] leading-[var(--text-nav--line-height)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                isActive
                  ? 'border-primary font-semibold text-foreground'
                  : 'border-transparent text-muted-foreground',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
