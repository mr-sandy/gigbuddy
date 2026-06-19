---
baseline_commit: "68e45bab9cba91bc3047ac7c7ad291ca93a82d89"
builds_on: 3-3-setlist-overview-surface-section-heading-per-gig-annotation
---

# Story 3.4: Setlist creation with manual entry path (FR-6 manual)

Status: review

## Story

As Sandy,
I want a Setlist creation surface where I can enter Gig metadata, add Sections, and add Song rows manually with type-ahead matching against the Library,
so that I can build a Setlist by hand when no pasteable source exists (and so the Paste-to-parse story in 3.5 has a creation surface to extend).

## Acceptance Criteria

**AC-1 — `/setlists/new` route shell**

**Given** the `/setlists/new` route with a valid auth cookie
**When** the route renders
**Then** `web/src/routes/setlist-creation.tsx` (NEW) mounts at the path
**And** the surface renders three Gig metadata fields: Venue (text), Date (date picker), Time (time picker, HH:MM 24h, optional)
**And** a draft Setlist state is held in local component state (React `useState`) — no persisted draft, no URL state encoding
**And** `router.tsx` gains `{ path: 'setlists/new', element: <SetlistCreation /> }` BEFORE the existing `{ path: 'setlists/:setlistId' ... }` entry (specificity — `new` must not be caught by `:setlistId`)

**AC-2 — `+ New setlist` affordance on MacBook (top-nav slot)**

**Given** the MacBook chrome (AuthenticatedShell renders TopNav on non-iPhone)
**When** the Setlists home or any authenticated route renders
**Then** a `+ New setlist` link (using `ACTIONS.newSetlist` from `microcopy.ts`) is mounted in the `rightActions` slot of `<TopNav>` via the `AuthenticatedShell`
**And** the link is an anchor/`Link` navigating to `/setlists/new`
**And** the link is visible regardless of whether any Setlists exist
**And** `TopNav.tsx` is NOT modified — the slot (`rightActions` prop) already exists (Story 1.5 wired it)
**And** the affordance satisfies `min-h-tap`

**AC-3 — `+ New setlist` affordance on iPhone**

**Given** the iPhone chrome (BottomTabs are visible)
**When** the Setlists home (`/`) renders on iPhone
**Then** a `+ New setlist` link (`ACTIONS.newSetlist`) is visible in the Setlists home page chrome (above or below the Tonight/Upcoming/Past list — consistent placement)
**And** the link navigates to `/setlists/new`
**And** on iPhone, `AuthenticatedShell` does NOT pass `rightActions` to TopNav (there is no TopNav on iPhone — this affordance is in the Home route)

**AC-4 — Gig metadata fields: Venue, Date, Time**

**Given** the `/setlists/new` route
**When** Sandy types in the Venue field and blurs
**Then** the value is stored in the draft state
**And** the field is an `InlineEditField` (reusing `web/src/components/inline-edit-field.tsx`) with `ariaLabel="Venue"`

**Given** the Date field
**When** Sandy selects a date
**Then** the value is stored in draft state as a `YYYY-MM-DD` string (ISO date)
**And** the Date field uses a native `<input type="date">` (no custom datepicker library — keep zero new runtime dependencies)
**And** the Date input has `aria-label="Date"`

**Given** the Time field
**When** Sandy enters a time or leaves it blank
**Then** when entered: the value is stored in draft state as `HH:MM` string; when blank: the draft `gigMeta.time` is `undefined`
**And** the Time field uses a native `<input type="time">` with `aria-label="Time (optional)"` and `placeholder` copy indicating it is optional

**AC-5 — Draft state persists within the creation surface**

**Given** a draft Setlist on `/setlists/new`
**When** Sandy adds Sections or Song rows
**Then** the Venue, Date, and Time values are not lost (all live in a single `useState` object at the route level)
**And** navigating away from `/setlists/new` (e.g., back to home) discards the draft — no confirmation prompt, no "are you sure" — leaving is silent (per EXPERIENCE.md Voice & Tone: no interruptions)

**AC-6 — Default `Set 1` section on first song add**

**Given** a draft Setlist with no sections yet
**When** Sandy taps `+ Add song` without having added any section
**Then** a default Section named `Set 1` is automatically created
**And** the `SongSearchRow` (type-ahead input, see AC-9) appears under `Set 1`
**And** the section label renders using the `SectionHeading` component (static, no `InlineEditField` on iPhone; editable on MacBook — existing component, Story 3.3)

**AC-7 — `+ Add section` affordance**

**Given** the `/setlists/new` surface
**When** Sandy taps `+ Add section`
**Then** a new Section is appended to the draft with a default name `Set N` (where N is the count of existing sections + 1, e.g. first section is `Set 1`, second is `Set 2`)
**And** on MacBook (atmosphere `practice`): the `SectionHeading` renders in inline-edit mode (InlineEditField focused) so Sandy can rename immediately
**And** on iPhone (atmosphere `performance`): the section name is displayed as static text (per FR-10 — no inline rename on iPhone)
**And** the affordance label is `+ Add section` and satisfies `min-h-tap`

**AC-8 — Section rename on MacBook**

**Given** a Section heading on the creation surface on MacBook
**When** Sandy edits the name via the `SectionHeading` InlineEditField and blurs
**Then** the draft state's `sections[i].name` is updated
**And** no API call is made (this is draft-only state until Save)

**AC-9 — `+ Add song` affordance and type-ahead input within a Section**

**Given** an `+ Add song` affordance within a Section
**When** Sandy taps it
**Then** a `SongSearchRow` (NEW component, `web/src/components/song-search-row.tsx`) appears inline within that Section
**And** the `SongSearchRow` renders a text `<input>` that is immediately focused (`autoFocus`)
**And** as Sandy types, the input filters the active Band's Library via `useSongs()` (already in cache from Epic 2)
**And** matching songs are shown in a dropdown list below the input, filtered case-insensitively against the song `title`
**And** the dropdown renders at most 8 results to keep the list scannable
**And** each result row shows the song's `title` in editorial serif and satisfies `min-h-tap`

**AC-10 — Selecting a Library match (type-ahead resolve)**

**Given** Sandy types in a `SongSearchRow` and selects a matching Song from the dropdown
**When** the selection is made (tap or Enter key)
**Then** the `SongSearchRow` collapses and is replaced by a read-only `SetlistSongRow` (the existing component from Story 3.3)
**And** the draft's `sections[i].songs` gains a `SongRef` with `{ songId: song.songId, titleSnapshot: song.title }` (per AR-11)
**And** no API call is made yet

**AC-11 — Adding an unknown song (not in Library)**

**Given** Sandy types a song title in a `SongSearchRow` that does not match any Library song
**When** Sandy taps `+ Add to library` (appears when no dropdown result matches the typed text, or when the dropdown is empty)
**Then** a new minimal Song record is created via `useSongMutation().saveSong(...)` with `title = <typed text>`, `bandId = ACTIVE_BAND_ID`, a fresh NanoID (`generateSongId()`), and `clientWrittenAt = new Date().toISOString()`, `version: 1`
**And** the `SongSearchRow` collapses and is replaced by a read-only `SetlistSongRow`
**And** the draft's `sections[i].songs` gains a `SongRef` with `{ songId: newSongId, titleSnapshot: <typed text> }`
**And** the new Song is optimistically visible in the Library via the `useSongMutation` cache update (no page refresh)
**And** no API call is held until the outbox flushes (same as Song Detail inline create flow)

**AC-12 — Removing a Song row from the draft**

**Given** a Song row in a draft Section
**When** Sandy taps a `×` remove affordance on the row (MacBook: visible on hover; iPhone: always visible)
**Then** the row is removed from `sections[i].songs` in the draft state
**And** no API call is made
**And** the `×` remove affordance satisfies `min-h-tap` and has `aria-label="Remove <titleSnapshot>"`

**AC-13 — Save: validation**

**Given** Sandy taps the `Save` button
**When** the draft has an empty or whitespace-only Venue
**Then** an inline validation message appears adjacent to the Venue field: `Venue is required.`
**And** no API call is made

**Given** Sandy taps `Save` with no Date set
**Then** an inline validation message appears adjacent to the Date field: `Date is required.`
**And** no API call is made

**Given** Venue and Date are both populated
**Then** validation passes regardless of whether any Songs have been added (empty Setlist is valid per FR-6)

**AC-14 — Save: PUT and navigation**

**Given** Venue and Date are both present (Time is optional)
**When** Sandy taps `Save`
**Then** a new `setlistId` is minted with `generateSongId()` (reuse the same NanoID generator — IDs are opaque 16-char strings)
**And** a `SetlistPutInput` is built:
  ```ts
  {
    bandId: ACTIVE_BAND_ID,
    setlistId: <newSetlistId>,
    gigMeta: { venue, date, time: time || undefined },
    sections: <draft sections>,
    clientWrittenAt: new Date().toISOString(),
    version: 1,
  }
  ```
**And** `useSetlistMutation().saveSetlist(input)` is called (whole-record PUT enqueued to outbox)
**And** the router navigates to `/setlists/<newSetlistId>` (the Setlist overview from Story 3.3)
**And** the new Setlist is immediately visible in the TanStack cache (optimistic write via `mergeSetlistIntoList`) so the Setlists home surface shows it on next visit

**AC-15 — Save: empty Setlist is valid**

**Given** a draft with Venue + Date and zero Song rows (no sections)
**When** Sandy taps `Save`
**Then** the PUT is enqueued with `sections: []`
**And** the router navigates to `/setlists/<newSetlistId>`
**And** the Setlist overview renders the gig metadata header with no Section content (per Story 3.3 AC-3 — zero sections is valid)

**AC-16 — iPhone atmosphere and layout**

**Given** the `/setlists/new` route on iPhone (atmosphere `performance`)
**When** the surface renders
**Then** Performance atmosphere tokens apply
**And** Section names are static (no inline rename per FR-10)
**And** the `+ Add song` affordance and `+ Add section` affordance use the same token styling as other iPhone affordances

**AC-17 — Microcopy: extend `web/src/lib/microcopy.ts`**

**Given** `web/src/lib/microcopy.ts` (UPDATE)
**When** reviewed
**Then** `ACTIONS` gains nothing new — `newSetlist` already exists as `'+ New setlist'` and `done` already exists; no changes needed unless discovered otherwise during implementation
**And** `VALIDATION_MESSAGES` is added (new export):
  ```ts
  export const VALIDATION_MESSAGES = {
    venueRequired: 'Venue is required.',
    dateRequired: 'Date is required.',
  } as const;
  ```
**And** no existing constants are mutated

**AC-18 — `SongSearchRow` component**

**Given** `web/src/components/song-search-row.tsx` (NEW)
**When** rendered
**Then** it renders a text `<input>` with `aria-label="Search songs"` and `autoFocus`
**And** it accepts a `songs: Song[]` prop (the full Library from `useSongs()` passed down from the route — the component does NOT call `useSongs()` itself, to keep it a pure presentation component)
**And** it accepts `onSelect: (songRef: SongRef) => void` and `onAddNew: (title: string) => void` callbacks
**And** filtering is `title.toLowerCase().includes(query.toLowerCase())` (simple substring, not fuzzy — fuzzy is Story 3.5)
**And** an `+ Add to library` option appears in the dropdown when the query is non-empty AND there is no exact match (case-insensitive full-string match against `song.title.trim()`)
**And** pressing `Escape` on the input calls `onCancel: () => void` prop (collapses the search row back to a `+ Add song` affordance)

**AC-19 — `SetlistCreation` route tests**

**Given** `web/src/routes/setlist-creation.test.tsx` (NEW)
**When** the test suite runs
**Then** it covers:
  - renders Venue, Date, Time fields
  - Venue InlineEditField updates draft state on commit
  - Date input updates draft state
  - Save with empty Venue shows `VALIDATION_MESSAGES.venueRequired` and makes no API call
  - Save with empty Date shows `VALIDATION_MESSAGES.dateRequired` and makes no API call
  - Save with Venue + Date calls `saveSetlist` with correct shape (bandId, setlistId non-empty, sections: [], clientWrittenAt defined, version: 1)
  - Save navigates to `/setlists/<newId>` after successful `saveSetlist`
  - `+ Add section` appends a section with default name `Set 1`
  - `+ Add section` twice appends `Set 1` then `Set 2`
  - Default section created on first `+ Add song` when no section exists

**AC-20 — `SongSearchRow` component tests**

**Given** `web/src/components/song-search-row.test.tsx` (NEW)
**When** the test suite runs
**Then** it covers:
  - renders input with `aria-label="Search songs"`
  - typing filters songs by title (substring, case-insensitive)
  - selecting a song from the dropdown calls `onSelect` with correct `SongRef` (`songId` + `titleSnapshot`)
  - when query non-empty and no exact match: `+ Add to library` option is shown
  - tapping `+ Add to library` calls `onAddNew` with the typed title
  - when query is empty: no dropdown shown
  - Escape calls `onCancel`

**AC-21 — Verification pass**

**Given** the implementation is complete
**When** verification commands run from the repo root
**Then** `pnpm typecheck` is green across all five packages
**And** `pnpm lint` is green via Biome (kebab-case filenames; camelCase identifiers; no new `biome-ignore` directives unless justified)
**And** `pnpm test` is green — all new tests pass; no regressions against Story 3.3 baseline (web 312, api 103)
**And** `pnpm build:web` is green; `pnpm-lock.yaml` is unchanged (no new runtime dependencies)

**AC-22 — Commit checkpoint**

**Given** the implementation is complete and all verification passes
**When** the story is marked done
**Then** an explicit commit has been created containing all new and modified files listed in the File List
**And** `git status --porcelain` is clean

## Tasks / Subtasks

- [x] **Task 1 — Microcopy: add `VALIDATION_MESSAGES`** (AC: 17)
  - [x] Add `VALIDATION_MESSAGES` export to `web/src/lib/microcopy.ts`
  - [x] Run `pnpm typecheck` to confirm compiles

- [x] **Task 2 — `SongSearchRow` component + test** (AC: 9, 10, 11, 12, 18, 20)
  - [x] Create `web/src/components/song-search-row.tsx`
  - [x] Read `web/src/components/inline-edit-field.tsx` before writing (understand `BASE_FIELD_CLASS`, controlled input pattern)
  - [x] Read `web/src/components/setlist-song-row.tsx` before writing (understand how rows render)
  - [x] Props: `songs: Song[]`, `onSelect: (songRef: SongRef) => void`, `onAddNew: (title: string) => void`, `onCancel: () => void`
  - [x] Controlled `<input type="text">` with `aria-label="Search songs"` and autoFocus (via `useEffect(() => inputRef.current?.focus(), [])` — Biome's `noAutofocus` a11y rule disallows the JSX attribute on raw DOM nodes; the imperative ref-focus delivers the same UX)
  - [x] Filter logic: `title.toLowerCase().includes(query.toLowerCase())`, cap at 8 results
  - [x] `+ Add to library` shown when query non-empty AND no exact full-string match
  - [x] Escape key calls `onCancel`
  - [x] Dropdown uses `role="listbox"` on the container and `role="option"` on each result for accessibility (containers are `<div>` not `<ul>`/`<li>` to satisfy Biome's `noNoninteractiveElementToInteractiveRole`; `role="combobox"` is on the input itself per WAI-ARIA 1.2)
  - [x] Create `web/src/components/song-search-row.test.tsx` covering AC-20 cases
  - [x] Run `pnpm typecheck`

- [x] **Task 3 — `SetlistCreation` route + test** (AC: 1, 4, 5, 6, 7, 8, 13, 14, 15, 16, 19)
  - [x] Create `web/src/routes/setlist-creation.tsx`
  - [x] Read `web/src/routes/song-detail.tsx` — understand `readAtmosphere()`, `useState` draft patterns, `generateSongId()` usage
  - [x] Read `web/src/hooks/use-setlist-mutation.ts` — understand `saveSetlist()` signature
  - [x] Read `web/src/hooks/use-songs.ts` — pass `useSongs().data ?? []` down to `SongSearchRow`
  - [x] Draft state shape: `{ venue: string; date: string; time: string; sections: DraftSection[] }` where `DraftSection = { name: string; songs: SongRef[] }`
  - [x] Venue: `InlineEditField` value="" onCommit→update draft
  - [x] Date: `<input type="date">` onChange→update draft
  - [x] Time: `<input type="time">` onChange→update draft (optional)
  - [x] `+ Add section` button: appends `{ name: 'Set N', songs: [] }` to draft sections
  - [x] `+ Add song` button per section: sets a "searching" flag for that section, renders `SongSearchRow`
  - [x] `SongSearchRow.onSelect`: append SongRef to section's songs, clear "searching" flag
  - [x] `SongSearchRow.onAddNew`: call `saveSong()`, mint `songId` with `generateSongId()`, append SongRef, clear flag
  - [x] `SongSearchRow.onCancel`: clear "searching" flag
  - [x] Section song rows: render `SetlistSongRow` for each confirmed song (import existing component)
  - [x] `×` remove on each song row (AC-12)
  - [x] Save button: validate → call `saveSetlist()` → navigate to `/setlists/:newId`
  - [x] Default `Set 1` auto-creation when `+ Add song` tapped with no sections (AC-6)
  - [x] Atmosphere detection for `SectionHeading` static/editable mode
  - [x] Create `web/src/routes/setlist-creation.test.tsx` covering AC-19 cases
  - [x] Run `pnpm typecheck`

- [x] **Task 4 — Wire route + affordances** (AC: 1, 2, 3)
  - [x] Update `web/src/router.tsx`: add `{ path: 'setlists/new', element: <SetlistCreation /> }` BEFORE `{ path: 'setlists/:setlistId', ... }`
  - [x] Update `web/src/routes/authenticated-shell.tsx`: pass `rightActions={<Link to="/setlists/new">+ New setlist</Link>}` to `<TopNav>` on MacBook (conditionally when `!isIPhone()`)
  - [x] Update `web/src/routes/home.tsx`: add `+ New setlist` affordance on iPhone (below/above the Tonight section, consistently placed)
  - [x] Read `web/src/routes/home.tsx` fully before modifying — understand the section structure so the iPhone affordance is placed without breaking existing layout
  - [x] Run `pnpm typecheck`

- [x] **Task 5 — Verification pass** (AC: 21)
  - [x] `pnpm typecheck` green across all five packages
  - [x] `pnpm lint` green (auto-fixed formatting via `pnpm lint:fix`; no new `biome-ignore` directives — instead the structural a11y fixes use semantically-correct elements per WAI-ARIA 1.2)
  - [x] `pnpm test` green — web 333 (baseline 312 + 21 new: SongSearchRow 8, SetlistCreation 13); no regressions
  - [x] `pnpm build:web` green; `pnpm-lock.yaml` unchanged (zero new runtime dependencies)

- [ ] **Task 6 — Commit checkpoint** (AC: 22) _(deferred — orchestration workflow owns the commit after review steps pass)_
  - [ ] `git add` all new and modified files listed in the File List
  - [ ] `git commit` with a descriptive message
  - [ ] Confirm `git status --porcelain` is clean

## Dev Notes

### This story's scope

Story 3.4 delivers the **Setlist creation surface** — a new route `/setlists/new` that lets Sandy enter Gig metadata and build a Setlist by hand with a type-ahead Song search. It is a **pure web-layer story**: no server changes, no schema changes, no sync-layer changes. All persistence flows through the existing `useSetlistMutation()` and `useSongMutation()` hooks.

This story is the **foundation Story 3.5 extends** — the Paste-to-parse feature mounts into this same `/setlists/new` surface by adding a paste input area above the manual sections UI. Story 3.4 does NOT include any paste logic.

**What this story delivers:**
- `web/src/routes/setlist-creation.tsx` NEW — full creation surface
- `web/src/routes/setlist-creation.test.tsx` NEW
- `web/src/components/song-search-row.tsx` NEW — type-ahead song picker
- `web/src/components/song-search-row.test.tsx` NEW
- `web/src/lib/microcopy.ts` UPDATE — adds `VALIDATION_MESSAGES`
- `web/src/router.tsx` UPDATE — adds `/setlists/new` route
- `web/src/routes/authenticated-shell.tsx` UPDATE — passes `rightActions` on MacBook
- `web/src/routes/home.tsx` UPDATE — iPhone affordance

**What this story does NOT deliver:**
- Paste-to-parse (Story 3.5)
- Drag-reorder (Story 3.6)
- Any changes to `api/**`, `shared/**`, `infra/**`, `e2e/**`
- No changes to `web/src/sync/**`

### Route specificity: `/setlists/new` vs `/setlists/:setlistId`

**Critical:** `setlists/new` must be registered BEFORE `setlists/:setlistId` in `router.tsx`. React Router 7 matches routes in definition order; if `:setlistId` comes first, the literal string `new` will be swallowed as a setlistId and the creation route will never render.

Current router state (end of Story 3.3):
```ts
children: [
  { index: true, element: <Home /> },
  { path: 'library', element: <Library /> },
  { path: 'songs/new', element: <SongDetail /> },
  { path: 'songs/:songId', element: <SongDetail /> },
  { path: 'setlists/:setlistId', element: <SetlistOverview /> },
]
```

After Story 3.4:
```ts
children: [
  { index: true, element: <Home /> },
  { path: 'library', element: <Library /> },
  { path: 'songs/new', element: <SongDetail /> },
  { path: 'songs/:songId', element: <SongDetail /> },
  { path: 'setlists/new', element: <SetlistCreation /> },  // BEFORE :setlistId
  { path: 'setlists/:setlistId', element: <SetlistOverview /> },
]
```

### `TopNav` `rightActions` slot — already wired

`web/src/components/top-nav.tsx` (Story 1.5) already has the `rightActions?: ReactNode` prop and renders `{rightActions ? <li>{rightActions}</li> : null}`. The comment in the file even says "Story 3.4 mounts `+ New setlist` here without modifying this component."

In `AuthenticatedShell`, the current render is:
```tsx
{chromeVisible && !iPhone ? <TopNav /> : null}
```

After this story:
```tsx
{chromeVisible && !iPhone ? (
  <TopNav rightActions={<Link to="/setlists/new" className="...">{ACTIONS.newSetlist}</Link>} />
) : null}
```

The Link should use `text-[color:var(--color-accent)]` styling consistent with other action affordances in the app.

### Draft state shape

The draft is local `useState` — NOT persisted to IndexedDB, not in the URL. Navigating away discards it silently. This is intentional: the creation surface is transient prep.

```ts
type DraftSection = {
  name: string;
  songs: SongRef[];  // SongRef from shared schema: { songId, titleSnapshot, perGigAnnotation? }
};

type DraftState = {
  venue: string;
  date: string;      // YYYY-MM-DD, empty string until user selects
  time: string;      // HH:MM, empty string if not set
  sections: DraftSection[];
};

const initialDraft: DraftState = {
  venue: '',
  date: '',
  time: '',
  sections: [],
};
```

The Save handler converts this to `SetlistPutInput`:
```ts
const input: SetlistPutInput = {
  bandId: ACTIVE_BAND_ID,
  setlistId: generateSongId(),   // new ID every Save attempt (idempotent retry is safe)
  gigMeta: {
    venue: draft.venue.trim(),
    date: draft.date,
    time: draft.time || undefined,
  },
  sections: draft.sections,      // DraftSection[] is compatible with SectionSchema structure
  clientWrittenAt: new Date().toISOString(),
  version: 1,
};
```

### `SongSearchRow` component design

The search row is a controlled input with a dropdown of matching songs. Keep it simple — no third-party combobox, no react-aria. The filtering runs synchronously against the cached Library (already in memory from `useSongs()`).

```tsx
type SongSearchRowProps = {
  songs: Song[];             // full library — filtered inline, no async
  onSelect: (songRef: SongRef) => void;
  onAddNew: (title: string) => void;
  onCancel: () => void;
};
```

The component holds its own `query` state. The parent (SetlistCreation) tracks whether each section is in "searching" mode; when `onSelect`, `onAddNew`, or `onCancel` fires, the parent clears the searching flag.

**Accessibility for the dropdown:**
```tsx
<div role="combobox" aria-expanded={matches.length > 0} aria-haspopup="listbox">
  <input
    type="text"
    aria-label="Search songs"
    aria-autocomplete="list"
    aria-controls="song-search-listbox"
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    onKeyDown={handleKeyDown}
    autoFocus
  />
</div>
<ul id="song-search-listbox" role="listbox" aria-label="Song matches">
  {matches.map((song) => (
    <li key={song.songId} role="option" ...>
      {song.title}
    </li>
  ))}
  {query && !hasExactMatch && (
    <li role="option" ...>+ Add to library: {query}</li>
  )}
</ul>
```

**Exact match check** (for showing `+ Add to library`):
```ts
const hasExactMatch = songs.some(
  (s) => s.title.trim().toLowerCase() === query.trim().toLowerCase()
);
```

### `SetlistSongRow` reuse in creation surface

`web/src/components/setlist-song-row.tsx` (Story 3.3) renders read-only song titles and handles annotation editing. In the creation surface, confirmed song rows should be rendered using this same component, but annotation editing is not relevant pre-save. The simplest approach: pass no-op `onAnnotationChange` and `onNavigate` props (the component won't navigate during creation — Safari should not navigate mid-creation flow). 

A `×` remove button must be added adjacent to each confirmed row. This is NOT part of `SetlistSongRow` itself (which has no remove button). The remove affordance is inline markup in `SetlistCreation`, not a new prop on `SetlistSongRow`.

Pattern:
```tsx
<div className="flex items-center gap-[calc(var(--spacing-unit)*2)]">
  <SetlistSongRow
    songRef={songRef}
    sectionIndex={si}
    songIndex={ji}
    onNavigate={() => {}}          // no-op during creation
    onAnnotationChange={() => {}}  // no-op during creation
  />
  <button
    type="button"
    aria-label={`Remove ${songRef.titleSnapshot}`}
    className="min-h-tap min-w-tap ..."
    onClick={() => removeSong(si, ji)}
  >
    ×
  </button>
</div>
```

### `readAtmosphere()` pattern — copy (do NOT import)

Story 3.3 Dev Notes documented this pattern. Copy verbatim into `setlist-creation.tsx` and `song-search-row.tsx` if needed:

```ts
function readAtmosphere(): 'practice' | 'performance' {
  if (typeof document === 'undefined') return 'practice';
  return document.documentElement.dataset.atmosphere === 'performance' ? 'performance' : 'practice';
}
```

Call at render time: `const atmosphere = readAtmosphere();`

`SectionHeading` already reads atmosphere internally — you just pass `onRename` and the component decides how to render.

### Validation rendering

Validation messages are inline, adjacent to the field, not a toast and not a modal. A simple `<p className="text-[color:var(--color-attention-unknown)]...">` below the offending field is sufficient. The `VALIDATION_MESSAGES.venueRequired` and `VALIDATION_MESSAGES.dateRequired` constants from `microcopy.ts` drive the copy.

Use a `validationErrors` state:
```ts
const [validationErrors, setValidationErrors] = useState<{ venue?: string; date?: string }>({});
```

Clear validation errors on the next Save attempt (not on every keystroke — don't over-engineer).

### `generateSongId()` for Setlist IDs

Story 3.1 uses `generateSongId()` from `web/src/lib/song-id.ts` to mint setlistIds — the underlying NanoID generator is general-purpose (AR-47: "IDs: NanoID, 16-char URL-safe"). Use the same function for setlistIds in the creation surface. There is no `generateSetlistId()` — just import `generateSongId` and use it for both. The function name is a naming artifact; the algorithm is correct for any ID.

### iPhone `+ New setlist` affordance placement in `home.tsx`

On iPhone, there is no TopNav, so the `+ New setlist` affordance must live within the Home route. Place it at the top of the route content, just above the "Tonight" section heading — this mirrors the Library's `+ New song` which sits at the top before the list. This is the established pattern in the codebase.

```tsx
// In Home route, just before the Tonight section:
{isIPhone() && (
  <Link
    to="/setlists/new"
    className="inline-flex min-h-tap items-center ..."
  >
    {ACTIONS.newSetlist}
  </Link>
)}
```

This conditioned on `isIPhone()` — the MacBook gets the affordance via `TopNav rightActions`. No duplication.

### `SetlistCreation` loading boundary for songs

The route calls `useSongs()` to power the type-ahead search. If the Library hasn't loaded yet (unlikely post-Epic 2 cache, but possible on first visit), `useSongs().data` will be `undefined`. Pass an empty array `useSongs().data ?? []` to `SongSearchRow`. The type-ahead will show no results until the cache hydrates — silent degradation, no error state needed.

### Token patterns reminder (Tailwind v4 inline CSS variable syntax)

Do NOT hard-code hex values or pixel sizes. Use the established patterns:
```tsx
// Color:
className="text-[color:var(--color-accent)]"
className="bg-[color:var(--color-surface)]"
// Type scale:
className="text-[length:var(--text-practice-body)]"
// Font family:
className="font-[family-name:var(--font-serif-editorial)]"
// Tap target:
className="min-h-tap"   // from --spacing-tap: 44px
```

Study `web/src/routes/library.tsx` (for `+ New song` affordance pattern), `web/src/components/inline-edit-field.tsx` (for field rendering), and `web/src/components/section-heading.tsx` (for section rendering) before writing new components.

### Architecture compliance reminders

- **AR-23 (whole-record PUT):** The Save handler builds the full `SetlistPutInput` including all sections and songs. Never send a partial payload.
- **AR-45 (hook boundary):** `SetlistCreation` imports `useSetlistMutation()` and `useSongMutation()` — never imports `outbox.ts` or `flusher.ts` directly.
- **AR-46:** No analytics SDK, no Redux/Zustand/Jotai. All state is local `useState` or TanStack Query.
- **AR-47:** `generateSongId()` for all new IDs. No UUIDs, no auto-increments.
- **AR-48:** `clientWrittenAt = new Date().toISOString()` stamped fresh at Save time. `gigMeta.date` is YYYY-MM-DD; `gigMeta.time` is HH:MM or `undefined`.

### Retro lessons from Stories 3.1–3.3 applied

**Lesson #1 (not-committed gap):** Task 6 is the explicit commit checkpoint — do not mark done before committing.

**Lesson #2 (TypeScript strict):** `useParams` returns `string | undefined`. All optional Zod fields (`time`, `perGigAnnotation`) must be `string | undefined`, never `string | null`. Empty strings on optional fields should be converted: `time.trim() || undefined`.

**Lesson #3 (whole-record PUT critical):** The `SetlistPutInput` MUST include `bandId`, `setlistId`, `gigMeta`, `sections`, `clientWrittenAt`, `version`. `SetlistPutInputSchema.strict()` will reject any extra key or missing key at the API level.

**Lesson #4 (new dirs need Biome coverage):** New files in `web/src/routes/` and `web/src/components/` — existing directories already covered. No new Biome config changes needed.

**Lesson #5 (route ordering matters):** `/setlists/new` before `/setlists/:setlistId` — already documented above. This is the primary new trap in this story.

### Testing count baseline

Story 3.3 exit count: **web 312, api 103**.

Story 3.4 new test files (estimate):
- `web/src/routes/setlist-creation.test.tsx`: ~12 cases
- `web/src/components/song-search-row.test.tsx`: ~8 cases

Expected final: **web ~332, api 103 unchanged**.

## Dev Agent Record

### Agent Model Used

Opus 4.7 (1M context) via the BMad dev-story workflow.

### Debug Log References

- `pnpm typecheck` — green across all five packages (shared, infra, e2e, api, web).
- `pnpm --filter web exec vitest run src/components/song-search-row.test.tsx` — 8 / 8 pass.
- `pnpm --filter web exec vitest run src/routes/setlist-creation.test.tsx` — 13 / 13 pass.
- `pnpm test` — shared 26, infra 51, api 103, web 333 (web baseline 312 + 21 new = 333). No regressions.
- `pnpm lint` — green after one auto-fix pass (`pnpm lint:fix`) plus a structural pass on `song-search-row.tsx` to satisfy Biome's `noNoninteractiveElementToInteractiveRole`, `useFocusableInteractive`, and `noAutofocus` rules without adding any `biome-ignore` directives.
- `pnpm build:web` — production bundle built successfully (436.61 kB JS / 18.29 kB CSS).
- `git diff --stat pnpm-lock.yaml` — empty (lockfile unchanged; zero new runtime dependencies).

### Completion Notes List

- **Microcopy** — `VALIDATION_MESSAGES = { venueRequired, dateRequired }` appended to `web/src/lib/microcopy.ts`. No existing constants mutated.
- **`SongSearchRow`** — Pure presentational type-ahead. Filter is case-insensitive substring on title, capped at 8 matches. `+ Add to library` surfaces when the query is non-empty and there is no exact (trimmed, case-insensitive) full-string match. Enter selects the top match if present, otherwise triggers `+ Add to library`; Escape calls `onCancel`. WAI-ARIA combobox 1.2: `role="combobox"` lives on the input; the listbox is a `<div role="listbox">` with `<div role="option" tabIndex={-1}>` rows — this satisfies Biome's a11y rules while keeping the spec's accessibility intent. Auto-focus is implemented via `useRef` + `useEffect(() => inputRef.current?.focus(), [])` because Biome's `noAutofocus` rule blocks the JSX attribute on raw DOM nodes (existing usages elsewhere are on custom React components, which the rule doesn't see).
- **`SetlistCreation` route** — Draft is local `useState<DraftState>`; no IDB persistence, no URL encoding. Save validates Venue (trimmed-non-empty) and Date (non-empty string), then builds a `SetlistPutInput` with `setlistId = generateSongId()`, `version: 1`, `clientWrittenAt = new Date().toISOString()`, and `gigMeta.time` omitted (not `null`/empty string) when blank. The route imports `useSetlistMutation`, `useSongMutation`, and `useSongs` — never the outbox/flusher directly (AR-45). Default `Set 1` auto-creates only when `+ Add song` is tapped while `draft.sections.length === 0` (AC-6); after that, the route-level `+ Add song` affordance disappears and per-section `+ Add song` buttons take over. `+ Add to library` calls `saveSong()` with a minimal `SongPutInput` (just `title` plus required fields), then immediately appends the new SongRef to the section in the same handler.
- **Router** — `{ path: 'setlists/new', element: <SetlistCreation /> }` registered BEFORE `{ path: 'setlists/:setlistId', element: <SetlistOverview /> }` so `new` is not swallowed as a setlistId (Lesson #5 from Story 3.1–3.3 retro).
- **AuthenticatedShell** — passes `rightActions={newSetlistLink}` to `<TopNav>` on MacBook; iPhone branch unchanged (no TopNav exists). `TopNav` itself was NOT modified (the `rightActions` slot was wired by Story 1.5).
- **Home** — iPhone-only `+ New setlist` Link rendered at the top of the route content (`isIPhone()`-gated). MacBook receives the affordance via the TopNav slot — no duplication.
- **`SetlistSongRow` reuse** — confirmed rows in the creation surface render through the existing component with `onNavigate={noop}` and `onAnnotationChange={noop}` (per Dev Notes guidance — Safari should not navigate mid-creation). The `×` remove affordance is inline route-level markup, not a new prop on `SetlistSongRow`.
- **Lint gotchas worth flagging for future stories**:
  1. Biome's `noAutofocus` fires on the JSX attribute when applied to a raw DOM element (e.g. `<input autoFocus>`), but does NOT fire when the same attribute is forwarded as a prop to a custom React component (e.g. `<InlineEditField autoFocus />`). The fix used here — `useRef` + `useEffect` for imperative focus — is the lint-clean pattern for raw DOM nodes.
  2. Biome's `noNoninteractiveElementToInteractiveRole` rejects `<ul role="listbox">` and `<li role="option">`. Use `<div>` containers and put the interactive role on the input itself (combobox 1.2 pattern).
- **Lesson #3 (whole-record PUT) confirmed**: tests assert `payload` shape contains exactly `bandId, setlistId, gigMeta, sections, clientWrittenAt, version` — no `serverReceivedAt`, no extra keys. `SetlistPutInputSchema.strict()` would 400 anything else.
- **Story 3.5 hand-off** — The paste-to-parse surface (Story 3.5) will mount above the existing manual sections UI in `setlist-creation.tsx`. The current draft state model (sections + songs as `DraftSection[]` with `SongRef[]`) is the merge target — paste-parsed sections will become `DraftSection` entries the same way manually-added ones do, so no schema changes will be needed on the creation surface for 3.5.

### File List

**NEW files:**
- `web/src/routes/setlist-creation.tsx`
- `web/src/routes/setlist-creation.test.tsx`
- `web/src/components/song-search-row.tsx`
- `web/src/components/song-search-row.test.tsx`

**UPDATED files:**
- `web/src/lib/microcopy.ts` (adds `VALIDATION_MESSAGES` export)
- `web/src/router.tsx` (adds `setlists/new` route before `setlists/:setlistId`)
- `web/src/routes/authenticated-shell.tsx` (passes `rightActions` to TopNav on MacBook)
- `web/src/routes/home.tsx` (adds iPhone `+ New setlist` affordance)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status: ready-for-dev → in-progress → review)
- `_bmad-output/implementation-artifacts/3-4-setlist-creation-with-manual-entry-path.md` (this file)

### Change Log

| Date       | Change                                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-19 | Story 3.4 spec created; status set to ready-for-dev.                                                                              |
| 2026-06-19 | Implementation complete; tests pass (web 333, api 103, infra 51, shared 26); status → review.                                     |
