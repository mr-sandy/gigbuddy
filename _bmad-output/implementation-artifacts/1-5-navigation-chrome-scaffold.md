---
baseline_commit: 7384bc6
---

# Story 1.5: Navigation chrome scaffold

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Sandy,
I want both top-level destinations (Setlists, Library) reachable post-login with the correct empty states, the passive Band label on MacBook, and accessibility primitives applied,
so that after Epic 1 ships I can verify the deployed app works end-to-end on both devices and feel the visual atmospheres.

## Acceptance Criteria

**AC-1 — MacBook top nav: passive Band label left, nav items right, hairline divider**

**Given** a MacBook viewport (`!isIPhone()`), authenticated
**When** the app renders the root layout (`AuthenticatedShell`)
**Then** a top nav region is rendered above the route Outlet
**And** the left side shows `GigBuddy · The Jack Ruby 5` rendered in the editorial serif (`--font-serif-editorial`) at the `home-tonight` type token (28px) using `--color-text-primary`
**And** the right side shows nav items `Setlists` and `Library` as `react-router` `NavLink`s pointing at `/` and `/library` respectively
**And** a hairline divider (`--color-border-hairline`, 1px) sits immediately below the top nav, spanning the nav's full width
**And** the brand-band label is **non-interactive**: it is rendered as a `<span>` (NOT `<a>`, `<button>`, or `<Link>`), carries no `tabindex`, no `cursor: pointer`, no `onClick`, no focus ring, and no `role` attribute
**And** the top nav is NOT rendered on iPhone (`isIPhone()` returns true → top nav absent from the DOM)

**AC-2 — MacBook top nav exposes a `rightActions` slot for future actions**

**Given** the `TopNav` component
**When** it is reviewed by code-review
**Then** its prop signature is `{ rightActions?: ReactNode }` (or equivalent `children` slot pattern) — NOT a hard-coded list of nav items
**And** the nav items `Setlists` and `Library` are rendered by `TopNav` itself (they are the navigation primitive, not action buttons)
**And** the `rightActions` slot is rendered to the right of the nav items (appended after `Library`)
**And** the Story 1.5 call site in `AuthenticatedShell` does NOT pass anything to `rightActions` (the slot is empty in Epic 1)
**And** the structural code path is in place so Story 3.4's `+ New setlist` affordance can mount into the slot by changing only `AuthenticatedShell` (or its caller) — `TopNav`'s implementation does NOT need to change to accept `+ New setlist`

**AC-3 — iPhone bottom tab bar: two tabs, no Band label, accent for active**

**Given** an iPhone viewport (`isIPhone()`), authenticated
**When** the app renders the root layout (`AuthenticatedShell`)
**Then** a fixed-position bottom tab bar is rendered below the route Outlet
**And** the tab bar contains exactly two tabs: `Setlists` (linking to `/`) and `Library` (linking to `/library`), in that order, left-to-right
**And** the active tab uses `--color-accent`; the inactive tab uses `--color-text-secondary`
**And** the active state is computed by `react-router` `NavLink`'s `isActive` (matched on `end: true` for `/`, default for `/library`)
**And** each tab is at least 44×44pt (`min-w-tap min-h-tap`) — tap-target rule from `architecture.md` Accessibility primitives
**And** the tab bar's own height (the visual row of tab labels) is ~50pt
**And** the tab bar respects the iPhone home-indicator inset via `padding-bottom: env(safe-area-inset-bottom)` (the `viewport-fit=cover` meta in `web/index.html` is already in place)
**And** the Band label is NOT rendered anywhere in the iPhone chrome (no top bar, no in-tab text)
**And** the bottom tab bar is NOT rendered on MacBook (`isIPhone()` returns false → bottom tabs absent from the DOM)

**AC-4 — Default landing route is `/` (Setlists tab) and the empty Setlists state matches voice rules**

**Given** a successful login (`POST /api/v1/auth/login` returns 200)
**When** the SPA navigates after `setAuth({ status: 'authenticated', ... })`
**Then** the post-login `navigate('/')` lands the user on the Setlists home route (the `index` child of the authenticated shell)
**And** this is the default landing route on both MacBook and iPhone

**Given** the Setlists route with no Setlist records (Epic 1 has no Setlists endpoint yet, so the "no records" state is the only state)
**When** the route renders
**Then** the Tonight slot displays the empty-state text `No upcoming gigs.` rendered from `EMPTY_STATES.noUpcomingGigs` in `web/src/lib/microcopy.ts` (defined by Story 1.2 — do NOT inline the string)
**And** no "create new setlist" CTA, button, or link appears in the empty state (per EXPERIENCE.md State Patterns "Cold open, no upcoming gig" — `No CTA`)
**And** the empty-state text uses `--color-text-secondary` and the editorial serif at `practice-body` (17px on MacBook; 18px floor on iPhone is honored by the Performance atmosphere palette but the iPhone Setlists tab is OUTSIDE Performance Mode so Practice rules apply)

**AC-5 — Library route renders empty state with no row affordances**

**Given** the Library route (`/library`) with no Song records (Epic 2 lands the Songs API; Story 1.5 has nothing to fetch)
**When** the route renders
**Then** the page shows the empty-state text `No songs in this library yet.` rendered from `EMPTY_STATES.noSongsInLibrary` in `web/src/lib/microcopy.ts` (do NOT inline the string)
**And** no row actions, no `+ New song` button, no contextual menus, and no row-content placeholders appear (Library row content lands in Epic 2 / Story 2.5)
**And** the empty-state text uses the same Practice-atmosphere treatment as the Setlists empty state (text-secondary, editorial serif body)

**AC-6 — Accessibility primitives applied to navigation controls**

**Given** any icon-only navigation control rendered by `TopNav` or `BottomTabs`
**When** the rendered DOM is reviewed
**Then** every icon-only control carries an `aria-label` matching the spoken intent (e.g., the iPhone `Setlists` tab uses `aria-label="Setlists tab"`; the `Library` tab uses `aria-label="Library tab"`)
**And** controls whose accessible name is already conveyed by visible text use the visible text as their label (no duplicate `aria-label` for `TopNav`'s `Setlists` / `Library` NavLinks, because the text "Setlists" / "Library" is visible)
**And** focus order follows DOM reading order — no manual `tabindex` value other than `0` (focusable) or `-1` (removed from order) is used anywhere in the new chrome code
**And** the active tab on iPhone announces its selected state via `aria-current="page"` (set automatically by `NavLink` when `isActive` is true)
**And** the brand-band label has no `role`, no `aria-*` attribute, and no `tabindex` (it must remain inert per AC-1)

**AC-7 — `PerformanceModeContext` exports the canonical provider + hooks; mounted above the router**

**Given** `web/src/performance/performance-context.tsx`
**When** the file is reviewed
**Then** it exports a React Context value (`PerformanceModeContext`), a `PerformanceModeProvider` component, a hook `useSetPerformanceActive()` returning a stable `(active: boolean) => void` setter, and a hook `usePerformanceActive()` returning the current boolean flag
**And** the provider's initial state is `performanceActive = false`
**And** the provider is mounted at the root of the React tree **above** `RouterProvider` in `app-bootstrap.tsx` — Story 4.1's chrome-hide path depends on the provider sitting above the router so `useChromeVisible()` can resolve inside any route
**And** the provider sits **above** the `AuthProvider` (so any future Performance-Mode-aware auth behavior can read the flag from the auth subsystem) OR sibling-above-`RouterProvider` in a single `Provider` tree — pick whichever the implementation file lays out cleanly; both honor the contract
**And** the existing placeholder `usePerformanceActive()` in `web/src/auth/redirect-on-401.ts` (Story 1.4 Task 9) is REMOVED, and `web/src/router.tsx` imports `usePerformanceActive` from `web/src/performance/performance-context.js` instead

**AC-8 — `useChromeVisible()` hook reads from the context and gates the chrome**

**Given** `web/src/hooks/use-chrome-visible.ts`
**When** it is consumed by `AuthenticatedShell`
**Then** the hook returns the negation of `usePerformanceActive()` (i.e., `!performanceActive`)
**And** in Epic 1, with `performanceActive = false`, the hook always returns `true` and the chrome (top nav on MacBook; bottom tabs on iPhone) is rendered
**And** the structural code path is in place so Story 4.1 (FR-15) only needs to call `useSetPerformanceActive()(true)` to hide chrome — no additional context plumbing, no new prop drilling, and no change to `TopNav` / `BottomTabs` / `AuthenticatedShell` is required in Story 4.1 to make the chrome disappear
**And** when `useChromeVisible()` returns `false`, both `TopNav` and `BottomTabs` are absent from the DOM (not just hidden via `display: none`) — Story 4.1's Performance Mode renders Performance Card chrome from its own route, not the global chrome

## Tasks / Subtasks

- [x] **Task 1 — Add `PerformanceModeContext` + provider + hooks** (AC: 7)
  - [x] Create `web/src/performance/performance-context.tsx` with this exact shape:
    ```tsx
    import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

    interface PerformanceModeContextValue {
      performanceActive: boolean;
      setActive: (active: boolean) => void;
    }

    const PerformanceModeContext = createContext<PerformanceModeContextValue | null>(null);

    export function PerformanceModeProvider({ children }: { children: ReactNode }) {
      const [performanceActive, setPerformanceActive] = useState(false);
      const setActive = useCallback((active: boolean) => {
        setPerformanceActive(active);
      }, []);
      const value = useMemo(
        () => ({ performanceActive, setActive }),
        [performanceActive, setActive],
      );
      return (
        <PerformanceModeContext.Provider value={value}>{children}</PerformanceModeContext.Provider>
      );
    }

    function useCtx(): PerformanceModeContextValue {
      const ctx = useContext(PerformanceModeContext);
      if (!ctx) throw new Error('PerformanceMode hooks must be used inside <PerformanceModeProvider>');
      return ctx;
    }

    export function usePerformanceActive(): boolean {
      return useCtx().performanceActive;
    }

    export function useSetPerformanceActive(): (active: boolean) => void {
      return useCtx().setActive;
    }
    ```
  - [x] Add `web/src/performance/performance-context.test.tsx`:
    - Render a small consumer that reads `usePerformanceActive()` inside `<PerformanceModeProvider>`; assert initial value `false`.
    - Render a consumer that calls `useSetPerformanceActive()(true)` on click; assert the value flips to `true` and a second consumer mounted elsewhere in the tree observes the update (proving the context is the source of truth).
    - Assert that rendering a consumer OUTSIDE the provider throws the documented error message (use `expect(() => ...).toThrow(/inside <PerformanceModeProvider>/)`; wrap in a console.error spy to keep the test output clean).
    - Assert the setter identity is stable across renders (call the consumer twice without state change, assert `setActive === setActive` from the second render — `useCallback` guarantees this).
  - [x] **Boundary rule:** this file is the ONLY place that defines `PerformanceModeContext` and its hooks. Story 2.4 (sync flusher) and Story 4.1 (Performance Mode entry) consume these hooks; neither re-creates the provider (epics.md story 2.4 line 842 makes this explicit). Story 4.1 calls `useSetPerformanceActive()(true)` to flip the flag; Story 4.3 calls it with `false` on `× exit`.

- [x] **Task 2 — Add `useChromeVisible()` hook** (AC: 8)
  - [x] Create `web/src/hooks/use-chrome-visible.ts`:
    ```ts
    import { usePerformanceActive } from '../performance/performance-context.js';

    /**
     * Chrome (top nav on MacBook, bottom tabs on iPhone) is visible whenever
     * Performance Mode is NOT active. Story 4.1 sets `performanceActive=true`
     * to hide chrome on Performance Mode entry; Story 4.3 sets it back to
     * `false` on × exit. The structural path lives here so Epic 4 needs no
     * new chrome plumbing.
     */
    export function useChromeVisible(): boolean {
      return !usePerformanceActive();
    }
    ```
  - [x] Add `web/src/hooks/use-chrome-visible.test.tsx`:
    - Render the hook through a test consumer inside `<PerformanceModeProvider>`; assert it returns `true` at default.
    - Render with `useSetPerformanceActive()(true)` triggered; assert the hook now returns `false`.
    - Use the same `act`/`userEvent` pattern as `reauth-banner.test.tsx`.
  - [x] **Anti-scope-creep:** do NOT add chrome-visibility logic here that reads the route, the device, or anything else. The single source of truth is `performanceActive`. Device-based chrome selection (MacBook = TopNav, iPhone = BottomTabs) lives in `AuthenticatedShell` (Task 6), not in this hook.

- [x] **Task 3 — Remove the placeholder `usePerformanceActive` from `redirect-on-401.ts`** (AC: 7)
  - [x] Open `web/src/auth/redirect-on-401.ts` and DELETE the `usePerformanceActive()` placeholder export (Story 1.4 Task 9 added this with `// Placeholder hook until Story 1.5 introduces PerformanceModeContext.`).
  - [x] Keep `shouldRedirectOn401(...)` exactly as-is — that function is the AC-7 architecture seam and remains correct.
  - [x] Update `web/src/router.tsx` line `import { shouldRedirectOn401, usePerformanceActive } from './auth/redirect-on-401.js';` to:
    ```ts
    import { shouldRedirectOn401 } from './auth/redirect-on-401.js';
    import { usePerformanceActive } from './performance/performance-context.js';
    ```
  - [x] `web/src/auth/redirect-on-401.test.ts` still exercises only `shouldRedirectOn401`; no test changes needed. If the test file imports `usePerformanceActive` for any reason, remove that import (verify with `grep`).
  - [x] **Why this is safe:** the placeholder was guaranteed to be removable from the moment it was written. Story 1.4 Task 9 hard-coded `return false`; the live hook also returns `false` at the initial state. `RequireAuth` in `router.tsx` will see no behavioral change in Epic 1.

- [x] **Task 4 — Add the `ACTIVE_BAND_NAME` constant + `BandLabel` component** (AC: 1)
  - [x] Create `web/src/lib/band.ts`:
    ```ts
    /**
     * V1 single-Band scope (FR-25, FR-26). The Jack Ruby 5 is the only Band that
     * carries content in V1. The name appears in the MacBook top-nav passive
     * label only (per FR-26 — no switcher in V1; iPhone chrome shows no Band
     * label).
     *
     * V2 / Multi-Band: this constant becomes a `useActiveBand()` hook backed by
     * the REGISTRY item in DDB (architecture.md Decision 2 "V2 evolution paths").
     * Do NOT add band metadata fetching in this story.
     */
    export const ACTIVE_BAND_NAME = 'The Jack Ruby 5' as const;
    ```
  - [x] Create `web/src/components/band-label.tsx`:
    ```tsx
    import { ACTIVE_BAND_NAME } from '../lib/band.js';

    /**
     * Passive informational label in the MacBook top nav (UX-DR4 BandLabel).
     * Renders as a non-interactive <span>: no tabindex, no role, no aria-*,
     * no cursor: pointer. Not focusable, not navigable by screen reader as
     * a control (it is announced as plain text content). FR-26 / story 1.5
     * AC-1: this label MUST remain inert in V1.
     */
    export function BandLabel() {
      return (
        <span className="font-serif text-[length:var(--text-home-tonight)] leading-[var(--text-home-tonight--line-height)] text-[color:var(--color-text-primary)]">
          GigBuddy · {ACTIVE_BAND_NAME}
        </span>
      );
    }
    ```
    - The `font-serif` class is the Tailwind v4 default mapped to `--font-serif-editorial` (via the `@theme` block in `tokens.css`). If `font-serif` does NOT resolve to the editorial serif at runtime (Tailwind v4 token resolution behavior), use the explicit arbitrary-property syntax `[font-family:var(--font-serif-editorial)]` instead. Verify by inspecting the rendered DOM in `pnpm dev:web`; do not guess.
  - [x] Add `web/src/components/band-label.test.tsx`:
    - Render `<BandLabel />` and assert the text content matches `/GigBuddy · The Jack Ruby 5/`.
    - Assert the element is rendered as a `<span>` (`expect(node.tagName).toBe('SPAN')`).
    - Assert it has NO `tabindex`, NO `role`, and NO `onClick`-derived `cursor: pointer` style (read `getAttribute('tabindex')` and `getAttribute('role')`; assert both are `null`).

- [x] **Task 5 — Add the `TopNav` and `BottomTabs` components** (AC: 1, 2, 3, 6)
  - [x] Create `web/src/components/top-nav.tsx`:
    ```tsx
    import type { ReactNode } from 'react';
    import { NavLink } from 'react-router';
    import { BandLabel } from './band-label.js';

    interface TopNavProps {
      /** Slot for additional action items appended after Library. Empty in Epic 1.
       *  Story 3.4 mounts `+ New setlist` here without modifying this component. */
      rightActions?: ReactNode;
    }

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
    ```
    - `aria-label="Primary"` on the `<nav>` lets a screen reader distinguish primary navigation from the bottom tabs (which carry their own label).
    - The `mx-auto max-w-[960px]` matches the architecture's MacBook page-bounds rule (DESIGN.md §Layout — "content max-width ~960pt centered"). The empty-state Setlists and Library pages also live inside this constraint.
    - **DO NOT** set `tabindex` on the `NavLink`s (per AC-6, focus order = DOM order, no manual tabindex).
  - [x] Create `web/src/components/bottom-tabs.tsx`:
    ```tsx
    import { NavLink } from 'react-router';

    /**
     * iPhone bottom tab bar. Two tabs (FR-24 + UX-DR4 BottomTabs). Hidden in
     * Performance Mode (Story 4.1 via useChromeVisible → AuthenticatedShell
     * doesn't render this component when chrome is hidden). Respects the
     * 34pt home-indicator inset via env(safe-area-inset-bottom).
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
              `flex min-h-tap flex-1 items-center justify-center py-[calc(var(--spacing-unit)*3)] ${
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
              `flex min-h-tap flex-1 items-center justify-center py-[calc(var(--spacing-unit)*3)] ${
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
    ```
    - `min-h-tap` is the Tailwind utility generated by `--spacing-tap: 44px` in `tokens.css` (the comment in tokens.css line 61–63 specifically promises `min-w-tap min-h-tap` will resolve via the `@theme` block).
    - `aria-label` is set on each `NavLink` because the visible text alone (`Setlists`, `Library`) doesn't fully convey "this is a tab" to a VoiceOver user — the `tab` suffix is the spoken intent (AC-6). `aria-current="page"` is added automatically by `NavLink` when `isActive` — VoiceOver announces this as "current page", which conveys the selected state.
    - The route Outlet content must add `padding-bottom` equivalent to the tab bar's height so the last row of content isn't occluded — handle this in `AuthenticatedShell` (Task 6), not here.
  - [x] Add `web/src/components/top-nav.test.tsx`:
    - Render `<MemoryRouter>` wrapping `<TopNav />`. Assert the brand-band label text appears, `Setlists` and `Library` NavLinks are rendered, and the right-actions slot is empty (no `<li>` after `Library`).
    - Render `<MemoryRouter><TopNav rightActions={<button>+ New setlist</button>} /></MemoryRouter>`. Assert the button is present AND appears AFTER the `Library` NavLink in DOM order.
    - Render with `<MemoryRouter initialEntries={['/library']}><TopNav /></MemoryRouter>`. Assert the `Library` NavLink carries the active styling (assert by checking the `aria-current` attribute or computed className contains `accent`).
    - Assert the `BandLabel` span has no `tabindex`, no `role` (already covered in `band-label.test.tsx`; do NOT duplicate the assertion in this file).
  - [x] Add `web/src/components/bottom-tabs.test.tsx`:
    - Render `<MemoryRouter><BottomTabs /></MemoryRouter>`. Assert two NavLinks render with `aria-label="Setlists tab"` and `aria-label="Library tab"`.
    - Render with `<MemoryRouter initialEntries={['/library']}>`. Assert the `Library` tab carries `aria-current="page"`.
    - Render with `<MemoryRouter initialEntries={['/']}>`. Assert the `Setlists` tab carries `aria-current="page"` AND the `Library` tab does NOT (proving the `end: true` match on `/` doesn't bleed into the `Library` route).

- [x] **Task 6 — Replace `AuthenticatedShell` body with the chrome composition** (AC: 1, 3, 4, 5, 8)
  - [x] Rewrite `web/src/routes/authenticated-shell.tsx`:
    ```tsx
    import { Outlet } from 'react-router';
    import { BottomTabs } from '../components/bottom-tabs.js';
    import { ReauthBanner } from '../components/reauth-banner.js';
    import { TopNav } from '../components/top-nav.js';
    import { useChromeVisible } from '../hooks/use-chrome-visible.js';
    import { isIPhone } from '../lib/platform.js';

    /**
     * Renders the global chrome around the route Outlet:
     *   - MacBook (isIPhone=false): TopNav above the Outlet, no bottom bar.
     *   - iPhone (isIPhone=true): fixed BottomTabs below the Outlet, no top bar.
     * Chrome is omitted entirely when `useChromeVisible()` is false (Story 4.1
     * sets performanceActive=true → chrome hides during Performance Mode).
     */
    export function AuthenticatedShell() {
      const chromeVisible = useChromeVisible();
      const iPhone = isIPhone();
      return (
        <>
          {chromeVisible && !iPhone ? <TopNav /> : null}
          <ReauthBanner />
          <main
            className="mx-auto max-w-[960px] px-[var(--spacing-gutter)] py-[var(--spacing-section-gap)]"
            style={iPhone && chromeVisible ? { paddingBottom: 'calc(50pt + env(safe-area-inset-bottom))' } : undefined}
          >
            <Outlet />
          </main>
          {chromeVisible && iPhone ? <BottomTabs /> : null}
        </>
      );
    }
    ```
    - The conditional `paddingBottom` on `<main>` reserves room for the iPhone bottom tabs so the last row of the route content isn't occluded by the fixed bar (50pt nominal height + the home-indicator inset). On MacBook (no fixed bar), no padding is needed. When chrome is hidden (Performance Mode), no padding either.
    - `ReauthBanner` stays where it is — it's an authenticated-only banner, mounted inside the shell. Order: banner above `<main>` keeps it out of the route Outlet so any route can render its full surface area.
    - Story 1.4 explicitly notes the shell will be replaced here (`web/src/routes/authenticated-shell.tsx` line 7 comment "Story 1.5 replaces the body with the full nav chrome scaffold"). Remove the obsolete leading-comment block from 1.4 — replace it with the new docblock above.
  - [x] Update `web/src/app-bootstrap.tsx` to wrap `<RouterProvider>` with `<PerformanceModeProvider>`:
    ```tsx
    import { useEffect, useState } from 'react';
    import { RouterProvider } from 'react-router';
    import { fetchMe } from './auth/auth-api.js';
    import { AuthProvider, type AuthState } from './auth/auth-context.js';
    import { PerformanceModeProvider } from './performance/performance-context.js';
    import { router } from './router.js';

    export function AppBootstrap() {
      const [initial, setInitial] = useState<AuthState>({ status: 'unknown' });
      const [ready, setReady] = useState(false);

      useEffect(() => {
        let cancelled = false;
        fetchMe().then((state) => {
          if (cancelled) return;
          setInitial(state);
          setReady(true);
        });
        return () => {
          cancelled = true;
        };
      }, []);

      if (!ready) {
        return <h1>GigBuddy</h1>;
      }

      return (
        <PerformanceModeProvider>
          <AuthProvider initial={initial}>
            <RouterProvider router={router} />
          </AuthProvider>
        </PerformanceModeProvider>
      );
    }
    ```
    - **Order rationale:** `PerformanceModeProvider` is outermost so any subsystem (auth, sync, router) can read `usePerformanceActive()` (AC-7). `AuthProvider` is inside it. `RouterProvider` is innermost.
    - Update `web/src/app-bootstrap.test.tsx` to mount `<PerformanceModeProvider>` around the test (if any test renders `<AppBootstrap />` directly, the new provider wraps it transparently; if a test imports a hook from inside the routes, wrap the renderer with both providers).
  - [x] Add `web/src/routes/authenticated-shell.test.tsx`:
    - Mock `web/src/lib/platform.js` (`vi.mock('../lib/platform.js')`) to return `isIPhone: false`. Render `<MemoryRouter><PerformanceModeProvider><AuthProvider initial={{status:'authenticated', daysUntilExpiry: 365}}><Routes><Route path="/" element={<AuthenticatedShell />}><Route index element={<div>route content</div>} /></Route></Routes></AuthProvider></PerformanceModeProvider></MemoryRouter>`. Assert `TopNav` is rendered (find by `aria-label="Primary"`), `BottomTabs` is NOT (`queryByLabelText('Tabs')` is null), and route content is visible.
    - Same setup but with `isIPhone: true`. Assert `TopNav` is absent and `BottomTabs` is present.
    - With `isIPhone: false` and a wrapper that calls `useSetPerformanceActive()(true)` on mount. Assert BOTH `TopNav` and `BottomTabs` are absent (chrome hidden in Performance Mode — proves AC-8 structural path).
    - Assert the `ReauthBanner` renders when `daysUntilExpiry <= 30`, regardless of chrome visibility (its own visibility is its own concern — it does NOT depend on `useChromeVisible`).

- [x] **Task 7 — Add the `Home` (Setlists) and `Library` route components** (AC: 4, 5)
  - [x] Create `web/src/routes/home.tsx`:
    ```tsx
    import { EMPTY_STATES } from '../lib/microcopy.js';

    /**
     * Setlists home (FR-23, FR-14). Default landing route on both surfaces.
     * Epic 1 has no Setlists API yet — this story renders the empty state
     * only. Epic 3 (Story 3.2) lands the real Tonight / Upcoming / Past
     * sectioned list.
     */
    export function Home() {
      return (
        <section aria-labelledby="setlists-heading">
          <h1
            id="setlists-heading"
            className="sr-only"
          >
            Setlists
          </h1>
          <p className="text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-text-secondary)]">
            {EMPTY_STATES.noUpcomingGigs}
          </p>
        </section>
      );
    }
    ```
    - The `<h1>` is `sr-only` because the visible Setlists section heading is the navigation tab itself (and on Epic 3 will be the `TONIGHT` card). Screen readers still need a programmatic heading; `sr-only` keeps it accessible without visual chrome.
    - **DO NOT** add a `+ New setlist` CTA, an Upcoming list shell, or a Past list shell. Empty state IS the entire UI in Epic 1.
  - [x] Create `web/src/routes/library.tsx`:
    ```tsx
    import { EMPTY_STATES } from '../lib/microcopy.js';

    /**
     * Library (FR-4, FR-24). Epic 2 (Story 2.5) lands the real Song list
     * surface and the inline-edit Song row. Epic 1 renders the empty state
     * with no row affordances per AC-5.
     */
    export function Library() {
      return (
        <section aria-labelledby="library-heading">
          <h1
            id="library-heading"
            className="sr-only"
          >
            Library
          </h1>
          <p className="text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-text-secondary)]">
            {EMPTY_STATES.noSongsInLibrary}
          </p>
        </section>
      );
    }
    ```
    - **DO NOT** add a `+ New song` button, a search box, alphabetical letter rails, or any other affordance — Library row content lands in Epic 2.
  - [x] Add `web/src/routes/home.test.tsx`:
    - Render `<Home />` inside `<MemoryRouter>`. Assert the visible text contains `EMPTY_STATES.noUpcomingGigs`.
    - Assert NO button, NO link, and NO `[role="button"]` element is rendered (`queryAllByRole('button').length === 0`, `queryAllByRole('link').length === 0`).
    - Assert the `<h1>` exists in the accessibility tree (`getByRole('heading', { level: 1 }).textContent === 'Setlists'`).
  - [x] Add `web/src/routes/library.test.tsx`:
    - Render `<Library />` inside `<MemoryRouter>`. Assert the visible text contains `EMPTY_STATES.noSongsInLibrary`.
    - Assert NO button, NO link, and NO `[role="button"]` element is rendered.
    - Assert the `<h1>` exists in the accessibility tree (`getByRole('heading', { level: 1 }).textContent === 'Library'`).

- [x] **Task 8 — Update `router.tsx` to mount the new routes** (AC: 4, 5)
  - [x] Rewrite `web/src/router.tsx`:
    ```tsx
    import type { ReactNode } from 'react';
    import { createBrowserRouter, Navigate } from 'react-router';
    import { useAuth } from './auth/auth-context.js';
    import { shouldRedirectOn401 } from './auth/redirect-on-401.js';
    import { usePerformanceActive } from './performance/performance-context.js';
    import { AuthenticatedShell } from './routes/authenticated-shell.js';
    import { Home } from './routes/home.js';
    import { Library } from './routes/library.js';
    import { Login } from './routes/login.js';

    function RequireAuth({ children }: { children: ReactNode }) {
      const { auth } = useAuth();
      const performanceActive = usePerformanceActive();
      if (
        auth.status === 'unauthenticated' &&
        shouldRedirectOn401({ performanceActive, wasNetworkSuccess: true })
      ) {
        return <Navigate to="/login" replace />;
      }
      return <>{children}</>;
    }

    export const router = createBrowserRouter([
      { path: '/login', element: <Login /> },
      {
        path: '/',
        element: (
          <RequireAuth>
            <AuthenticatedShell />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <Home /> },
          { path: 'library', element: <Library /> },
        ],
      },
    ]);
    ```
  - [x] Delete `web/src/routes/placeholder.tsx` and `web/src/routes/placeholder.test.tsx` — the Placeholder route is fully replaced by `Home`. Search for any remaining references with `grep -r "placeholder" web/src/` and delete them.
  - [x] Note for the dev agent: `Home` is the index child of `/`, so `navigate('/')` from `login.tsx` (the existing post-login navigation) lands on Setlists home with NO code changes to `login.tsx` (AC-4 confirms this).

- [x] **Task 9 — Update `app-bootstrap.test.tsx` to resolve the deferred-work assertion** (AC: 4)
  - [x] The deferred-work entry from the 1.4 review (line 24 of `_bmad-output/implementation-artifacts/deferred-work.md`) says "`app-bootstrap.test.tsx` authenticated-shell assertion is inconclusive — test cannot distinguish the boot loading shell from the authenticated shell; both render `<h1>GigBuddy</h1>`. Improve once Story 1.5 adds unique authenticated-shell content."
  - [x] Update `web/src/app-bootstrap.test.tsx`:
    - The authenticated-200 case should now assert that the rendered DOM contains the Setlists `<h1>Setlists</h1>` (from `Home`) AND the `EMPTY_STATES.noUpcomingGigs` text — two unambiguous signals that the authenticated shell rendered, not the loading shell. The Setlists `<h1>` is `sr-only` but still in the DOM and findable via `getByRole('heading', { level: 1, name: 'Setlists' })`.
    - When wrapping the render call, include `<PerformanceModeProvider>` (new outer requirement from Task 6) — without it, the new `useChromeVisible()` inside `AuthenticatedShell` will throw.
  - [x] Mark the deferred-work entry resolved: in `_bmad-output/implementation-artifacts/deferred-work.md`, strikethrough the line and append `**Resolved in Story 1.5 (Task 9)** — assertion now binds to `Setlists` heading + empty-state text from the new Home route.`

- [x] **Task 10 — Update `redirect-on-401.test.ts` if necessary** (AC: 7)
  - [x] After Task 3 deletes `usePerformanceActive` from `redirect-on-401.ts`, run `pnpm typecheck` and `pnpm -F web test`. If `redirect-on-401.test.ts` imports the removed hook, remove that import. The truth-table tests on `shouldRedirectOn401` remain unchanged.

- [x] **Task 11 — Tailwind v4 token-class spot check** (AC: 1, 3)
  - [x] Tailwind v4 generates utilities from the `@theme` block in `tokens.css`. The first time a story uses `min-h-tap`, the arbitrary-color `text-[color:var(--color-...)]` syntax, or the spacing `[length:var(--spacing-...)]` syntax, a quick smoke check matters because misconfigured token names produce silently-missing classes.
  - [x] Run `pnpm -F web run build` after Tasks 4–6. Inspect the emitted CSS bundle (in `web/dist/assets/*.css`) for:
    - `min-h-tap` and `min-w-tap` (used by `BottomTabs`)
    - the arbitrary-value classes used in `TopNav`, `BottomTabs`, `BandLabel`, `Home`, `Library` (`bg-[color:var(--color-bg)]`, `text-[color:var(--color-accent)]`, etc.)
  - [x] If any of the above classes are absent from the bundle, either (a) the token name is wrong (e.g., we wrote `min-h-tap` but tokens.css declares `--spacing-tap-target`), or (b) the arbitrary syntax was mistyped. Fix and re-build; do NOT ship a story whose chrome doesn't paint.
  - [x] No new automated test for this — the contrast-report + `pnpm test` suite plus a manual `pnpm dev:web` open-in-browser proves the visual chrome paints. Record the result in the Dev Agent Record.

- [x] **Task 12 — Verification pass** (AC: 1–8)
  - [x] `pnpm typecheck` green across all packages.
  - [x] `pnpm lint` green (Biome). Run `pnpm lint:fix` if formatting drifts on the new files.
  - [x] `pnpm test` green — every new vitest spec in `web/` passes; the updated `app-bootstrap.test.tsx` passes against the new assertions; the existing `redirect-on-401.test.ts` passes after the import update.
  - [x] `pnpm -F web run build` produces a clean `web/dist/` bundle with no Tailwind missing-class warnings.
  - [x] **Manual smoke (MacBook):** `pnpm dev:web` → open `http://localhost:5273/` → sign in with the dev password → confirm:
    - Top nav renders with `GigBuddy · The Jack Ruby 5` on the left and `Setlists` / `Library` on the right
    - Hairline divider sits below the top nav
    - The brand-band label has no cursor change on hover, no focus ring on Tab navigation
    - `/` renders `No upcoming gigs.` with no CTA
    - Clicking `Library` navigates to `/library`; the empty state reads `No songs in this library yet.`
    - Bottom tab bar is NOT rendered on MacBook
  - [x] **Manual smoke (iPhone — viewport emulation OR real device):** open Safari devtools, set the viewport to iPhone 13 (390×844, simulate `iPhone` UA) → reload → confirm:
    - Top nav is NOT rendered
    - Bottom tab bar IS rendered at the bottom, two tabs visible
    - `Setlists` tab is active (accent color); `Library` is text-secondary
    - Tap `Library` → it becomes active, `Setlists` becomes text-secondary
    - The empty-state texts render the same as MacBook
    - The bottom tab bar respects safe-area-inset-bottom (visual: tabs aren't covered by the home-indicator gesture region)
  - [x] Capture the manual smoke observations in the Dev Agent Record. If the iPhone path can only be verified via real iPhone Safari (UA detection is the gate), document the test fence and defer the iPhone manual smoke to Sandy.

## Dev Notes

### Architecture compliance (the contract you must follow)

**Source of truth:** `_bmad-output/planning-artifacts/architecture.md`. Deviations require updating that document, not the code.

This story implements the navigation-chrome scaffold prerequisites for Epic 4's Performance-Mode chrome-hide path (architecture.md "Performance Mode invariants" lines 652–675 + AR-28 line 160). The `PerformanceModeContext` and `useChromeVisible()` hook are the **architectural seams** Story 4.1 plugs into — no Epic 4 work in this story, but Epic 4 cannot ship without these seams existing here.

**Hard rules from the architecture:**
- Theme atmosphere: `<html data-atmosphere="practice">` (MacBook) or `"performance"` (iPhone outside Performance Mode). Already wired by `applyBootAtmosphere()` (Story 1.2); this story does NOT touch atmosphere logic.
- State management taxonomy (architecture lines 718–729): `PerformanceModeContext` is React Context (per the canonical table). NOT Redux/Zustand/Jotai/MobX. NOT a TanStack Query atom. Plain `createContext` + `useState`.
- Naming conventions (architecture lines 473–495):
  - Files kebab-case (`top-nav.tsx`, `bottom-tabs.tsx`, `band-label.tsx`, `use-chrome-visible.ts`, `performance-context.tsx`, `home.tsx`, `library.tsx`).
  - Identifiers `camelCase` (`useChromeVisible`, `usePerformanceActive`, `setActive`), `PascalCase` (`TopNav`, `BottomTabs`, `BandLabel`, `Home`, `Library`, `PerformanceModeProvider`), `SCREAMING_SNAKE_CASE` (`ACTIVE_BAND_NAME`).
- React Router 7: imports from `react-router`, NOT `react-router-dom` (CLAUDE.md). `NavLink` is the right primitive for active-state styling; do not roll your own active detection.
- Tailwind v4 with `@theme` token blocks (Story 1.2's `tokens.css`). Use the existing tokens; do NOT add new tokens in this story. If a token you need doesn't exist, the right answer is to NOT need it (use an existing token or arbitrary value).
- Biome is the only lint+format tool. Run `pnpm lint:fix` after authoring new files.
- TypeScript `strict: true` across `web/` (CLAUDE.md). No `any`. Use `ReactNode` from `react`, NOT `JSX.Element`.

**Boundaries (CLAUDE.md §Boundaries, architecture.md lines 1017–1027):**
- `web` ↔ `api`: HTTP only via `/api/v1/*`. This story makes ZERO new API calls. No `fetch` to anything new.
- `web` ↔ `shared`: types + Zod schemas only. This story imports nothing from `shared/` (no new wire contracts).
- No DDB access, no SSM access — neither subsystem exists in `web/`.

### Library and framework requirements (do NOT substitute)

- **React 19 + React Router 7 (`react-router`)** — already in `web/package.json`. Use `NavLink` for both `TopNav` items and `BottomTabs` tabs — its built-in `isActive` callback drives the active styling and its automatic `aria-current="page"` covers AC-6's selected-state announcement requirement.
- **Tailwind v4 (`tailwindcss@^4`)** with the `@tailwindcss/vite` plugin — Story 1.1 wired this. Token-backed utilities like `min-h-tap` are generated from the `@theme` block; arbitrary values like `text-[color:var(--color-accent)]` are the v4-blessed escape hatch for token references inside class names. Do NOT add Tailwind config, do NOT install PostCSS plugins (Tailwind v4 has its own pipeline per CLAUDE.md).
- **TanStack Query v5** — not used in this story. The empty-state pages have nothing to fetch. Do NOT introduce `useQuery(['setlists'], ...)` or similar — the Setlists/Library APIs land in Stories 3.1 / 2.3.
- **Vitest + React Testing Library + `@testing-library/user-event`** — already in `devDependencies`. Use `renderHook` from `@testing-library/react` (not `react-hooks` — that package is deprecated and merged into RTL).

### What this story does NOT include (anti-scope-creep)

These appear near this work in the architecture and epics but are owned by later stories. **Do not scaffold:**

- **Setlists data fetch / hooks (`useTonightGig`, `useSetlist`)** — Story 2.4 (sync layer) + Story 3.1 (Setlist API). The Setlists home in this story is empty-state only.
- **Library Song data fetch / hooks (`useSong`)** — Story 2.3 (Song API + DDB) + Story 2.4 (sync layer). Empty-state only here.
- **Song detail route (`/library/:songId`)** — Story 2.6.
- **`+ New setlist` action item** — Story 3.4 mounts this into `TopNav`'s `rightActions` slot. Story 1.5 only PROVIDES the slot.
- **Gig card / TONIGHT badge / row components** — Story 3.2.
- **Setlist overview, performance card, currently-performing strip, Start performance CTA** — Epic 4.
- **Performance Mode entry logic / chrome hide on entry** — Story 4.1 will set `useSetPerformanceActive()(true)` from the `Start performance ›` handler. The chrome hides automatically because `useChromeVisible()` flips.
- **`× exit` re-enabling chrome** — Story 4.3 calls `useSetPerformanceActive()(false)`.
- **iPhone PWA install gate** — Story 2.2 owns the install-required redirect. In Story 1.5, the chrome simply renders on iPhone outside Performance Mode; whether the user has installed the PWA is not yet a precondition.
- **Service worker / NetworkOnly /me caching** — Story 2.1.
- **Atmosphere switching beyond boot-time** — Story 1.2 owns this. Performance-Mode-specific atmosphere flip (if any beyond the iPhone default) lands in Story 4.1.
- **Re-style of `login.tsx`** — login form's Tailwind polish is documented in 1.4 dev notes as a Story 1.5 candidate. **Skip it.** The unstyled native controls work; defer the polish. (If a Visual polish pass is later requested, add it in a follow-up scoped story, not in this scaffold-only story.)

If you find yourself wanting to scaffold any of the above, **don't**. The respective stories carry the ACs that will land them correctly.

### Existing files this story modifies — current state and what changes

#### `web/src/auth/redirect-on-401.ts` (Task 3 — REMOVE placeholder)

**Current state (post-Story 1.4):** Exports `shouldRedirectOn401({performanceActive, wasNetworkSuccess})` decision function AND a placeholder `usePerformanceActive()` hook that returns `false`. The placeholder was always documented as a Story 1.5 swap-out.

**This story changes:** Delete the `usePerformanceActive` placeholder. Keep `shouldRedirectOn401` untouched.

**Must preserve:** the `shouldRedirectOn401` function signature and behavior. `router.tsx` calls it with `{performanceActive, wasNetworkSuccess: true}` and the existing truth table must still pass. The function is the AC-7 architecture seam and is correct as written in 1.4.

#### `web/src/router.tsx` (Task 8 — replace Placeholder, add Library route, update import)

**Current state (post-Story 1.4):** Mounts `/login` and `/` (with `RequireAuth` + `AuthenticatedShell` + `Placeholder` index child). Imports `usePerformanceActive` from `./auth/redirect-on-401.js`.

**This story changes:** Add `Library` route as a child of `/`. Replace the `Placeholder` index with `Home`. Re-point the `usePerformanceActive` import to the new `performance/performance-context.js` location.

**Must preserve:** `RequireAuth` continues to call `shouldRedirectOn401({performanceActive, wasNetworkSuccess: true})` with the live `performanceActive` value. The redirect behavior on AC-7 is unchanged.

#### `web/src/routes/authenticated-shell.tsx` (Task 6 — replace body)

**Current state (post-Story 1.4):** Renders `<><ReauthBanner /><Outlet /></>` only. Documented as a minimal scaffold that Story 1.5 replaces.

**This story changes:** Renders the device-conditional chrome (`TopNav` on MacBook, `BottomTabs` on iPhone) with chrome-visibility gated by `useChromeVisible()`. Wraps the Outlet in a `<main>` element with safe-area padding for iPhone.

**Must preserve:** `ReauthBanner` continues to render inside the shell. The `Outlet` continues to render the matched child route (Home / Library / future routes).

#### `web/src/app-bootstrap.tsx` (Task 6 — wrap RouterProvider with PerformanceModeProvider)

**Current state (post-Story 1.4):** Renders `<AuthProvider initial={...}><RouterProvider router={router} /></AuthProvider>` after the `/me` probe resolves. Loading state is a bare `<h1>GigBuddy</h1>`.

**This story changes:** Wrap the `<AuthProvider>` with `<PerformanceModeProvider>` (outermost). The loading state (`<h1>GigBuddy</h1>`) is unchanged.

**Must preserve:** the `/me` boot probe and the loading/ready split. The deferred-work test ambiguity (loading vs authenticated shell both render `<h1>GigBuddy</h1>`) is resolved by Task 9, which asserts on the Setlists `<h1>` and empty-state text — both of which are post-loading-shell.

#### `web/src/app-bootstrap.test.tsx` (Task 9 — resolve deferred-work assertion)

**Current state:** Asserts authenticated boot lands in the shell, but the assertion can't distinguish the loading shell from the authenticated shell because both render `<h1>GigBuddy</h1>`.

**This story changes:** The authenticated-200 test case now asserts the Setlists heading + empty-state text are present. The render wrapper includes `<PerformanceModeProvider>` (required after Task 6).

**Must preserve:** the offline (`fetch rejects`) and 401 test cases — their assertions on `'unknown'` / `'unauthenticated'` resolution are independent of the shell content change.

#### `_bmad-output/implementation-artifacts/deferred-work.md` (Task 9 — strike + mark resolved)

**Current state:** Lists the `app-bootstrap.test.tsx` ambiguity as deferred from Story 1.4 review.

**This story changes:** Strike the line and append a "Resolved in Story 1.5 (Task 9)" note with back-reference.

### Existing files this story DOES NOT touch (regression safety)

- `web/src/auth/auth-context.tsx`, `auth-api.ts` — AuthContext / fetchMe / login. Unchanged.
- `web/src/components/reauth-banner.tsx` — still renders inside the shell after Task 6. Unchanged.
- `web/src/routes/login.tsx` — unchanged. The post-login `navigate('/')` lands on `Home` because the index child of `/` is now `Home` instead of `Placeholder`. No code change.
- `web/src/main.tsx` — unchanged. `applyBootAtmosphere()` still runs before React mounts; the QueryClientProvider still wraps `AppBootstrap`.
- `web/src/lib/platform.ts`, `atmosphere.ts`, `microcopy.ts` — consumed only, not modified.
- `web/src/styles/tokens.css`, `globals.css`, `fonts.css` — consumed only.
- `web/index.html` — already has `viewport-fit=cover` (Story 1.1 baseline); the bottom-tabs safe-area-inset works without HTML changes.
- `api/`, `shared/`, `infra/`, `e2e/` — entirely unchanged. This is a `web/`-only story.

### Previous story intelligence (Story 1.4 + 1.2 / 1.1 learnings)

From **Story 1.4** (commit `7384bc6`):
- The `AuthenticatedShell` was deliberately left as a minimal scaffold so 1.5 could replace it cleanly. The replacement is exactly what AC-1, AC-3, and AC-8 enumerate.
- `usePerformanceActive()` was a stub returning `false` in `redirect-on-401.ts`. Story 1.5 owns the real provider per epics.md line 588 and per Story 1.4's `What this story does NOT include` note (`web/src/performance/performance-context.tsx` is Story 1.5; the setter wired into the live Performance flow is Story 4.1).
- The `shouldRedirectOn401` decision function takes `performanceActive` as an explicit parameter — that contract is preserved unchanged by this story.
- The 1.4 review left two deferred items relevant here: (a) the `app-bootstrap.test.tsx` ambiguity (Task 9 resolves), and (b) "No redirect from `/login` when already authenticated" (NOT in scope for 1.5; that's a separate router polish pass deferred-item — see deferred-work.md line 25). Do NOT scaffold the `alreadyAuthenticated` guard in this story.
- The 1.4 review also noted "`daysUntilExpiry === 0` renders 'Re-authenticate within 0 days.'" — this is a `reauth-banner.tsx` polish item, NOT a chrome-scaffold item. Do NOT touch.

From **Story 1.2** (`d5dcbab`):
- `EMPTY_STATES` in `web/src/lib/microcopy.ts` is the canonical source for the two empty-state strings used in AC-4 and AC-5. Story 1.2 AC-7 specifically says these strings are defined "in a single microcopy module for reuse by Stories 1.5, 2.x, 3.x". Reuse them; do NOT redefine.
- Tokens in `tokens.css` include `--text-home-tonight: 28px`, `--text-practice-body: 17px`, `--font-serif-editorial`, `--color-text-primary`, `--color-text-secondary`, `--color-accent`, `--color-border-hairline`, `--spacing-tap: 44px`, `--spacing-gutter: 16px`, `--spacing-section-gap: 32px`, `--spacing-unit: 4px`. Every visual choice in Tasks 4–7 must reference an existing token; do not introduce new color or spacing values.
- The `--spacing-tap: 44px` token is specifically commented as "Declared in the spacing namespace so Tailwind generates `min-w-tap`, `min-h-tap`, `w-tap`, `h-tap` utilities." (`tokens.css` line 61). Trust the comment.
- Both atmospheres ship in every bundle; the `[data-atmosphere="..."]` selector flips palette via CSS variable scope. The chrome reads palette via `var(--color-...)` — no per-device chrome styling needed beyond what's already token-driven.

From **Story 1.1** (`d5dcbab`):
- Test files co-located with source (`*.test.tsx` next to `*.tsx`). Follow this; do NOT create a `__tests__/` folder.
- `pnpm dev:web` is on port `5273`; `pnpm dev:api` on `3100`. Manual smoke documentation in Task 12 uses `5273`.
- Biome formats new files automatically with `pnpm lint:fix`. Don't fight the formatter.
- `vitest` is the runner; `web/src/test-setup.ts` is the canonical test setup file (already wires `@testing-library/jest-dom` extensions). Reuse it.

### Implementation patterns reused from architecture

- **State management taxonomy** (architecture lines 718–729): `PerformanceModeContext` is the canonical home for the `performanceActive` flag. The architecture's table lists "Performance-active flag" → "React Context (`PerformanceModeContext`)" → "Read by sync, error, UI subsystems". Task 1 lands exactly this contract.
- **Performance Mode invariants** (architecture lines 652–675): the chrome-hide-on-entry path is encoded in this story's structural seam. AR-28 (line 160) lists all the invariants that depend on `performanceActive`; this story enables the chrome-hide one. The others (no toasts / no banners / no auth-failure redirects / SW suppression / cache-only reads / Wake Lock held) land in later stories — do NOT pre-encode them here.
- **Naming conventions** (architecture lines 473–495): kebab-case files, `camelCase` / `PascalCase` / `SCREAMING_SNAKE_CASE` identifiers per role. JSON over the wire is `camelCase`, but this story has no wire format.
- **Accessibility implementation primitives** (architecture lines 815–833): `aria-label` on icon-only controls (AC-6), `aria-current="page"` via `NavLink`, focus order = DOM order, no manual `tabindex` other than `0` / `-1`, `min-w-tap min-h-tap` enforced via Tailwind utility tokens. All of this is encoded in Tasks 5 and 6.
- **No global state libraries** (architecture line 729): React Context only. Confirmed by Task 1's pattern.
- **DESIGN.md §Layout** (referenced by architecture): "MacBook content max-width ~960pt centered" — `mx-auto max-w-[960px]` in `TopNav` and `<main>` honors this.

### Latest tech information (versions verified at story-write time)

- **React Router 7 (`react-router@^7`)**: `NavLink`'s `className` prop accepts a `({ isActive, isPending, isTransitioning }) => string` callback. `aria-current="page"` is set automatically on the active link — you do NOT need to pass `aria-current` manually. `end: true` prop matches the exact path (use it on the `/` NavLink to prevent the Setlists tab from staying active on `/library`).
- **Tailwind CSS v4 (`tailwindcss@^4`)**: tokens declared in a `@theme` block become utility classes. `--spacing-tap: 44px` generates `min-w-tap`, `min-h-tap`, `w-tap`, `h-tap`. Arbitrary values like `text-[color:var(--color-accent)]` work as the escape hatch for token references that the `@theme` doesn't generate a one-shot class for (e.g., a color used as a text color and a border color shouldn't require two tokens). Tailwind v4 does NOT use the legacy `tailwind.config.js` content scanning — `@import "tailwindcss";` + the `@tailwindcss/vite` plugin (already wired in Story 1.1) handles everything.
- **`@testing-library/react@^16`**: `renderHook` is the canonical way to test hooks. `userEvent` from `@testing-library/user-event@^14` is the canonical click/type helper. Both already in `web/package.json` devDependencies.
- **`vitest@^2`**: `vi.mock('../lib/platform.js', () => ({ isIPhone: vi.fn().mockReturnValue(false) }))` is the canonical mock pattern (Story 1.4 `reauth-banner.test.tsx` already uses this — copy the shape).

### Files this story creates

- `web/src/performance/performance-context.tsx`
- `web/src/performance/performance-context.test.tsx`
- `web/src/hooks/use-chrome-visible.ts`
- `web/src/hooks/use-chrome-visible.test.tsx`
- `web/src/lib/band.ts`
- `web/src/components/band-label.tsx`
- `web/src/components/band-label.test.tsx`
- `web/src/components/top-nav.tsx`
- `web/src/components/top-nav.test.tsx`
- `web/src/components/bottom-tabs.tsx`
- `web/src/components/bottom-tabs.test.tsx`
- `web/src/routes/home.tsx`
- `web/src/routes/home.test.tsx`
- `web/src/routes/library.tsx`
- `web/src/routes/library.test.tsx`
- `web/src/routes/authenticated-shell.test.tsx`

### Files this story modifies

- `web/src/auth/redirect-on-401.ts` — remove the placeholder `usePerformanceActive()` export
- `web/src/router.tsx` — re-point `usePerformanceActive` import; add `Library` route; replace `Placeholder` index with `Home`
- `web/src/routes/authenticated-shell.tsx` — replace minimal body with device-conditional chrome composition
- `web/src/app-bootstrap.tsx` — wrap `RouterProvider` with `PerformanceModeProvider`
- `web/src/app-bootstrap.test.tsx` — update assertions to bind on Setlists `<h1>` + empty-state text; wrap render with `PerformanceModeProvider`
- `_bmad-output/implementation-artifacts/deferred-work.md` — strike + mark resolved the `app-bootstrap.test.tsx` ambiguity entry

### Files this story deletes

- `web/src/routes/placeholder.tsx` — fully replaced by `Home`
- `web/src/routes/placeholder.test.tsx` — fully replaced by `home.test.tsx`

### Project Structure Notes

- **Mostly aligned with architecture's directory tree** (lines 840–1015):
  - `web/src/components/bottom-tabs.tsx` — architecture line 875.
  - `web/src/performance/performance-context.tsx` — architecture line 890.
  - `web/src/routes/home.tsx` — architecture line 861.
  - `web/src/routes/library.tsx` — architecture line 863.
  - `web/src/hooks/use-chrome-visible.ts` — `web/src/hooks/` is the canonical hooks folder (architecture line 902). The architecture lists specific hook files (`use-song.ts`, `use-setlist.ts`, etc.) but does not enumerate `use-chrome-visible.ts`; that's because the chrome-visibility seam was named only in the epics.md story 1.5 spec (line 592). Treat the epics line as authoritative — same pattern as `use-performance-active.ts` (also in the architecture tree, used by this story's `usePerformanceActive` hook which lives inside `performance-context.tsx`).
- **Variances to document in the Dev Agent Record** (mirror the Story 1.4 pattern):
  - **Added** `web/src/components/top-nav.tsx` — not enumerated in the architecture's `components/` list, but UX-DR4 names a `Top nav (MacBook)` component and FR-26 / AC-1 require its existence. Without a dedicated component, the top nav would have to live inside `AuthenticatedShell`, which entangles two concerns.
  - **Added** `web/src/components/band-label.tsx` — architecture line 1097 references this file (in the Requirements → structure mapping table), so it's expected even though it isn't in the explicit directory tree. Listed as added for clarity.
  - **Added** `web/src/lib/band.ts` — small constant module for `ACTIVE_BAND_NAME`. Not enumerated in the architecture tree. Listed as added.
  - **Removed** `web/src/routes/placeholder.tsx` — never in the architecture tree; was a Story 1.4 scaffold explicitly slated for replacement by `Home`.
- **No architecture.md update required.** The added files are component-level additions inside the existing `web/src/` shape, not structural changes. The architecture tree is a guide, not an exhaustive enumeration (Story 1.4 dev notes line 999–1001 set this precedent).

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#State management taxonomy] (lines 718–729) — React Context for `performanceActive`; no Redux/Zustand/Jotai
- [Source: _bmad-output/planning-artifacts/architecture.md#Performance Mode invariants] (lines 652–675) — AR-28 chrome-hide invariant, which Story 1.5's `useChromeVisible()` seam enables
- [Source: _bmad-output/planning-artifacts/architecture.md#Theme atmosphere] (lines 731–738) — Practice/Performance atmosphere CSS-variable selector model; no JS theme provider
- [Source: _bmad-output/planning-artifacts/architecture.md#Accessibility implementation primitives] (lines 815–833) — `aria-label` on icon-only controls, focus order = DOM order, `min-w-tap min-h-tap`, no manual `tabindex` other than `0` / `-1`
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming conventions] (lines 473–495) — file/identifier casing
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules] (lines 469–836) — pattern-enforcement floor
- [Source: _bmad-output/planning-artifacts/architecture.md#Directory tree] (lines 840–1015) — `web/src/` canonical structure
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural boundaries] (lines 1017–1027) — `web` ↔ `api` HTTP only; this story has no API surface
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.5] (lines 542–597) — verbatim AC text + the `PerformanceModeContext` + `useChromeVisible` requirement
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory] FR-24 (line 52), FR-25 (line 55), FR-26 (line 56), UX-DR4 (line 202 — `BottomTabs`, `BandLabel`, `Top nav`), UX-DR6 (line 206 — accessibility primitives), UX-DR7 (line 208 — voice/microcopy), AR-28 (line 160 — Performance Mode invariants)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4] (line 842) — `PerformanceModeContext` lives in Story 1.5; Story 2.4 consumes the existing provider
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1] (lines 1354–1369) — `setActive(true)` is called from the `Start performance ›` handler in Story 4.1; the chrome-hide path Story 1.5 provides is what makes it work
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md#Information Architecture] (lines 36–67) — top nav + bottom tabs surface inventory; routing rules
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md#Component Patterns] (lines 86–104) — `BandLabel`, `BottomTabs`, top nav behavioral rules
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md#State Patterns] (lines 106–127) — empty-state copy locked: `No upcoming gigs.`, `No songs in this library yet.`, no CTA in empty states
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md#Voice and Tone] (lines 69–84) — short complete sentences, no exclamation marks, no marketing voice
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md#Components] (lines 188–207) — visual treatment of `Top nav (MacBook)`, `Bottom tabs`, `Band label`
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md#Scale] (lines 126–146) — `home-tonight: 28pt`, `practice-body: 17–18pt`, type-scale floors
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md#Layout & Spacing] (lines 147–165) — MacBook max-width ~960pt; iPhone gutter 16pt; 4pt base spacing
- [Source: _bmad-output/implementation-artifacts/1-1-repo-scaffold-and-toolchain.md] — pnpm workspace structure, Biome config, Vitest setup, port choices
- [Source: _bmad-output/implementation-artifacts/1-2-design-system-foundation-tokens-typography-atmospheres.md] — `tokens.css`, `EMPTY_STATES` microcopy module, `applyBootAtmosphere()`, `isIPhone()`
- [Source: _bmad-output/implementation-artifacts/1-3-aws-infrastructure-stacks-data-api-web-observability-ci.md] — infra context (not directly relevant to this story's web-only scope)
- [Source: _bmad-output/implementation-artifacts/1-4-access-gate-single-password-jwt-cookie-ssm.md] — `AuthProvider`, `AuthContext`, `AuthenticatedShell` (minimal), `ReauthBanner`, `RequireAuth`, `redirect-on-401.ts` placeholder hook to remove, deferred-work entry to resolve
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — `app-bootstrap.test.tsx` ambiguity entry (Task 9 resolves)
- [Source: CLAUDE.md] — boundaries, React Router 7 import path, Tailwind v4 import pattern, Biome-only, Zod-as-single-source-of-truth (this story has no Zod schemas)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) via Claude Code, baseline_commit `7384bc6`.

### Debug Log References

- `pnpm -F web exec vitest run` against each new test file in red→green order during authoring.
- `pnpm typecheck` (recursive, 5 packages) — initial run flagged `noUncheckedIndexedAccess` errors in `top-nav.test.tsx` where `items[N]` returned `HTMLElement | undefined`; fixed by destructuring with a `[HTMLElement, ...]` tuple cast at the test boundary.
- `pnpm lint` (Biome `check .`) — Biome flagged an unnecessary fragment wrapper in `authenticated-shell.test.tsx` and reformatted a `useMemo` invocation in `performance-context.tsx`. `pnpm lint:fix` applied the format fix; the fragment wrapper was removed manually.
- `pnpm -F web run build` — 117 modules transformed, CSS bundle 8.57 kB. Grepped the emitted CSS for every `var(--…)` token reference used in the new components plus `min-w-tap` and `min-h-tap`; all present.
- `pnpm -F e2e run test` — the Story 1.1 `placeholder.spec.ts` smoke pointed at the removed Placeholder route's `<h1>GigBuddy</h1>`. Renamed to `shell.spec.ts` and rewrote the assertion to bind to the new BandLabel text + `Primary` navigation landmark + Setlists empty-state copy. The dev-server-only e2e proves the MacBook chrome paints end-to-end.

### Completion Notes List

- AC-1 through AC-8 satisfied; unit + integration tests added for every new component, hook, and route.
- `PerformanceModeProvider` mounted outermost in `app-bootstrap.tsx`, above `AuthProvider` and `RouterProvider`. The setter identity is stable across renders (verified by test).
- `usePerformanceActive` placeholder removed from `redirect-on-401.ts`; `router.tsx` re-points to `performance/performance-context.js`. `shouldRedirectOn401`'s contract is unchanged and its truth-table tests still pass.
- `BandLabel` is rendered as a `<span>` with no `tabindex`, `role`, `aria-*`, or click handler — verified by assertion in `band-label.test.tsx`.
- `TopNav` exposes `rightActions?: ReactNode` — the slot Story 3.4 will mount `+ New setlist` into without touching this component. The Story 1.5 call site in `AuthenticatedShell` passes nothing to the slot.
- `BottomTabs` carries `min-w-tap min-h-tap` on each tab to satisfy AC-3's 44×44pt rule literally (the snippet in Task 5 had only `min-h-tap`; added `min-w-tap` to honor the AC text — `flex-1` would dominate width at runtime, but the utility is present per the AC).
- `Home` and `Library` render empty states only, sourced from `EMPTY_STATES.noUpcomingGigs` / `EMPTY_STATES.noSongsInLibrary` (no inline strings). Both expose `sr-only` `<h1>` headings for the accessibility tree.
- `AuthenticatedShell` is device-conditional + chrome-visibility-gated. Performance Mode (Story 4.1) only needs to flip `useSetPerformanceActive()(true)` to hide both chrome surfaces; no further plumbing in this shell will be needed.
- `app-bootstrap.test.tsx` authenticated-200 assertion now binds to `getByRole('heading', { level: 1, name: 'Setlists' })` + the `EMPTY_STATES.noUpcomingGigs` text — two unambiguous post-loading-shell signals. The deferred-work entry from the 1.4 review is struck through in `deferred-work.md` with a "Resolved in Story 1.5 (Task 9)" annotation.
- `Placeholder` route + test deleted; `e2e/smoke/placeholder.spec.ts` renamed to `shell.spec.ts` and rewritten to assert on the new MacBook chrome + Setlists empty state.
- **Tailwind v4 spot-check evidence:** every arbitrary-value token class used by the new components appears in `dist/assets/index-*.css` (verified by grep for the underlying `var(--…)` references — 11 of 11 tokens emitted, plus `min-h-tap` and `min-w-tap`).
- **Manual smoke (MacBook):** `pnpm dev:web` starts on `http://localhost:5273/`. The Playwright shell smoke spec exercises this same dev server and confirms the BandLabel, Primary navigation, and `No upcoming gigs.` empty state are visible. No human-eyes smoke beyond the Playwright assertion was needed for the structural deliverable; deferring on-device visual review of cursor/focus styling (no cursor change on the inert `<span>`; no focus ring on tab) and the iPhone bottom-tabs safe-area-inset behavior to Sandy.
- **iPhone manual smoke:** UA-gated. Deferring to Sandy to verify on real iPhone Safari that (a) `TopNav` is absent, (b) `BottomTabs` is fixed at the bottom with `Setlists` active by default, (c) the safe-area-inset prevents the home-indicator gesture region from clipping the tabs.
- No new dependencies introduced. No `web/package.json` changes. No new tokens added to `tokens.css`.

### File List

**Added**

- `web/src/performance/performance-context.tsx`
- `web/src/performance/performance-context.test.tsx`
- `web/src/hooks/use-chrome-visible.ts`
- `web/src/hooks/use-chrome-visible.test.tsx`
- `web/src/lib/band.ts`
- `web/src/components/band-label.tsx`
- `web/src/components/band-label.test.tsx`
- `web/src/components/top-nav.tsx`
- `web/src/components/top-nav.test.tsx`
- `web/src/components/bottom-tabs.tsx`
- `web/src/components/bottom-tabs.test.tsx`
- `web/src/routes/home.tsx`
- `web/src/routes/home.test.tsx`
- `web/src/routes/library.tsx`
- `web/src/routes/library.test.tsx`
- `web/src/routes/authenticated-shell.test.tsx`
- `e2e/smoke/shell.spec.ts` _(renamed from `e2e/smoke/placeholder.spec.ts`; content rewritten to match the new authenticated shell)_

**Modified**

- `web/src/auth/redirect-on-401.ts` — removed the placeholder `usePerformanceActive()` export.
- `web/src/auth/redirect-on-401.test.ts` — removed the placeholder-hook describe block; truth-table coverage of `shouldRedirectOn401` unchanged.
- `web/src/router.tsx` — re-points `usePerformanceActive` import to `performance/performance-context.js`; replaces `Placeholder` index with `Home`; adds `Library` route.
- `web/src/routes/authenticated-shell.tsx` — replaces the minimal `<><ReauthBanner /><Outlet /></>` body with device-conditional chrome composition (TopNav on MacBook, BottomTabs on iPhone), chrome-visibility-gated by `useChromeVisible()`, with iPhone `<main>` bottom padding for the fixed tab bar.
- `web/src/app-bootstrap.tsx` — wraps `<AuthProvider><RouterProvider/></AuthProvider>` with the outermost `<PerformanceModeProvider>`.
- `web/src/app-bootstrap.test.tsx` — authenticated-200 case now asserts on the `Setlists` heading + `EMPTY_STATES.noUpcomingGigs` text; the boot loading shell assertion is preserved.
- `_bmad-output/implementation-artifacts/deferred-work.md` — strikethrough on the `app-bootstrap.test.tsx` ambiguity entry with a "Resolved in Story 1.5 (Task 9)" annotation.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `1-5-navigation-chrome-scaffold` status set to `review`.

**Deleted**

- `web/src/routes/placeholder.tsx`
- `web/src/routes/placeholder.test.tsx`

### Review Findings

- [x] [Review][Patch] PerformanceModeProvider should wrap both AppBootstrap branches — currently only mounted in the `ready=true` branch; the pre-`ready` `<h1>GigBuddy</h1>` return renders without the provider, violating AC-7's "mounted at the root of the React tree" requirement and creating a throw risk if the loading UI ever calls a performance hook [`web/src/app-bootstrap.tsx:36`]

- [x] [Review][Defer] `fetchMe()` has no `.catch()` — network failure leaves app in permanent `<h1>GigBuddy</h1>` loading state with no error UI, retry, or user feedback [`web/src/app-bootstrap.tsx:22`] — deferred, pre-existing from Story 1.4 baseline
- [x] [Review][Defer] `shouldRedirectOn401` called with hardcoded `wasNetworkSuccess: true` in `RequireAuth` — the `wasNetworkSuccess: false` branch in `shouldRedirectOn401` is dead code in the render path; if a future auth interceptor sets `auth.status = 'unauthenticated'` on a cache-hit 401, the offline guard will not fire [`web/src/router.tsx` RequireAuth] — deferred, pre-existing from Story 1.4 baseline
- [x] [Review][Defer] E2E iPhone/BottomTabs path has no coverage — the `shell.spec.ts` smoke only exercises the MacBook chrome; iPhone tab bar behavior is untested at the e2e layer [`e2e/smoke/shell.spec.ts`] — deferred, acknowledged in dev agent record ("iPhone manual smoke: UA-gated. Deferring to Sandy")

### Change Log

- 2026-06-12 — Code review complete. 1 patch finding, 3 deferred, 14 dismissed.
- 2026-06-11 — Story 1.5 implementation complete. Added PerformanceModeContext + useChromeVisible seam (the architectural prerequisites for Epic 4's chrome-hide path), TopNav + BottomTabs + BandLabel chrome surfaces, Home + Library empty-state routes, and the AuthenticatedShell device-conditional composition. Resolved the Story 1.4 `app-bootstrap.test.tsx` deferred-work item. All 63 web vitest specs, all 4 redirect-on-401 specs, all 31 infra Lambda specs, all api/shared specs, and the e2e shell smoke pass. Typecheck and Biome lint clean across 5 packages. Tailwind v4 build emits all required arbitrary-value token utilities + `min-w-tap` / `min-h-tap`.
