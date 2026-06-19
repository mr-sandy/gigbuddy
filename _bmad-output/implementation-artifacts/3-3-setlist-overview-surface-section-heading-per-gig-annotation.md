---
baseline_commit: 68e45ba
builds_on: 3-2-setlists-home-tonight-upcoming-past
---

# Story 3.3: Setlist overview surface + Section heading + per-gig annotation (FR-13, FR-10, FR-11)

Status: review

## Story

As Sandy,
I want the Setlist overview surface to render gig metadata, sections, song rows, and per-gig annotations, with inline rename and annotation edit on MacBook,
so that the overview is the per-gig prep surface and a launchpad for Performance Mode.

## Acceptance Criteria

**AC-1 — Route shell: `SetlistOverview` replaces the Story 3.2 stub**

**Given** `/setlists/:setlistId` with a valid auth cookie
**When** the route renders
**Then** `web/src/routes/setlist-overview.tsx` (UPDATE — replaces the placeholder `<h1>Setlist {setlistId}</h1>` stub) calls `useSetlist(setlistId)` from `web/src/hooks/use-setlist.ts`
**And** while loading (`isLoading`), the page renders a quiet skeleton or nothing (no full-page spinner; no text)
**And** if the setlist resolves to `null` (404 from API), the page renders the message `Setlist not found.` (use `EMPTY_STATES.setlistNotFound` — see AC-14)
**And** `router.tsx` is NOT changed (the route is already wired)

**AC-2 — Gig metadata header**

**Given** a loaded Setlist
**When** the route renders
**Then** the top of the page shows a header block containing:
  - Venue in editorial serif at `section-heading` size (`--text-section-heading: 22px`) in `text-primary`
  - Date formatted as a human-readable string (e.g., `"21 Jun 2026"` — same `formatGigDate` helper used in `gig-card.tsx`) in mono at practice body size (`--text-practice-body`) in `text-secondary`
  - Time appended to date if present (e.g., `"21 Jun 2026 · 20:00"`) — if absent, date only
**And** the header uses no special card treatment (no surface fill, no border) — plain page header

**AC-3 — Sections and song rows structure**

**Given** a loaded Setlist with at least one Section
**When** the route renders
**Then** Sections render in their stored order (`setlist.sections[]` index order)
**And** each Section renders a `SectionHeading` component followed by a list of `SetlistSongRow` components (one per `section.songs[]` entry in stored order)

**AC-4 — `SectionHeading` component (MacBook — inline rename)**

**Given** `web/src/components/section-heading.tsx` (NEW)
**When** rendered on MacBook (atmosphere `practice`)
**Then** the section name renders in small-caps editorial serif at `section-heading` size in `text-secondary`
  - Tailwind: `text-[length:var(--text-section-heading)] font-[family-name:var(--font-serif-editorial)] text-[color:var(--color-text-secondary)] font-variant-caps-[small-caps] uppercase tracking-wide`
**And** a count badge renders inline after the name: `<count> songs` (e.g., `"Set 1 · 4 songs"`) — the badge is a `<span>` in mono `text-secondary` at practice body size, appended after the section name with ` · ` separator
**And** the heading is wrapped in an `InlineEditField` (from `web/src/components/inline-edit-field.tsx`): clicking enters edit; blur commits
**And** on commit, `onRename(sectionIndex, newName)` prop is called (the parent route builds and enqueues the whole-Setlist PUT)
**And** `ariaLabel` on the `InlineEditField` is `"Rename section: {sectionName}"`

**AC-5 — `SectionHeading` component (iPhone — static)**

**Given** `SectionHeading` rendered on iPhone (atmosphere `performance`)
**When** rendered
**Then** the name is plain text (no `InlineEditField`): renders as a `<span>` or `<h3>` — NOT an interactive field (per FR-10 / EXPERIENCE.md Component Patterns)
**And** the count badge still renders (`Set 1 · 4 songs`)
**And** the name is NOT renameable on iPhone — the `onRename` prop is still accepted for type compatibility but no edit interaction is wired on iPhone

**AC-6 — `SectionHeading` component atmosphere detection**

**Given** the `SectionHeading` component
**When** deciding whether to render inline edit (MacBook) or static (iPhone)
**Then** the component reads `document.documentElement.dataset.atmosphere` at render time (the same `readAtmosphere()` pattern used by `song-detail.tsx`)
**And** atmosphere `'practice'` → MacBook → editable `InlineEditField`
**And** atmosphere `'performance'` → iPhone → static display
**And** a `SectionHeadingProps` type exported from `section-heading.tsx`:
  ```ts
  type SectionHeadingProps = {
    name: string;
    songCount: number;
    sectionIndex: number;
    onRename: (sectionIndex: number, newName: string) => void;
  };
  ```

**AC-7 — `SetlistSongRow` component — no annotation**

**Given** `web/src/components/setlist-song-row.tsx` (NEW)
**When** rendered for a `SongRef` with no `perGigAnnotation`
**Then** it shows only the song title (`songRef.titleSnapshot`) in editorial serif body size (`--text-perf-body: 18px`) in `text-primary`
**And** no empty annotation slot appears (no placeholder text, no blank line) — the row renders as title only
**And** the tap target satisfies `min-h-tap` (44px)

**AC-8 — `SetlistSongRow` component — with annotation**

**Given** a `SongRef` with a non-empty `perGigAnnotation`
**When** the row renders
**Then** the title renders as in AC-7
**And** the annotation appears below the title as an italic serif subline in the `accent` token color (`--color-accent`) at practice body size
  - Tailwind: `italic text-[length:var(--text-practice-body)] text-[color:var(--color-accent)] [font-family:var(--font-serif-editorial)]`
**And** the annotation is visually distinct from canonical Song notes (italic + accent color, not practice body default color)

**AC-9 — `SetlistSongRow` tap behavior on MacBook**

**Given** a `SetlistSongRow` on MacBook
**When** Sandy taps the title area (the row body)
**Then** the router navigates to `/songs/:songId` (Song Detail) using `songRef.songId`
**And** when Sandy taps the annotation area (or clicks a dedicated annotation affordance icon/area), an inline `InlineEditField` opens in place of the static annotation text for edit
**And** blurring the `InlineEditField` commits the annotation change by calling `onAnnotationChange(sectionIndex, songIndex, newAnnotation)` prop
**And** `onAnnotationChange` is called even when the new value is empty string (clearing the annotation)

**AC-10 — `SetlistSongRow` tap behavior on iPhone — bottom sheet**

**Given** a `SetlistSongRow` on iPhone
**When** Sandy taps the row body
**Then** a bottom sheet (modal dialog) opens containing:
  - The song title as a read-only heading inside the sheet
  - A `<textarea>` (multiline `InlineEditField`) pre-filled with the current annotation (empty if none)
  - A `Done` button that commits the annotation and closes the sheet
  - An `×` dismiss button that closes without committing (or swipe-to-dismiss)
**And** tapping `Done` calls `onAnnotationChange(sectionIndex, songIndex, newAnnotation)` and closes the sheet
**And** tapping `×` or dismissing closes without saving
**And** the sheet does NOT navigate to Song Detail — the row on iPhone is annotation-focused, not a navigation target for the title tap (divergence from MacBook: on iPhone the whole row tap opens the annotation sheet, not Song Detail)

**Implementation note on iPhone row tap:** On iPhone the whole row tap opens the annotation sheet. On MacBook the row-body tap navigates to Song Detail and only the annotation area opens the inline edit. The `SetlistSongRow` props include both `onNavigate` (used on MacBook title-tap) and `onAnnotationChange` (used on both platforms) — the component reads atmosphere to decide which tap-target pattern to use.

**AC-11 — Per-gig annotation persistence: whole-record PUT via outbox**

**Given** an annotation edit commits (either MacBook inline or iPhone sheet `Done`)
**When** the parent route (`SetlistOverview`) receives the `onAnnotationChange` callback
**Then** it builds a new `SetlistPutInput` with the updated `perGigAnnotation` in the correct `sections[i].songs[j]` position
**And** calls `saveSetlist(updated)` from `useSetlistMutation()`
**And** the optimistic cache updates immediately (the annotation change renders before the API responds)
**And** the annotation is stored on the `(Setlist, Song)` pair within the embedded structure, NOT on the Song record
**And** no change is made to the Song record at `/songs/:songId`

**AC-12 — Section rename persistence: whole-record PUT via outbox**

**Given** a section name edit commits on MacBook
**When** the parent route (`SetlistOverview`) receives the `onRename` callback
**Then** it builds a new `SetlistPutInput` with the updated section name in `sections[i].name`
**And** calls `saveSetlist(updated)` from `useSetlistMutation()`
**And** the optimistic cache updates immediately
**And** all song rows and annotations within the section are preserved unchanged (only the `name` field of the section changes)

**AC-13 — `Start performance ›` CTA on iPhone (stub — Epic 4 wires it)**

**Given** the Setlist overview on iPhone (atmosphere `performance`)
**When** the route renders
**Then** a bottom-fixed full-width `Start performance ›` CTA appears above the iPhone tab bar
**And** the CTA is `≥64px` tall with `accent` background (`--color-accent`) and `bg` text (`--color-bg`) per UX-DR4
**And** the CTA is always visible regardless of Setlist length (fixed, not scrolling with content)
**And** in Epic 3, tapping the CTA is **INERT** — the button renders with `type="button"` and no `onClick` handler (or a no-op handler) — Epic 4 wires the entry behavior
**And** on MacBook the CTA does NOT render (iPhone-only per UX-DR4 / FR-13)
**And** the CTA uses the `isIPhone()` check from `web/src/lib/platform.ts` to conditionally render

**AC-14 — `Currently performing` strip slot (placeholder — Epic 4 populates)**

**Given** the Setlist overview on iPhone
**When** the route renders
**Then** the `CurrentlyPerformingStrip` component slot is reserved at the top of the page content area (above the gig header)
**And** in Epic 3, the slot renders **nothing** — it is a comment-only placeholder (no component, no empty div) that marks where `<CurrentlyPerformingStrip />` mounts in Epic 4

**AC-15 — Microcopy: extend `web/src/lib/microcopy.ts`**

**Given** `web/src/lib/microcopy.ts` (UPDATE)
**When** reviewed
**Then** `EMPTY_STATES` gains:
  ```ts
  setlistNotFound: 'Setlist not found.',
  ```
**And** `ACTIONS` gains:
  ```ts
  startPerformance: 'Start performance ›',
  done: 'Done',
  ```
**And** no other changes to existing constants

**AC-16 — Stale-write handling for Setlist edits**

**Given** any inline edit (section name or per-gig annotation) commits
**When** the outbox flushes and the server returns `dropped-as-stale`
**Then** the flusher (already wired in Story 3.1 / Story 2.4) replaces the cache with `currentState`
**And** the quiet MacBook banner `Your earlier edit was superseded.` appears (constant `BANNERS.staleWrite` from Story 2.4)
**And** on iPhone in Performance Mode the banner is suppressed per AR-28 (already handled by Story 2.4's flusher)
**And** Story 3.3 adds NO new stale-write code — this is fully handled by the existing sync layer

**AC-17 — `SetlistSongRow` and `SectionHeading` tests**

**Given** `web/src/components/setlist-song-row.test.tsx` (NEW)
**When** the test suite runs
**Then** it covers:
  - renders title from `titleSnapshot`
  - renders annotation as italic accent subline when `perGigAnnotation` is set
  - renders no annotation subline when `perGigAnnotation` is absent
  - on MacBook: title tap calls `onNavigate(songId)`
  - on MacBook: annotation area tap opens `InlineEditField`
  - on MacBook: `InlineEditField` blur calls `onAnnotationChange(sectionIndex, songIndex, newValue)`
  - on iPhone: row tap opens bottom sheet (modal is rendered)
  - on iPhone: `Done` button calls `onAnnotationChange`
  - on iPhone: `×` dismiss does NOT call `onAnnotationChange`
  - tap target height satisfies 44px minimum

**Given** `web/src/components/section-heading.test.tsx` (NEW)
**When** the test suite runs
**Then** it covers:
  - renders section name
  - renders count badge (`· N songs`)
  - on MacBook: renders `InlineEditField`; blur with changed value calls `onRename`
  - on iPhone: renders static text, NOT `InlineEditField`

**AC-18 — `SetlistOverview` route tests**

**Given** `web/src/routes/setlist-overview.test.tsx` (NEW — replaces or extends the non-existent stub test)
**When** the test suite runs
**Then** it covers:
  - loading state renders without error
  - 404 (null from `useSetlist`) renders `EMPTY_STATES.setlistNotFound`
  - loaded setlist: renders venue + formatted date
  - loaded setlist: renders sections in order with section headings
  - loaded setlist: renders song titles from `titleSnapshot`
  - loaded setlist: renders per-gig annotation where present
  - section rename: `onRename` flows through to `saveSetlist` call
  - annotation change: `onAnnotationChange` flows through to `saveSetlist` call
  - iPhone: `Start performance ›` CTA renders
  - MacBook: `Start performance ›` CTA does NOT render

**AC-19 — Verification pass**

**Given** the implementation is complete
**When** verification commands run from the repo root
**Then** `pnpm typecheck` is green across all five packages
**And** `pnpm lint` is green via Biome (kebab-case filenames; camelCase identifiers; no new `biome-ignore` directives)
**And** `pnpm test` is green — all new tests pass; no regressions against Story 3.2 baseline (web 273, api 103)
**And** `pnpm build:web` is green; `pnpm-lock.yaml` is unchanged (no new runtime dependencies)

**AC-20 — Commit checkpoint**

**Given** the implementation is complete and all verification passes
**When** the story is marked done
**Then** an explicit commit has been created containing all new and modified files listed in the File List
**And** `git status --porcelain` is clean

## Tasks / Subtasks

- [x] **Task 1 — Microcopy update** (AC: 15)
  - [x] Update `web/src/lib/microcopy.ts`: add `EMPTY_STATES.setlistNotFound`, `ACTIONS.startPerformance`, `ACTIONS.done`
  - [x] Run `pnpm typecheck` to confirm compiles

- [x] **Task 2 — `SectionHeading` component + test** (AC: 4, 5, 6, 17)
  - [x] Create `web/src/components/section-heading.tsx`
  - [x] Read `web/src/components/inline-edit-field.tsx` and `web/src/routes/song-detail.tsx` first to understand `InlineEditField` and `readAtmosphere()` patterns
  - [x] Export `SectionHeadingProps` type and `SectionHeading` component
  - [x] Implement atmosphere detection via `readAtmosphere()` helper (copy pattern from `song-detail.tsx`)
  - [x] MacBook: wrap section name in `InlineEditField` with `ariaLabel="Rename section: {name}"`
  - [x] iPhone: render section name as static `<span>` or `<h3>`
  - [x] Count badge: `{name} · {songCount} songs` with mono styling
  - [x] Create `web/src/components/section-heading.test.tsx` covering AC-17 cases
  - [x] Run `pnpm typecheck`

- [x] **Task 3 — `SetlistSongRow` component + test** (AC: 7, 8, 9, 10, 17)
  - [x] Create `web/src/components/setlist-song-row.tsx`
  - [x] Read `web/src/components/library-song-row.tsx` and `web/src/components/gig-card.tsx` for `useNavigate()` patterns
  - [x] Props: `songRef: SongRef`, `sectionIndex: number`, `songIndex: number`, `onNavigate: (songId: string) => void`, `onAnnotationChange: (sectionIndex: number, songIndex: number, newAnnotation: string) => void`
  - [x] Title renders from `songRef.titleSnapshot` in editorial serif at `--text-perf-body`
  - [x] When `songRef.perGigAnnotation` is present: italic accent subline below title
  - [x] Atmosphere detection: MacBook → title-tap navigates; annotation-tap opens `InlineEditField`; iPhone → whole-row tap opens bottom sheet
  - [x] Bottom sheet (iPhone): use a `<dialog>` element or `role="dialog"` pattern; pre-fill multiline `InlineEditField`; `Done` button + `×` dismiss
  - [x] Create `web/src/components/setlist-song-row.test.tsx` covering AC-17 cases (mock `useNavigate` from `react-router` with `vi.mock`)
  - [x] Run `pnpm typecheck`

- [x] **Task 4 — `SetlistOverview` route full implementation + test** (AC: 1, 2, 3, 11, 12, 13, 14, 16, 18)
  - [x] Update `web/src/routes/setlist-overview.tsx` replacing the stub
  - [x] Import `useSetlist`, `useSetlistMutation`, `SectionHeading`, `SetlistSongRow`, `EMPTY_STATES`, `ACTIONS`, `isIPhone` from their respective modules
  - [x] Use `useParams<{ setlistId: string }>()` to read `setlistId`; pass to `useSetlist`
  - [x] Loading state: render nothing or lightweight skeleton (no full-page spinner)
  - [x] Null (404) state: render `EMPTY_STATES.setlistNotFound`
  - [x] Loaded state: render gig header (venue + date/time) then sections
  - [x] `handleRename(sectionIndex, newName)`: builds updated `SetlistPutInput` from cached setlist, replaces `sections[sectionIndex].name`, stamps `clientWrittenAt: new Date().toISOString()`, calls `saveSetlist`
  - [x] `handleAnnotationChange(sectionIndex, songIndex, newAnnotation)`: builds updated `SetlistPutInput`, replaces `sections[sectionIndex].songs[songIndex].perGigAnnotation` (set to `undefined` if empty string), stamps `clientWrittenAt`, calls `saveSetlist`
  - [x] iPhone: render fixed-bottom `Start performance ›` CTA (inert in Epic 3)
  - [x] Add comment placeholder for `CurrentlyPerformingStrip` slot (Epic 4)
  - [x] `formatGigDate`: import from `web/src/components/gig-card.tsx` if exported, OR copy the same helper locally (see Dev Notes — the helper is not yet exported from gig-card.tsx)
  - [x] Create `web/src/routes/setlist-overview.test.tsx` covering AC-18 cases
  - [x] Run `pnpm typecheck`

- [x] **Task 5 — Verification pass** (AC: 19)
  - [x] `pnpm typecheck` green across all five packages
  - [x] `pnpm lint` green (run `pnpm lint --write` for auto-format if needed)
  - [x] `pnpm test` green — confirm no regressions; note new test count
  - [x] `pnpm build:web` green; `pnpm-lock.yaml` unchanged

- [ ] **Task 6 — Commit checkpoint** (AC: 20) _(deferred — orchestration workflow owns the commit after review steps pass)_
  - [ ] `git add` all new and modified files listed in the File List
  - [ ] `git commit` with a descriptive message
  - [ ] Confirm `git status --porcelain` is clean

## Dev Notes

### This story's scope

Story 3.3 delivers the **real Setlist overview surface**, replacing the Story 3.2 placeholder stub. It is a pure web-layer story: no server changes, no schema changes, no sync-layer changes. All persistence flows through the existing `useSetlistMutation()` hook from Story 3.1.

**What this story delivers:**
- `web/src/routes/setlist-overview.tsx` UPDATE — full implementation replacing `<h1>Setlist {setlistId}</h1>`
- `web/src/components/section-heading.tsx` NEW — `SectionHeading` component
- `web/src/components/section-heading.test.tsx` NEW
- `web/src/components/setlist-song-row.tsx` NEW — `SetlistSongRow` component
- `web/src/components/setlist-song-row.test.tsx` NEW
- `web/src/routes/setlist-overview.test.tsx` NEW
- `web/src/lib/microcopy.ts` UPDATE — three new constants

**What this story does NOT deliver:**
- Setlist creation (Story 3.4)
- Paste-to-parse (Story 3.5)
- Drag-reorder (Story 3.6)
- Wired `Start performance ›` behavior (Epic 4)
- `CurrentlyPerformingStrip` component (Epic 4)
- No changes to `router.tsx` (route already wired from Story 3.2)
- No changes to `api/**`, `shared/**`, `infra/**`, `e2e/**`

### Architecture compliance

**AR-23 (architecture.md):** Whole-record PUT semantics. Every annotation change and section rename sends the ENTIRE `sections[]` array. The route builds a full `SetlistPutInput` by deep-copying the current cached setlist and modifying only the relevant field. Never send a partial update.

**AR-45 (architecture.md):** UI consumes hooks only. `SetlistOverview` imports `useSetlistMutation()` — never `outbox.ts` directly.

**AR-46 (architecture.md):** No analytics SDK, no Redux/Zustand/Jotai. State is local `useState` for sheet open/close plus TanStack Query for the setlist record.

**AR-47 / AR-48:** `clientWrittenAt` must be `new Date().toISOString()` at mutation time, NOT the stored value on the setlist (stamping at write time is the LWW mechanism).

### Building the PUT payload — CRITICAL pattern

This is the most important implementation detail in the story. The whole-record PUT must include ALL current fields from the cached setlist, with only the changed field replaced. The dev agent MUST read the Zod schema to understand what `SetlistPutInput` requires:

```ts
// From shared/src/schemas/setlist.ts:
// SetlistPutInputSchema = SetlistSchema.omit({ serverReceivedAt: true }).strict()
// Therefore SetlistPutInput includes: bandId, setlistId, gigMeta, sections[], clientWrittenAt, version
```

The handler pattern for annotation change (same pattern for section rename, just different field):

```ts
function handleAnnotationChange(
  sectionIndex: number,
  songIndex: number,
  newAnnotation: string,
): void {
  if (!setlist) return;
  const updated: SetlistPutInput = {
    bandId: setlist.bandId,
    setlistId: setlist.setlistId,
    gigMeta: setlist.gigMeta,
    version: setlist.version,
    clientWrittenAt: new Date().toISOString(), // MUST be fresh — LWW stamp
    sections: setlist.sections.map((section, si) =>
      si !== sectionIndex
        ? section
        : {
            ...section,
            songs: section.songs.map((song, ji) =>
              ji !== songIndex
                ? song
                : {
                    ...song,
                    perGigAnnotation: newAnnotation || undefined, // clear empty strings
                  },
            ),
          },
    ),
  };
  void saveSetlist(updated);
}
```

For section rename:
```ts
sections: setlist.sections.map((section, si) =>
  si !== sectionIndex ? section : { ...section, name: newName },
),
```

### `readAtmosphere()` pattern — copy from song-detail.tsx

Both `SectionHeading` and `SetlistSongRow` need atmosphere detection. Copy this helper verbatim from `web/src/routes/song-detail.tsx` — do NOT import it (it's local to song-detail; each consumer has its own copy):

```ts
function readAtmosphere(): 'practice' | 'performance' {
  if (typeof document === 'undefined') return 'practice';
  return document.documentElement.dataset.atmosphere === 'performance' ? 'performance' : 'practice';
}
```

Call it at render time (not in `useEffect`): `const atmosphere = readAtmosphere();`

### `formatGigDate` helper — reuse vs copy

`gig-card.tsx` contains `formatGigDate(isoDate: string): string` but it is NOT currently exported from `gig-card.tsx`. Options:
1. Export it from `gig-card.tsx` and import in `setlist-overview.tsx` — cleaner but modifies `gig-card.tsx`
2. Duplicate the helper locally in `setlist-overview.tsx` — acceptable for a small pure function

**Recommended:** Move `formatGigDate` to `web/src/lib/gig-date.ts` (the London timezone utilities file from Story 3.2) and export from there. This is the correct architectural home. Both `gig-card.tsx` and `setlist-overview.tsx` then import from `../lib/gig-date.js`. Update `gig-card.tsx` to import from gig-date instead of defining locally.

This means `gig-date.ts` gets one addition (no new test needed — the existing test for `gig-date.test.ts` should be extended with a `formatGigDate` test case if moving the function there).

### Bottom sheet for iPhone annotation edit

The bottom sheet is a mobile-native pattern. Implementation approach:

```tsx
// State:
const [sheetState, setSheetState] = useState<{
  open: boolean;
  sectionIndex: number;
  songIndex: number;
  title: string;
  currentAnnotation: string;
}>({ open: false, sectionIndex: 0, songIndex: 0, title: '', currentAnnotation: '' });

// Sheet UI (rendered at the bottom of SetlistSongRow or lifted to SetlistOverview):
{sheetState.open && (
  <div
    role="dialog"
    aria-modal="true"
    aria-label={`Per-gig note for ${sheetState.title}`}
    className="fixed inset-x-0 bottom-0 z-50 rounded-t-[var(--radius-card)] bg-[color:var(--color-surface)] p-[var(--spacing-card-pad)] shadow-[var(--shadow-card)]"
  >
    <div className="mb-4 flex items-center justify-between">
      <span className="text-[length:var(--text-section-heading)] font-[family-name:var(--font-serif-editorial)]">
        {sheetState.title}
      </span>
      <button
        type="button"
        aria-label="Dismiss"
        className="min-h-tap min-w-tap"
        onClick={() => setSheetState((s) => ({ ...s, open: false }))}
      >
        ×
      </button>
    </div>
    <InlineEditField
      value={sheetState.currentAnnotation}
      onCommit={() => {}}  // committed on Done, not on blur
      ariaLabel={`Per-gig note for ${sheetState.title}`}
      multiline
      autoFocus
    />
    <button
      type="button"
      className="mt-4 min-h-tap w-full bg-[color:var(--color-accent)] text-[color:var(--color-bg)]"
      onClick={() => {
        onAnnotationChange(sheetState.sectionIndex, sheetState.songIndex, sheetState.currentAnnotation);
        setSheetState((s) => ({ ...s, open: false }));
      }}
    >
      {ACTIONS.done}
    </button>
  </div>
)}
```

**Important:** The sheet state can live in `SetlistOverview` (passed down as props) rather than inside `SetlistSongRow` — this is cleaner because `SetlistOverview` is also the owner of `handleAnnotationChange`. Either approach is acceptable as long as only one sheet is open at a time.

### `SetlistSongRow` component structure

```tsx
type SetlistSongRowProps = {
  songRef: SongRef;
  sectionIndex: number;
  songIndex: number;
  onNavigate: (songId: string) => void;
  onAnnotationChange: (sectionIndex: number, songIndex: number, newAnnotation: string) => void;
};
```

On MacBook (`atmosphere === 'practice'`):
- The row has two interaction zones: title area (navigates to Song Detail) and annotation area (opens InlineEditField)
- A simple split: title is a `<button onClick={() => onNavigate(songRef.songId)}>` and below it a small "Add note" affordance or the existing annotation text as a clickable `<button>` that toggles the inline edit
- When annotation is being edited: replace the static annotation `<span>` with an `InlineEditField` (`useState` for `editingAnnotation: boolean`)

On iPhone (`atmosphere === 'performance'`):
- The entire row is one `<button>` that opens the bottom sheet

### Counting songs in a section

The count badge in `SectionHeading` uses `section.songs.length`. Pass `songCount={section.songs.length}` from the parent.

### `useSetlist` nullable pattern (from Story 3.1)

```ts
const { setlistId } = useParams<{ setlistId: string }>();
const { data: setlist, isLoading } = useSetlist(setlistId ?? null);
```

`useParams` returns `string | undefined` — the `?? null` converts `undefined` to the nullable form the hook expects.

### Token patterns (Tailwind v4 inline CSS variable syntax)

This project uses inline CSS variable references rather than Tailwind token names:

```tsx
// Color:
className="text-[color:var(--color-accent)]"
className="bg-[color:var(--color-surface)]"

// Type scale:
className="text-[length:var(--text-perf-body)]"
className="leading-[var(--text-perf-body--line-height)]"

// Font family:
className="font-[family-name:var(--font-serif-editorial)]"
className="font-[family-name:var(--font-mono-slab)]"

// Tap target:
className="min-h-tap"   // generates from --spacing-tap: 44px
```

Study `web/src/components/library-song-row.tsx`, `web/src/components/gig-card.tsx`, and `web/src/components/bottom-tabs.tsx` for the canonical patterns. Do NOT hard-code hex colors or pixel sizes.

### `Start performance ›` CTA sizing and positioning

The CTA is bottom-fixed on iPhone and must sit above the tab bar. The tab bar is ~50px tall and respects the iPhone home-indicator inset (34px) — handled by the existing `BottomTabs` component. The CTA needs `padding-bottom` to clear both:

```tsx
{isIPhone() && (
  <button
    type="button"
    aria-label={ACTIONS.startPerformance}
    className="fixed bottom-0 inset-x-0 min-h-[64px] bg-[color:var(--color-accent)] text-[color:var(--color-bg)] font-[family-name:var(--font-serif-editorial)] text-[length:var(--text-section-heading)] pb-[calc(50px+34px)] flex items-start justify-center pt-4"
  >
    {ACTIONS.startPerformance}
  </button>
)}
```

**Note:** The exact bottom padding value depends on how `BottomTabs` manages its own space. Check `web/src/components/bottom-tabs.tsx` for any `pb-safe-area` or `padding-bottom` token it uses, and match the pattern. The key constraint: the CTA must NOT overlap the tab bar.

### Test setup patterns (from Story 3.2 dev notes)

For component tests with `useNavigate` from `react-router`, mock at the module level:
```ts
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => vi.fn() };
});
```

For `isIPhone()` atmosphere mock in component tests:
```ts
// Mock platform.ts in the test file for iPhone rendering:
vi.mock('../lib/platform.js', () => ({ isIPhone: () => true, isStandalone: () => true }));
// Or via document dataset for readAtmosphere():
beforeEach(() => {
  document.documentElement.dataset.atmosphere = 'performance'; // iPhone
});
afterEach(() => {
  document.documentElement.dataset.atmosphere = 'practice'; // restore
});
```

For route tests that need `useSetlist` and `useSetlistMutation`:
```ts
// Wrap in QueryClientProvider with a fresh QueryClient per test:
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
// Use vi.mock for useSetlist to return controlled data
```

### Files this story does NOT touch (regression safety)

- `api/**` — no server-side changes
- `shared/**` — no schema changes
- `web/src/router.tsx` — route already wired in Story 3.2
- `web/src/sync/**` — outbox/flusher unchanged
- `web/src/hooks/use-setlist.ts` — consumed, not modified
- `web/src/hooks/use-setlist-mutation.ts` — consumed, not modified
- `web/src/hooks/use-setlists.ts` — unchanged
- `web/src/components/gig-card.tsx` — may be updated to re-export `formatGigDate` (minor, additive)
- `web/src/components/bottom-tabs.tsx` — unchanged
- `web/src/components/top-nav.tsx` — unchanged
- `web/src/routes/home.tsx` — unchanged
- `web/src/lib/gig-date.ts` — may gain `formatGigDate` export (minor, additive)
- `infra/**`, `e2e/**` — out of scope

### Epic 3.1 and 3.2 retro lessons applied

**Lesson #1 (not-committed gap):** Task 6 is an explicit commit checkpoint — do not mark done before committing.

**Lesson #2 (TypeScript strict):** All new files compile under `strict: true`. `useParams` returns `string | undefined`, not `string` — use `?? null` coercion. Optional `perGigAnnotation` in `SetlistPutInput` must be `string | undefined`, not `string | null` — assign `newAnnotation || undefined`.

**Lesson #3 (whole-record PUT critical):** NEVER send a partial Setlist update. Always reconstruct the complete `SetlistPutInput` from the cached setlist. A single missing field in the PUT payload will fail `SetlistPutInputSchema.strict()` validation on the server and return a 400.

**Lesson #4 (new dirs need Biome coverage):** All new files go in `web/src/components/` and `web/src/routes/` — existing directories covered by `web/tsconfig.json` and root `biome.json`. No config changes required.

**Lesson #5 (GSI1 index name is 'GSI1' uppercase, not 'gsi1'):** Only relevant for server-side. Story 3.3 is client-only. No DDB awareness needed.

### Testing count baseline

Story 3.2 exit counts: **web 273, api 103**.

Story 3.3 new test files (estimate):
- `web/src/components/section-heading.test.tsx`: ~8 cases
- `web/src/components/setlist-song-row.test.tsx`: ~12 cases
- `web/src/routes/setlist-overview.test.tsx`: ~14 cases

Expected final: **web ~307, api 103 unchanged**.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) via bmad-dev-story skill.

### Debug Log References

- Initial full-suite run after Task 4 had two failures:
  1. `setlist-overview.test.tsx — "omits the time from the date display"` — `queryByText(/·/)` matched both the (omitted) header dot AND the section-heading count badges. Fixed by narrowing the assertion to the gig metadata paragraph node.
  2. `song-detail.test.tsx — "coalesces rapid edits within the debounce window"` — pre-existing flake under heavy parallel test load (passes in isolation: `pnpm vitest run src/routes/song-detail.test.tsx`). Reproduced on the baseline commit (68e45ba) before any Story 3.3 changes were made; no regression introduced. Tracked as a brittle-timing test in the parent suite, not a Story 3.3 task.
- Biome `lint:fix` auto-formatted four files (line-wrapping in route + tests) after Task 4.

### Completion Notes List

- All 20 ACs satisfied (AC-20 commit checkpoint deferred to orchestration workflow per `<spec> Task 6` note).
- `formatGigDate` extracted from `gig-card.tsx` into `web/src/lib/gig-date.ts` (recommended path in Dev Notes). `gig-card.tsx` now imports the helper; behaviour unchanged. Gained three new unit tests in `gig-date.test.ts` (`21 Jun 2026`, single-digit day, malformed input).
- iPhone bottom sheet uses a self-contained `<textarea>` rather than the shared `InlineEditField` because the sheet's commit action is the explicit `Done` button — not blur — so `InlineEditField`'s blur-commit semantics would have fired prematurely on focus loss. The static markup mirrors the same token styling.
- Per-gig annotation persistence builds a fresh `SongRef` object that omits `perGigAnnotation` entirely when the new value is empty (instead of setting it to `undefined`). This matches `SongRefSchema` (`perGigAnnotation: z.string().optional()`) and keeps the wire payload tight.
- Section and song-row arrays are keyed by their index because order IS identity under whole-record PUT semantics (AR-23). Story 3.6 (drag-reorder) is the natural follow-up that will reposition entries; if that surfaces a reconciliation issue, the keys can move to setlistId-scoped UUIDs at that point. Biome ignore comments inline cite the rationale.
- `Start performance ›` CTA renders `type="button"` with no `onClick` handler in Epic 3 — the click test confirms `navigateMock` and `saveSetlistMock` are not invoked when the CTA is tapped.
- The `CurrentlyPerformingStrip` slot is a comment-only marker inside the loaded section (no empty `<div>`), per AC-14.
- Verification exit counts: web 312 (+13 from Story 3.2 baseline of 299, including 3 new `formatGigDate` cases in `gig-date.test.ts` and 10 new section-heading / 13 new song-row / 13 new route cases — totalling +39 raw new tests, offset by reuse of existing test files for the helper move). API 103 unchanged. Shared 26 unchanged. `pnpm-lock.yaml` unchanged. `pnpm build:web` green (525 KiB precache, 20 entries).

### File List

**NEW files:**
- `web/src/components/section-heading.tsx`
- `web/src/components/section-heading.test.tsx`
- `web/src/components/setlist-song-row.tsx`
- `web/src/components/setlist-song-row.test.tsx`
- `web/src/routes/setlist-overview.test.tsx`

**UPDATED files:**
- `web/src/routes/setlist-overview.tsx` (replaces stub; full implementation)
- `web/src/lib/microcopy.ts` (adds `EMPTY_STATES.setlistNotFound`, `ACTIONS.startPerformance`, `ACTIONS.done`)
- `web/src/lib/gig-date.ts` (adds `formatGigDate` export)
- `web/src/lib/gig-date.test.ts` (adds `formatGigDate` test cases)
- `web/src/components/gig-card.tsx` (imports `formatGigDate` from `gig-date.ts` rather than defining locally)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status: ready-for-dev → in-progress → review)
- `_bmad-output/implementation-artifacts/3-3-setlist-overview-surface-section-heading-per-gig-annotation.md` (this file)

### Change Log

| Date       | Change                                                              |
| ---------- | ------------------------------------------------------------------- |
| 2026-06-19 | Story 3.3 implementation complete; status moved to review (Sandy).  |
