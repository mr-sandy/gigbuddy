import { Outlet } from 'react-router';
import { TabBar } from '../components/tab-bar.js';

/*
 * Pathless layout for `/songs` and `/gigs` only (Story 7.20): the tab bar is
 * structural, so no other page can show it. Padding clears the bar, its
 * border, 16px of breathing room and the home indicator, as `song.tsx` does
 * for the play bar.
 */
export function ListLayout() {
  return (
    <>
      <div className="pb-[calc(var(--spacing-tab-bar)+1px+var(--spacing-unit)*4+env(safe-area-inset-bottom))]">
        <Outlet />
      </div>
      <TabBar />
    </>
  );
}
