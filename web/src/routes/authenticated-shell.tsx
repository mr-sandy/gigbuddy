import { Outlet } from 'react-router';

/*
 * Plain layout around the route Outlet: one centred, width-capped column
 * with no device-specific chrome (Story 7.1 reset — no TopNav, BottomTabs,
 * banners or navigate-away guard).
 */
export function AuthenticatedShell() {
  return (
    <main className="mx-auto max-w-[40rem] px-[var(--spacing-gutter)] pt-[var(--spacing-section-gap)]">
      <Outlet />
    </main>
  );
}
