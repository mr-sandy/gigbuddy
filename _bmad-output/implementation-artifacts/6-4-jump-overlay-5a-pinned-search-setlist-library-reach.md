---
baseline_commit: "1d47045"
builds_on: 6-3-jump-affordance-bottom-toolbar-a2
---

# Story 6.4: Jump overlay 5-a — pinned search + scrolling setlist overview + library reach (P1 5-a lock, unified-jump-scope)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Sandy,
I want the jump overlay (opened by `≡ jump` from Story 6.3) to show a pinned search field above a scrolling setlist overview, with library results appearing under an `In library` group when the query has no setlist match — one surface, one path, setlist-first,
So that whether I'm reaching for a song in tonight's plan (B3) or reaching outside it to a library song (B4), the interaction is a single search-or-scan and a single tap.

## Locked constraints (do not relitigate)

- Visual direction is locked — do not propose alterations to color, typography, or layout philosophy. Reuse existing invariant tokens (`--color-accent`, `--color-bg`, `--text-perf-body`, `--text-practice-body`, `--font-serif-editorial`, `--font-mono-slab`, `SECTION_HEADING.songCount`). No new CSS custom properties in `web/src/styles/tokens.css`.
- Sandy IS the user — skip persona ceremony.
- iOS PWA + Safari cookie sharing pattern is intentional (not touched by this story).
- British English spelling and idiom in UI copy is intentional. This story's only new prose is `Search this setlist or library`, `In this setlist`, `In library` — all locked verbatim in epics.md/the mockup brief, already British-neutral.
- **Scope boundary (critical):** this story fills the Story 6.3 shell's empty content region with search + setlist overview + library reach. It does **not** implement: the visual `DETOUR` position-slot treatment, the `NEXT ›`-returns-to-plan-cursor+1 / `‹`-undoes-the-jump button semantics, or the Currently-performing-strip `↩` signal — all three are Story 6.5's scope ("plan-cursor persistence"). This story's job is narrower and explicit: **guarantee that tapping a row makes the Performance Card display the tapped song, without moving the URL-encoded plan cursor.** See "Architecture decision this story must make" in Dev Notes — this is the single trickiest part of the story; read it before writing code.
- Do not build the section-break auto-scroll/highlight behaviour (Story 6.6) or the detour position-indicator swap (Story 6.5). Both stories will extend `JumpOverlay`/`PerformanceCard` further; keep this story's additions scoped to what its own ACs require.

## Acceptance Criteria

**AC-1 — Pinned search field + scrolling sectioned setlist overview, no card chrome duplicated**

**Given** the jump overlay is open (from the Story 6.3 shell)
**When** the overlay renders
**Then** the top chrome is: `‹` dismiss control (top-left, unchanged from 6.3) followed by a pinned search input with `aria-label="Search this setlist or library"` and `placeholder="Search this setlist or library"` (serif)
**And** below the search input, the setlist overview renders as a vertical scroll: each section heading reads `Set 1   6 songs` / `Set 2   5 songs` (Story 6.2's `SECTION_HEADING.songCount` format), each section listing its song rows with title (serif) + key (mono, small)
**And** no `NEXT ›`, no wake-lock indicator, no position indicator renders inside the overlay
**And** the row corresponding to the plan cursor (the song currently shown on the Performance Card when the overlay was opened, ignoring any prior detour override — see Dev Notes) is highlighted with `accent` fill / `bg`-colored text, AND carries a non-color signal (`aria-current="true"`) per architecture.md's color-never-alone rule (line 831) — this is the sole *visual* signal telling Sandy "you are jumping from here"

**AC-2 — No query: full sectioned setlist, no library section**

**Given** the overlay is open with no query typed
**When** the overlay renders
**Then** every setlist song row is visible in sectioned order (same section order as the Setlist Overview)
**And** no library rows are rendered, and the `In library` heading is absent

**AC-3 — Query matches the setlist: filter in place, no library rows**

**Given** Sandy types a query that has any match in the current setlist (case-insensitive substring on title)
**When** the overlay filters
**Then** matching setlist rows render (flattened, one list — section headings are dropped while filtering; see Dev Notes for the chosen composition) under an `In this setlist` small-caps heading (`text-secondary`)
**And** no library rows render

**AC-4 — Query matches only the library: `In library` group, no new API call**

**Given** Sandy types a query that has no match in the current setlist but does match one or more library songs
**When** the overlay filters
**Then** the setlist section is empty (omitted — no `In this setlist` heading with zero rows)
**And** an `In library` small-caps heading (`text-secondary`) renders, followed by matching library songs as tap-target rows (same title + key row shape as setlist rows)
**And** library songs already present in the current setlist are excluded from the `In library` group (de-dup by `songId` — every setlist song is also a library song, so without this exclusion a matching title would render twice)
**And** the library query reads the client-side library cache via `useSongs()` (Story 2.5) — no new API endpoint, no new fetch logic

**AC-5 — Query matches both: setlist first, library second**

**Given** Sandy types a query that matches both setlist and library rows
**When** the overlay filters
**Then** setlist matches render first (`In this setlist`), library matches render second (`In library`), in that order

**AC-6 — Tapping any row advances the card to that song; plan cursor and wake lock are untouched**

**Given** Sandy taps any row in the overlay (setlist match or library match)
**When** the tap is registered
**Then** the overlay dismisses (same 150ms fade as the Story 6.3 `‹` dismiss)
**And** the Performance Card underneath renders the tapped song (title, key, patch, chord chart, and per-gig annotation if the tapped song has a `SongRef` in the setlist; no annotation if it's a library-only song)
**And** the wake lock stays held throughout (no change to any wake-lock/`performanceActive` logic)
**And** the URL (`:songIndex`) and the plan-cursor position indicator (`<n> / <total>`) are **unchanged** — the card is now displaying a song other than `flatSongs[songIndex]` while the indicator still reads the plan-cursor's position (this looks visually incomplete until Story 6.5 swaps the indicator to `DETOUR`; that drift is expected and acceptable — see Dev Notes)

**AC-7 — Dismiss without selecting discards the query**

**Given** the overlay is open with a query typed
**When** Sandy taps the `‹` dismiss control
**Then** the overlay dismisses without changing the current song
**And** the query state is discarded (the overlay unmounts; re-opening remounts `JumpOverlay` fresh with `query=''` — no extra code needed beyond what Story 6.3 already ships)

**AC-8 — Wake-lock indicator still does not propagate to the overlay (unchanged from 6.3)**

**Given** the overlay is open
**When** the wake lock is lost while the overlay is visible
**Then** the `☽` glyph does NOT render on the overlay's chrome (already true — `JumpOverlay` does not call `useWakeLockIndicator()`; this story adds no such call)

**AC-9 — Reduced motion**

**Given** the overlay is open on iPhone with `prefers-reduced-motion`
**When** search filtering runs on each keystroke
**Then** the filter is applied instantly (row set changes on every keystroke via plain conditional rendering — no crossfade animation is introduced by this story, so there is nothing to collapse)
**And** the overlay's own mount/dismiss fade (Story 6.3, unchanged) still honours `≤150ms` / instant-under-reduced-motion as already shipped

## Tasks / Subtasks

- [x] Task 1 — `PerformanceCard`: introduce the local "display override" mechanism (AC: 6)
  - [x] In `web/src/routes/performance-card.tsx` (UPDATE), add `const [detourSongId, setDetourSongId] = useState<string | null>(null);` — **component-local `useState`, NOT `PerformanceModeContext`.** Justification: nothing outside `PerformanceCard` needs to read this in this story's scope (mirrors the `isJumpOverlayOpen` precedent from Story 6.3's Dev Notes). Story 6.5 may need to promote this concept into context (e.g. so the Currently-performing strip on `/setlists/:setlistId` can render the `↩` detour signal after `×`) — that migration is 6.5's job, not this story's. Do not add a context field here.
  - [x] Add `useEffect(() => { setDetourSongId(null); }, [parsedSongIndex]);` — clears any display override whenever the URL-encoded plan cursor changes (i.e. `NEXT ›` / `‹` navigation, or a fresh route load). This prevents a stale detour override from outliving the button-driven adjacent-song navigation that already exists. Without this, tapping `NEXT ›` while displaying a jumped-to song would advance the URL but the card would keep rendering the old detour song (stale `song` fetch key), because `displaySongId` would still resolve to the leftover `detourSongId`.
  - [x] Compute `const displaySongId = detourSongId ?? currentSongRef?.songId ?? null;` and pass it to `useSong(displaySongId)` in place of the current `useSong(currentSongRef?.songId ?? null)` call.
  - [x] Compute `const displaySongRef = detourSongId !== null ? flatSongs.find((s) => s.songId === detourSongId) : currentSongRef;` — used ONLY for the per-gig annotation lookup (title/key/patch/chordChart already come from the fetched `song` object and need no change). When `displaySongRef` is `undefined` (a library-only detour target with no `SongRef` in this setlist), the per-gig-annotation block must not render (guard on `displaySongRef?.perGigAnnotation`).
  - [x] Update `isLoading` to gate on `displaySongId` rather than `currentSongRef?.songId`: `const isLoading = setlist === undefined || (displaySongId !== null && song === undefined);`. The `notFound` gate is unchanged (`currentSongRef === undefined` still validates the plan cursor itself; `song === null` now also covers a bad `displaySongId` fetch).
  - [x] Do NOT change any `NEXT ›` / `‹` button logic, the position indicator markup, or the last-song `isLast` calculation — all of these continue to read `parsedSongIndex`/`flatSongs.length` exactly as today. This is deliberate: this story does not implement detour semantics, only the display-override plumbing Story 6.5 will build on.

- [x] Task 2 — `JumpOverlay`: pinned search field + sectioned setlist overview (AC: 1, 2, 3, 8, 9)
  - [x] In `web/src/components/jump-overlay.tsx` (UPDATE), extend the props: `sections: Section[]`, `currentSongId: string`, `onSelectSong: (songId: string) => void` (in addition to the existing `onDismiss: () => void`). Import `Section`/`SongRef`/`Song` types from `@gigbuddy/shared`.
  - [x] Add a `useState<string>('')` for `query`. Render the pinned search input directly below the existing `‹` dismiss row: `<input type="search" aria-label="Search this setlist or library" placeholder="Search this setlist or library" value={query} onChange={...} className="...">` — style per the serif input pattern already used in `song-search-row.tsx`'s `INPUT_CLASS` (border-0, transparent background, `font-serif-editorial`, `placeholder:text-secondary`, focus underline via `box-shadow`), reusing those exact utility classes rather than inventing new ones.
  - [x] Below the search input, render a scrollable content region (`flex-1 overflow-y-auto`) containing the sectioned setlist overview when `query.trim() === ''`:
    - For each `section` in `sections`, render a heading reading `SECTION_HEADING.songCount(section.songs.length)` prefixed by `section.name` (mirror the exact classes used in `section-heading.tsx`'s `NAME_CLASS`/`COUNT_CLASS` — do not import those constants since they aren't exported; re-declare equivalent classes locally in `jump-overlay.tsx`, citing the token names: `--text-section-heading` + `--font-serif-editorial` for the name, `--text-practice-body` + `--font-mono-slab` + `--color-text-secondary` for the count).
    - Each row: a `<button type="button">` containing the song title (serif, `--text-perf-body`, `--color-text-primary` — mirror `setlist-song-row.tsx`'s `TITLE_CLASS`) and, if a matching library `Song` has a `key`, the key (mono, `--text-practice-body`, `--color-text-secondary`).
    - The row whose `songId === currentSongId` gets `accent`-fill / `bg`-text classes (`bg-[color:var(--color-accent)] text-[color:var(--color-bg)]`) AND `aria-current="true"`.
    - `onClick` on any row calls `onSelectSong(songId)` then the existing `handleDismiss()` (the same fade-out-then-`onDismiss` function already in the component from Story 6.3) — do not duplicate the dismiss timer logic.
  - [x] Fetch the library via `useSongs()` (from `../hooks/use-songs.js`) inside `JumpOverlay` itself — do NOT thread a `songs` prop down from `PerformanceCard` (keeps the component self-contained for reuse by Story 6.6). Build `const songsById = useMemo(() => new Map((librarySongs ?? []).map((s) => [s.songId, s])), [librarySongs]);` and use it to look up each setlist row's `key` (setlist `SongRef` has no `key` field of its own — see `shared/src/schemas/setlist.ts`).
  - [x] No wake-lock indicator, no `useWakeLockIndicator()` call — unchanged from Story 6.3 (AC-8).

- [x] Task 3 — Filtering + `In this setlist` / `In library` grouping (AC: 3, 4, 5)
  - [x] Compute `const setlistSongIds = useMemo(() => new Set(sections.flatMap((sec) => sec.songs.map((sr) => sr.songId))), [sections]);` — used for library de-dup (AC-4).
  - [x] Compute `trimmedQuery`/`queryLower`/`hasQuery` (mirror `song-search-row.tsx`'s pattern).
  - [x] When `hasQuery`:
    - `setlistMatches` = all `SongRef`s across all sections whose `titleSnapshot.toLowerCase()` includes `queryLower`, flattened into one list (no per-section grouping while filtering — section headings are dropped; see Dev Notes for why).
    - `libraryMatches` = all `Song`s from `useSongs()` whose `title.toLowerCase()` includes `queryLower` AND whose `songId` is NOT in `setlistSongIds`.
    - Render `setlistMatches` (if any) under an `In this setlist` heading (small-caps, `text-secondary` — reuse the same heading classes as the section headings, or a slightly lighter treatment; either is acceptable per epics.md's "implementation picks the cleanest composition").
    - Render `libraryMatches` (if any) under an `In library` heading, after the setlist group.
    - If both are empty, render nothing below the search input (no invented "no matches" copy — none exists in `microcopy.ts` and none should be added without validating with Sandy first; silence is the existing pattern for other empty/loading states in this file's neighbourhood, e.g. `performance-card.tsx`'s "quiet skeleton" comment).
  - [x] When `!hasQuery`: render the full sectioned view from Task 2, no library group at all (AC-2).
  - [x] Add the two new microcopy strings to `web/src/lib/microcopy.ts` as a new `JUMP_OVERLAY` export (append-only, non-locked surface, same convention as `PERFORMANCE_CARD`/`SECTION_HEADING`): `searchLabel: 'Search this setlist or library'`, `inThisSetlistHeading: 'In this setlist'`, `inLibraryHeading: 'In library'`. Use these constants in `jump-overlay.tsx` rather than inline string literals.

- [x] Task 4 — Wire `JumpOverlay`'s new props from `PerformanceCard` (AC: 1, 6)
  - [x] In `web/src/routes/performance-card.tsx`, change the `JumpOverlay` render to pass the new props: `sections={setlist.sections}`, `currentSongId={displaySongId ?? ''}` — **use `displaySongId`, not `currentSongRef.songId`**, so that re-opening the overlay while already on a (this-story's-plumbing) detour highlights the currently-displayed song, not the original plan cursor; this keeps the "you are jumping from here" signal accurate for the song actually on screen. `onSelectSong={(songId) => setDetourSongId(songId === currentSongRef?.songId ? null : songId)}` — selecting the plan-cursor's own row clears any override (returns to plan); selecting anything else sets the override.
  - [x] Confirm `setlist` is defined at the point `<JumpOverlay>` renders (it is — the component already early-returns on the loading/not-found branches above the return statement that renders the toolbar/overlay).

- [x] Task 5 — Tests (AC: 1–9)
  - [x] `web/src/components/jump-overlay.test.tsx` (UPDATE) — the Story 6.3 "scope guard" test (`renders no search field, setlist rows, or library rows`) is now **incorrect** (this story intentionally adds all three) — delete it and replace with real content assertions. Add a hoisted `useSongsMock` (mirror the `useSetlistMock`/`useSongMock` hoisting pattern in `performance-card.test.tsx`) and `vi.mock('../hooks/use-songs.js', () => ({ useSongs: useSongsMock }))`. New/updated cases:
    - renders the search input with `aria-label`/`placeholder` "Search this setlist or library"
    - with no query: every setlist row renders in sectioned order (`Set 1   2 songs` etc. via `SECTION_HEADING.songCount`), no `In library` heading, no library rows
    - the plan-cursor row (`currentSongId` prop) is the only row with `aria-current="true"`
    - typing a query matching a setlist song filters to that row only, under `In this setlist`, no library rows
    - typing a query matching only a library song (not in the setlist fixture) shows `In library` with that row, no `In this setlist` heading (or an empty one — pick whichever the implementation renders and assert consistently)
    - a library song that happens to share a title-substring with a setlist song is NOT duplicated in `In library` (the de-dup case, AC-4)
    - a query matching both renders `In this setlist` before `In library` in DOM order
    - tapping a setlist row calls `onSelectSong` with that row's `songId`, then (after the fade) `onDismiss`
    - tapping a library row calls `onSelectSong` with that song's `songId`
    - the existing dialog-role / dismiss-aria-label / transition-class tests from Story 6.3 remain unchanged and passing
  - [x] `web/src/routes/performance-card.test.tsx` (UPDATE) — add the hoisted `useSongsMock` (new mock; `useSongs` is now transitively invoked whenever `JumpOverlay` mounts, so its absence would throw "No QueryClient" the moment any existing "tap `≡ jump`" test from Story 6.3 runs against the now-fuller `JumpOverlay`). New cases in the existing `describe('PerformanceCard — jump overlay ...')` block (or a new block):
    - tapping `≡ jump`, then a setlist row for a song OTHER than the currently-displayed one, results in the card re-rendering that song's title (i.e. `useSongMock` is called with the new `songId`) — WITHOUT `navigateMock` being called (plan cursor/URL untouched)
    - tapping `≡ jump`, then a library-only row (present in the `useSongsMock` fixture but not in `makeSetlist()`'s sections), results in the card rendering that song too — again without `navigateMock` being called
    - after selecting a detour target, tapping `NEXT ›` still calls `navigateMock` with `parsedSongIndex + 1` exactly as before (unchanged existing behaviour) — this is enough to prove Task 1's `useEffect` doesn't interfere with existing navigation; a full "does the card really show the plan song again after NEXT" assertion would require re-mounting at the new route and is optional/nice-to-have, not required
  - [x] Run `pnpm --filter web run test`, `pnpm --filter web run typecheck`, and `pnpm lint` — all clean before marking `review`.

## Dev Notes

### Architecture decision this story must make (read first)

The epics AC says: *"if the tapped song is not the plan cursor + 1, the card enters the detour state (semantics owned by Story 6.5; this story guarantees the transition triggers)"* and *"the plan cursor DOES NOT change."* Nothing in the shipped codebase currently distinguishes "the song being displayed" from "the plan cursor" — `PerformanceCard`'s only state is the URL's `:songIndex`, which today serves both roles simultaneously. Story 6.4 is the first story to need them to diverge (tapping a jump-overlay row must change *what's displayed* without moving the URL), and Story 6.5 is explicitly the story that builds the full detour *semantics* (return-anchor, contextual `‹`/`NEXT ›`, `DETOUR` label) on top of whatever plumbing 6.4 leaves behind.

**Chosen design (this story):** a single component-local `detourSongId: string | null` in `PerformanceCard`, defaulting to `null`. When set, it overrides which `songId` is fetched/displayed; the URL (`:songIndex`, i.e. the plan cursor) is never touched by the jump-overlay's `onSelectSong` callback. This is deliberately minimal:

- It unifies the B3 (setlist-internal jump) and B4 (library jump) cases — both are "just a songId" (matches the epics story title's `unified-jump-scope` lock). No separate code path for "jump within setlist" vs. "jump to library" is needed; `useSong(displaySongId)` doesn't care where the id came from.
- It is intentionally kept OUT of `PerformanceModeContext` — nothing outside `PerformanceCard` needs to read it in this story's scope. Story 6.5's Currently-performing-strip work (which needs detour state visible on a *different* route, `/setlists/:setlistId`, after `×`) will very likely need to promote this into context (or a new context field) — that is explicitly Story 6.5's job. Do not pre-build it here; a wrong guess now just gets thrown away.
- The position indicator (`<n> / <total>`) and `NEXT ›`/`‹` button logic are **not** touched by this story. This means that for a brief window after a jump (until Story 6.5 ships), the card will display a different song than the numeric indicator implies — e.g. showing `Sunny` while the header still reads `5 / 11`. This is expected drift, not a bug: epics.md's AC-1 for Story 6.5 explicitly says the numeric indicator is replaced by the word `DETOUR` "when the card enters the detour state" — that swap is 6.5's AC, not 6.4's. Do not attempt to hide/fudge the indicator in this story; leave it showing the plan-cursor position exactly as today.
- The `useEffect` that clears `detourSongId` on `parsedSongIndex` change (Task 1) is a defensive, self-contained addition — it stops a jumped-to display from persisting forever once Sandy taps `NEXT ›`/`‹` (which already navigate via the URL, unchanged). It does NOT implement "NEXT returns to plan cursor + 1" as a *detour-aware* behaviour — that already falls out for free, because `NEXT ›` already computes `parsedSongIndex + 1` regardless of any detour, and clearing `detourSongId` on that navigation simply stops the stale override from masking the correct plan song. Story 6.5 will build the *contextual* `‹` (undo-the-jump-to-return-anchor, rather than decrement) on top of this.

If a future reviewer (or Story 6.5) decides a different mechanism is needed, that's fine — this story's job is only to satisfy its own ACs without inventing 6.5's UI, and to leave a clean, well-commented seam for 6.5 to build on. Document any deviation in this story's Dev Agent Record.

### Why setlist rows lose their per-section grouping while filtering (composition choice)

Epics AC (Story 6.4, "query matches setlist") explicitly leaves this open: *"rows are grouped under an `In this setlist` small-caps heading ... if a group heading is required for legibility (the heading may be omitted when zero library results are present — implementation picks the cleanest composition per the mockup)."* This story's chosen composition: **always flatten to one list under `In this setlist` while a query is active** (never re-derive per-section `Set 1`/`Set 2` headings during filtering), because:

- Per-section headings during filtering would frequently render 1–2 sections with zero matching rows, which is visually noisier than a single flat list — and the epics text itself signals headings are secondary/optional during filtering ("if a group heading is required for legibility").
- Showing `In this setlist` unconditionally whenever there's a query and at least one setlist match (not only when library results are also present) keeps the logic simple/deterministic and is explicitly permitted by the epics wording ("may be omitted" ≠ "must be omitted").
- This mirrors the mockup brief's `In this setlist` / `In library` two-bucket model (`mockups/p1-performance.md` lines 294–296) rather than a three-or-more-bucket per-section model.

### Library de-dup is load-bearing (AC-4)

Every setlist `SongRef` references a `songId` that also exists in the Library (`Song` table) — the Library IS the source for every song ever added to a setlist. Without excluding `setlistSongIds` from the `In library` results, a query matching a song that's ALSO in tonight's setlist would render **twice**: once correctly under `In this setlist`, once incorrectly under `In library`. This is the single easiest correctness bug to introduce in this story — the mockup's own worked example (`mockups/p1-performance.md` line 252, `Almost Like Being In Love`) deliberately uses a song that is NOT in the setlist so the de-dup requirement wasn't visually obvious in the mock; the epics AC text makes it explicit ("no match in the current setlist but does match ... library songs").

### Row shape and key lookup — setlist `SongRef` has no `key` field

`SongRef` (`shared/src/schemas/setlist.ts`) is `{ songId, titleSnapshot, perGigAnnotation? }` — no `key`. The epics AC requires every row (setlist or library) to show "title (serif) + key (mono, small)." Since `JumpOverlay` already calls `useSongs()` for the library-reach feature, reuse that same result to look up each setlist row's `key` by `songId` (build a `Map<songId, Song>` once via `useMemo`). Do not add a second data source or thread `key` through the `Setlist`/`SongRef` schema — that would be a shared-schema change this story does not need and is out of scope (CLAUDE.md: "Zod schemas in `shared/` are the single source of truth... never define a parallel type for the same record shape" — adding `key` to `SongRef` would duplicate data already owned by `Song`).

### Reusing `SECTION_HEADING.songCount` without reusing the `<SectionHeading>` component

`section-heading.tsx`'s file comment (written during Story 6.2) anticipates this story reusing `SECTION_HEADING.songCount(n)` — do that. But do **not** reuse the `<SectionHeading>` component itself: it carries a MacBook-only `InlineEditField` rename branch and an `onRename` callback that have no purpose inside a read-only, always-performance-atmosphere overlay, and its internal `NAME_CLASS`/`COUNT_CLASS` constants are not exported for reuse anyway. Re-declare equivalent classes locally in `jump-overlay.tsx` (same token references: `--text-section-heading` / `--font-serif-editorial` for the name, `--text-practice-body` / `--font-mono-slab` / `--color-text-secondary` for the count) — this keeps `JumpOverlay` a lighter, self-contained, read-only component, which also makes it a cleaner base for Story 6.6 (section-break orientation view) to extend later.

### Accessibility: pair the `accent`-fill highlight with a non-color signal

Architecture.md line 831 ("Color-never-alone enforced by component contract... Code review catches violations; no automated check") and the pattern already established for Story 6.5's detour-strip AC (pairing italic + `↩` with an `aria-label`) both point the same way: the plan-cursor row's `accent`-fill highlight must not be the *only* signal. This story adds `aria-current="true"` to that row's button — cheap, standard, and testable (`getByRole('button', { current: true })` or an attribute assertion). This is not explicitly spelled out as its own AC line in epics.md, but is a direct application of the project's already-locked accessibility contract; expect code review to flag its absence if omitted.

### No "no matches" empty-state copy — do not invent one

If a query matches neither the setlist nor the library, this story renders nothing below the search input (silence). `microcopy.ts` has no entry for this state, and per `[[feedback-brief-examples-are-not-schema]]` / `[[feedback-verify-inferences-in-source-docs]]` project conventions, do not invent new user-facing copy without checking with Sandy first — silence is consistent with existing quiet-empty-state patterns already in this file's neighbourhood (`performance-card.tsx`'s loading-state comment: "Quiet skeleton — no spinner, no copy").

### `useSongs()` during active Performance Mode — AR-28 is already satisfied by precedent

AR-28 requires performance-mode reads to come from cache, not trigger auth-redirect toasts on failure. `PerformanceCard` already calls `useSetlist()`/`useSong()` while `performanceActive === true` (shipped since Epic 4) with no special AR-28 handling beyond what TanStack Query + the Service Worker cache already provide. `useSongs()` (Story 2.5) is built the same way (same `QueryClient` defaults, same offline-cache-first behaviour via the SyncProvider) — calling it from inside `JumpOverlay` needs no new AR-28 machinery; it inherits the same contract automatically.

### Files touched

| File | Change |
|---|---|
| `web/src/routes/performance-card.tsx` | UPDATE — add local `detourSongId` state + clearing effect; compute `displaySongId`/`displaySongRef`; change `useSong()` call and per-gig-annotation guard; pass new props to `<JumpOverlay>` |
| `web/src/components/jump-overlay.tsx` | UPDATE — add `sections`/`currentSongId`/`onSelectSong` props; pinned search input; sectioned setlist overview; `In this setlist`/`In library` filtering; `useSongs()` call for library reach + key lookups |
| `web/src/components/jump-overlay.test.tsx` | UPDATE — remove the now-incorrect Story 6.3 scope-guard test; add search/filter/selection/de-dup coverage; add `useSongsMock` |
| `web/src/routes/performance-card.test.tsx` | UPDATE — add `useSongsMock`; add setlist-jump / library-jump display-override test cases |
| `web/src/lib/microcopy.ts` | UPDATE — append new `JUMP_OVERLAY` export (`searchLabel`, `inThisSetlistHeading`, `inLibraryHeading`) |

No other files should need to change. In particular:
- No changes to `performance-context.tsx` (the display-override state is local to `PerformanceCard`, per the Architecture decision above).
- No new API routes, no shared-package schema changes (`SongRef` is not extended with `key`).
- No new CSS custom properties in `tokens.css`.
- No changes to `section-heading.tsx` itself (its exported `SECTION_HEADING.songCount` helper is consumed as-is; the component is not reused).

### Architecture compliance

- File naming: `kebab-case` — all touched files already conform.
- TypeScript `strict: true` — new props (`sections: Section[]`, `currentSongId: string`, `onSelectSong: (songId: string) => void`) fully typed; no `any`.
- No parallel Zod schema — `Section`/`SongRef`/`Song` types are imported from `@gigbuddy/shared`, not redefined.
- State management: local `useState` for `detourSongId` and `query`, matching architecture.md's "State management taxonomy" (React Context only for the four cross-cutting Performance Mode fields; component-local `useState` for everything else) and the `isJumpOverlayOpen`/`sheetOpen` precedents.
- Accessibility: `aria-label` + `placeholder` on the search input; `aria-current="true"` on the highlighted row (color-never-alone, architecture.md line 831); existing `role="dialog"`/`aria-modal="true"` unchanged.
- Testing: Vitest + RTL, co-located `*.test.tsx`, no snapshot tests. [Source: architecture.md lines 768–778]
- Biome is the sole lint/format tool — run `pnpm lint` before marking `review`.
- Microcopy: append-only `JUMP_OVERLAY` export, following the `PERFORMANCE_CARD`/`SECTION_HEADING` precedent (non-locked, additive surfaces). [Source: web/src/lib/microcopy.ts lines 1–14]

### Previous story intelligence (6.3, immediately prior)

Story 6.3 (`baseline_commit` = `1d47045`, this story's baseline) shipped:
- `JumpOverlay({ onDismiss }): JSX.Element` as a minimal shell — full-screen (`fixed inset-0`), `role="dialog" aria-modal="true" aria-label="Jump to a song"`, real 150ms opacity fade (mount via `requestAnimationFrame`, dismiss via a 150ms `setTimeout` before calling `onDismiss`). This story extends the SAME component (adds props, fills the empty `flex-1` content region) — do not rewrite the fade/dismiss mechanics, reuse `handleDismiss()` for row-tap selection too (Task 2).
- The Story 6.3 test file's explicit "scope guard" test (asserting NO searchbox/textbox/list exists) exists precisely to stop 6.3 from overshooting into 6.4's territory. Now that 6.4 IS building that content, this guard test must be deleted/replaced — do not leave it in place (it will correctly start failing, which is expected, not a regression to chase).
- `performance-card.test.tsx` already has hoisted mocks for `useSetlist`, `useSong`, `navigate`, `usePerformanceActive`, `setPerformanceActive`, `setActiveSongIndex`, `setPerformanceView` — reuse this scaffolding; add `useSongsMock` alongside it (Task 5).
- Story 6.3's Dev Notes established the "component-local, not context" precedent for `isJumpOverlayOpen` — this story's `detourSongId` follows the identical justification (see Architecture decision above).
- Story 6.3 removed the Story 4.1 next-song preview span entirely; there is no preview text anywhere in the toolbar to interact with or preserve.

### Git intelligence summary

Recent commits: `1d47045` (Story 6.3, current HEAD), `d2dfd64` (Story 6.3 AC-drift fixup), `fba00ff` (Story 6.2), `255c948` (Story 6.1) — each a single-story, single-commit change with a clean working tree at the end (verified via `git status` before this story's creation: nothing to commit). This story is the first in Epic 6 to touch `web/src/components/jump-overlay.tsx` a second time — expect a moderate diff there (props + a substantial new content region) plus a smaller diff in `performance-card.tsx` (new local state + a few line changes to the `useSong`/annotation logic, no changes to the toolbar/footer markup itself).

### Project Structure Notes

- No conflicts detected with `web/src/routes/`, `web/src/components/`, or `web/src/lib/` (kebab-case, co-located tests, flat `components/` directory — no subfolders).
- `web/src/hooks/use-songs.ts` (Story 2.5) already exists and needs no changes — this story is a new *consumer* of it, not a modifier.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.4] (lines 1972–2033) — canonical AC statements this story implements
- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.5] (lines 2035–2093) — the immediately-following story; its title ("plan-cursor persistence") and ACs define exactly where this story's scope ends
- [Source: _bmad-output/planning-artifacts/journeys/journey-p1-performance.md] lines 75–107 (§B3, §B4) — detour state-machine semantics; confirms library jumps ("B4") reuse the exact same detour mechanics as setlist-internal jumps ("B3") — the basis for this story's unified `detourSongId` design
- [Source: _bmad-output/planning-artifacts/journeys/journey-p1-performance.md] line 176 — "Jump target scope: unified. Setlist and library are one search surface. Setlist matches first, library matches after. No separate 'library escape hatch' flow."
- [Source: _bmad-output/planning-artifacts/mockups/p1-performance.md] lines 119–139, 190–202 — jump-overlay shape 5-a locked composition (search field + scrolling overview + library group)
- [Source: _bmad-output/planning-artifacts/mockups/p1-performance.md] lines 267–273, 294–296 — locked microcopy: `In this setlist`, `In library`, `Search this setlist or library`; worked query examples (`sun` → `Sunny`; `alm` → `Almost Like Being In Love`)
- [Source: _bmad-output/planning-artifacts/mockups/p1-performance.md] line 201 — "the plan cursor's row is highlighted in `accent` ... this is the sole signal telling Sandy 'you are jumping from here'"
- [Source: architecture.md] line 831 — color-never-alone accessibility rule (basis for the `aria-current` requirement on the highlighted row)
- [Source: architecture.md] lines 768–778 — testing patterns: Vitest + RTL, no snapshots, co-located tests
- [Source: web/src/routes/performance-card.tsx] — current implementation as of `baseline_commit` (read in full during this story's creation)
- [Source: web/src/components/jump-overlay.tsx] — Story 6.3's shipped shell (read in full during this story's creation)
- [Source: web/src/components/section-heading.tsx] — `SECTION_HEADING.songCount` helper + its file comment explicitly anticipating this story's reuse
- [Source: web/src/components/song-search-row.tsx] — existing serif search-input styling pattern (`INPUT_CLASS`) and case-insensitive substring-match pattern, reused here
- [Source: web/src/components/setlist-song-row.tsx] lines 62–64 — `TITLE_CLASS` token references reused for jump-overlay row titles
- [Source: web/src/hooks/use-songs.ts] — client-side library cache hook consumed by this story
- [Source: shared/src/schemas/setlist.ts] — confirms `SongRef` has no `key` field (basis for the library-cache key-lookup requirement)
- [Source: web/src/performance/performance-context.tsx] — confirms the four cross-cutting Performance Mode fields; `detourSongId` is deliberately NOT one of them in this story
- [Source: _bmad-output/implementation-artifacts/6-3-jump-affordance-bottom-toolbar-a2.md] — previous story's Dev Notes patterns this story follows (component-local state precedent, reuse-existing-tokens discipline, one-commit-per-story cadence)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (`claude-opus-4-7`) via `bmad-dev-story`.

### Debug Log References

- `pnpm --filter web run test` — 624/624 tests passing (16 in `jump-overlay.test.tsx`, 49 in `performance-card.test.tsx`).
- `pnpm --filter web run typecheck` — clean.
- `pnpm lint` — clean (Biome check, 217 files).

### Completion Notes List

- Implemented the `detourSongId` display-override pattern in `PerformanceCard` exactly as Task 1 spec — component-local `useState<string | null>`, cleared on every `parsedSongIndex` identity change. The URL / `NEXT ›` / `‹` / position-indicator markup are untouched; only `useSong()` fetch key + per-gig annotation lookup + `<JumpOverlay>` props flip through the override.
- `JumpOverlay` gained `sections` / `currentSongId` / `onSelectSong` props alongside the existing `onDismiss`. `useSongs()` is called locally (self-contained per Task 2 rationale) and its cache powers BOTH the library-reach filter AND the per-row key lookups (setlist `SongRef` has no `key` field).
- Chosen composition for setlist filtering: flatten all matches under a single `In this setlist` heading (drop the per-section `Set N` headings while a query is active). Consistent with the spec's "cleanest composition" latitude and mirrored in tests.
- Row highlight: `bg-[color:var(--color-accent)] text-[color:var(--color-bg)]` on the button pairs with `aria-current="true"` — the non-color signal required by architecture.md's color-never-alone rule. The setlist SongRef's `key` (mono, `text-secondary`) inherits the button's color when highlighted so the small-caps swaps cleanly to `bg`-colored text.
- Silence is the empty-state for a query that matches neither bucket (no invented microcopy — follows `[[feedback-brief-examples-are-not-schema]]` and the story's Dev Notes).
- `performance-card.test.tsx` now hoisted-mocks `useSongs()` (default: `{ data: [] }`) so every pre-existing test that opens the overlay via `≡ jump` continues to work; three new detour test cases assert (a) setlist-jump display-override without navigation, (b) library-only-jump display-override without navigation, and (c) NEXT › still navigates to `parsedSongIndex + 1` after a detour selection.
- One `biome-ignore lint/correctness/useExhaustiveDependencies` on the `setDetourSongId(null)` effect — the effect body doesn't read `parsedSongIndex`, but its identity change is the intended trigger. Ignored with a comment matching the `inline-edit-field.tsx` precedent.
- No changes to `PerformanceModeContext`, `useWakeLockIndicator`, `useSong` / `useSetlist` / `useSongs` hook signatures, shared Zod schemas, or `tokens.css` — all deliberately out of scope per spec.

### File List

- `web/src/routes/performance-card.tsx` (UPDATE) — added local `detourSongId` state + clearing effect; introduced `displaySongId`/`displaySongRef`; retargeted `useSong()` and the per-gig annotation guard; passed `sections`/`currentSongId`/`onSelectSong` props to `<JumpOverlay>`.
- `web/src/components/jump-overlay.tsx` (UPDATE) — new `sections`/`currentSongId`/`onSelectSong` props; pinned search input; sectioned setlist overview (no-query view); `In this setlist`/`In library` filtering (with query); local `SongRow`/`SetlistSection` helpers; `useSongs()` reach for library matches + per-row key lookups.
- `web/src/components/jump-overlay.test.tsx` (UPDATE) — removed the Story 6.3 scope-guard test; added `useSongsMock`; new coverage for pinned-search-input rendering, no-query sectioned overview, `aria-current` highlight, setlist-only / library-only / de-dup / both / no-matches filtering, and setlist / library row selection.
- `web/src/routes/performance-card.test.tsx` (UPDATE) — added hoisted `useSongsMock`; three new tests for setlist-jump, library-only-jump, and post-detour NEXT › behaviour.
- `web/src/lib/microcopy.ts` (UPDATE) — appended a new `JUMP_OVERLAY` export (`searchLabel`, `inThisSetlistHeading`, `inLibraryHeading`).

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-08-17 | Implement Story 6.4: JumpOverlay pinned search + sectioned setlist overview + `In library` reach + PerformanceCard display-override plumbing. | Claude Opus 4.7 |
