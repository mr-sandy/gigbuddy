import { Outlet } from 'react-router';

/*
 * Plain layout around the route Outlet: one centred, width-capped column
 * with no chrome of its own (Story 7.1 reset — no TopNav, BottomTabs,
 * banners or navigate-away guard). Routes render their own header (Story
 * 7.20); the list layout renders the tab bar.
 */
export function AuthenticatedShell() {
  return (
    <main className="mx-auto max-w-[40rem] px-[var(--spacing-gutter)]">
      <Outlet />
    </main>
  );
}
