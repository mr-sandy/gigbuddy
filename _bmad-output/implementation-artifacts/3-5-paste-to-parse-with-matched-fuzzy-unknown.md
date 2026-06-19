---
baseline_commit: "94dfdff"
builds_on: 3-4-setlist-creation-with-manual-entry-path
design_ref: _bmad-output/planning-artifacts/paste-to-parse-design.md
---

# Story 3.5: Paste-to-parse with Matched / Fuzzy / Unknown (FR-7, FR-8, FR-9, NFR-3)

Status: review

## Story

As Sandy,
I want a Paste-to-parse text area on the Setlist creation surface that parses pasted plain text into Sections + Song rows, matches each row against the Library, and surfaces Matched / Fuzzy / Unknown rows with inline resolution,
so that I can land a 19-song Setlist in minutes from a WhatsApp message, Apple Notes, or any other plain-text source without manual typing.

## Acceptance Criteria

**AC-1 — Paste area mounted above manual sections in `setlist-creation.tsx`**

**Given** the `/setlists/new` route (from Story 3.4)
**When** the route renders
**Then** a `<textarea>` labeled `Paste setlist` (with `aria-label="Paste setlist"`) appears above the manual sections UI
**And** the text area accepts multi-line plain-text paste
**And** below the text area a parsed-result region (`<div aria-live="polite">`) renders the parser output
**And** the manual Sections UI below is the merge target — resolved rows from the paste flow land in `draft.sections` (the same state Story 3.4 left behind)
**And** `setlist-creation.tsx` is UPDATED (not replaced); the paste UI is mounted above the existing `{draft.sections.map(...)}` block

**AC-2 — Parser: section detection and song rows (`web/src/paste-parse/parser.ts`)**

**Given** `web/src/paste-parse/parser.ts` (NEW)
**When** `parseSetlist(text: string): ParseResult` is called
**Then** it scans line-by-line and emits a `ParseResult = { sections: ParsedSection[] }` where `ParsedSection = { name: string; rows: ParsedRow[] }` and `ParsedRow = { raw: string; normalized: string }`
**And** section detection follows this priority:

| Pattern | Treatment |
|---|---|
| `^\s*set\s+\d+\b` (case-insensitive) | Header — name = matched text Title-cased e.g. `Set 1` |
| `^\s*encore\b` (case-insensitive) | Header — name = `Encore` |
| `^\s*\{([^}]+)\}\s*$` (`{Set 1}`, `{Encore}`) | Header — name = inside braces |
| `^#{1,6}\s+(.+)` | Header — name = right-hand side |
| `^\s*-{3,}\s*$` (3+ dashes) | Separator — closes current section; next non-blank non-header becomes first row of next implicit `Set N+1` |
| Blank line | Skipped (does NOT close a section) |
| Any other non-blank line | Song row in the current section |

**And** when no header pattern is detected, all rows land in a single default Section named `Set 1` (per FR-7 / EXPERIENCE.md Flow 3)
**And** the parser does NOT specially detect "document title" lines — they become Unknown rows Sandy discards via AC-8

**AC-3 — Normalizer: `web/src/paste-parse/normalize.ts` (NEW)**

**Given** `web/src/paste-parse/normalize.ts`
**When** `normalizeTitle(raw: string): string` is called
**Then** the pipeline runs in this order:
1. Trim whitespace
2. Strip leading enumerator: `/^\d+[.)]\s+/` or `/^[-•]\s+/`
3. Strip from the first ` – ` (em-dash surrounded by spaces) onward
4. Strip from ` - ` (hyphen surrounded by spaces) onward (e.g., `Cantaloupe Island - Fm Blues`)
5. Strip trailing `[...]` brackets: `/\s*\[[^\]]*\]\s*$/`
6. Strip trailing `(...)` parens: `/\s*\([^)]*\)\s*$/`
7. NFKD-normalize then strip combining marks (diacritics): `str.normalize('NFKD').replace(/\p{M}/gu, '')`
8. Strip ASCII and curly apostrophes: `/['']/g`
9. Lowercase
10. Collapse whitespace: `/\s+/g` → single space, then trim

**And** worked examples that the tests MUST cover:
- `"COMIN' HOME BABY"` → `"comin home baby"`
- `"Move on Up – The Rhythm is like Steely Dan 'Do it Again'"` → `"move on up"`
- `"INTO THE MYSTIC [first dance]"` → `"into the mystic"`
- `"WATERMELON MAN – Ivan Ian John"` → `"watermelon man"`
- `"KELVINGROVESTREET – solos – Ivan Ian Clare SANDY John [GUITAR CHANGE]"` → `"kelvingrovestreet"`
- `"MAS QUE NADA "` → `"mas que nada"`
- `"Más Que Nada"` (diacritics) → `"mas que nada"`
- `"1. Some Song"` → `"some song"`

**AC-4 — Matcher: `web/src/paste-parse/matcher.ts` (NEW)**

**Given** `web/src/paste-parse/matcher.ts`
**When** `matchRows(rows: ParsedRow[], library: Song[]): MatchResult[]` is called
**Then** each row goes through this pipeline:

**Step 1 — Normalize the row's title** via `normalizeTitle` (AC-3)
**Step 2 — Build normalized Library index:** `Map<normalizedTitle, Song>` (computed once, cached per library snapshot)
**Step 3 — Exact match:** if normalized row title is in the index → `{ status: 'matched', song: <Song> }`
**Step 4 — Jaro-Winkler similarity** against every Library song's normalized title; take top-1
**Step 5 — Threshold:** score ≥ 0.92 → `{ status: 'fuzzy', song: <Song>, score }` · else → `{ status: 'unknown' }`

**And** the Jaro-Winkler implementation is inline (~30 lines) OR uses the `natural` package's `JaroWinklerDistance`; NO `string-similarity` or `fast-levenshtein` (those are not JW implementations)
**And** zero new runtime `npm` dependencies if implementing JW inline (preferred); if using `natural`, update `pnpm-lock.yaml`
**And** `titleSnapshot` on commit: when a row resolves Matched, the `SongRef.titleSnapshot` is the **Library's canonical title** (NOT the pasted string)

**And** worked Jaro-Winkler scores that the tests MUST cover:

| Paste (normalized) | Library (normalized) | Expected |
|---|---|---|
| `"comin home baby"` | `"coming home baby"` | Fuzzy (score ≈ 0.98) |
| `"cantaloupe island"` | `"canteloupe island"` | Fuzzy (score ≈ 0.96) |
| `"kelvingrovestreet"` | `"kelvingrove street"` | Fuzzy (score ≈ 0.96) |
| `"mas que nada"` | `"mas que nada"` | Matched (exact) |
| `"move on up"` | `"move it on over"` | Unknown (score ≈ 0.82 < 0.92) |

**AC-5 — `ParseRowStatus` component (NEW `web/src/components/parse-row-status.tsx`)**

**Given** `web/src/components/parse-row-status.tsx` (NEW — listed in UX-DR4)
**When** rendered for a **Matched** row
**Then** it shows `✓` glyph + canonical Library title
**And** when the canonical title differs from what Sandy pasted it shows a quiet `(was: <paste form>)` caption in `text-secondary` treatment
**And** no action buttons (Matched needs no resolution)

**When** rendered for a **Fuzzy** row
**Then** it shows `?` glyph (amber `attention-fuzzy` token) + suggested Library title + `Yes, that one` button + `No — new song` button
**And** both buttons satisfy `min-h-tap min-w-tap`

**When** rendered for an **Unknown** row
**Then** it shows `+` glyph (red `attention-unknown` token) + parsed-as-normalized title + three single-tap action buttons: `+ Add to library`, `Pick from library`, `Discard`
**And** all three buttons satisfy `min-h-tap min-w-tap`

**And** in all three states, color is NEVER the sole signal — always paired with glyph AND label (per FR-7 / UX-DR6 / NFR-19)
**And** the containing region has `aria-live="polite"` (set on the parent `<div>` in `setlist-creation.tsx` per UX-DR6 / NFR-22)

**AC-6 — Fuzzy resolution: `Yes, that one` and `No — new song`**

**Given** Sandy taps `Yes, that one` on a Fuzzy row
**When** the tap is registered
**Then** the row converts to Matched state: the `ParseRowStatus` shows the Matched UI
**And** the underlying `MatchResult` is updated to `{ status: 'matched', song: <candidate> }`
**And** no API call is made yet (conversion is local state only; rows become `SongRef[]` only on Save)

**Given** Sandy taps `No — new song` on a Fuzzy row
**When** the tap is registered
**Then** the row converts to Unknown state with the normalized title and shows the three Unknown actions

**AC-7 — Unknown resolution: `+ Add to library`**

**Given** Sandy taps `+ Add to library` on an Unknown row
**When** the tap is registered
**Then** a new minimal Song record (title only) is created via `useSongMutation().saveSong(...)` with:
  - `bandId: ACTIVE_BAND_ID`
  - `songId: generateSongId()`
  - `title: <displayed/edited title>` (the normalized form, NOT the raw pasted string)
  - `clientWrittenAt: new Date().toISOString()`
  - `version: 1`
**And** the row converts to Matched referencing the new Song (`SongRef.titleSnapshot` = the title)
**And** the new Song is optimistically visible in the Library (via `useSongMutation` cache update — same pattern as Story 3.4 AC-11)
**And** no navigation occurs

**AC-8 — Unknown resolution: `Discard`**

**Given** Sandy taps `Discard` on an Unknown row
**When** the tap is registered
**Then** the row is removed from the parsed result entirely
**And** it does NOT appear in the final Setlist
**And** the row count for the Section decreases immediately (required to unblock Save when paste includes document-title junk)

**AC-9 — Unknown resolution: `Pick from library`**

**Given** Sandy taps `Pick from library` on an Unknown row
**When** the tap is registered
**Then** an inline type-ahead picker replaces the Unknown row's action buttons (reusing `SongSearchRow` from `web/src/components/song-search-row.tsx` — Story 3.4)
**And** the `SongSearchRow` receives `songs` from `useSongs().data ?? []`
**And** on `onSelect`, the row converts to Matched with the selected `SongRef`
**And** on `onCancel`, the picker closes and the Unknown row state is restored
**And** `onAddNew` is NOT exposed / wired here — `Pick from library` is for picking an existing song, not creating one

**AC-10 — Inline title edit before resolution**

**Given** any Matched, Fuzzy, or Unknown row
**When** Sandy taps into the row's displayed title
**Then** the title becomes editable inline
**And** on blur/Enter, `normalizeTitle` re-runs on the edited string, the matcher re-runs against the Library, and the row's state updates to the new match result
**And** this allows Sandy to strip noise the parser missed before committing

**AC-11 — Performance budget: 500ms for ~20-song input (NFR-3)**

**Given** a paste of ~20 song rows
**When** the `onPaste` or `onChange` event fires on the textarea
**Then** `parseSetlist` + `matchRows` complete within 500ms
**And** the implementation is synchronous (no `setTimeout`/debounce needed at V1 scale — the library is in memory from `useSongs()`)
**And** if profiling shows a hit, normalizing the Library index once per library snapshot (memoized) is the mitigation

**AC-12 — Save gating: no Fuzzy or Unknown rows remain**

**Given** the parsed result region with at least one Fuzzy or Unknown row remaining
**When** Sandy taps `Save`
**Then** `Save` is disabled (visually and functionally — `aria-disabled="true"`, no click handler fires)
**And** the button remains disabled until all rows are resolved (Matched or Discarded)

**Given** zero Fuzzy or Unknown rows remain
**When** Sandy taps `Save`
**Then** the resolved Sections from the paste flow are merged into `draft.sections` as `DraftSection[]`
**And** `SongRef.titleSnapshot` for each resolved row is the Library's canonical title (NOT the pasted string)
**And** the save proceeds exactly as Story 3.4 AC-14 (whole-record PUT enqueued, navigate to overview)

**AC-13 — Edge cases the parser must handle**

| Input | Behavior |
|---|---|
| Empty paste | Parsed region renders empty-state copy: `Paste a setlist above.` |
| Only headers, no songs | Sections render with 0 / 0 counts; Save is still allowed (empty Setlist is valid) |
| Only songs, no headers | All rows in implicit `Set 1` |
| Same paste title twice (legitimately) | Each row resolves independently; both may become Matched to the same `songId` |
| Trailing whitespace, smart quotes | Stripped by normalizer |
| Diacritics (`Más Que Nada`) | NFKD-normalized → matches `Mas Que Nada` |

**AC-14 — Tests: `parser.test.ts`**

**Given** `web/src/paste-parse/parser.test.ts` (NEW)
**When** the test suite runs
**Then** it covers at minimum:
- Blank text → empty result
- Single-section no-header input → one Section named `Set 1`
- `Set 1` / `Set 2` headers split into two sections
- `Encore` header detected
- `{Set 1}` brace-wrapped header detected
- `# Set 2` markdown header detected
- `---` separator closes section and opens implicit next
- Blank lines are skipped (do not split sections)
- Each row's `raw` preserves the original line; `normalized` has been through `normalizeTitle`

**AC-15 — Tests: `matcher.test.ts`**

**Given** `web/src/paste-parse/matcher.test.ts` (NEW)
**When** the test suite runs
**Then** it covers the five worked-score table rows from AC-4 (Matched exact, Fuzzy ≥ 0.92, Unknown < 0.92)
**And** covers: empty library → all Unknown; duplicate Library titles → top-1 returned; library normalization is pre-computed (not recomputed per row)

**AC-16 — Tests: `normalize.test.ts`**

**Given** `web/src/paste-parse/normalize.test.ts` (NEW)
**When** the test suite runs
**Then** it covers all eight worked-normalization examples from AC-3

**AC-17 — Tests: `parse-row-status.test.tsx`**

**Given** `web/src/components/parse-row-status.test.tsx` (NEW)
**When** the test suite runs
**Then** it covers:
- Matched row: renders `✓`, canonical title, no action buttons
- Matched row with different paste form: renders `(was: <paste form>)` caption
- Fuzzy row: renders `?`, suggested title, `Yes, that one` and `No — new song` buttons
- Unknown row: renders `+`, normalized title, all three action buttons
- Color-never-alone verified via glyph + label present in all states

**AC-18 — Integration in `setlist-creation.test.tsx`**

**Given** `web/src/routes/setlist-creation.test.tsx` (UPDATE)
**When** the test suite runs
**Then** it adds coverage for:
- Textarea renders with `aria-label="Paste setlist"`
- Pasting text triggers parser and renders `ParseRowStatus` rows
- Fuzzy `Yes, that one` converts row to Matched
- Fuzzy `No — new song` converts row to Unknown
- Unknown `+ Add to library` calls `saveSong` and converts row to Matched
- Unknown `Discard` removes the row
- Save is disabled when Fuzzy/Unknown rows remain
- Save is enabled after all rows resolved

**AC-19 — Microcopy: extend `web/src/lib/microcopy.ts`**

**Given** `web/src/lib/microcopy.ts` (UPDATE)
**When** reviewed
**Then** `PASTE_TO_PARSE` is added (new export):
  ```ts
  export const PASTE_TO_PARSE = {
    placeholder: 'Paste setlist above.',
    emptyResult: 'Paste a setlist above.',
    yesMatch: 'Yes, that one',
    noNewSong: 'No — new song',
    addToLibrary: '+ Add to library',
    pickFromLibrary: 'Pick from library',
    discard: 'Discard',
    wasCaution: 'was:',
  } as const;
  ```
**And** no existing constants are mutated

**AC-20 — Accessibility**

**Given** the parsed-result region
**When** rows transition between states (Matched / Fuzzy / Unknown resolution)
**Then** the region's parent `<div aria-live="polite">` causes VoiceOver to announce changes (per UX-DR6 / NFR-22)
**And** each `ParseRowStatus` action button has explicit visible text (no icon-only buttons in this component — text IS the label)
**And** the inline title edit field has `aria-label` set to `Song title`

**AC-21 — Verification pass**

**Given** the implementation is complete
**When** verification commands run from the repo root
**Then** `pnpm typecheck` is green across all five packages
**And** `pnpm lint` is green via Biome (kebab-case filenames; camelCase identifiers; no new `biome-ignore` directives unless justified in a comment)
**And** `pnpm test` is green — all new tests pass; no regressions against Story 3.4 baseline (web 333, api 103)
**And** `pnpm build:web` is green; `pnpm-lock.yaml` is unchanged (if JW implemented inline)

**AC-22 — Commit checkpoint**

**Given** the implementation is complete and all verification passes
**When** the story is marked done
**Then** an explicit commit has been created containing all new and modified files listed in the File List
**And** `git status --porcelain` is clean

## Tasks / Subtasks

- [x] **Task 1 — `normalize.ts` + `normalize.test.ts`** (AC: 3, 16)
  - [x] Create `web/src/paste-parse/normalize.ts` exporting `normalizeTitle(raw: string): string`
  - [x] Implement the 10-step pipeline in AC-3 order
  - [x] Create `web/src/paste-parse/normalize.test.ts` covering all 8 worked examples from AC-3
  - [x] Run `pnpm typecheck`

- [x] **Task 2 — `parser.ts` + `parser.test.ts`** (AC: 2, 14)
  - [x] Create `web/src/paste-parse/parser.ts` exporting `parseSetlist(text: string): ParseResult`
  - [x] Define types `ParsedRow = { raw: string; normalized: string }` and `ParsedSection = { name: string; rows: ParsedRow[] }` and `ParseResult = { sections: ParsedSection[] }` in `parser.ts` (or a co-located `types.ts`)
  - [x] Implement line-by-line scan with the section-detection table from AC-2
  - [x] Call `normalizeTitle` from `normalize.ts` to fill `row.normalized`
  - [x] Create `web/src/paste-parse/parser.test.ts` covering all cases in AC-14
  - [x] Run `pnpm typecheck`

- [x] **Task 3 — Jaro-Winkler + `matcher.ts` + `matcher.test.ts`** (AC: 4, 15)
  - [x] Decide: inline JW (~30 lines) or `natural` package
    - **Preferred: inline** — keeps `pnpm-lock.yaml` unchanged and bundle lean
    - If `natural` is used: `pnpm add natural` in `web/`, confirm `pnpm-lock.yaml` updates, add to `pnpm build:web` check
  - [x] Create `web/src/paste-parse/matcher.ts` exporting `matchRows(rows: ParsedRow[], library: Song[]): MatchResult[]`
  - [x] Define `MatchResult` type (union: `{ status: 'matched'; song: Song } | { status: 'fuzzy'; song: Song; score: number } | { status: 'unknown' }`)
  - [x] Pre-compute normalized Library map once per call (not per row)
  - [x] Implement Exact → JW top-1 → threshold pipeline
  - [x] Create `web/src/paste-parse/matcher.test.ts` covering all cases in AC-15
  - [x] Run `pnpm typecheck`

- [x] **Task 4 — `ParseRowStatus` component + test** (AC: 5, 17)
  - [x] Create `web/src/components/parse-row-status.tsx`
  - [x] Read `web/src/components/inline-edit-field.tsx` before writing (understand the focus / blur pattern for inline title edit)
  - [x] Read `web/src/components/song-search-row.tsx` before writing (understand how the type-ahead is structured so `Pick from library` can embed it cleanly)
  - [x] Props:
    ```ts
    type ParseRowStatusProps = {
      result: MatchResult;
      rawTitle: string;           // for the "was:" caption
      onAcceptFuzzy: () => void;
      onRejectFuzzy: () => void;
      onAddToLibrary: () => void;
      onPickFromLibrary: () => void;
      onDiscard: () => void;
      onTitleEdit: (newTitle: string) => void;  // re-triggers matching
      songs: Song[];               // for Pick from library type-ahead
    };
    ```
  - [x] Use token CSS variables; no hard-coded hex. Reference tokens: `--color-accent`, `--color-attention-fuzzy`, `--color-attention-unknown`, `--color-text-secondary`, `--color-bg`
  - [x] Glyph characters: `✓` (Matched), `?` (Fuzzy), `+` (Unknown)
  - [x] `Pick from library` state: renders `<SongSearchRow>` with `onAddNew` wired to a no-op or hidden (existing `SongSearchRow` already supports `onAddNew` — pass a noop and hide the `+ Add to library` option if possible, or accept it appears)
  - [x] Create `web/src/components/parse-row-status.test.tsx` covering AC-17 cases
  - [x] Run `pnpm typecheck`

- [x] **Task 5 — Wire paste UI into `setlist-creation.tsx`** (AC: 1, 6, 7, 8, 9, 10, 11, 12)
  - [x] Read the FULL current `web/src/routes/setlist-creation.tsx` before modifying
  - [x] Add local state for paste result: `const [parseResults, setParseResults] = useState<RowState[]>([])`
    where `RowState = { parsedRow: ParsedRow; match: MatchResult; displayTitle: string }`
  - [x] Add `<textarea aria-label="Paste setlist">` above the sections UI
  - [x] Wire `onChange` / `onPaste` to call `parseSetlist` then `matchRows` and update `parseResults`
  - [x] Render `<div aria-live="polite">` containing `ParseRowStatus` per row
  - [x] Implement Fuzzy accept/reject handlers (update row's `match` in local state)
  - [x] Implement Unknown `+ Add to library` handler (calls `saveSong()`, converts to Matched)
  - [x] Implement Unknown `Discard` handler (removes row from `parseResults`)
  - [x] Implement Unknown `Pick from library` handler (set per-row "picking" flag; render `SongSearchRow` inline)
  - [x] Implement inline title edit → re-normalize → re-match (AC-10)
  - [x] Save-gate: compute `hasPendingRows = parseResults.some(r => r.match.status === 'fuzzy' || r.match.status === 'unknown')` and pass `disabled={hasPendingRows}` to the Save button; add `aria-disabled`
  - [x] On Save (no pending rows): merge `parseResults` into `DraftSection[]` and call `handleSave` as usual
  - [x] Update `web/src/routes/setlist-creation.test.tsx` with AC-18 cases
  - [x] Run `pnpm typecheck`

- [x] **Task 6 — Microcopy** (AC: 19)
  - [x] Add `PASTE_TO_PARSE` export to `web/src/lib/microcopy.ts`
  - [x] Replace any string literals in the paste-parse components with the new constants

- [x] **Task 7 — Verification pass** (AC: 21)
  - [x] `pnpm typecheck` green across all five packages
  - [x] `pnpm lint` green (auto-fix via `pnpm lint:fix`; no unjustified `biome-ignore`)
  - [x] `pnpm test` green — web ≥ 333 + new tests; api 103 unchanged
  - [x] `pnpm build:web` green
  - [x] `pnpm-lock.yaml` unchanged (confirm if JW is inline)

- [ ] **Task 8 — Commit checkpoint** (AC: 22) — _deferred to post-review per workflow_
  - [ ] `git add` all new and modified files from the File List
  - [ ] `git commit` with a descriptive message
  - [ ] Confirm `git status --porcelain` is clean

## Dev Notes

### This story's scope

Story 3.5 is a **pure web-layer story** — no API changes, no schema changes, no sync-layer changes. It extends `/setlists/new` (Story 3.4's `setlist-creation.tsx`) with a paste input area and parser+matcher pipeline. All writes flow through the existing `useSongMutation()` and `useSetlistMutation()` hooks exactly as Story 3.4 does.

**What this story delivers:**
- `web/src/paste-parse/normalize.ts` NEW
- `web/src/paste-parse/normalize.test.ts` NEW
- `web/src/paste-parse/parser.ts` NEW
- `web/src/paste-parse/parser.test.ts` NEW
- `web/src/paste-parse/matcher.ts` NEW
- `web/src/paste-parse/matcher.test.ts` NEW
- `web/src/components/parse-row-status.tsx` NEW (UX-DR4 component)
- `web/src/components/parse-row-status.test.tsx` NEW
- `web/src/routes/setlist-creation.tsx` UPDATE — paste UI mounted above manual sections
- `web/src/routes/setlist-creation.test.tsx` UPDATE — add AC-18 cases
- `web/src/lib/microcopy.ts` UPDATE — add `PASTE_TO_PARSE`

**What this story does NOT deliver:**
- Any changes to `api/**`, `shared/**`, `infra/**`, `e2e/**`
- No changes to `web/src/sync/**`
- Drag-reorder (Story 3.6)

### Design reference — read first

`_bmad-output/planning-artifacts/paste-to-parse-design.md` is the authoritative design note. It locks the algorithm, normalization pipeline, threshold, and UX surface. The story spec above is derived from it. When in doubt, the design note wins.

### Paste area placement in `setlist-creation.tsx`

The paste UI sits **above** the existing `{draft.sections.map(...)}` block. The file currently has this structure (simplified):

```tsx
<section aria-labelledby="setlist-creation-heading">
  <header>  {/* Venue, Date, Time fields */}  </header>

  {/* ---- INSERT PASTE AREA HERE ---- */}

  {draft.sections.map(...)}   {/* manual sections */}
  {draft.sections.length === 0 ? <button>+ Add song</button> : null}
  <button>+ Add section</button>
  <button>Save</button>
</section>
```

The paste textarea and parsed-result `<div aria-live="polite">` are a self-contained block. They feed resolved rows INTO the same `draft.sections` state on Save. Sandy can also mix-and-match: paste some rows, then manually add more via `+ Add song`.

### State model for paste rows

The paste flow maintains its own transient state — separate from `draft.sections` until Save. This prevents the paste-UI churn from corrupting manually-edited sections mid-flow.

```ts
type RowState = {
  parsedRow: ParsedRow;    // raw + normalized from parser
  match: MatchResult;      // current match status (mutable via resolution actions)
  displayTitle: string;    // what to show (canonical if matched, normalized if unknown)
  isPicking: boolean;      // true while SongSearchRow is open for "Pick from library"
};

const [pasteText, setPasteText] = useState('');
const [rowStates, setRowStates] = useState<RowState[]>([]);
```

On each textarea change/paste:
```ts
const parsed = parseSetlist(newText);
const allRows = parsed.sections.flatMap((s) => s.rows);
const matches = matchRows(allRows, songs);
setRowStates(allRows.map((row, i) => ({
  parsedRow: row,
  match: matches[i],
  displayTitle: matches[i].status === 'matched' ? matches[i].song.title : row.normalized,
  isPicking: false,
})));
```

**Section structure preserved:** The parsed `ParseResult.sections` carries section names. The final merge on Save reconstructs `DraftSection[]` from the parsed sections, inserting the resolved `SongRef[]` for each section:

```ts
function buildDraftSectionsFromParse(
  parsedSections: ParsedSection[],
  rowStates: RowState[],
): DraftSection[] {
  let rowIndex = 0;
  return parsedSections.map((sec) => ({
    name: sec.name,
    songs: sec.rows
      .map(() => {
        const rs = rowStates[rowIndex++];
        if (rs.match.status !== 'matched') return null; // discarded or still pending (Save is blocked anyway)
        return {
          songId: rs.match.song.songId,
          titleSnapshot: rs.match.song.title,
        };
      })
      .filter((r): r is SongRef => r !== null),
  }));
}
```

### `ParseRowStatus` visual design (token references)

All styling via CSS variables — no hard-coded hex:

```tsx
// Matched
<span className="text-[color:var(--color-accent)]">✓</span>
<span className="text-[length:var(--text-practice-body)]">Matched</span>
// ... canonical title ...
// (was: paste form) in text-secondary when differs

// Fuzzy
<span className="text-[color:var(--color-attention-fuzzy)]">?</span>
<span>Fuzzy</span>
// Yes, that one | No — new song  (both min-h-tap)

// Unknown
<span className="text-[color:var(--color-attention-unknown)]">+</span>
<span>Unknown</span>
// + Add to library | Pick from library | Discard  (all min-h-tap)
```

Color is never the sole signal — `✓`, `?`, `+` glyphs plus the `Matched`/`Fuzzy`/`Unknown` labels carry the meaning independently of color (per NFR-19 / UX-DR6 color-never-alone).

### Jaro-Winkler inline implementation

Preferred (avoids a new dependency). ~30-line pure function:

```ts
// web/src/paste-parse/matcher.ts (internal, not exported)
function jaroWinkler(s1: string, s2: string): number {
  // Standard JW: jaro score + prefix bonus (max 4 chars, scale 0.1)
  // ... (implement per Wikipedia algorithm)
}
```

If you're blocked implementing JW inline, use `natural`'s `JaroWinklerDistance(a, b)` — but that requires `pnpm add natural --filter web` and will change `pnpm-lock.yaml`. Flag this in the Dev Agent Record.

### `SongSearchRow` reuse in `Pick from library`

`web/src/components/song-search-row.tsx` (Story 3.4) is already production-ready. For `Pick from library` in `ParseRowStatus`:

```tsx
{isPicking && (
  <SongSearchRow
    songs={songs}
    onSelect={(songRef) => {
      // songRef.songId + titleSnapshot already set by SongSearchRow
      onPickFromLibrary(songRef);
    }}
    onAddNew={(_title) => {
      // No-op: Pick from library is for existing songs only.
      // SongSearchRow will show "+ Add to library" in the dropdown;
      // wire onAddNew to a noop or disable display — simplest: noop.
    }}
    onCancel={onCancelPick}
  />
)}
```

Note: `SongSearchRow.onSelect` already returns `{ songId, titleSnapshot }` — this IS a valid `SongRef`. No conversion needed.

### `readAtmosphere()` pattern — copy verbatim

As in Story 3.4, copy the function into any new files that need it:
```ts
function readAtmosphere(): 'practice' | 'performance' {
  if (typeof document === 'undefined') return 'practice';
  return document.documentElement.dataset.atmosphere === 'performance' ? 'performance' : 'practice';
}
```

### Biome lint traps (from Stories 3.3 and 3.4)

- **`noAutofocus` on raw DOM `<input>`:** Use `useRef + useEffect(() => ref.current?.focus(), [])` — already solved in `SongSearchRow`; replicate the same pattern in `ParseRowStatus` inline title edit
- **`noNoninteractiveElementToInteractiveRole`:** Use `<div role="listbox">` + `<div role="option">`, not `<ul>/<li>`. Already established in `SongSearchRow` — mirror the pattern
- **`noArrayIndexKey` suppression:** Section and row indices are positional identity (whole-record PUT semantics). Use `// biome-ignore lint/suspicious/noArrayIndexKey: row position is its identity (AR-23)` exactly as in `setlist-creation.tsx`

### Architecture compliance

- **AR-23 (whole-record PUT):** On Save, the FULL `SetlistPutInput` including all sections from both the paste flow AND any manual additions is sent. Never send a partial.
- **AR-45 (hook boundary):** `setlist-creation.tsx` and `parse-row-status.tsx` import `useSongMutation()` and `useSongs()` — NEVER import `outbox.ts` or `flusher.ts` directly.
- **AR-46:** No analytics SDK, no Redux/Zustand/Jotai. All state is local `useState`.
- **AR-47:** `generateSongId()` for all new Song IDs (from `web/src/lib/song-id.ts`).
- **AR-48:** `clientWrittenAt = new Date().toISOString()` stamped fresh when `saveSong()` is called.

### `titleSnapshot` semantics — critical

Per AR-11, `titleSnapshot` preserves the Library's canonical title, not the pasted typo. When a row resolves to Matched:
- `SongRef.titleSnapshot = match.song.title` (Library canonical) — not `row.normalized` (pasted form)
- The `(was: <paste form>)` UI caption shows the pasted form for Sandy's awareness, but it is NOT stored

### Save-gate implementation

The Save button in `setlist-creation.tsx` must check both manual rows AND paste rows:

```ts
const hasPendingRows = rowStates.some(
  (rs) => rs.match.status === 'fuzzy' || rs.match.status === 'unknown',
);

// On the Save button:
<button
  type="button"
  onClick={hasPendingRows ? undefined : handleSave}
  aria-disabled={hasPendingRows}
  className={hasPendingRows ? SAVE_BUTTON_DISABLED_CLASS : SAVE_BUTTON_CLASS}
>
  Save
</button>
```

If no paste has been made (`rowStates.length === 0`), `hasPendingRows` is false and Save works as in Story 3.4.

### Token patterns reminder (Tailwind v4)

```tsx
// Color:
className="text-[color:var(--color-attention-fuzzy)]"
className="text-[color:var(--color-attention-unknown)]"
className="text-[color:var(--color-accent)]"
className="text-[color:var(--color-text-secondary)]"
// Tap target:
className="min-h-tap min-w-tap"   // from --spacing-tap: 44px
// Type scale:
className="text-[length:var(--text-practice-body)]"
```

Never hard-code hex values.

### Testing count baseline

Story 3.4 exit count: **web 333, api 103**.

New test files (estimate):
- `normalize.test.ts`: ~10 cases
- `parser.test.ts`: ~12 cases
- `matcher.test.ts`: ~10 cases
- `parse-row-status.test.tsx`: ~8 cases
- `setlist-creation.test.tsx` updates: ~8 new cases

Expected Story 3.5 final: **web ~381, api 103 unchanged**.

### Story 3.4 handoff note (from Dev Agent Record)

> Story 3.5 will mount above the existing manual sections UI in `setlist-creation.tsx`. The current draft state model (sections + songs as `DraftSection[]` with `SongRef[]`) is the merge target — paste-parsed sections will become `DraftSection` entries the same way manually-added ones do, so no schema changes will be needed on the creation surface for 3.5.

This confirms: no changes to `DraftSection`, `DraftState`, or the Save handler's PUT payload shape. The paste flow is additive state that collapses into the same `sections: DraftSection[]` on Save.

## Dev Agent Record

### Agent Model Used

Claude (Opus 4.7, 1M context) via bmad-dev-story workflow.

### Debug Log References

- Jaro-Winkler implementation verified against AC-4 worked scores: `comin home baby` ↔ `coming home baby` ≈ 0.99, `cantaloupe island` ↔ `canteloupe island` ≈ 0.98, `kelvingrovestreet` ↔ `kelvingrove street` ≈ 0.99, `mas que nada` ↔ `mas que nada` = 1.00, `move on up` ↔ `move it on over` ≈ 0.78 (below 0.92). All within tolerance of the design-note table.
- ParseRowStatus "(was: …)" caption first draft compared raw vs canonical via `.trim() !== .trim()`; updated to case-insensitive (`.toLowerCase()`) to honour "case is not semantic" from the design note. Test that initially failed (paste form differed only in trailing whitespace) was retargeted to a real case difference (`COMIN' HOME BABY` vs `Coming Home Baby`).
- Biome auto-fix collapsed multi-line imports and ternaries to single lines in matcher.ts, parser.test.ts, normalize.test.ts, matcher.test.ts, parse-row-status.test.tsx, and setlist-creation.tsx; no semantic changes.

### Completion Notes List

- Story 3.5 implemented as a pure web-layer extension to Story 3.4's `setlist-creation.tsx`. Zero changes to `api/`, `shared/`, `infra/`, `e2e/`. Zero new runtime npm dependencies (JW implemented inline ~50 lines including comments). `pnpm-lock.yaml` unchanged.
- Parser supports the full AC-2 detection table: `Set N` (case-insensitive, title-cased), `Encore`, `{...}` brace headers, `# ... ######` markdown headers, `---` separator → implicit `Set N+1`. Trailing `---` does not emit a phantom empty section. No-header pastes land in implicit `Set 1`.
- Matcher precomputes the normalized Library index once per call (per AC-4 step 2). Duplicate Library titles tie-break by latest `clientWrittenAt` (matches design-note rule). `matchNormalizedTitle` is exported so the route's inline-edit handler (AC-10) can re-match a single row without rebuilding the index for every keystroke — the index is small enough that the rebuild cost is negligible at V1 scale.
- ParseRowStatus renders inline-edit input alongside the glyph/label so every row state (Matched / Fuzzy / Unknown) supports AC-10 inline title editing. `Pick from library` mounts `SongSearchRow` with `onAddNew` wired to a noop (AC-9 says "Pick" is for picking, not adding) — the `+ Add to library` Unknown action covers the add-new path.
- Route Save flow merges parsed sections FIRST, then manual `draft.sections`, into the SetlistPutInput. `titleSnapshot` for resolved rows uses the Library's canonical `song.title` (AR-11 / AC-4). `hasPendingRows` derives from `rowStates` only; if no paste has been made, `rowStates` is empty and Save behaves exactly like Story 3.4.
- Performance: 20-row × 100-song matcher benchmark in `matcher.test.ts` runs in <500ms (well under the NFR-3 budget). Inline JW + per-call library normalization is sufficient at V1 scale; memoization of the library index across calls is deferred to V2 if profiling shows a hit.
- Test counts at story exit: web 412 (+79 from 333), api 103 unchanged, shared 26 unchanged. Lint clean, typecheck clean, build green.
- Task 8 (commit checkpoint) intentionally left unchecked — the orchestrating workflow will commit after the code-review and adversarial-review steps pass.

### File List

**NEW files:**
- `web/src/paste-parse/normalize.ts`
- `web/src/paste-parse/normalize.test.ts`
- `web/src/paste-parse/parser.ts`
- `web/src/paste-parse/parser.test.ts`
- `web/src/paste-parse/matcher.ts`
- `web/src/paste-parse/matcher.test.ts`
- `web/src/components/parse-row-status.tsx`
- `web/src/components/parse-row-status.test.tsx`

**UPDATED files:**
- `web/src/routes/setlist-creation.tsx` (paste UI above manual sections)
- `web/src/routes/setlist-creation.test.tsx` (AC-18 cases added)
- `web/src/lib/microcopy.ts` (adds `PASTE_TO_PARSE` export)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status: ready-for-dev → in-progress → review)
- `_bmad-output/implementation-artifacts/3-5-paste-to-parse-with-matched-fuzzy-unknown.md` (this file)

### Change Log

| Date       | Change                                              |
| ---------- | --------------------------------------------------- |
| 2026-06-19 | Story 3.5 spec created; status set to ready-for-dev. |
| 2026-06-19 | Story 3.5 implemented (paste-to-parse with Matched / Fuzzy / Unknown). Tasks 1–7 complete; Task 8 (commit) deferred to post-review. Status: review. |
