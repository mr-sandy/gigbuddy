---
baseline_commit: bc100fe
builds_on: 2-1-service-worker-pwa-manifest
---

# Story 2.2: iPhone PWA install gate

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Sandy,
I want the iPhone surface to route to install-instructions until the PWA is installed,
so that storage eviction by iOS Safari is prevented (`navigator.storage.persist()` is meaningful only post-install) and Performance Mode's Wake Lock prerequisite is enforced.

## Acceptance Criteria

**AC-1 — `web/src/lib/platform.ts` exports `isStandalone()` alongside the existing `isIPhone()`**

**Given** `web/src/lib/platform.ts`
**When** reviewed
**Then** the module exports `isStandalone(): boolean` in addition to the existing `isIPhone()`
**And** `isStandalone()` returns `true` when `window.matchMedia('(display-mode: standalone)').matches` is `true` OR when the legacy iOS-Safari `navigator.standalone === true`
**And** `isStandalone()` returns `false` in non-browser environments (`typeof window === 'undefined'`) so it is safe to call from any module that imports it
**And** `isIPhone()` retains its current signature and behavior (Story 1.2 contract — UA-based detection of iPhone + iPod; iPad explicitly returns `false` per NFR-26)
**And** the file's header comment is updated to reflect that the helper now also reports install state (the existing comment already anticipates Story 2.2 — refresh it from "to be added" to a present-tense description)

**AC-2 — iPhone Safari (`isIPhone() === true && isStandalone() === false`) renders the install-instructions surface before any API call or auth check**

**Given** an iPhone visitor opening the SPA (`isIPhone()` returns `true`) where `isStandalone()` returns `false`
**When** `AppBootstrap` mounts
**Then** no `fetch('/api/v1/me')` request is issued (verifiable in tests via a fetch stub assertion `expect(fetchMock).not.toHaveBeenCalled()`)
**And** the rendered tree is `<PerformanceModeProvider><InstallInstructions /></PerformanceModeProvider>` — neither `AuthProvider` nor `RouterProvider` is mounted on the install-gate path
**And** the surface renders synchronously (no boot loading shell) — `isIPhone()` and `isStandalone()` are both synchronous, so the gate decision happens before React paints
**And** the requested URL is preserved (no `history.replaceState` call) — the gate is determined by UA + display-mode, not URL; once the user installs the PWA and re-launches from the home screen, the original URL resolves normally

**AC-3 — iPhone PWA standalone (`isStandalone() === true`) bypasses the install gate**

**Given** an iPhone visitor where `isStandalone()` returns `true` (running from the installed PWA — `display-mode: standalone` matches, or `navigator.standalone === true`)
**When** `AppBootstrap` mounts
**Then** the existing boot sequence runs unchanged: `fetchMe()` fires, the auth state resolves, the router mounts, and the user lands at the route they requested (or `/login` per the auth flow)
**And** the install-instructions surface is NOT rendered

**AC-4 — MacBook (`isIPhone() === false`) bypasses the install gate regardless of standalone state**

**Given** a MacBook visitor (`isIPhone()` returns `false`)
**When** `AppBootstrap` mounts
**Then** the install gate is never evaluated against `isStandalone()` — the gate predicate is `isIPhone() && !isStandalone()`, and the short-circuit on `isIPhone() === false` means MacBook always boots the normal sequence
**And** the install-instructions surface is NOT rendered on MacBook even if `display-mode: standalone` happens to match (a future PWA install on macOS is out of scope per NFR-26; the surface is iPhone-only)

**AC-5 — `web/src/routes/install-instructions.tsx` renders an accessible, voice-compliant, hard-gate surface**

**Given** the `InstallInstructions` component
**When** rendered (any viewport)
**Then** the surface fills the viewport with the Performance-atmosphere palette (background `var(--color-bg)`, text `var(--color-text-primary)`, accent `var(--color-accent)` — the Performance atmosphere is already applied to `<html>` on iPhone by `applyBootAtmosphere()` from Story 1.2; the component does not flip the atmosphere itself)
**And** the surface respects iPhone safe-area insets via `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` so the top notch and bottom home-indicator do not occlude content
**And** the surface contains, in order:
  - A primary heading (`<h1>`) with the accessible name `Install GigBuddy`
  - A short explanatory paragraph: `GigBuddy runs on iPhone as a home-screen app.`
  - An ordered list (`<ol>`) of three steps, each as a list item:
    1. `Tap the Share button at the bottom of Safari.`
    2. `Scroll and tap "Add to Home Screen".`
    3. `Tap Add. Then open GigBuddy from your home screen.`
**And** the copy follows UX-DR7 voice & tone (microcopy reference at `web/src/lib/microcopy.ts`): short complete sentences, no exclamation marks, no emoji, no marketing voice, no encouragement
**And** the surface contains NO dismiss, skip, "I've already installed", or "continue without installing" affordances (the gate is hard — per architecture line 284 and UX-DR8 "no skip / dismiss button")
**And** the surface contains NO automatic redirect logic, polling, or retry — Sandy installs, opens the home-screen icon, and `isStandalone()` returns `true` on the next launch, bypassing the gate (AC-3)
**And** the body text is the editorial-serif face (`var(--font-serif-editorial)`) inherited from `html` (globals.css); the ordered-list items use a body-floor size from the Performance type scale (`var(--text-perf-body)` — 18pt, satisfying NFR-17's Performance body floor)
**And** the component has zero side effects (no `useEffect`, no event listeners) — it is a pure render

**AC-6 — `app-bootstrap.tsx` short-circuits on the install gate predicate**

**Given** `web/src/app-bootstrap.tsx`
**When** reviewed
**Then** the bootstrap computes `const installGateActive = isIPhone() && !isStandalone()` at the top of the function body (before the `useState`/`useEffect` hooks read auth state)
**And** the install-gate branch returns `<PerformanceModeProvider><InstallInstructions /></PerformanceModeProvider>` early — before the existing `useState<AuthState>`, `useEffect` calling `fetchMe`, and conditional render of the auth shell
**And** the `useEffect` that fires `fetchMe()` is gated by `installGateActive` so the effect does not call `fetchMe` on the install-gate path (the effect's body checks `if (installGateActive) return;` after the cleanup wiring, OR the entire effect is conditionally omitted via early return at the top of the component — pick whichever keeps React's Rules of Hooks intact: a hook may not be skipped, but its body may early-exit)
**And** the existing auth-resolution branches (authenticated / unauthenticated / unknown) and the offline-cache path (architecture lines 692–702) are untouched on the non-gate paths

**AC-7 — Tests cover the four boot paths (iPhone Safari gated, iPhone PWA passes, MacBook passes, fetchMe is not called on the gated path)**

**Given** `web/src/app-bootstrap.test.tsx`
**When** the suite runs
**Then** new tests cover, in addition to the existing four cases:
  - **iPhone Safari (gated)** — stubs `navigator.userAgent` to an iPhone Safari UA, stubs `window.matchMedia('(display-mode: standalone)')` to return `{matches: false}`, stubs `(navigator as { standalone?: boolean }).standalone = false`, renders `<AppBootstrap />`, asserts the install-instructions heading is present (`screen.getByRole('heading', { name: 'Install GigBuddy' })`), and asserts `expect(fetchMock).not.toHaveBeenCalled()`
  - **iPhone PWA standalone (passes)** — stubs the iPhone UA and `window.matchMedia('(display-mode: standalone)').matches = true`, the existing 200-`/me` fetch stub fires, asserts the authenticated shell renders (Setlists heading + `EMPTY_STATES.noUpcomingGigs`) and `fetchMock` WAS called
  - **MacBook (passes)** — preserves the existing MacBook test paths; one explicit case stubs a Mac UA and asserts the install-instructions surface is NOT rendered

**Given** `web/src/lib/platform.test.ts`
**When** the suite runs
**Then** new tests cover `isStandalone()`:
  - Returns `true` when `window.matchMedia('(display-mode: standalone)').matches` is `true` (stub `window.matchMedia` to return `{matches: true, media: '...', addListener: () => {}, removeListener: () => {}}` or use `vi.stubGlobal` with a partial `MediaQueryList` shape — jsdom's `matchMedia` is undefined by default)
  - Returns `true` when `(navigator as { standalone?: boolean }).standalone === true` even if `matchMedia` reports `matches: false` (legacy iOS Safari path)
  - Returns `false` when both signals are falsy
  - Returns `false` when `typeof window === 'undefined'` (SSR-safety check, even though we don't SSR; the guard is cheap and the existing `isIPhone()` mirrors it)

**Given** a new `web/src/routes/install-instructions.test.tsx`
**When** the suite runs
**Then** tests assert:
  - The heading `Install GigBuddy` is present
  - The three step strings from AC-5 are present, each as an `<li>`
  - No element with text matching `/dismiss|skip|continue|already installed/i` is rendered
  - No `button` element is rendered (the component has zero interactive controls)

**AC-8 — Build-output `index.html` adds the iOS Safari install-prompt hint (`<meta name="apple-itunes-app">` exclusion is documented, not added)**

**Given** `web/index.html` (Story 2.1 baseline already added the five iOS install meta/link tags)
**When** reviewed for Story 2.2
**Then** NO new `<meta>` or `<link>` tags are added — Story 2.1 already declared `<meta name="apple-mobile-web-app-capable">`, `<meta name="apple-mobile-web-app-status-bar-style">`, `<meta name="apple-mobile-web-app-title">`, `<link rel="apple-touch-icon">`, and `<meta name="theme-color">`. Story 2.2 is purely a route-and-helper story; it does not change the install metadata.
**And** the Dev Notes explicitly call out why no `<meta name="apple-itunes-app">` tag is added (that meta is the App Store smart banner; GigBuddy ships no native iOS app, so the tag does not apply)

**AC-9 — Manual verification on Sandy's iPhone (explicit unchecked checkbox; story does not flip to `done` until ticked, per Epic 1 retro Lesson #1)**

**Given** the deployed PWA at `https://gig.cormie.com/` with Story 2.2 shipped
**When** Sandy opens the site in iPhone Safari (uninstalled)
**Then** the install-instructions surface renders immediately — no password prompt, no Setlists view, no loading state stuck on `GigBuddy` shell
**And** the three install steps from AC-5 are visible and legible at iPhone 13's 390pt viewport with safe-area insets respected (text not occluded by the top notch or bottom home indicator)
**And** Sandy follows the steps, completes the install, opens GigBuddy from the home-screen icon
**And** the launched PWA does NOT show the install-instructions surface — instead it boots the normal sequence (which, since Sandy is not yet logged in on this device, surfaces `/login`)
**And** Sandy pastes a one-line confirmation into the Dev Agent Record's Completion Notes (e.g., "iPhone 13 / iOS 18.x at 2026-06-XX: pre-install gate rendered the install-instructions screen; post-install standalone launch bypassed the gate and surfaced /login.") and ticks this checkbox

## Tasks / Subtasks

- [x] **Task 1 — Add `isStandalone()` to `web/src/lib/platform.ts`** (AC: 1)
  - [x] Open `web/src/lib/platform.ts`. Add the new export below `isIPhone()`:
    ```typescript
    /*
     * Reports whether the app is running as an installed PWA. On iPhone this
     * is the install-gate signal consumed by app-bootstrap (Story 2.2).
     *
     * Two signals, both honored on current iOS:
     *   - `window.matchMedia('(display-mode: standalone)').matches` — modern
     *     spec-compliant signal (PWA manifest `display: "standalone"`)
     *   - `navigator.standalone === true` — legacy iOS Safari signal (pre-spec;
     *     still emitted by current iOS as a redundant compatibility hint)
     * Either being truthy is sufficient to consider the app installed.
     */
    export function isStandalone(): boolean {
      if (typeof window === 'undefined') return false;
      if (window.matchMedia('(display-mode: standalone)').matches) return true;
      const legacyStandalone = (navigator as { standalone?: boolean }).standalone;
      return legacyStandalone === true;
    }
    ```
  - [x] Update the header comment block to reflect present-tense reality (the existing comment says "the Wake Lock / install gate (Stories 2.2, 4.x) all read from `isIPhone()`" — Story 2.2 now also reads from `isStandalone()`; reword to "Atmosphere wiring, the install gate (Story 2.2), and Wake Lock (Story 4.x) all read from these helpers so detection stays in lockstep.").
  - [x] **Do NOT cache the matchMedia result.** `window.matchMedia` is cheap to invoke; caching would create a stale-state bug if iOS ever flips display-mode mid-session (it doesn't today, but caching adds no value here).
  - [x] **Do NOT add a `matchMedia` listener for change events.** The install gate is a boot-time decision; we re-read on every render of `AppBootstrap`, which is sufficient. A reactive listener would force the gate to be stateful for zero practical benefit.

- [x] **Task 2 — Create `web/src/routes/install-instructions.tsx`** (AC: 5)
  - [x] Create `web/src/routes/install-instructions.tsx`:
    ```typescript
    /*
     * Hard install gate for iPhone Safari (Story 2.2, AR-22, UX-DR8, NFR-25).
     *
     * Rendered by app-bootstrap when isIPhone() && !isStandalone(). The surface
     * has no dismiss / skip — installation is a precondition for Wake Lock and
     * full-screen privileges on iPhone (NFR-25), and for navigator.storage
     * persistence (AR-21, consumed by Story 2.4's outbox).
     *
     * The Performance atmosphere is already on <html> at boot time for iPhone
     * (applyBootAtmosphere in main.tsx); this component reads tokens via CSS
     * variables and does not need to flip the atmosphere itself.
     */
    export function InstallInstructions() {
      return (
        <main
          aria-labelledby="install-heading"
          className="mx-auto flex min-h-[100dvh] max-w-[480px] flex-col justify-center px-[var(--spacing-gutter)]"
          style={{
            paddingTop: 'max(env(safe-area-inset-top), var(--spacing-section-gap))',
            paddingBottom: 'max(env(safe-area-inset-bottom), var(--spacing-section-gap))',
          }}
        >
          <h1
            id="install-heading"
            className="text-[length:var(--text-perf-title)] leading-[var(--text-perf-title--line-height)] text-[color:var(--color-text-primary)]"
          >
            Install GigBuddy
          </h1>
          <p className="mt-[var(--spacing-card-stack-gap)] text-[length:var(--text-perf-body)] leading-[var(--text-perf-body--line-height)] text-[color:var(--color-text-secondary)]">
            GigBuddy runs on iPhone as a home-screen app.
          </p>
          <ol className="mt-[var(--spacing-section-gap)] flex list-decimal flex-col gap-[var(--spacing-card-stack-gap)] pl-[calc(var(--spacing-unit)*6)] text-[length:var(--text-perf-body)] leading-[var(--text-perf-body--line-height)] text-[color:var(--color-text-primary)]">
            <li>Tap the Share button at the bottom of Safari.</li>
            <li>Scroll and tap &ldquo;Add to Home Screen&rdquo;.</li>
            <li>Tap Add. Then open GigBuddy from your home screen.</li>
          </ol>
        </main>
      );
    }
    ```
  - [x] **Why `min-h-[100dvh]` not `min-h-screen`:** the `dvh` unit (dynamic viewport height) accounts for iOS Safari's dynamic toolbar collapse/expand. Using `100vh` on iOS Safari can leave content cropped behind the floating toolbar.
  - [x] **Why `max(env(safe-area-inset-*), var(--spacing-section-gap))`:** if `env(safe-area-inset-*)` is `0` (non-iPhone or unsupported), the `max()` falls back to the standard section gap so the surface still has comfortable padding. Critical because the install gate may also render in test environments where insets are `0`.
  - [x] **Why no button or link:** the gate is hard (UX-DR8, architecture line 284). Adding a "Already installed?" button would invite Sandy to bypass the gate on iPhone Safari where the install signal is genuinely false — a footgun for the Wake Lock prerequisite.
  - [x] **Why no `useEffect` or event handlers:** the component is a pure render. No polling, no auto-redirect-on-install-detection. Sandy installs → re-launches from home screen → `isStandalone()` returns `true` → `AppBootstrap` doesn't render this component on the next mount. State transitions are owned by the iOS install lifecycle, not the component.
  - [x] **Why `&ldquo;` and `&rdquo;` not raw `"`:** the smart-quote entities render typographic quotes consistent with the editorial-serif face. Raw straight quotes look out of place in body copy. (Project precedent: no other component currently uses smart quotes in JSX strings — this is the first; if Sandy prefers straight quotes for code-hygiene reasons, switch to `&quot;` or raw `"`. The AC text uses straight quotes for searchability.)

- [x] **Task 3 — Gate `AppBootstrap` on the install predicate** (AC: 2, 3, 4, 6)
  - [x] Open `web/src/app-bootstrap.tsx`. Add the imports:
    ```typescript
    import { isIPhone, isStandalone } from './lib/platform.js';
    import { InstallInstructions } from './routes/install-instructions.js';
    ```
  - [x] Add the gate predicate at the top of the `AppBootstrap` function body, BEFORE the existing `useState` calls:
    ```typescript
    const installGateActive = isIPhone() && !isStandalone();
    ```
  - [x] Gate the existing `useEffect`'s body so it does not call `fetchMe()` on the install-gate path. **Hooks must not be skipped** — keep the `useEffect` call site exactly where it is, but early-return inside the effect body:
    ```typescript
    useEffect(() => {
      if (installGateActive) return;
      let cancelled = false;
      fetchMe().then((state) => {
        if (cancelled) return;
        setInitial(state);
        setReady(true);
      });
      return () => {
        cancelled = true;
      };
    }, [installGateActive]);
    ```
    Add `installGateActive` to the dependency array. Because the predicate is derived from synchronous functions of UA + display-mode, it is stable across the component's lifetime — the dependency is included to satisfy `react-hooks/exhaustive-deps` semantics, not because it actually changes.
  - [x] Return the install-instructions surface BEFORE the existing `ready`/`authenticated` branches. The final structure:
    ```typescript
    return (
      <PerformanceModeProvider>
        {installGateActive ? (
          <InstallInstructions />
        ) : !ready ? (
          <h1>GigBuddy</h1>
        ) : (
          <AuthProvider initial={initial}>
            <RouterProvider router={router} />
          </AuthProvider>
        )}
      </PerformanceModeProvider>
    );
    ```
  - [x] **Why the gate sits INSIDE `PerformanceModeProvider`:** architecture line 654 / Story 1.5 AC-7 mounts the provider at the root of the React tree so any subsystem can read `usePerformanceActive()`. The install-instructions surface doesn't currently read it, but a future error reporter (Story 2.4 `web/src/lib/error-reporter.ts`) wrapping the install surface in an `ErrorBoundary` would want to read `performanceActive`. Keep the provider's mounting point invariant.
  - [x] **Why the gate sits OUTSIDE `AuthProvider` and `RouterProvider`:** the install gate is the surface — not a gated route. Mounting auth and router on the gate path would (a) require a `RequireStandalone` wrapper in `router.tsx` (more code, two places to keep in sync), (b) force `fetchMe()` to fire so `auth.status` can resolve, and (c) leak login/redirect concerns into the gate path. The short-circuit at the top of the tree is the smallest change that satisfies "BEFORE any API call or auth check" (epic Story 2.2 AC).

- [x] **Task 4 — Extend tests** (AC: 7)
  - [x] Open `web/src/lib/platform.test.ts`. Import `isStandalone` and add a `describe('isStandalone', () => { ... })` block after the existing `isIPhone` block:
    ```typescript
    function stubMatchMedia(matches: boolean): void {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }));
    }

    function stubLegacyStandalone(value: boolean | undefined): void {
      vi.stubGlobal('navigator', { ...navigator, standalone: value });
    }

    describe('isStandalone', () => {
      it('returns true when display-mode standalone matches', () => {
        stubMatchMedia(true);
        stubLegacyStandalone(undefined);
        expect(isStandalone()).toBe(true);
      });

      it('returns true via legacy navigator.standalone even when display-mode does not match', () => {
        stubMatchMedia(false);
        stubLegacyStandalone(true);
        expect(isStandalone()).toBe(true);
      });

      it('returns false when neither signal is truthy', () => {
        stubMatchMedia(false);
        stubLegacyStandalone(undefined);
        expect(isStandalone()).toBe(false);
      });

      it('returns false when navigator.standalone is explicitly false', () => {
        stubMatchMedia(false);
        stubLegacyStandalone(false);
        expect(isStandalone()).toBe(false);
      });
    });
    ```
    **Why `vi.stubGlobal('matchMedia', ...)`:** jsdom does not implement `window.matchMedia`. Stubbing the global with a minimal `MediaQueryList`-shaped factory satisfies the helper's type contract; the existing `afterEach(() => vi.unstubAllGlobals())` cleans up.
  - [x] Create `web/src/routes/install-instructions.test.tsx`:
    ```typescript
    import { render, screen } from '@testing-library/react';
    import { describe, expect, it } from 'vitest';
    import { InstallInstructions } from './install-instructions.js';

    describe('InstallInstructions', () => {
      it('renders the install heading and the three steps', () => {
        render(<InstallInstructions />);
        expect(screen.getByRole('heading', { level: 1, name: 'Install GigBuddy' })).toBeInTheDocument();
        expect(screen.getByText('GigBuddy runs on iPhone as a home-screen app.')).toBeInTheDocument();
        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(3);
        expect(items[0]).toHaveTextContent('Tap the Share button at the bottom of Safari.');
        expect(items[1]).toHaveTextContent('Add to Home Screen');
        expect(items[2]).toHaveTextContent('Tap Add. Then open GigBuddy from your home screen.');
      });

      it('exposes no interactive controls (the gate is hard — no skip / dismiss)', () => {
        render(<InstallInstructions />);
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.queryByRole('link')).toBeNull();
      });

      it('contains no voice-and-tone-violating copy (no exclamation marks, no emoji)', () => {
        render(<InstallInstructions />);
        const text = document.body.textContent ?? '';
        expect(text).not.toMatch(/!/);
        // Emoji ranges (Misc Symbols, Dingbats, supplemental, etc.). Cheap guard.
        expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
      });
    });
    ```
  - [x] Extend `web/src/app-bootstrap.test.tsx`. Add the helpers (or reuse the platform-test stubs by importing them — they're inline today; cleanest is to duplicate the small helpers here so the test file stays self-contained):
    ```typescript
    function stubIPhoneUA(): void {
      vi.stubGlobal('navigator', {
        ...navigator,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      });
    }

    function stubIPhonePWA(): void {
      vi.stubGlobal('navigator', {
        ...navigator,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
        standalone: true,
      });
    }

    function stubMatchMedia(matches: boolean): void {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }));
    }
    ```
    Add three new `it()` cases:
    - **iPhone Safari renders install-instructions and never probes /me**
      ```typescript
      it('renders the install-instructions surface and skips /me on iPhone Safari', async () => {
        stubIPhoneUA();
        stubMatchMedia(false);
        render(<AppBootstrap />);
        expect(screen.getByRole('heading', { level: 1, name: 'Install GigBuddy' })).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
      });
      ```
    - **iPhone PWA standalone boots normally**
      ```typescript
      it('boots the authenticated shell on iPhone PWA (display-mode standalone)', async () => {
        stubIPhonePWA();
        stubMatchMedia(true);
        fetchMock.mockResolvedValueOnce(
          jsonResponse(200, { status: 'ok', data: { authenticated: true, daysUntilExpiry: 365 } }),
        );
        render(<AppBootstrap />);
        await waitFor(() => {
          expect(screen.getByRole('heading', { level: 1, name: 'Setlists' })).toBeInTheDocument();
        });
        expect(fetchMock).toHaveBeenCalledWith('/api/v1/me', expect.anything());
      });
      ```
    - **MacBook bypasses the install gate regardless of matchMedia state**
      ```typescript
      it('boots the authenticated shell on MacBook even if display-mode standalone matches', async () => {
        // No iPhone UA stub — default jsdom navigator is a non-iPhone agent.
        stubMatchMedia(true); // simulates the edge of a future macOS PWA install
        fetchMock.mockResolvedValueOnce(
          jsonResponse(200, { status: 'ok', data: { authenticated: true, daysUntilExpiry: 365 } }),
        );
        render(<AppBootstrap />);
        await waitFor(() => {
          expect(screen.getByRole('heading', { level: 1, name: 'Setlists' })).toBeInTheDocument();
        });
        expect(screen.queryByRole('heading', { name: 'Install GigBuddy' })).toBeNull();
      });
      ```
  - [x] **Why test against `expect(fetchMock).not.toHaveBeenCalled()` on the gated path:** the architecture invariant is "before any API call or auth check" (epic Story 2.2 AC-2). A unit test that only checks the rendered surface would not catch a regression where the install-gate branch happens to render the surface BUT the `useEffect` still fires `fetchMe()` in the background. The fetch-mock assertion is the load-bearing test for this invariant.
  - [x] **Why no `RouterProvider` or `MemoryRouter` is needed in the install-gate test:** the gated path doesn't mount the router at all (AC-2). The existing test setup's `router.navigate('/', { replace: true })` reset is harmless on the gate path (the router is module-scoped but not mounted into the tree).

- [x] **Task 5 — Verification pass** (AC: 1–8)
  - [x] `pnpm typecheck` green across all packages. The new files (`web/src/routes/install-instructions.tsx`, `web/src/routes/install-instructions.test.tsx`) sit under `web/src/**` and are picked up by `web/tsconfig.json` automatically. The `isStandalone()` addition to `platform.ts` is typed; the `(navigator as { standalone?: boolean }).standalone` cast is intentional (the legacy iOS-Safari property is not in `lib.dom.d.ts`).
  - [x] `pnpm lint` green. Biome already covers `web/src/**`; no `biome.json` changes needed in this story.
  - [x] `pnpm test` green. New tests: ~4 in platform.test.ts, ~3 in install-instructions.test.ts, ~3 added to app-bootstrap.test.tsx. Total ~10 cases added.
  - [x] `pnpm build:web` green. The new route file adds a small chunk; nothing else changes in the build output. The build-output test from Story 2.1 (`web/src/build-output.test.ts`) is unaffected (the SW + manifest structure does not change).
  - [x] **Do NOT run `pnpm --filter web run assets:pwa`.** Icons are unchanged. The committed PNGs from Story 2.1 stay as-is.
  - [x] **Do NOT add a Playwright e2e test for the install gate.** The e2e suite (`e2e/smoke/`) runs against a single Chromium browser config with a desktop UA. There is no iPhone UA project in `e2e/playwright.config.ts` (deferred-work item from Story 1.5 review). Adding a Playwright iPhone-UA project just to assert this surface is a disproportionate cost; the unit test in `app-bootstrap.test.tsx` covers the load-bearing behavior. When Sandy adds an iPhone Playwright project in a future hardening pass, this story's gate can get e2e coverage at that time.

- [x] **Task 6 — Manual iPhone gate proof on Sandy's iPhone (explicit unchecked checkbox per Epic 1 retro Lesson #1)** (AC: 9)
  - [x] Sandy merges the Story 2.2 PR to `main`; `deploy.yml` (Story 1.6) ships the new bundle to `https://gig.cormie.com/`.
  - [x] Sandy opens `https://gig.cormie.com/` in iPhone Safari on his iPhone 13 with GigBuddy NOT yet installed (or installed and then removed — Settings → Safari → Advanced → Website Data → clear `gig.cormie.com` if needed).
  - [x] Sandy confirms the install-instructions surface renders immediately (no Setlists view, no password prompt, no `GigBuddy` boot-shell stuck state).
  - [x] Sandy confirms the three install steps are visible and legible with the safe-area insets honored (no notch occlusion, no home-indicator overlap on the bottom step).
  - [x] Sandy completes `Share → Add to Home Screen → Add`, opens GigBuddy from the home-screen icon.
  - [x] Sandy confirms the standalone launch BYPASSES the install-instructions surface. (Note: reached the authenticated Setlists shell rather than `/login` because iOS shares the cookie jar between Safari and the installed PWA for the same origin; the existing `gigbuddy_session` cookie carried across. Load-bearing claim — gate bypass — is confirmed; the `/login` parenthetical in the AC was a hypothesis about logged-out state on the device, not a hard requirement.)
  - [x] Sandy pastes a confirmation line into the Dev Agent Record's "Completion Notes List" (e.g., "iPhone 13 / iOS 18.x at 2026-06-XX: pre-install gate rendered the install-instructions screen; post-install standalone launch bypassed the gate and surfaced /login.") and ticks this checkbox.
  - [x] **Do NOT mark the story `done` in sprint-status.yaml until this checkbox is ticked.** The Epic 1 retro Lesson #1 made this the structural fix for "deferred to Sandy" handoff failures; Story 2.1 applied the same pattern.

## Dev Notes

### Architecture compliance (the contract you must follow)

**Source of truth:** `_bmad-output/planning-artifacts/architecture.md`. Patterns are the contract; deviations require updating that document, not the implementation.

This story implements the **iPhone PWA install gate** (architecture.md line 284, AR-22). It is the consumer of Story 2.1's manifest+SW: 2.1 makes installation possible; 2.2 enforces it as a precondition for the iPhone surface.

**Hard rules from the architecture:**

- **AR-22** (architecture line 282–284, epics line 150): "iPhone install-detection gate: on iPhone, if `display-mode: standalone` / `navigator.standalone` is false, the SPA routes to install-instructions before Performance Mode is reachable. PWA install is a hard precondition (per PRD §B)." Story 2.2 is the literal implementation of this rule.
- **NFR-25** (epics line 111): "PWA installation is required for the iPhone surface to grant Wake Lock and full-screen privileges." Wake Lock (Story 4.2) and full-screen (Performance Mode in Epic 4) both depend on standalone-mode launch; the gate enforces the precondition synchronously at boot.
- **AR-21** (epics line 149, architecture line 283): `navigator.storage.persist()` is meaningful only post-install (iOS Safari evicts storage from non-installed PWAs aggressively). Story 2.4 owns the `navigator.storage.persist()` call; Story 2.2 is the upstream gate that makes the persist() call actually durable.
- **UX-DR8** (epics line 210): "iPhone install instructions screen. When `display-mode` is not `standalone` and platform is iPhone, the SPA renders an install-instructions surface explaining how to add GigBuddy to the home screen. Performance Mode is unreachable until installed (per AR-22 / NFR-25). Copy and visual treatment follow Voice & Tone and DESIGN.md (UX-DR7, UX-DR1)."
- **UX-DR7** (epics line 208): "Voice and tone consistency for microcopy. All user-facing strings follow `EXPERIENCE.md` §Voice and Tone: short complete sentences; no exclamation marks; no emoji; no marketing voice; no encouragement layer."
- **NFR-17** (epics line 101): Performance Mode body floor is 18pt. The install-gate surface lives on iPhone with the Performance atmosphere already applied; using `var(--text-perf-body)` (18px) for body copy satisfies the floor.
- **NFR-20** (epics line 104): Tap targets ≥ 44×44pt. The install-gate surface has zero interactive controls (UX-DR8 "no skip / dismiss"), so the tap-target rule has nothing to enforce on this surface — it remains a project-wide invariant for components added in later stories.
- **AR-46** (epics line 186): No CSS-in-JS, no Redux/Zustand/Jotai, no form library, no analytics SDK. The install-instructions component is plain JSX + Tailwind utility classes + CSS variables; no new runtime dependencies.
- **AR-16** (architecture line 696): `/api/v1/me` distinguishes "offline → cache" from "online + 401 → login". The install gate fires BEFORE `fetchMe()` is invoked, so the AR-16 distinction is irrelevant on the gate path. On non-gate paths (MacBook, iPhone PWA standalone), AR-16 behaves exactly as Story 1.4 established.

**Patterns to reuse:**

- **Synchronous boot-time detection** (Story 1.2 baseline, `web/src/lib/atmosphere.ts` + `web/src/lib/platform.ts`): the atmosphere flip and the iPhone UA test are both synchronous calls fired before React paints. The install gate follows the same pattern — `isIPhone() && !isStandalone()` is computed inside `AppBootstrap`'s function body, no async resolution, no `useEffect`.
- **Boot-time short-circuit in `AppBootstrap`** (Story 1.5 PerformanceModeProvider mounting): the provider sits outside the async-resolved `AuthProvider/RouterProvider` branches. Story 2.2 adds an earlier branch (`installGateActive`) at the same level — the install-gate surface IS the rendered tree, not a routed surface.
- **Microcopy locked in `web/src/lib/microcopy.ts`** (Story 1.2): the install-gate copy from AC-5 is surface-specific and does not need to be a `microcopy.ts` constant (only reusable strings live there). The strings are inlined in the component file. Do NOT promote them to `microcopy.ts` unless a second surface needs them — wastes the file's locked-microcopy semantic.
- **Test stubbing pattern** (Story 1.2 `platform.test.ts`): `vi.stubGlobal('navigator', ...)` + `afterEach(() => vi.unstubAllGlobals())`. Story 2.2 extends with `vi.stubGlobal('matchMedia', ...)` (jsdom does not implement matchMedia; the stub provides a minimal `MediaQueryList`-shaped object).
- **`AuthenticatedShell` viewport-padding pattern** (Story 1.5 `web/src/routes/authenticated-shell.tsx`): uses `env(safe-area-inset-bottom)` to push content above the iPhone home indicator. Story 2.2's install-instructions surface uses `max(env(safe-area-inset-*), var(--spacing-section-gap))` for both top and bottom — same idea, with a non-zero fallback when insets are absent.

**Boundaries (CLAUDE.md §Boundaries, architecture lines 1017–1027):**

- `web` ↔ `api`: HTTP only. Story 2.2 explicitly does NOT call any `/api/v1/*` endpoint on the install-gate path. The non-gate paths inherit Story 1.4's `fetchMe()` call unchanged.
- `web` ↔ `shared`: types + Zod schemas only. Story 2.2 adds no new schema; the existing `MeResponseSchema` from Story 1.4 is consumed on the non-gate path only.
- `web` ↔ `infra`: none. No CDK, S3, or CloudFront changes. The deploy pipeline ships the new bundle automatically.

### Library and framework requirements (do NOT substitute)

- **No new dependencies.** This story is pure React + native Web APIs (`window.matchMedia`, `navigator.standalone`). Do NOT add any package — not `react-use`, not `@react-hookz/web`, not a "PWA install gate" library off npm. The two-line detection function is the canonical implementation.
- **React 19** (existing) — `useEffect` semantics for the install-gate dependency are React-18+/19-compatible. No StrictMode-double-invocation issue: the effect has no side effects on the gated path (early return).
- **React Router 7** (existing, imported from `react-router`, not `react-router-dom`) — Story 2.2 does NOT mount the router on the install-gate path. The router stays declared in `router.tsx` and is mounted only on the non-gate paths.
- **TanStack Query v5** (existing) — Story 2.2 does NOT use TanStack Query. The install-gate path renders nothing that needs a query. TanStack's `QueryClient` is provided in `main.tsx` above `AppBootstrap` and is harmless on the gate path (no queries fire).
- **`vite-plugin-pwa` and `@vite-pwa/assets-generator`** (Story 2.1 baseline) — present but not directly touched by Story 2.2. The manifest's `display: "standalone"` IS the signal `isStandalone()` checks for, so the two stories are tightly coupled at the manifest contract.
- **No `workbox-window` import** — same as Story 2.1. Auto-registration handles SW lifecycle; no app-level wiring.

### What this story does NOT include (anti-scope-creep)

These appear nearby in the architecture/epics but are owned by other stories. **Do not scaffold:**

- **`navigator.storage.persist()` call** (AR-21): Story 2.4 owns this. Story 2.2 makes the persist() call meaningful by enforcing install (iOS Safari only respects persist() for installed PWAs), but does NOT call persist() itself.
- **TanStack Query IndexedDB persister** (AR-20): Story 2.4.
- **Outbox for offline writes** (AR-20, AR-23): Story 2.4.
- **`/api/v1/client-errors` endpoint** (AR-39): Story 2.3 (server) + Story 2.4 (client wiring).
- **Wake Lock acquisition** (FR-18, AR-25): Story 4.2.
- **Full-screen / portrait-lock APIs**: Story 4.1 (entry) handles tab-bar hiding; the `manifest.webmanifest` orientation hint from Story 2.1 is the install-time signal. Story 2.2 does NOT call `screen.orientation.lock(...)`.
- **`window.matchMedia` change listener** for live `display-mode` switching: not needed. iOS doesn't toggle `display-mode` mid-session; re-reading on every `AppBootstrap` render is sufficient.
- **An "I've already installed" or "Continue without installing" bypass button**: explicitly forbidden by UX-DR8 ("no skip / dismiss button") and architecture line 284 ("hard precondition"). Do NOT add one even if it feels user-friendly.
- **Auto-detect when the user has just completed the install** (poll `isStandalone()`, redirect on transition): not needed. The user must launch from the home-screen icon to enter standalone mode; the next `AppBootstrap` mount naturally re-evaluates the predicate.
- **Smart App Banner via `<meta name="apple-itunes-app">`**: this is the App Store banner for native iOS apps. GigBuddy ships no native app; the meta is inapplicable and must NOT be added (it would surface an App Store sheet that 404s).
- **Update-prompt UI** (`virtual:pwa-register/react`): deferred (Story 2.1 anti-scope-creep). Not relevant to 2.2.
- **Onboarding tour, "What's new" sheet, success animation on standalone launch**: out of scope and against UX-DR7 voice & tone ("no encouragement layer").
- **Variants of the install-instructions surface per iOS version**: iOS Safari's Share-sheet UX has been stable since iOS 13 (the Share button position moved to the bottom of Safari in iOS 15 and has stayed there). One copy variant covers iPhone 13 (Sandy's primary device — NFR-24) running iOS 17+; older iOS versions are out of scope.
- **MacBook PWA install gate**: explicitly out of scope. AR-22 scopes the gate to iPhone only. MacBook visitors with `display-mode: standalone` (which would require Sandy to install the Chrome/Edge PWA on macOS, a path not exercised in V1) get the normal app shell — never the install-instructions surface.

If you find yourself wanting to scaffold any of the above, **don't**. The respective stories (or future polish work) own them.

### Existing files this story modifies — current state and what changes

#### `web/src/lib/platform.ts` (Task 1 — add `isStandalone()`)

**Current state:** Exports only `isIPhone()`. UA-based check returning `true` for `iPhone` or `iPod` in `navigator.userAgent`; `false` for iPad, MacBook, and all other browsers. Header comment anticipates Story 2.2 (says "the Wake Lock / install gate (Stories 2.2, 4.x) all read from `isIPhone()`").

**This story changes:** Adds the `isStandalone()` export; refreshes the header comment to reflect present-tense reality. Leaves `isIPhone()` untouched.

**Must preserve:** `isIPhone()`'s exact signature and behavior — it's consumed by `applyBootAtmosphere()` (`web/src/lib/atmosphere.ts`), `AuthenticatedShell` (`web/src/routes/authenticated-shell.tsx`), and `ReauthBanner` (`web/src/components/reauth-banner.tsx`). Any change to its behavior cascades to atmosphere flipping, chrome layout, and the re-auth banner suppression on iPhone.

#### `web/src/lib/platform.test.ts` (Task 4 — add `isStandalone()` tests)

**Current state:** Seven `it` cases covering `isIPhone()` across iPhone Safari, iPhone PWA, iPod, Mac Safari, Mac Chrome, Mac Firefox, and iPad UAs. Pattern: `vi.stubGlobal('navigator', { ...navigator, userAgent: '...' })` + `afterEach(() => vi.unstubAllGlobals())`.

**This story changes:** Adds a new `describe('isStandalone', () => { ... })` block with four `it` cases (display-mode true, legacy navigator.standalone true, both false, navigator.standalone explicitly false). Adds two small helpers (`stubMatchMedia`, `stubLegacyStandalone`) inside the file.

**Must preserve:** All existing `isIPhone` cases. The `afterEach` cleanup must run after both `describe` blocks — confirm by running the suite and checking no test leaks state.

#### `web/src/app-bootstrap.tsx` (Task 3 — gate on install predicate)

**Current state:** Renders `<PerformanceModeProvider>` wrapping either the boot-shell `<h1>GigBuddy</h1>` (while `ready=false`) or `<AuthProvider initial={initial}><RouterProvider router={router} /></AuthProvider>` (after `fetchMe()` resolves). The `useEffect` fires `fetchMe()` on mount; cancels on unmount.

**This story changes:**
1. Adds imports for `isIPhone`, `isStandalone`, and `InstallInstructions`.
2. Computes `installGateActive` at the top of the function body.
3. Adds the `installGateActive` early-return inside the `useEffect` body (and `installGateActive` to the dependency array).
4. Adds the `installGateActive ? <InstallInstructions /> : ...` branch as the OUTERMOST branch of the render's conditional ladder, inside `PerformanceModeProvider`.

**Must preserve:**
- The `PerformanceModeProvider` wrapping (architecture invariant: the provider sits at the top of the tree so any subsystem can read `usePerformanceActive()` — Story 1.5 AC-7).
- The boot-shell `<h1>GigBuddy</h1>` for the non-gated unready state.
- The `AuthProvider initial={initial}` shape (the auth context is fed the resolved `AuthState`).
- The `useEffect` cancellation pattern (`let cancelled = false` + `return () => { cancelled = true; }`) — the early-return on the gate path must occur BEFORE the `cancelled` declaration so the cancellation closure is not created on the gate path.

#### `web/src/app-bootstrap.test.tsx` (Task 4 — add gate-path tests)

**Current state:** Four `it` cases covering the existing boot paths (loading shell, authenticated 200, 401 redirect to /login, offline-cache fetch rejection). Setup stubs `fetch` globally and resets the router location before each test.

**This story changes:** Adds three new `it` cases (iPhone Safari gated, iPhone PWA standalone passes, MacBook bypasses gate). Adds `stubIPhoneUA()`, `stubIPhonePWA()`, and `stubMatchMedia(matches)` helpers inline.

**Must preserve:** The existing `beforeEach` that resets `fetchMock` and stubs `fetch`, and the `afterEach` that unstubs globals. The existing four cases should pass unchanged — the new gate predicate evaluates to `false` in the jsdom default environment (`navigator.userAgent` does not contain "iPhone"), so existing tests stay on the non-gated path.

### Existing files this story DOES NOT touch (regression safety)

- `web/src/main.tsx` — unchanged. `applyBootAtmosphere()` runs before React mounts; the atmosphere flip for iPhone is already correct.
- `web/src/router.tsx` — unchanged. The install gate does NOT mount the router on the gate path; the router declaration stays as-is and `RequireAuth` continues to gate `/` for non-gate paths.
- `web/src/auth/*` — unchanged. `fetchMe`, `AuthProvider`, `useAuth`, `shouldRedirectOn401`, `redirect-on-401.test.ts` all stay as-is. The gate path never enters this subsystem.
- `web/src/performance/performance-context.tsx` — unchanged. The provider is reused on the gate path (Story 1.5's mounting contract is preserved).
- `web/src/routes/{home,library,login,authenticated-shell}.tsx` — unchanged. These routes are only reachable on non-gate paths.
- `web/src/components/*`, `web/src/hooks/*`, `web/src/lib/{atmosphere,band,microcopy}.ts`, `web/src/styles/*` — unchanged. No CSS variable additions, no microcopy constant additions.
- `web/index.html` — unchanged. Story 2.1 already added the five iOS install meta/link tags; Story 2.2 adds no further `<meta>` or `<link>`.
- `web/vite.config.ts`, `web/pwa-assets.config.ts`, `web/public/icons/*`, `web/public/manifest.webmanifest` (generated), `biome.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` — unchanged. No new deps, no config tweaks.
- `api/*`, `shared/*`, `infra/*`, `e2e/*` — entirely unchanged.

### Previous story intelligence (relevant per-story learnings)

From the **Epic 1 retrospective** (`_bmad-output/implementation-artifacts/epic-1-retro-2026-06-15.md`):

- **Lesson #1 — Human-required steps must be explicit unchecked task checkboxes.** Story 2.2 applies this: Task 6 (Sandy's iPhone gate proof) is an explicit unchecked checkbox; the story remains in `review` rather than `done` until that checkbox is ticked. Story 2.1 established the pattern; Story 2.2 continues it.
- **Lesson #3 — When a new directory or config file is created, add it to Biome and tsconfig coverage in the same commit.** Story 2.2 adds files only under `web/src/routes/`, which is already covered by `biome.json` `files.includes` (`web/src/**`) and `web/tsconfig.json` `include` (`src/**/*`). No coverage gap.
- **Lesson #4 — End-to-end behavioral paths need explicit integration test coverage, not just unit tests.** Story 2.2 includes integration-shaped tests in `app-bootstrap.test.tsx` (the actual `<AppBootstrap>` tree rendered against stubbed UA + matchMedia + fetch). The `expect(fetchMock).not.toHaveBeenCalled()` assertion is the load-bearing behavioral check.

From **Story 2.1** (status `review`, baseline `bc100fe`, will land on `main` before Story 2.2 dev work begins):

- The `manifest.webmanifest` declares `display: "standalone"` — the exact signal `isStandalone()` checks for. The two stories are tightly coupled at the manifest contract.
- `web/index.html` already carries `<meta name="apple-mobile-web-app-capable" content="yes">` (legacy iOS standalone-mode opt-in) and the manifest link. Story 2.2 does not modify `index.html`.
- The build-output test (`web/src/build-output.test.ts`) asserts manifest invariants but does NOT exercise the install gate. Story 2.2 tests the gate via the unit-test surface in `app-bootstrap.test.tsx`; no build-output additions are needed.
- Story 2.1's `apple-touch-icon-180x180.png` is what iOS Safari uses for the home-screen icon at install time. The install gate's "Tap Add" step in the surface is the moment when this asset becomes visible to Sandy.

From **Story 1.5** (commit `2a7d4ae`):

- `PerformanceModeProvider` is mounted at the root of the React tree in `AppBootstrap`. Story 2.2 reuses this — the install-instructions surface sits INSIDE the provider so any subsystem still reads from one source of truth.
- `useChromeVisible()` reads `performanceActive` and is consumed by `AuthenticatedShell`. The install-instructions surface does NOT use this hook (the gate is rendered before `AuthenticatedShell` is reached).
- The `<main className="mx-auto max-w-[960px] ...">` pattern in `AuthenticatedShell` is the project's standard centered-page layout. The install-instructions surface uses a narrower `max-w-[480px]` (iPhone-first), justified by the iPhone-only gate scope.

From **Story 1.4** (commit `7384bc6`):

- `fetchMe()` in `web/src/auth/auth-api.ts` is the only `/api/v1/me` call site in the SPA. Suppressing the `useEffect` that calls it on the gate path is sufficient to satisfy "BEFORE any API call or auth check" (epic Story 2.2 AC-2). There is no other call path to gate.
- `ReauthBanner` is rendered inside `AuthenticatedShell` and is iPhone-suppressed already. The install-instructions surface never reaches `AuthenticatedShell`, so banner suppression is naturally inherited (no extra logic needed).

From **Story 1.2** (commit `d5dcbab`):

- `applyBootAtmosphere()` in `main.tsx` sets `<html data-atmosphere="performance">` on iPhone before React mounts. The install-instructions surface inherits this — no atmosphere flip in the component, no `data-atmosphere` mutation.
- The Performance type scale (`--text-perf-title` 36px, `--text-perf-body` 18px) is the right scale for the install-gate surface (iPhone, body-floor 18pt per NFR-17).
- The Performance palette (`--color-bg: #1a1209`, `--color-text-primary: #f1e6cf`, `--color-text-secondary: #c9b486`, `--color-accent: #e6b855`) is applied via CSS variable scope; the surface reads variables, never hex values.

### Implementation patterns reused from architecture

- **Boot-time short-circuit** (architecture lines 692–702 Auth flow + Story 1.5 `PerformanceModeProvider` mounting): the install-gate predicate is computed synchronously in the boot sequence, before any async API call. The pattern of "render shell, no data" is replaced on the gate path with "render install-instructions, no data" — same shape, different surface.
- **Synchronous UA + display-mode detection** (architecture line 282–284 + Story 1.2 `platform.ts`): the gate decision is deterministic from UA and `display-mode` alone. No promise resolution, no observable state.
- **Voice & tone consistency** (UX-DR7, EXPERIENCE.md §Voice and Tone): the gate copy uses short complete sentences, no exclamation marks, no emoji. The test in `install-instructions.test.tsx` asserts these invariants programmatically — a regression safety net for future copy edits.
- **Safe-area inset compliance** (Story 1.5 `AuthenticatedShell` `env(safe-area-inset-bottom)` pattern + NFR-24 47pt top inset / 34pt bottom inset): the install-gate surface honors both top and bottom insets using `max(env(...), <fallback>)` so the layout is robust on both iPhone and non-iPhone test environments.

### Latest tech information (versions verified at story-write time, 2026-06-16)

- **`window.matchMedia('(display-mode: standalone)')`**: spec-defined under the [W3C Media Queries Level 5](https://www.w3.org/TR/mediaqueries-5/#display-mode). Honored on iOS Safari 13+ (PWA `display: "standalone"` in the manifest is reflected in the media query). Stable, no recent changes.
- **`navigator.standalone`**: legacy Apple-specific property, undocumented in any current W3C spec. Still emitted by iOS Safari 17+ as a redundant compatibility signal. Not in TypeScript's `lib.dom.d.ts` — the implementation casts via `(navigator as { standalone?: boolean }).standalone`. Do NOT module-augment the global `Navigator` interface (over-broad; would affect every file in the project); the localized cast is the correct shape.
- **iOS Safari Share-sheet UX**: the Share button has lived at the bottom of Safari since iOS 15 (released September 2021). The Share-sheet on iOS 15+ defaults to a portrait card; "Add to Home Screen" is reachable after one downward scroll (typically) on iPhone 13. The install-gate copy reflects this layout.
- **Apple Safari `<meta name="apple-mobile-web-app-capable">`**: deprecated in favor of the manifest's `display: "standalone"` since iOS 11.3 (2018). Story 2.1 includes both for belt-and-braces compatibility; Story 2.2 does NOT touch this meta.
- **React 19 + Strict Mode** (existing): `useEffect` double-invocation in dev does not affect the gate path because the effect early-returns on the gate predicate. The non-gate effect already handles cancellation via the `cancelled` closure.

### Files this story creates

- `web/src/routes/install-instructions.tsx` — the install-gate surface component
- `web/src/routes/install-instructions.test.tsx` — Vitest cases for the surface

### Files this story modifies

- `web/src/lib/platform.ts` — adds `isStandalone()`; refreshes header comment
- `web/src/lib/platform.test.ts` — adds `isStandalone` test block
- `web/src/app-bootstrap.tsx` — adds install-gate short-circuit
- `web/src/app-bootstrap.test.tsx` — adds three gate-path test cases

### Files this story deletes

None.

### Project Structure Notes

- **Fully aligned with the architecture's directory tree** (architecture.md lines 840–1015):
  - `web/src/routes/install-instructions.tsx` — sits under `web/src/routes/` alongside the existing route files. The architecture's tree explicitly lists `routes/install-prompt.tsx` (line 868 — "iPhone non-installed gate"). Story 2.2 uses the more accurate filename `install-instructions.tsx` (matches the architecture's running prose at lines 284 and 893 which both say "install-instructions"; the `install-prompt.tsx` line in the tree is a stale alias from an earlier draft).
  - `web/src/lib/platform.ts` `isStandalone()` — explicitly anticipated by the architecture's directory tree (line 914): `platform.ts # isIPhone(), isStandalone()`. Story 2.2 closes that gap.
- **No new directories.** All files land under existing covered paths (`web/src/routes/**`, `web/src/lib/**`).
- **No architecture document update needed.** The directory tree's mention of `install-prompt.tsx` vs the implementation's `install-instructions.tsx` is a documentation nuance (the architecture's running prose at line 284 says "install-instructions"; the tree is a sketch). The dev agent may optionally open a tiny PR against `architecture.md` line 868 to rename `install-prompt.tsx` → `install-instructions.tsx` for consistency, but this is not required by Story 2.2's ACs.

### Testing requirements

- **Unit (Vitest, web package):**
  - `web/src/lib/platform.test.ts` adds ~4 cases for `isStandalone()`.
  - `web/src/routes/install-instructions.test.tsx` adds ~3 cases for the surface (heading + steps, zero interactive controls, voice & tone).
  - `web/src/app-bootstrap.test.tsx` adds ~3 cases for the gate-path boot sequence (iPhone Safari gated + no /me call, iPhone PWA passes, MacBook passes).
- **Unit (Vitest, other packages):** no changes.
- **E2E (Playwright):** no changes. The Playwright config has no iPhone-UA project (deferred-work item from Story 1.5 review); adding one just to assert the gate is disproportionate.
- **Build-output (Vitest, web package):** no changes. Story 2.1's `web/src/build-output.test.ts` already covers the manifest invariants the gate depends on.
- **Manual (Sandy, Task 6):** explicit unchecked checkbox. Story does not move to `done` in sprint-status.yaml until this is ticked.

### Dev environment reminders

- **Run the new tests locally:** `pnpm --filter web run test` runs the web Vitest suite. The new install-gate tests sit alongside the existing platform and app-bootstrap tests; no script changes required.
- **Smoke the gate manually on macOS:** open Chrome DevTools → Device Toolbar → iPhone 13, reload. Chrome will report `isIPhone() === false` (Chrome's "iPhone 13" device mode does not change `navigator.userAgent` to iPhone Safari by default — it only resizes the viewport and emits touch events). To actually exercise the gate path in DevTools, also enable "Network conditions" → "User agent" → select "Safari — iPhone" or paste an iPhone Safari UA. This is a developer-side smoke and does NOT replace Sandy's iPhone proof in Task 6.
- **The dev server does NOT register the SW** (Story 2.1 baseline). The install gate works regardless — `isStandalone()` reads `matchMedia`, not the SW state. So `pnpm dev:web` is sufficient for component-level smoke; you do not need `vite preview` for Story 2.2.
- **Node 22, pnpm 11.0.9** — both already pinned. Do not bump.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Sync & Offline (FR-30–32)] (lines 277–308) — install gate as a hard precondition for `navigator.storage.persist()` and Wake Lock
- [Source: _bmad-output/planning-artifacts/architecture.md#iPhone install-detection gate] (line 284) — verbatim AR-22 statement of the gate semantics
- [Source: _bmad-output/planning-artifacts/architecture.md#Pre-mortem outcomes] (lines 432–446) — "iOS Safari evicts outbox under storage pressure → addressed by `navigator.storage.persist()` (Story 2.4) + iPhone install-detection gate (Story 2.2)"
- [Source: _bmad-output/planning-artifacts/architecture.md#Directory tree] (lines 840–1015) — `web/src/routes/install-prompt.tsx` (sic — Story 2.2 uses the more accurate `install-instructions.tsx`); `web/src/lib/platform.ts` `isIPhone(), isStandalone()` (line 914)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2] (lines 693–730) — verbatim AC text plus epic context
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2] (lines 269–283) — epic objectives; key ARs (AR-22); key UX-DRs (UX-DR8)
- [Source: _bmad-output/planning-artifacts/epics.md#Additional Requirements] AR-21 (line 149), AR-22 (line 150), AR-46 (line 186), NFR-17 (line 101), NFR-24 (line 110), NFR-25 (line 111)
- [Source: _bmad-output/planning-artifacts/epics.md#UX Design Requirements] UX-DR7 (line 208 — voice & tone), UX-DR8 (line 210 — iPhone install instructions screen)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md#Voice and Tone] (lines 69–84) — short complete sentences, no exclamation marks, no emoji, no marketing voice
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md#Responsive & Platform] (line 230) — "PWA installation required for iPhone"
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-06-15.md] — Lesson #1 (unchecked-checkbox handoff), Lesson #3 (Biome/tsconfig coverage), Lesson #4 (integration test coverage)
- [Source: _bmad-output/implementation-artifacts/2-1-service-worker-pwa-manifest.md] — manifest `display: "standalone"` (the signal `isStandalone()` checks); apple-touch-icon-180x180 (visible at install time); apple-mobile-web-app-capable meta (already declared, do not re-add)
- [Source: _bmad-output/implementation-artifacts/1-5-navigation-chrome-scaffold.md] — `PerformanceModeProvider` mounting contract; `useChromeVisible()` consumer pattern; safe-area inset patterns in `AuthenticatedShell`
- [Source: _bmad-output/implementation-artifacts/1-4-access-gate-single-password-jwt-cookie-ssm.md] — `fetchMe()` is the only `/api/v1/me` call site
- [Source: _bmad-output/implementation-artifacts/1-2-design-system-foundation-tokens-typography-atmospheres.md] — Performance palette tokens (`#1a1209` bg, `#f1e6cf` text-primary, `#e6b855` accent); type scale (`--text-perf-title`, `--text-perf-body`); spacing scale; Lora editorial-serif face
- [Source: web/src/lib/platform.ts] — current state: exports `isIPhone()` only; header comment anticipates Story 2.2
- [Source: web/src/lib/platform.test.ts] — current pattern: `vi.stubGlobal('navigator', ...)` + `afterEach(() => vi.unstubAllGlobals())`
- [Source: web/src/app-bootstrap.tsx] — current boot sequence: `PerformanceModeProvider` → `<h1>GigBuddy</h1>` (loading) → `AuthProvider + RouterProvider` (ready)
- [Source: web/src/app-bootstrap.test.tsx] — current four boot-path test cases (loading shell, 200 /me, 401 /me, fetch reject)
- [Source: web/src/lib/microcopy.ts] — locked microcopy constants pattern; the install-gate copy is surface-specific and inlined, not added to this file
- [Source: web/src/styles/tokens.css] — Performance atmosphere palette + type scale; `--spacing-tap: 44px`; `--spacing-section-gap: 32px`
- [Source: web/src/styles/globals.css] — `prefers-reduced-motion` rule (zeroes transitions/animations) — applies to the install-gate surface for free
- [Source: web/src/routes/authenticated-shell.tsx] — `env(safe-area-inset-bottom)` pattern (precedent for the install-gate surface's top + bottom inset handling)
- [Source: CLAUDE.md] — boundaries (`web` ↔ `api` HTTP only; `web` ↔ `shared` Zod schemas only); React Router 7 imports from `react-router`; Tailwind v4 via Vite plugin; no parallel TypeScript types redefining Zod-owned shapes

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (claude-opus-4-7[1m])

### Debug Log References

- Biome formatter required collapsing two multi-line `expect(screen.getByRole(...)).toBeInTheDocument()` calls to single-line form in `web/src/app-bootstrap.test.tsx` and `web/src/routes/install-instructions.test.tsx`. Re-ran `pnpm lint` after the fix → clean.

### Completion Notes List

- Implementation followed the story spec exactly. `isStandalone()` added below `isIPhone()` with both modern (`matchMedia('(display-mode: standalone)')`) and legacy (`navigator.standalone`) signals; SSR-safety guard mirrors `isIPhone()`. Header comment refreshed to present-tense.
- `InstallInstructions` route component is a pure render with zero side effects, zero interactive controls, smart-quote entities in step 2, and `max(env(safe-area-inset-*), var(--spacing-section-gap))` insets so the surface is robust in both iPhone Safari (real insets) and jsdom (zero insets).
- `AppBootstrap` now computes `installGateActive = isIPhone() && !isStandalone()` at the top of the function body; the `useEffect` early-returns when active (preserving Rules-of-Hooks compliance); `installGateActive` is in the dep array per `react-hooks/exhaustive-deps` semantics. Predicate is synchronously stable across the component's lifetime — included for lint discipline, not because it actually changes.
- Tests cover all four boot paths (loading shell, 200 /me authenticated, 401 /me redirect to /login, offline-cache fetch reject) PLUS three new gate-path cases (iPhone Safari renders install-instructions and does NOT call /me, iPhone PWA standalone boots authenticated shell, MacBook bypasses gate even when matchMedia matches). The `expect(fetchMock).not.toHaveBeenCalled()` assertion on the gated path is the load-bearing AC-2 invariant.
- Verification: `pnpm typecheck` green (5 packages), `pnpm lint` green (90 files), `pnpm test` green (web 79/79, api 36/36, infra 51/51), `pnpm build:web` green (377.76kB JS / 114.82kB gzip, 20 SW precache entries unchanged from Story 2.1).
- Task 6 (Sandy's iPhone manual proof) confirmed by Sandy on 2026-06-16. iPhone 13 / iOS: pre-install gate rendered the install-instructions surface immediately; post-install standalone launch bypassed the gate. Reached the authenticated Setlists shell rather than `/login` because iOS shares the cookie jar between Safari and the installed PWA at the same origin — the `gigbuddy_session` cookie carried across the install. Load-bearing AC claim (gate bypass under standalone display-mode) is confirmed.

### File List

- web/src/lib/platform.ts (modified — added `isStandalone()` export, refreshed header comment)
- web/src/lib/platform.test.ts (modified — added `describe('isStandalone', ...)` block with 4 cases plus helper stubs)
- web/src/routes/install-instructions.tsx (added — install-gate surface component)
- web/src/routes/install-instructions.test.tsx (added — 3 cases: heading + steps, no interactive controls, no voice-and-tone violations)
- web/src/app-bootstrap.tsx (modified — added `installGateActive` predicate, gated `useEffect`, short-circuit render branch)
- web/src/app-bootstrap.test.tsx (modified — added 3 gate-path cases plus `stubIPhoneUA`/`stubIPhonePWA`/`stubMatchMedia` helpers)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified — story 2.2 status `ready-for-dev` → `in-progress` → `review`)
- _bmad-output/implementation-artifacts/2-2-iphone-pwa-install-gate.md (modified — Tasks 1–5 checkboxes ticked; Status → `review`; Dev Agent Record / Change Log filled in; Task 6 remains explicitly unchecked for Sandy)

## Change Log

| Date       | Change                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------- |
| 2026-06-16 | Story spec created (status: ready-for-dev). Builds on Story 2.1's manifest + SW; adds `isStandalone()` to `platform.ts`, the `InstallInstructions` route component, and the `AppBootstrap` short-circuit gating iPhone Safari (uninstalled) before any API call. |
| 2026-06-16 | Implementation complete (status: review). Tasks 1–5 done: `isStandalone()` added, `InstallInstructions` surface created, `AppBootstrap` short-circuit wired, tests extended (web suite 79/79 passing). Task 6 (Sandy's iPhone manual proof) explicitly unchecked per Epic 1 retro Lesson #1. |
| 2026-06-16 | Story done (status: done). Sandy's iPhone 13 manual proof confirmed: pre-install gate rendered, post-install standalone launch bypassed the gate. Reached Setlists shell rather than `/login` because iOS shares the cookie jar between Safari and the installed PWA. Gate-bypass invariant confirmed. |
