---
baseline_commit: "e5cdd2a"
builds_on: 6-4-jump-overlay-5a-pinned-search-setlist-library-reach
---

# Story 6.5: Detour state (D3) + Currently-performing strip detour signal (P1 D3 lock, plan-cursor persistence)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Sandy,
I want the Performance Card to show `DETOUR` in the top-right position slot whenever I'm on a jumped-to song (with no numeric indicator, no hairline), `NEXT ›` from the detour to return to plan-cursor + 1, `‹` from the detour to undo the jump, and the Currently-performing strip after `×` to signal a detour via italic title + `↩` prefix,
So that a glance at the card tells me whether I'm on plan or detoured, and both the return-to-plan and exit-then-resume paths respect the "plan is a starting point, not a script" model.

## Locked constraints (do not relitigate)

- Visual direction is locked — do not propose alterations to color, typography, or layout philosophy. Reuse existing invariant tokens. The `DETOUR` label reuses the SAME classes already on the position-indicator `<span>` (`--text-perf-meta`, `--font-mono-slab`, `--color-text-secondary`) — it is a text-content swap, not a new visual treatment. No new CSS custom properties in `web/src/styles/tokens.css`.
- Sandy IS the user — skip persona ceremony.
- iOS PWA + Safari cookie sharing pattern is intentional (not touched by this story).
- British English spelling and idiom in UI copy is intentional. This story's only new prose is the word `DETOUR` (locked verbatim in epics.md) and two implementation-chosen (not epics-locked) accessibility strings — see Dev Notes "Copy this story invents."
- **Scope boundary (critical):** this story does NOT touch `web/src/components/jump-overlay.tsx` at all. The overlay's row-highlight logic (`currentSongId={displaySongId}`, added in Story 6.4) already highlights whichever song is currently DISPLAYED (the detour song, if one is active) — see Dev Notes "Known drift vs. the planning docs (do not fix here)" before assuming this needs correcting. Story 6.5's job is: (a) the `DETOUR` position-slot swap, (b) `NEXT ›`/`‹` contextual behaviour on the card, (c) the Currently-performing-strip signal. Story 6.6 (section-break orientation view) is a separate, later story — do not build any of its auto-open/auto-scroll behaviour here.
- Do not add a `key` field to `SongRef` or any other shared-schema change. Do not add a new API endpoint. `useSong()` (Story 2.5, already shipped) is the only new data-fetch this story introduces, and only in `setlist-overview.tsx`.

## Acceptance Criteria

**AC-1 — Plan-cursor state: numeric indicator, no `DETOUR` word, no chrome cue**

**Given** the Performance Card is on the plan cursor (not detoured)
**When** the top chrome renders
**Then** the top-right position slot renders the numeric indicator `<n> / <total>` (shipped format, unchanged)
**And** no `DETOUR` word appears anywhere on the card
**And** no chrome cue (hairline / label) indicates detour

**AC-2 — Jumping to a non-adjacent song enters the detour state**

**Given** Sandy taps a row in the jump overlay (Story 6.4) that is NOT equal to plan cursor + 1
**When** the Performance Card advances to the tapped song (Story 6.4's `onSelectSong` plumbing, unchanged)
**Then** the card enters the detour state
**And** the top-right position slot renders the word `DETOUR` (mono, `--text-perf-meta` sizing, `--color-text-secondary` — the SAME classes already on that span; only the text content + `aria-label` swap)
**And** no numeric indicator is shown in the detour state
**And** no hairline or additional chrome cue is added (D3 is dropped-numeric only — locked 2026-07-19)

**AC-3 — `NEXT ›` from a detour returns to plan cursor + 1**

**Given** Sandy is on a detour song
**When** Sandy taps `NEXT ›`
**Then** the card advances to `plan cursor + 1` (traversing section boundaries per Story 4.1 rules, unchanged math)
**And** the plan cursor updates to `plan cursor + 1` (the return anchor is consumed)
**And** the card exits the detour state (position slot returns to `<n> / <total>`)
**Implementation note:** this already falls out of the SHIPPED `NEXT ›` `onClick` (`navigate(parsedSongIndex + 1)`) once Task 1/2's detour-clearing effect fires on the resulting `parsedSongIndex` change — see Dev Notes. Do not add new branching to the `NEXT ›` handler itself; the work is in the clearing effect + the position-slot/`‹` logic.

**AC-4 — `‹` from a detour undoes the jump (returns to the return anchor)**

**Given** Sandy is on a detour song
**When** Sandy taps `‹`
**Then** the card returns to the return anchor (`currentSongRef`, the plan-cursor song from which the detour was launched)
**And** the plan cursor is UNCHANGED (no `navigate()` call at all)
**And** the card exits the detour state

**AC-5 — Detour + plan cursor is the last song: `NEXT ›` inert, `‹` still undoes**

**Given** Sandy is on the plan cursor and the plan cursor is the LAST song of the setlist
**When** Sandy is jumped to a detour song via the overlay
**Then** the detour state renders as in AC-2
**And** `NEXT ›` from the detour is inert (disabled, no-op) — there is no `plan cursor + 1`
**And** `‹` from the detour still returns to the plan cursor as in AC-4 (undo is available regardless of the return anchor's position in the setlist)
**Implementation note:** `NEXT ›`'s `isLast`/`disabled` logic already keys off `parsedSongIndex` (the plan cursor), so this is already correct once AC-2/AC-4 are implemented — write a test to PROVE it, do not add new code for it.

**AC-6 — Currently-performing strip signals a detour after `×` mid-detour; `Resume ›` preserves it**

**Given** the Currently-performing strip (shipped Story 4.3) renders after Sandy taps `×` mid-detour
**When** the strip renders on `/setlists/:setlistId`
**Then** the strip's current-song text renders in italic serif
**And** a `↩` (U+21A9 LEFTWARDS ARROW WITH HOOK — NOT `↵`) prefix appears before the song title (`Currently performing: ↩ Sunny`)
**And** tapping `Resume ›` returns Sandy to the detour song with detour state intact (position slot re-shows `DETOUR`; return anchor preserved)

**AC-7 — Strip renders unchanged when no detour was active at exit**

**Given** the strip renders after `×` from a plan song (no detour active at exit)
**When** the strip renders
**Then** the current-song text renders in the shipped non-italic serif
**And** no `↩` prefix is present

**AC-8 — Accessibility: the italic + `↩` signal is paired with a text-based semantic**

**Given** the strip is present with the detour signal
**When** an accessibility audit runs
**Then** the italic + `↩` visual signal is paired with a non-visual semantic (an `aria-label` on the strip's region, e.g. `"Currently performing on a detour: Sunny"`) — color/style/glyph is never the only signal (architecture.md line 831, color-never-alone)

**AC-9 — Shipped renderings match the approved mockups (code-review visual check)**

**Given** `iteration-3/state-2a-detour-v1-floor-text-chart.png` (card) and `iteration-2/state-7-strip-detour-signalled.png` (strip)
**When** the story is code-reviewed
**Then** the shipped renderings match at glance-level (visual inspection; no pixel-diff test required)

## Tasks / Subtasks

- [x] Task 1 — Promote the detour override into `PerformanceModeContext` (AC: 2, 3, 4, 5, 6)
  - [x] In `web/src/performance/performance-context.tsx` (UPDATE), add `activeDetourSongId: string | null` to `PerformanceModeContextValue` and the provider's `useState<string | null>(null)`, mirroring the existing `activeSongIndex` field's shape (NOT the `activeSetlistId`/`activeSongIndex` bundled-setter pattern — this needs an independent read/write pair, matching `usePerformanceActive()`/`useSetPerformanceActive()`).
  - [x] Export `useActiveDetourSongId(): string | null` and `useSetActiveDetourSongId(): (songId: string | null) => void`, following the exact `useCtx()`-based pattern already used for every other hook pair in this file.
  - [x] Inside `setPerformanceSession(setlistId, songIndex)` (the function shared by `useStartPerformance` at entry and `useResetPerformanceSession`/`usePerformanceEnd` at exit — the ONLY two call sites in the codebase), ALSO call `setActiveDetourSongIdState(null)`. This is the single point where a session boundary invalidates any stale detour — a fresh `Start performance ›` or an ended session must never inherit a leftover detour from a prior session. Do **not** add detour-clearing to `setActiveSongIndex()` — that setter fires on every render's plan-cursor mirror from `PerformanceCard` (see Task 2), and clearing detour there would defeat the "Resume › preserves detour" requirement (AC-6).
  - [x] Add the new fields/setter to the `useMemo` dependency array and the memoised `value` object, matching the existing pattern exactly.

- [x] Task 2 — `PerformanceCard`: detour-aware position slot + contextual `‹` + mount-preserving clearing effect (AC: 1, 2, 3, 4, 5)
  - [x] In `web/src/routes/performance-card.tsx` (UPDATE), REMOVE the Story 6.4 local state: `const [detourSongId, setDetourSongId] = useState<string | null>(null);`. Import and call `useActiveDetourSongId()` / `useSetActiveDetourSongId()` from `../performance/performance-context.js` instead, naming the read value `activeDetourSongId` and the setter `setActiveDetourSongId`.
  - [x] Replace the Story 6.4 clearing effect (`useEffect(() => { setDetourSongId(null); }, [parsedSongIndex]);`) with a **mount-preserving** version — this is the crux of "plan-cursor persistence" (the story's subtitle):
    ```ts
    const isInitialRenderRef = useRef(true);
    useEffect(() => {
      if (isInitialRenderRef.current) {
        isInitialRenderRef.current = false;
        return;
      }
      setActiveDetourSongId(null);
    }, [parsedSongIndex, setlistId]);
    ```
    Skipping the clear on the very first render is essential: a fresh mount of `PerformanceCard` happens on `Start performance ›` entry, on `Resume ›` from the strip, and on cold-relaunch — in the `Resume ›` case, `activeDetourSongId` may hold a value we WANT preserved (AC-6). Only a genuine WITHIN-mount `parsedSongIndex` (or `setlistId`) change — i.e. Sandy tapping `NEXT ›`/`‹` while the card stays mounted — should clear it. `setlistId` is included defensively (see Dev Notes "Why `setlistId` is in the dependency array") even though no current navigation path can reach it.
  - [x] Update `displaySongId`/`displaySongRef` to read `activeDetourSongId` instead of the removed local `detourSongId` — the expressions themselves are unchanged, only the source variable.
  - [x] Compute `const isDetour = activeDetourSongId !== null;` once, near `isFirst`/`isLast`.
  - [x] Position indicator `<span role="status">` (top-right, currently rendering `{currentPosition} / {totalSongs}` with `aria-label={PERFORMANCE_CARD.ariaSongPosition(...)}`): when `isDetour`, render `{PERFORMANCE_CARD.detourLabel}` and `aria-label={PERFORMANCE_CARD.ariaOnDetour}` instead — SAME `className` (do not add or remove any classes; the token references already match the epics AC's "mono, perf-meta sizing, secondary emphasis" requirement).
  - [x] `‹` (previousSong) button:
    - `disabled={!isDetour && isFirst}` / `aria-disabled={!isDetour && isFirst}` (was `disabled={isFirst}`) — undo-the-jump is always available while detoured, regardless of the return anchor's position.
    - `onClick`: `() => { if (isDetour) { setActiveDetourSongId(null); return; } if (isFirst) return; navigate(...parsedSongIndex - 1); }` — the detour branch does NOT call `navigate()` at all (AC-4: plan cursor unchanged).
    - Do NOT change the `aria-label` (`PERFORMANCE_CARD.ariaPreviousSong`, "Previous song") — see Dev Notes "Copy this story invents" for why this is a deliberate non-change.
  - [x] `NEXT ›` button: **NO code change.** `isLast`/`onClick` already key off `parsedSongIndex` (the plan cursor) — AC-3 and AC-5's `NEXT ›` behaviour already fall out for free once Task 1 + this task's clearing effect are in place. Write tests to prove it (Task 3); do not touch this button's markup or handler.
  - [x] `onSelectSong` passed to `<JumpOverlay>`: swap `setDetourSongId` for `setActiveDetourSongId` — no other change to the `<JumpOverlay>` render.
  - [x] Update the file's top-of-file doc comment (the ASCII diagram + prose) to note the Story 6.5 detour additions, following the pattern of how Stories 6.3/6.4's additions are already documented there.

- [x] Task 3 — `microcopy.ts`: append DETOUR + strip-signal strings (AC: 2, 6, 8)
  - [x] In `web/src/lib/microcopy.ts` (UPDATE), append to `PERFORMANCE_CARD`: `detourLabel: 'DETOUR'` (locked verbatim, epics.md) and `ariaOnDetour: 'On a detour'` (implementation-chosen spoken form — see Dev Notes).
  - [x] Append to `CURRENTLY_PERFORMING`: `detourPrefix: '↩'` (U+21A9 — copy the exact glyph already locked in the mockup brief; do NOT use `↵`) and `ariaRegionDetour: (title: string) => "Currently performing on a detour: " + title` (implementation-chosen wording per epics AC-8's "or equivalent"; a template literal is equally fine — the exact string-concatenation mechanism is not load-bearing).

- [x] Task 4 — `CurrentlyPerformingStrip`: italic + `↩` detour signal (AC: 6, 7, 8)
  - [x] In `web/src/components/currently-performing-strip.tsx` (UPDATE), add a required prop `isDetour: boolean` to `CurrentlyPerformingStripProps`.
  - [x] When `isDetour` is `true`: the `<section>`'s `aria-label` becomes `CURRENTLY_PERFORMING.ariaRegionDetour(currentSongTitle)` (instead of the static `CURRENTLY_PERFORMING.ariaRegion`); the song-title text renders with an added `italic` class and is prefixed with `{CURRENTLY_PERFORMING.detourPrefix}{' '}` immediately before `{currentSongTitle}` (matches the mockup's `↩ Sunny` — space between glyph and title).
  - [x] When `isDetour` is `false` (the existing shipped case): unchanged — `aria-label={CURRENTLY_PERFORMING.ariaRegion}`, no italic, no prefix.
  - [x] This is a required (non-optional) prop — every existing call site must be updated (Task 6 covers the test file; `setlist-overview.tsx` is updated in Task 5).

- [x] Task 5 — `SetlistOverview`: derive detour state + resolve the detour song's title (AC: 6, 7)
  - [x] In `web/src/routes/setlist-overview.tsx` (UPDATE), import `useSong` from `../hooks/use-song.js` (NEW import — not currently used in this file) and `useActiveDetourSongId` from `../performance/performance-context.js`.
  - [x] Compute `const activeDetourSongId = useActiveDetourSongId();` and `const isDetourActive = isActiveSetlist && activeDetourSongId !== null;` (reuse the existing `isActiveSetlist` gate — detour state is only meaningful when this overview IS the active session).
  - [x] Fetch the detour song's LIVE title: `const { data: detourSong } = useSong(isDetourActive ? activeDetourSongId : null);`. **Do not** attempt to resolve the title from `titleSnapshot`/a `SongRef` lookup — the detour target may be a library-only song with no `SongRef` in this Setlist at all (Story 6.4's unified `B3`/`B4` jump scope). `useSong()`'s TanStack Query cache is warm because `PerformanceCard` already fetched and displayed this exact song before Sandy tapped `×` (same AR-28 cache-first contract already relied on throughout this route).
  - [x] Change `currentPerformanceSongTitle` to: `isDetourActive ? (detourSong?.title ?? '') : (flatActiveSongs[activeSongIndex]?.titleSnapshot ?? '')`. The non-detour branch is the exact shipped Story 4.3 expression — unchanged.
  - [x] Pass `isDetour={isDetourActive}` to `<CurrentlyPerformingStrip>`.
  - [x] `Resume ›`'s `onClick` is **UNCHANGED** — still navigates to `/performance/<setlistId>/<activeSongIndex>` (same template-literal expression already shipped). It always targets the plan-cursor/return-anchor URL; the detour override lives in context (not the URL), so remounting `PerformanceCard` at that URL picks the persisted `activeDetourSongId` back up via Task 2's mount-preserving effect. Do NOT add a detour param/segment to the Resume URL.

- [x] Task 6 — Tests (AC: 1–9)
  - [x] `web/src/performance/performance-context.test.tsx` (UPDATE) — add:
    - `useActiveDetourSongId()` defaults to `null`.
    - the setter updates the value for all consumers (mirror the existing `Reader`/`Toggle` pattern).
    - a case proving `setPerformanceSession(...)` (exercised via a component that calls `useSetActivePerformanceSession()`) resets `activeDetourSongId` back to `null` after it was previously set to a non-null value.
    - setter identity is stable across renders (mirror the existing `useSetPerformanceActive` stability test).
  - [x] `web/src/routes/performance-card.test.tsx` (UPDATE) — extend the `performance-context.js` module mock with two new hoisted mocks: `useActiveDetourSongIdMock` (default `vi.fn(() => null)`) and `useSetActiveDetourSongIdMock` (default `vi.fn()`); reset both in `beforeEach`. Add a new `describe('PerformanceCard — detour state (Story 6.5)')` block:
    - plan-cursor state (mock returns `null`): numeric `<n> / <total>` renders, `DETOUR` text is absent, `‹` is `disabled` at `songIndex='0'` exactly as before (regression guard against Task 2's `disabled` formula change).
    - detour active (mock `useActiveDetourSongIdMock` to return `'song0000000003cc'`, i.e. Take Five, while rendering at `songIndex='0'`, i.e. plan cursor = Autumn Leaves): position slot shows `DETOUR`, no numeric text; `‹` is NOT disabled even though `songIndex='0'` is `isFirst`; tapping `‹` calls `useSetActiveDetourSongIdMock` with `null` and does NOT call `navigateMock`.
    - detour active AND plan cursor is the LAST song (`songIndex='2'`, mock detour to `'song0000000002bb'`, Black Orpheus): `NEXT ›` stays `disabled` (extends the existing Story 4.4 last-song assertion — now proven ALSO true under detour); `‹` is enabled, tapping it clears the detour without navigating.
    - a fresh mount (the normal `renderRoute()` helper — a brand-new `render()` call) with `useActiveDetourSongIdMock` returning a non-null value does NOT call `useSetActiveDetourSongIdMock` with `null` (proves the mount-preserving guard — a resumed detour is not immediately wiped).
    - a genuine WITHIN-mount `parsedSongIndex` change clears the override — see Dev Notes "Testing the mount-preserving effect" for the required technique (`createMemoryRouter`/`RouterProvider` + a direct `router.navigate(...)` call, bypassing the mocked `useNavigate`) before writing this test; the naive `rerender()`-with-new-`initialEntries` approach does NOT work with `<MemoryRouter>` and will produce a false pass/fail.
    - (nice-to-have, not epics-mandated) detour chaining: selecting a SECOND jump-overlay row while already detoured re-sets the override to the new target without ever calling `navigate()`.
  - [x] `web/src/components/currently-performing-strip.test.tsx` (UPDATE) — pass `isDetour={false}` in every one of the 5 existing tests (the new prop is required; this keeps them green with no behaviour change). Add new cases:
    - `isDetour={true}`: the title renders italic and prefixed with `↩ ` (assert on the rendered text, e.g. `screen.getByText('↩ Sunny')`, or on the element's class list for italic — pick whichever is more robust given the actual markup).
    - `isDetour={true}` with `currentSongTitle="Sunny"`: the region's accessible name is `CURRENTLY_PERFORMING.ariaRegionDetour('Sunny')` (`"Currently performing on a detour: Sunny"`).
    - `isDetour={false}` (regression guard): title is NOT italic, no `↩` prefix, region name is still the plain `CURRENTLY_PERFORMING.ariaRegion`.
  - [x] `web/src/routes/setlist-overview.test.tsx` (UPDATE) — add a hoisted `useSongMock` (mirror the `performance-card.test.tsx` precedent) via a NEW `vi.mock('../hooks/use-song.js', () => ({ useSong: useSongMock }))` block, default `vi.fn(() => ({ data: undefined }))`, reset in `beforeEach`. Add `useActiveDetourSongIdMock` to the existing `performance-context.js` mock (default `vi.fn(() => null)`). New cases alongside the existing `describe('SetlistOverview — CurrentlyPerformingStrip (Story 4.3)')` block:
    - `useActiveDetourSongIdMock` returns `null`: strip title is unchanged from the existing `titleSnapshot`-based assertions (regression guard — existing tests should still pass verbatim).
    - `useActiveDetourSongIdMock` returns a songId AND `useSongMock` resolves `{ data: makeSong({ title: 'Sunny' }) }` (import `makeSong` or declare an equivalent local factory — `setlist-overview.test.tsx` does not currently have one; add a minimal `Song` factory or inline object matching the `Song` schema): the strip shows `Sunny` (NOT the `titleSnapshot` at `activeSongIndex`), and `<CurrentlyPerformingStrip>` receives `isDetour={true}`.
    - `Resume ›`'s `onClick` still navigates to `/performance/<setlistId>/<activeSongIndex>` even when a detour is active (unchanged target — regression guard proving no detour param is appended to the URL).
  - [x] Run `pnpm --filter web run test`, `pnpm --filter web run typecheck`, and `pnpm lint` — all clean before marking `review`.

## Dev Notes

### Why this story is "plan-cursor persistence" (read first)

Story 6.4 built a component-local `detourSongId` override in `PerformanceCard` and explicitly deferred its promotion into cross-route state: *"Story 6.5 may need to promote this concept into context... that migration is 6.5's job, not this story's."* This story is that migration, plus the button/position-slot semantics that only make sense once the override is legible outside `PerformanceCard`:

- **Why context, not local state:** AC-6 requires that tapping `×` mid-detour, landing on `/setlists/:setlistId`, and tapping `Resume ›` returns Sandy to the SAME detour (position slot re-shows `DETOUR`, return anchor preserved). `×` unmounts `PerformanceCard` entirely — any component-local state is gone. The override must live somewhere that survives the unmount: `PerformanceModeContext`, exactly like `activeSetlistId`/`activeSongIndex` already do for the plan cursor.
- **Why the mount-preserving effect is the crux of the story:** naively porting Story 6.4's clearing effect (`useEffect(() => { setDetourSongId(null); }, [parsedSongIndex]);`) into a context-backed version would clear the override on EVERY mount — including the `Resume ›` remount — because `useEffect` runs on the first render too. The `isInitialRenderRef` guard (Task 2) is what distinguishes "this is a fresh mount; trust whatever context says" from "this is a real `NEXT ›`/`‹` navigation within an already-mounted card; clear the override." Get this wrong and either (a) `Resume ›` never resumes a detour (fails AC-6), or (b) a stale detour survives `NEXT ›`/session boundaries (fails AC-3/session hygiene).
- **Why `NEXT ›` itself needs zero code changes:** `parsedSongIndex` (the URL, i.e. the plan cursor) has ALWAYS been what `NEXT ›`'s `isLast`/`onClick` read — untouched by any detour override since Story 6.4. So "`NEXT ›` from a detour advances to plan cursor + 1, exits detour" (AC-3) and "`NEXT ›` from a detour on the last plan song is inert" (AC-5) both already hold true the moment the clearing effect correctly fires on the resulting navigation. Resist the urge to add an `isDetour` branch to the `NEXT ›` handler — there is nothing to branch on.
- **Why `‹` DOES need a code change:** unlike `NEXT ›`, `‹`'s existing behaviour (`navigate(parsedSongIndex - 1)`) is WRONG when detoured — it would decrement the plan cursor, which AC-4 explicitly forbids ("the plan cursor is unchanged"). `‹` from a detour must instead just clear the override (no navigation at all) to reveal the return anchor that's already sitting at `parsedSongIndex`.

### Why `setlistId` is in the clearing effect's dependency array

No current navigation path in the app can reach "the same numeric `songIndex`, but a DIFFERENT `setlistId`" without going through `useStartPerformance` first (which already resets `activeDetourSongId` via `setPerformanceSession`, per Task 1) — `useStartPerformance` is the ONLY function that ever navigates to `/performance/:setlistId/0`. So this is defensive, not fixing an observed bug: if a future story adds a different entry path into an active performance route, the `setlistId` dependency ensures a stale detour from a different setlist's session can never survive into this one, even though `parsedSongIndex` alone might coincidentally match. Cheap, matches the codebase's existing defence-in-depth style (e.g. Story 4.4's last-song guard is duplicated for the same reason).

### Testing the mount-preserving effect

The existing test file (`performance-card.test.tsx`) fully mocks `useNavigate` (`vi.mock('react-router', ...) => ({ ...actual, useNavigate: () => navigateMock })`), so clicking `NEXT ›`/`‹` in a test NEVER produces a real route transition — `navigateMock` just records the call. This is sufficient for every OTHER test in this file (which only assert "was navigate called with X"), but it means you CANNOT use the normal `renderRoute()` + button-click pattern to prove "a within-mount `parsedSongIndex` change clears the detour override," because no real navigation ever happens.

Do NOT reach for `rerender()` with a new `<MemoryRouter initialEntries={[...]}>` — `MemoryRouter` creates its internal router via a lazy `useState` initializer that only runs on the FIRST mount; changing `initialEntries` on a `rerender()` call is a documented no-op and will silently fail to change the rendered route.

The correct technique for this ONE test: use `createMemoryRouter([{ path: '/performance/:setlistId/:songIndex', element: <PerformanceCard /> }])` + `<RouterProvider router={router}>` instead of `<MemoryRouter><Routes>...`, then call `router.navigate('/performance/setlistid0000001/1')` DIRECTLY in the test body (bypassing the mocked `useNavigate` and any button click entirely). This drives a genuine in-place route transition — `PerformanceCard` stays mounted (same component instance, same `isInitialRenderRef`), `useParams()` (unmocked — only `useNavigate` is overridden by this file's mock) picks up the new `songIndex`, and the clearing effect fires for real. Assert `useSetActiveDetourSongIdMock` was called with `null` afterwards.

### Copy this story invents (not epics-locked verbatim)

Epics.md locks the visible word `DETOUR` and the `↩` glyph + italic strip treatment verbatim, but does NOT lock:
- The position slot's spoken form when detoured. This story adds `ariaOnDetour: 'On a detour'` (distinct from the visible `DETOUR`, mirroring the existing `≡ jump` / `Open setlist and library jump overlay` glyph-vs-spoken-form precedent). If a future editorial pass wants different wording, that's a copy-only change to `microcopy.ts`.
- The strip's detour `aria-label` wording. Epics AC-8 explicitly says "e.g. ... or equivalent" — this story adds a `CURRENTLY_PERFORMING.ariaRegionDetour(title)` helper producing `"Currently performing on a detour: <title>"` as the equivalent.
- **Deliberately NOT changed:** `‹`'s `aria-label` (`PERFORMANCE_CARD.ariaPreviousSong`, "Previous song") stays the same in both plan and detour states, even though its behaviour is contextual. The journey doc (`journey-p1-performance.md` line 185) explicitly frames this as acceptable: *"‹ is contextual... Same button, unambiguous in context because the two cases never overlap."* Inventing a second aria-label (e.g. "Undo jump") would be adding un-sanctioned locked-feeling copy without checking with Sandy first — per `[[feedback-brief-examples-are-not-schema]]` / `[[feedback-verify-inferences-in-source-docs]]` project conventions. Leave it as-is; flag in code review only if Sandy wants to revisit.

### Known drift vs. the planning docs (do not fix here)

The journey doc (`journey-p1-performance.md` line 312) and the mockup brief describe the jump-overlay's highlighted row as showing the **return anchor** ("highlighted row on Kelvingrove Street, not on the detour song"). The SHIPPED Story 6.4 implementation instead highlights `displaySongId` — the CURRENTLY DISPLAYED song, which during a detour is the detour song itself, not the return anchor — per Story 6.4's own Task 4 rationale ("keeps the 'you are jumping from here' signal accurate for the song actually on screen"). This is a genuine discrepancy between the planning docs and the executed Story 6.4 contract, but it is **out of scope for Story 6.5**: none of this story's ACs (epics.md lines 2035–2093) touch the overlay's highlight logic, and `jump-overlay.tsx` is not in this story's File List. Do not "fix" it as an unrequested scope addition — if Sandy wants it revisited, that's a separate correction story (matching the precedent set by the Story 6.3 AC-drift commit, `d2dfd64`).

### `useSong()` for the detour title is a deliberate departure from the `titleSnapshot` pattern

Every other title on `/setlists/:setlistId` (including the shipped non-detour Currently-performing strip text) reads `titleSnapshot` off the Setlist's own `SongRef` — the AR-11 snapshot-at-author-time pattern, deliberately decoupled from the live `Song` record. The detour title CANNOT follow this pattern: Story 6.4 unified `B3` (within-setlist jump) and `B4` (library jump) so a detour target may have no `SongRef` in this Setlist at all. `useSong(activeDetourSongId)` is the only source that works for both cases. This means the detour title is technically "live" (not a snapshot) while the plan-cursor title stays a snapshot — a deliberate, documented inconsistency scoped exactly to the detour case, not a precedent for changing the plan-cursor title's behaviour.

### Files touched

| File | Change |
|---|---|
| `web/src/performance/performance-context.tsx` | UPDATE — add `activeDetourSongId` state + `useActiveDetourSongId`/`useSetActiveDetourSongId` hooks; `setPerformanceSession` also resets it to `null` |
| `web/src/routes/performance-card.tsx` | UPDATE — replace local `detourSongId` `useState` with the context hooks; mount-preserving clearing effect; `DETOUR` position-slot swap; contextual `‹` `disabled`/`onClick`; doc-comment update |
| `web/src/lib/microcopy.ts` | UPDATE — append `PERFORMANCE_CARD.detourLabel`/`ariaOnDetour`; `CURRENTLY_PERFORMING.detourPrefix`/`ariaRegionDetour` |
| `web/src/components/currently-performing-strip.tsx` | UPDATE — new required `isDetour` prop; italic + `↩` prefix; conditional region `aria-label` |
| `web/src/routes/setlist-overview.tsx` | UPDATE — derive `isDetourActive`; `useSong()` lookup for the detour title; pass `isDetour` to the strip |
| `web/src/performance/performance-context.test.tsx` | UPDATE — new hook coverage + `setPerformanceSession`-clears-detour case |
| `web/src/routes/performance-card.test.tsx` | UPDATE — new hoisted context mocks; new `describe('PerformanceCard — detour state (Story 6.5)')` block |
| `web/src/components/currently-performing-strip.test.tsx` | UPDATE — `isDetour` prop coverage on all cases |
| `web/src/routes/setlist-overview.test.tsx` | UPDATE — new `useSong` mock + detour-signal strip coverage |

No other files should need to change. In particular: no changes to `web/src/components/jump-overlay.tsx` (see "Scope boundary" above), no shared-package schema changes, no new API routes, no new CSS custom properties in `tokens.css`, no changes to `use-start-performance.ts` beyond what `setPerformanceSession`'s own (Task 1) implementation change already covers transparently.

### Architecture compliance

- File naming: `kebab-case` — all touched files already conform.
- TypeScript `strict: true` — the new `isDetour: boolean` prop and `activeDetourSongId: string | null` context field are fully typed; no `any`.
- No parallel Zod schema — no new record shapes introduced.
- State management: `activeDetourSongId` is the FOURTH cross-cutting field on `PerformanceModeContext` (alongside `performanceActive`, `activeSetlistId`/`activeSongIndex`, `performanceView`) — this is exactly the promotion Story 6.4's Dev Notes anticipated, matching architecture.md's "React Context for cross-cutting state" taxonomy (lines 718–724, 1034).
- Accessibility: `aria-label` swap on the position indicator (detour vs. plan); `aria-label` swap on the strip's region (detour vs. plan) — both satisfy color-never-alone (architecture.md line 831) by pairing the visual signal (dropped-numeric / italic+`↩`) with a distinct spoken form.
- Testing: Vitest + RTL, co-located `*.test.ts(x)`, no snapshot tests. [Source: architecture.md lines 768–778]
- Biome is the sole lint/format tool — run `pnpm lint` before marking `review`.
- Microcopy: append-only `PERFORMANCE_CARD`/`CURRENTLY_PERFORMING` additions, following the established non-locked, additive-surface convention (`detourLabel` is epics-locked verbatim; the two `aria*` strings are implementation-chosen per epics' own "or equivalent" latitude).

### Previous story intelligence (6.4, immediately prior)

Story 6.4 (`baseline_commit` = `e5cdd2a`, this story's baseline; committed as `Implement story 6.4: ...`) shipped:
- The component-local `detourSongId`/`setDetourSongId` `useState` in `PerformanceCard`, WITH an explicit, deliberate note in its own comment block that Story 6.5 would migrate this into context — this story is exactly that migration (Task 1/2).
- `JumpOverlay`'s `onSelectSong` callback wiring (`setDetourSongId(songId === currentSongRef?.songId ? null : songId)`) — Task 2 swaps this to `setActiveDetourSongId`, with IDENTICAL logic; no change to `jump-overlay.tsx` itself.
- `displaySongId`/`displaySongRef` — the display-override computation this story's `DETOUR` slot and the strip's title-lookup both build on top of, unchanged in shape.
- `performance-card.test.tsx`'s hoisted `useSongsMock` (added for `JumpOverlay`'s library reach) — irrelevant to this story's own new mocks (`useActiveDetourSongIdMock`/`useSetActiveDetourSongIdMock`) but must stay in place; do not remove it.
- The existing test `'after a detour selection, tapping NEXT › still navigates to plan-cursor + 1 (existing behaviour, unaffected by the detour override)'` (line ~721) — this story's AC-3 test should EXTEND this test's assertion set (or add a sibling test) now that `NEXT ›` from a detour is the FULL, final behaviour rather than "unaffected as a side-effect"; update its comment if you repurpose it, but do not delete the underlying coverage.

### Git intelligence summary

Recent commits: `e5cdd2a` (Story 6.4, current HEAD), `1d47045` (Story 6.3), `d2dfd64` (Story 6.3 AC-drift fixup), `fba00ff` (Story 6.2) — each a single-story, single-commit change with a clean working tree at the end. This story is the second to touch `performance-card.tsx` and `performance-context.tsx`'s hook surface in the same epic — expect a moderate diff in `performance-card.tsx` (state-source swap + two button/logic changes), a small but structurally important diff in `performance-context.tsx` (new field + hook pair + one existing function's body), and small diffs in `currently-performing-strip.tsx`/`setlist-overview.tsx`.

### Project Structure Notes

- No conflicts detected with `web/src/routes/`, `web/src/components/`, `web/src/performance/`, or `web/src/lib/` (kebab-case, co-located tests, flat directories — no subfolders).
- `web/src/hooks/use-song.ts` (Story 2.5) already exists and needs no changes — `setlist-overview.tsx` is a new *consumer* of it, not a modifier.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.5] (lines 2035–2093) — canonical AC statements this story implements
- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.4] (lines 1972–2033) — immediately-prior story; its Dev Notes explicitly deferred the context-promotion decision to this story
- [Source: _bmad-output/planning-artifacts/journeys/journey-p1-performance.md] lines 73–115, 175–198 (§B3, §B4, §B5) — detour state-machine semantics: "undo the jump" contextual `‹`, plan-cursor persistence, Resume-preserves-detour, detour chaining
- [Source: _bmad-output/planning-artifacts/mockups/p1-performance.md] lines 22–23, 43, 101–106, 257, 284–286, 298–300, 312, 317, 361 — D3 lock (dropped-numeric `DETOUR`), `↩` glyph lock, strip-signal lock (italic + `↩`, "Both" answer to Question 4)
- [Source: _bmad-output/planning-artifacts/mockups/rendered/p1-performance/iteration-3/state-2a-detour-v1-floor-text-chart.png] — approved detour-card rendering (structure)
- [Source: _bmad-output/planning-artifacts/mockups/rendered/p1-performance/iteration-2/state-7-strip-detour-signalled.png] — approved strip rendering with detour signal
- [Source: architecture.md] line 831 — color-never-alone accessibility rule
- [Source: architecture.md] lines 718–724, 1034 — React Context state-management taxonomy (basis for promoting `activeDetourSongId` into `PerformanceModeContext`)
- [Source: architecture.md] lines 805–811 — accessibility implementation primitives; existing `aria-label` pattern for the position indicator (`"Song 3 of 19"`)
- [Source: architecture.md] lines 768–778 — testing patterns: Vitest + RTL, no snapshots, co-located tests
- [Source: web/src/routes/performance-card.tsx] — current implementation as of `baseline_commit` (read in full during this story's creation)
- [Source: web/src/performance/performance-context.tsx] — current context shape; confirms the existing four fields and the `setPerformanceSession`/`useResetPerformanceSession`/`setActiveSongIndex` call-site boundaries this story must respect
- [Source: web/src/routes/setlist-overview.tsx] — current strip-wiring implementation (`currentPerformanceSongTitle` derivation, `Resume ›` handler) read in full during this story's creation
- [Source: web/src/components/currently-performing-strip.tsx] — shipped Story 4.3 component this story extends
- [Source: web/src/hooks/use-song.ts] — `useSong(songId: string | null)` signature confirms `null` is a safe, already-supported no-op input (used for the non-detour case)
- [Source: web/src/hooks/use-performance-end.ts] — confirms `resetSession()` (→ `setPerformanceSession(null, 0)`) is the ONLY end-of-performance cleanup path; this story's Task 1 change to `setPerformanceSession` is picked up here automatically, no changes needed to this file
- [Source: web/src/performance/use-start-performance.ts] — confirms `setPerformanceSession(setlistId, 0)` is the ONLY entry-point call; this story's Task 1 change is picked up here automatically, no changes needed to this file
- [Source: _bmad-output/implementation-artifacts/6-4-jump-overlay-5a-pinned-search-setlist-library-reach.md] — previous story's Dev Notes patterns this story follows and explicitly builds on ("Architecture decision this story must make" section, which this story's Task 1 resolves)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (claude-opus-4-7) via the bmad-dev-story workflow.

### Debug Log References

- Biome flagged `parsedSongIndex` + `setlistId` as extra dependencies on the mount-preserving `useEffect` in `performance-card.tsx` (`useExhaustiveDependencies`). Resolved with a `biome-ignore` comment — those props ARE the effect's triggers (their identity change is exactly what should re-run the clearing) per the story spec's Task 2 rationale + Dev Notes "Why `setlistId` is in the clearing effect's dependency array".
- Vitest emitted an `act()` warning on the `createMemoryRouter` mount-preserving test because `router.navigate(...)` triggers React state updates outside `act`. Wrapped the navigate call in `act(async () => { ... })` to suppress the warning without altering assertions.

### Completion Notes List

- Promoted the Story 6.4 component-local `detourSongId` `useState` into `PerformanceModeContext` as `activeDetourSongId` + `setActiveDetourSongId` (Task 1). Session-boundary reset added inside `setPerformanceSession()` — the only place both `useStartPerformance` and `useResetPerformanceSession` funnel through.
- `PerformanceCard`'s clearing effect is now mount-preserving via an `isInitialRenderRef` guard (Task 2). Fresh mounts (Start performance ›, cold relaunch, Resume › from strip) trust whatever `activeDetourSongId` context holds; only genuine within-mount `parsedSongIndex` / `setlistId` changes clear it.
- Position-slot swap to `DETOUR` (with `ariaOnDetour = 'On a detour'`) uses the SAME class list already on the position indicator — text-content swap only, no visual treatment change (locked constraint honoured).
- `‹` button is contextual: while detoured it "undoes the jump" (clears the override, no `navigate()` call, always enabled regardless of `isFirst`); on the plan cursor it retains its shipped `parsedSongIndex - 1` behaviour with `isFirst` disabling. `NEXT ›` deliberately unchanged — it already keys off `parsedSongIndex`, so AC-3 / AC-5 fall out for free.
- `‹`'s `aria-label` deliberately stays `"Previous song"` in both states (per journey doc + Dev Notes "Copy this story invents — Deliberately NOT changed").
- Currently-performing strip: new required `isDetour` prop drives italic-serif + `↩` prefix + detour region `aria-label`. `SetlistOverview` derives `isDetourActive` from context + fetches the detour song's LIVE title via `useSong()` (the only source that works for both within-setlist and library-only detour targets — Story 6.4's unified jump scope).
- All 641 web tests pass. Typecheck clean, Biome lint clean.
- `Resume ›`'s URL is unchanged — the detour override lives in context (not the URL), so remounting `PerformanceCard` at the plan-cursor URL picks the persisted `activeDetourSongId` back up via the mount-preserving guard.

### File List

- web/src/performance/performance-context.tsx (UPDATE)
- web/src/routes/performance-card.tsx (UPDATE)
- web/src/lib/microcopy.ts (UPDATE)
- web/src/components/currently-performing-strip.tsx (UPDATE)
- web/src/routes/setlist-overview.tsx (UPDATE)
- web/src/performance/performance-context.test.tsx (UPDATE)
- web/src/routes/performance-card.test.tsx (UPDATE)
- web/src/components/currently-performing-strip.test.tsx (UPDATE)
- web/src/routes/setlist-overview.test.tsx (UPDATE)

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-08-17 | Implemented story 6.5: promoted `detourSongId` into `PerformanceModeContext` with mount-preserving clearing; `DETOUR` position-slot swap; contextual `‹` (undo-the-jump); italic + `↩` detour signal on the Currently-performing strip; live-title lookup via `useSong` for the strip; new microcopy constants; 641 tests passing, lint + typecheck clean. | Sandy (via Amelia / Claude Opus 4.7) |
