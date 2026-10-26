---
baseline_commit: a737bef
---

# Story 7.15: Keep the screen awake on song pages

Status: ready-for-dev

<!-- Source: epics.md "Epic 7 / Story 7.15". Builds on 7.5 (song page) and 7.14 (gig play bar). -->

## Story

As Sandy,
I want the screen to stay on while a song is open,
so that the phone resting on the Nord doesn't dim or lock mid-song.

## Acceptance Criteria

1. While a song page is open, at either `/songs/:songId` or `/gigs/:setlistId/songs/:songId`,
   GigBuddy holds a screen wake lock (`navigator.wakeLock.request('screen')`). This covers a
   called song opened from the library that isn't in the set. Other pages, including song
   and gig edit pages, keep normal sleep.
2. Moving Previous/Next between gig songs keeps the lock: no drop and re-request per song.
3. Leaving the song pages releases the lock.
4. When the app comes back to the foreground, or the system releases the lock while the page
   is visible, the lock is requested again. No timed retry loop.
5. If a request fails or the API is missing, a small static note "Screen may sleep" shows in
   secondary text near the top of the song page. It never shows while the lock is held or
   before the first request has settled. No animation, banner or toast.
6. Lock logic lives in one hook in `web/src/hooks/`. No change to `api/`, `shared/` or `infra/`.
7. Same responsive and theming rules as 7.1. `STYLE.md` notes the "Screen may sleep" line.
8. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass. Unit tests cover:
   lock requested on both song routes, not on other pages; held across Previous/Next;
   released on leaving; re-requested on returning visible; note shown on failure and when
   unsupported, hidden when held.
9. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [ ] **Task 1: `useWakeLock` hook** (AC: 1, 3, 4, 5, 6)
  - [ ] New `web/src/hooks/use-wake-lock.ts` (+ `use-wake-lock.test.tsx`):
    ```ts
    /** Holds a screen wake lock while the calling component is mounted. */
    export function useWakeLock(): { failed: boolean };
    ```
  - [ ] One `useEffect` with empty deps. Inside it keep a local `sentinel` and an `active`
    flag (set false in cleanup so late promises do nothing).
    - `request()`: if `!('wakeLock' in navigator)` → `setFailed(true)`, return. Otherwise
      `navigator.wakeLock.request('screen')`; on success, if still active store the sentinel,
      `setFailed(false)`, and add a `release` listener; if no longer active, release it
      straight away. On rejection → `setFailed(true)`. Never throw.
    - `release` listener: drop the sentinel; if `document.visibilityState === 'visible'` and
      active, call `request()` once.
    - `visibilitychange` listener: when visible, active and no held sentinel, call `request()`.
    - Cleanup: `active = false`, remove the `visibilitychange` listener, release the sentinel
      if held (`void sentinel.release()`).
  - [ ] `failed` starts `false`, so nothing shows before the first request settles.
  - [ ] No retry timers, no module-level singleton. (The old `web/src/performance/wake-lock.ts`
    from Story 4.2, removed in 7.1, had backoff timers and a singleton; that is more than this
    needs. Re-requesting on visibility and on release is enough, and can't loop.)
  - [ ] A short header comment in the style of the other hooks.

- [ ] **Task 2: Use it on the song page** (AC: 1, 2, 3, 5)
  - [ ] `web/src/routes/song.tsx`: call `useWakeLock()` in `Song`. One component serves both
    song routes (`router.tsx` lines 38 and 45), and Previous/Next re-render the same mounted
    `Song`, so the lock is held across steps (AC2) and released when the route changes to
    any other page (AC3). Don't add it to `SongEdit`, `Gig` or any other route.
  - [ ] When `failed`, render a `<p>` with `WAKE_LOCK.maySleep` text (see copy below) just
    below the back-link row and above the title: Body size, secondary colour,
    `mt-[calc(var(--spacing-unit)*2)]`. Static; no icon, no `aria-live`. Show it whether or
    not the song record loaded.
  - [ ] Update the header comment of `song.tsx` with one line about the wake lock.

- [ ] **Task 3: Copy and style guide** (AC: 5, 7)
  - [ ] Append to `web/src/lib/microcopy.ts`:
    ```ts
    /* Story 7.15 — keep the screen awake on song pages. */
    export const WAKE_LOCK = {
      maySleep: 'Screen may sleep',
    } as const;
    ```
  - [ ] `STYLE.md`, after the "Bottom bar" bullet: "Screen may sleep" line on song pages:
    Body size, secondary text, under the back link; shown only when the screen can't be kept
    awake. No token changes.

- [ ] **Task 4: Tests** (AC: 8)
  - [ ] `use-wake-lock.test.tsx`: stub `navigator.wakeLock` with a fake `request` returning a
    fake sentinel (an `EventTarget` with `release: vi.fn()` and `released` flag). Use
    `Object.defineProperty(navigator, 'wakeLock', { configurable: true, value })` and delete
    it in `afterEach`. Cover: requests on mount; `failed` false while held; rejection →
    `failed` true; API missing → `failed` true; unmount → `sentinel.release` called;
    `visibilitychange` to visible after a release → requested again; sentinel `release`
    event while visible → requested again; request resolving after unmount → released at once.
    Use `renderHook` from `@testing-library/react`.
  - [ ] `song.test.tsx`: mock `../hooks/use-wake-lock.js` (default `{ failed: false }`).
    Cover: hook called on `/songs/:songId` and on the gig song route; note absent when
    `failed` false; note shown when `failed` true (on both routes, and when the song is not
    found).
  - [ ] Other route tests: no change needed; they don't render `Song`. If
    `app-bootstrap.test.tsx` renders a song page and jsdom lacks `navigator.wakeLock`, the
    note will show; that's fine unless a test asserts its absence.
  - [ ] Placeholder names only. No snapshot tests.

- [ ] **Task 5: Verify, commit, deploy** (AC: 6, 8, 9)
  - [ ] `git diff --stat HEAD -- api shared infra` is empty.
  - [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass.
  - [ ] Commit after code review, one commit: `Implement story 7.15: Keep the screen awake on
    song pages`. Push to `main` only with Sandy's go-ahead; watch `deploy.yml` with
    `gh run watch`. If the blackout check blocks, report it; don't use `deploy-force.yml`
    unless Sandy says so.
  - [ ] Set the story to `review`. No screenshots and no manual checklist for Sandy.

## Dev Notes

### What this story is

Web only. A song page keeps the phone awake; nowhere else does. Sandy chose (2026-10-26) to
cover library song pages too, because a called song that isn't in the set is opened from
`/songs`, and the note "Screen may sleep" when the lock can't be held.

### Design choices

- **Hook in `Song`, not a global setting.** The lock follows the page that's open: no mode to
  enter or leave, nothing to forget to switch off. Edit pages are excluded, so typing a chart
  on the laptop behaves normally.
- **No timed retries.** Wake lock requests fail for steady reasons (unsupported, iOS Low Power
  Mode, page hidden). Re-requesting when the page becomes visible again, or when the system
  drops the lock while visible, covers the real cases without any loop.
- **Note at the top, not in the bar.** The library song page has no bottom bar, and the bar
  is already full at 360px. One place for both routes.

### Facts verified when the story was written (2026-10-26)

- `web/src/router.tsx`: `songs/:songId` and `gigs/:setlistId/songs/:songId` both render
  `Song`; edit routes render `SongEdit` / `GigEdit` / `SetlistEdit`.
- `web/src/routes/song.tsx`: back-link row (`flex justify-between`), then `PageTitle`, key ·
  patch line, chord chart; `GigPlayBar` fixed at the bottom on gig song pages (7.14).
- No wake lock code in `web/src` today. `tsconfig.base.json` includes the `DOM` lib, so
  `WakeLockSentinel` and `navigator.wakeLock` types are available.
- Screen Wake Lock is supported in Safari / iOS 16.4+ (including home-screen web apps on
  current iOS) and in Chrome on macOS. On Sandy's laptop it just keeps the display on while a
  song is open.
- `web/src/test-setup.ts` is the shared jsdom setup; jsdom has no `navigator.wakeLock`.

### Guardrails

- Out of scope: full screen, keeping the lock on gig or list pages, any indicator while the
  lock is held, settings toggle, any `api/`, `shared/`, `infra/` or sync change.
- No device detection; one layout from 360px to 1680px.
- Biome only; `kebab-case` files; co-located tests; `.js` import suffix; imports from
  `react-router`; British English; strings in `microcopy.ts`.

### Project Structure Notes

New: `web/src/hooks/use-wake-lock.ts` (+ test). Updated: `web/src/routes/song.tsx` (+ test),
`web/src/lib/microcopy.ts`, `STYLE.md`, `sprint-status.yaml`. Router unchanged.

### Previous story intelligence

- 7.14: `Song` stays mounted across Previous/Next (it scrolls to top on `[songId, at]`), which
  is what keeps the lock held between songs.
- 7.7: weekend-evening deploys can hit the blackout check; report, don't force.
- Story 4.2 (Epic 4, removed in 7.1) had a fuller wake lock with backoff. See
  `git show 35acd6e:web/src/performance/wake-lock.ts` for reference only; don't restore it.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.15]
- [Source: _bmad-output/implementation-artifacts/7-14-play-a-gig-song-by-song.md]
- [Source: web/src/router.tsx; web/src/routes/song.tsx; web/src/lib/microcopy.ts; STYLE.md]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Change Log

- 2026-10-26: Story created; status → ready-for-dev.
