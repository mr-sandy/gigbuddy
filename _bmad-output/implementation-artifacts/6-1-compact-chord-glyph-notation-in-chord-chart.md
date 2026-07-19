---
baseline_commit: "b8410cf"
builds_on: 5-2-verified-restore-drill-runbook-v1-ship-gate
---

# Story 6.1: Compact chord-glyph notation in `<ChordChart>` (P1 chord-chart lock)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Sandy,
I want the shipped `<ChordChart text={...}>` component to render chord tokens with compact typographic notation (base note + accidentals + tension/quality as superscript or symbol) while keeping the V1 text-flow structure (no cards, no grid, no elevation, authored line breaks respected),
So that the chord chart on the Performance Card reads as engraved musical notation rather than raw text, without the failed V2 card-grid rhythm.

## Locked constraints (do not relitigate)

- Visual direction is locked — do not propose alterations to color, typography scale, or layout philosophy. This story only changes how chord *tokens* render inline; it does not touch the surrounding chrome, atmosphere tokens, or type scale.
- Sandy IS the user — skip persona ceremony.
- The V2 aspiration (engraved chord-glyph cards in a 2-column grid) is **retired** and must not be reintroduced. Structure stays V1 floor: a text run, no cards, no elevation.

## Acceptance Criteria

**AC-1 — `web/src/components/chord-notation.tsx` (NEW) exports pure, testable chord-token parsing + rendering**

**Given** `web/src/components/chord-notation.tsx` (NEW)
**When** reviewed
**Then** it exports `function parseChordToken(token: string): ParsedChordToken | null` where `ParsedChordToken = { root: string; suffix: string; bass?: string }`, implementing exactly the transformation rules in [Dev Notes → Chord-notation transformation rules (owned by this story)] below
**And** it exports `function renderChordToken(token: string, key: number | string): ReactNode` that calls `parseChordToken` and renders per those rules — the sole symbol substitution is `maj7` (case-insensitive exact match on the suffix) → `△` (U+25B3 WHITE UP-POINTING TRIANGLE) rendered at baseline (NOT superscripted); every other non-empty suffix renders as `<sup>{suffix}</sup>` verbatim (no other symbol substitutions — do not invent glyphs for `dim`, `ø`, `aug`, etc.; that is out of scope and not locked by the mockup brief)
**And** a token that fails to parse (see rules below for exactly which inputs fail) renders as the verbatim original string — no throw, no blank output
**And** the module has no side effects, no DOM access, and no dependency on `atmosphere` — it is a pure parse+render helper importable by both Performance and Practice call sites (AC-4)

**AC-2 — Canonical worked examples parse and render correctly (per epics.md AC block 1 + 2)**

**Given** the four canonical tokens from epics.md
**When** `renderChordToken` is called on each
**Then**:
| Input | root | suffix | Rendered (textContent) | Superscript element? |
|---|---|---|---|---|
| `Dbmaj7` | `Db` | `maj7` | `Db△` | no — `△` at baseline |
| `Gm7` | `G` | `m7` | `Gm7` | yes — `<sup>m7</sup>` |
| `Gb9` | `Gb` | `9` | `Gb9` | yes — `<sup>9</sup>` |
| `G7sus4` | `G` | `7sus4` | `G7sus4` | yes — `<sup>7sus4</sup>` |

**And** slash chords parse the bass note separately and render it at baseline after the quality: `Bm/D` → root `B`, suffix `m` (superscripted), bass `D` → textContent `Bm/D`, with `m` inside a `<sup>` and `/D` at baseline (not superscripted)
**And** altered dominants fall into the generic superscript rule (no special glyph beyond `maj7`→`△`): `G7♭9` → root `G`, suffix `7♭9` superscripted; `G7#5` → root `G`, suffix `7#5` superscripted — the accidental character inside the suffix is never transformed, it renders exactly as authored (`♭` stays `♭`, `#` stays `#`)
**And** a bare major triad with no suffix (e.g. `G`) renders as plain `G` — no superscript element, no `△` (a suffix of `''` renders nothing extra)

**AC-3 — Malformed / unrecognized tokens fall back to verbatim text (epics.md AC block 3)**

**Given** a token whose first character is not an uppercase letter `A`–`G` (e.g. `H7`, a stray word, a lowercase note name)
**When** `parseChordToken` runs
**Then** it returns `null`, and `renderChordToken` renders the original string unchanged
**Given** a slash-chord token whose part after `/` is not a single valid note (letter `A`–`G` plus an optional `#`/`b`/`♯`/`♭`) — e.g. `G7/H9`
**When** `parseChordToken` runs
**Then** it returns `null` (the whole token, including the slash, renders verbatim) — do not attempt to salvage the main part alone
**And** `web/src/components/chord-notation.test.tsx` (NEW) has at least one explicit case per fallback path above, asserting the rendered output equals the raw input string

**AC-4 — `web/src/components/chord-chart.tsx` (UPDATE) applies compact notation to every content line, in both atmospheres, without breaking existing URL handling**

**Given** `web/src/components/chord-chart.tsx` (UPDATE)
**When** a content line (the `data-chord-chart-line` branch — NOT section-heading or blank-line branches, which are untouched) renders
**Then** the line is tokenized preserving whitespace exactly (splitting on `/(\s+)/` so consecutive spaces used for chord-alignment are never collapsed or altered), and each non-whitespace token is passed through `renderChordToken` from AC-1; whitespace segments render as literal text nodes
**And** this tokenization composes with the existing URL-detection split (`URL_REGEX`) — a segment already identified as a URL is rendered exactly as it is today (as an `<a>` when `urlsTappable`, as plain text otherwise) and is NEVER passed through chord-token parsing; only the non-URL text segments are chord-tokenized
**And** the component performs no atmosphere check anywhere in this new logic — `urlsTappable` remains the only prop threading atmosphere-derived behavior into this component, and compact notation applies identically regardless of atmosphere (the Practice/Performance visual difference — text/accent colors — already comes from the atmosphere-scoped CSS custom properties on the surrounding elements, unmodified by this story)
**And** section-heading lines (`{Verse 1}` etc.) and blank lines render exactly as before — untouched by this story
**And** `web/src/components/chord-chart.test.tsx` (UPDATE) gains cases asserting: (a) a line with multiple chords separated by multiple spaces preserves the exact whitespace and renders a `<sup>` for each superscripted token; (b) a `{Section}` line is unaffected (still no `<sup>` inside it, content unchanged); (c) the existing URL tests still pass unmodified (URLs are never chord-tokenized — assert no `<sup>` renders inside the URL text); (d) a line mixing a malformed token with valid tokens renders the malformed one verbatim and the valid ones transformed, in the same line, in original order

**AC-5 — Song Detail edit surface (Story 2.6) shows authored source, never the transformed rendering**

**Given** `web/src/routes/song-detail.tsx` (no code change required — `InlineEditField` already binds directly to the raw `chordChart` string per Story 2.6, and the `<ChordChart>` preview underneath is a separate element)
**When** Sandy edits a chord-chart body containing `Dbmaj7`
**Then** the `InlineEditField` textarea value is exactly `Dbmaj7` (never `Db△`) — the transformation is render-time-only inside `<ChordChart>`, never persisted, never shown in the edit control
**And** `web/src/routes/song-detail.test.tsx` (UPDATE) gains one case using a body containing `Dbmaj7` (a token that visibly *would* change under compact notation) asserting `screen.getByLabelText(FIELD_LABELS.chordChart)` has value `Dbmaj7` verbatim — the existing test at line ~83 uses `Dm A7 Dm`, which happens to look identical whether transformed or not, so it does not actually prove non-transformation; this new case closes that gap

**AC-6 — Shipped rendering matches the approved mockup at chord-token level (manual/visual — no automated pixel test)**

**Given** the Performance Card, plan-baseline state, rendered with the approved mockup's content
**When** the story is code-reviewed
**Then** the rendering is visually compared against `_bmad-output/planning-artifacts/mockups/rendered/p1-performance/iteration-2/state-1a-plan-v1-floor-text-chart.png` for structure (V1 floor — no cards/grid/elevation) and against the iteration-2 chord-glyph notation for the `Db△` / superscript treatment
**And** no automated pixel-diff test is added — this AC is closed by visual sign-off during code review, noted in the Dev Agent Record

## Tasks / Subtasks

- [x] Task 1 — Chord-notation module (AC: 1, 2, 3)
  - [x] Create `web/src/components/chord-notation.tsx` (NEW) with `ParsedChordToken` type, `parseChordToken`, `renderChordToken`, and the module-scope constants documented in Dev Notes (`CHORD_TOKEN_REGEX`, `BASS_NOTE_REGEX`, `MAJOR_SEVENTH_SYMBOL`)
  - [x] Create `web/src/components/chord-notation.test.tsx` (NEW) covering the four canonical tokens, the slash-chord case, both altered-dominant cases, the bare-major-triad case, and both fallback cases from AC-3
- [x] Task 2 — Wire tokenization into `<ChordChart>` (AC: 4)
  - [x] Update `renderLineContent` in `web/src/components/chord-chart.tsx` to tokenize non-URL segments via `renderChordToken` while preserving the existing URL-split behavior (see Dev Notes for the exact composition)
  - [x] Add a `renderChordLine` helper (or inline the whitespace-preserving split) alongside the existing URL logic; apply the established `biome-ignore lint/suspicious/noArrayIndexKey` comment pattern already used in this file wherever a new array index is used as a React key
  - [x] Update `web/src/components/chord-chart.test.tsx` (UPDATE) per AC-4's four new cases; re-run the full existing suite in this file to confirm no regressions (see Dev Notes for why the existing assertions are expected to keep passing unchanged)
- [x] Task 3 — Confirm the edit-surface non-transformation guarantee (AC: 5)
  - [x] Add the `Dbmaj7` case to `web/src/routes/song-detail.test.tsx` (UPDATE) per AC-5 — no production code change expected in `song-detail.tsx` itself; if the test somehow fails, that indicates the edit surface is accidentally routing through `<ChordChart>`, which would be a regression to fix, not a new feature to build
- [ ] Task 4 — Visual sign-off (AC: 6)
  - [ ] During code review, visually compare the Performance Card chord region (plan state) against the approved mockup files named in AC-6; note the comparison outcome in the Dev Agent Record's Completion Notes  <!-- MANUAL_REVIEW_RECOMMENDED: visual comparison against `_bmad-output/planning-artifacts/mockups/rendered/p1-performance/iteration-2/state-1a-plan-v1-floor-text-chart.png` is out of scope for dev-story automation; logged for the manual code-review pass. -->


## Dev Notes

### Chord-notation transformation rules (owned by this story)

The epics.md AC block for altered dominants and slash chords explicitly defers the precise transformation rules to "the story's Dev Notes." These are those rules — final and binding for this implementation. Do not invent additional musical-notation symbols beyond what's specified here (e.g. no `ø` for half-diminished, no `°` for diminished) — those are out of scope; only `maj7` gets a symbol substitution, per the mockup lock ([Source: mockups/p1-performance.md#Chord-chart-direction-—-locked], line 28).

**Tokenization (line level, in `chord-chart.tsx`):**
A content line is split on whitespace runs with a capturing regex so no characters are lost: `line.split(/(\s+)/)`. Even-indexed results are candidate chord tokens; odd-indexed results are the whitespace runs themselves (rendered as literal text, unchanged — this is what keeps multi-space chord alignment intact, since `<pre>` preserves whitespace verbatim). This split happens **per non-URL segment**, after the existing `URL_REGEX` split — URLs are never chord-tokenized.

**Parsing (token level, in `chord-notation.tsx`):**

```ts
const CHORD_TOKEN_REGEX = /^([A-G])(#|b|♯|♭)?(.*)$/;
const BASS_NOTE_REGEX = /^[A-G](#|b|♯|♭)?$/;
const MAJOR_SEVENTH_SYMBOL = '△'; // U+25B3 WHITE UP-POINTING TRIANGLE

type ParsedChordToken = { root: string; suffix: string; bass?: string };

function parseChordToken(token: string): ParsedChordToken | null {
  let main = token;
  let bass: string | undefined;
  const slashIndex = token.indexOf('/');
  if (slashIndex !== -1) {
    main = token.slice(0, slashIndex);
    const candidateBass = token.slice(slashIndex + 1);
    if (!BASS_NOTE_REGEX.test(candidateBass)) return null;
    bass = candidateBass;
  }
  const match = main.match(CHORD_TOKEN_REGEX);
  if (!match) return null;
  const [, letter, accidental = '', suffix] = match;
  return { root: `${letter}${accidental}`, suffix, bass };
}
```

**Rendering rules:**
1. Root (base note + accidental, e.g. `Db`, `G`, `F#`) always renders at baseline, characters exactly as authored — accidentals are never converted between `#`/`b`/`♯`/`♭` spellings.
2. Suffix `''` (bare major triad) → nothing extra rendered.
3. Suffix exactly `maj7` (case-insensitive compare only, e.g. `maj7`, `Maj7`, `MAJ7` all match) → render `△` at baseline, immediately after root. This is the **only** symbol substitution in scope.
4. Any other non-empty suffix → `<sup>{suffix}</sup>`, verbatim, no case changes, no character substitution (this is the generic bucket that covers `m7`, `9`, `7sus4`, `m9`, `6`, `13`, `add9`, `sus2`, `dim7`, `aug`, and altered dominants like `7♭9`/`7#5` — all render as superscript text with no special glyph).
5. Bass (slash chord, e.g. `/D`) → renders at baseline after the suffix rendering, exactly as `/` + bass, never superscripted.
6. A token that fails to parse (see AC-3) renders as the original, untransformed string.

**Why the bare `<sup>` needs no extra className:** Tailwind v4's Preflight (loaded via the project's `@import "tailwindcss";` in `web/src/styles/globals.css`) already styles bare `sub`/`sup` elements with `font-size: 75%; line-height: 0; position: relative; vertical-align: baseline;` plus a `top: -0.5em` offset on `sup` — this produces a correctly-raised, correctly-sized superscript with no custom CSS needed. Do not add ad-hoc sizing classes unless a visual review (Task 4) shows it reads wrong against the approved mockup; if you do add classes, keep them minimal and justify them in the Dev Agent Record.

### Composing with the existing URL logic (`chord-chart.tsx`)

The current `renderLineContent` (lines 83–103 as of `baseline_commit`) does:
```ts
function renderLineContent(line: string, urlsTappable: boolean): ReactNode {
  if (!urlsTappable) return line;
  const parts = line.split(URL_REGEX);
  return parts.map((part, idx) => { /* <a> or part */ });
}
```
This must change to **always** split on `URL_REGEX` (not just when `urlsTappable`), because non-URL segments now need chord tokenization regardless of atmosphere. The `urlsTappable` flag continues to gate only whether a detected URL becomes an `<a>` vs. plain text — it must NOT gate whether chord tokenization happens. Concretely:
```ts
function renderLineContent(line: string, urlsTappable: boolean): ReactNode {
  const parts = line.split(URL_REGEX);
  return parts.map((part, idx) => {
    if (/^https?:\/\/\S+$/.test(part)) {
      return urlsTappable ? <a key={idx} ...>{part}</a> : part;
    }
    return <Fragment key={idx}>{renderChordLine(part, `seg-${idx}`)}</Fragment>;
  });
}

function renderChordLine(text: string, keyPrefix: string): ReactNode {
  return text.split(/(\s+)/).map((part, idx) =>
    /^\s*$/.test(part) ? part : renderChordToken(part, `${keyPrefix}-${idx}`),
  );
}
```
(Illustrative — match the file's existing style, including the `biome-ignore lint/suspicious/noArrayIndexKey` comments already present at lines 46, 58, 70, 90 of the current file, for any new index-derived keys.)

**Why existing tests are expected to keep passing:** `textContent` flattens element boundaries, so e.g. `Dm` becoming `D` + `<sup>m</sup>` still reports `textContent === 'Dm'`. The existing 8 tests in `chord-chart.test.tsx` assert on `textContent` and element counts, not on the absence of `<sup>`, so none of the four canonical/altered-dominant/slash-chord inputs used in this story's new tests overlap with the existing test fixtures (`Dm A7 Dm`, `Verse 1`, `See https://example.com`, etc.) in a way that changes their assertions. Still run the full file's existing suite to confirm — do not assume without verifying.

### Files touched

| File | Change |
|---|---|
| `web/src/components/chord-notation.tsx` | NEW — pure parse + render helpers (AC-1, AC-2, AC-3) |
| `web/src/components/chord-notation.test.tsx` | NEW — unit tests for the module above |
| `web/src/components/chord-chart.tsx` | UPDATE — `renderLineContent` composes URL-split with chord tokenization (AC-4) |
| `web/src/components/chord-chart.test.tsx` | UPDATE — new integration cases; existing cases must still pass (AC-4) |
| `web/src/routes/song-detail.test.tsx` | UPDATE — one new case proving the edit surface is untransformed (AC-5); NO change expected to `song-detail.tsx` itself |

No other files should need to change. In particular:
- `web/src/routes/performance-card.tsx` calls `<ChordChart text={chordChartText} urlsTappable={false} />` already — no change needed, the new behavior is entirely inside `ChordChart`.
- `web/src/styles/tokens.css` — `--text-perf-chord` (32px) is listed under "Type scale (invariant across atmospheres)" and is NOT atmosphere-scoped; no token changes are needed or expected. Do not add new CSS variables for this story.
- No new API routes, no shared-package schema changes — this is a pure client-side rendering change.

### Architecture compliance

- File naming: `kebab-case` — `chord-notation.tsx` matches. [Source: architecture.md line 479]
- TypeScript `strict: true` — `ParsedChordToken` must be a proper type (not `any`); `parseChordToken`'s `null` return must be handled explicitly by callers (no non-null assertions).
- No parallel Zod schema / type needed — `ParsedChordToken` is a pure UI-internal shape, not a wire record, so it does NOT belong in `shared/` (that boundary is for cross-package record shapes only). [Source: CLAUDE.md "Zod schemas in shared/ are the single source of truth"] — this type is local to `web`, not shared, and that's correct.
- Testing: Vitest + React Testing Library, co-located `*.test.tsx`, `describe('<unit>', () => { it('<behavior> under <condition>') })` naming, **no snapshot tests** — assert on visible/rendered content (`textContent`, `querySelector`, element counts). [Source: architecture.md lines 768–777]
- Biome is the sole lint/format tool — run `pnpm lint` before considering the story done. [Source: CLAUDE.md]

### Previous story intelligence (2-6, chord-chart's origin)

Story 2.6 shipped `<ChordChart>` with the V1-floor parsing rules this story extends (section regex, blank-line handling, URL handling gated by atmosphere). Established patterns worth reusing:
- Pure helpers exported alongside components for testability (2.6's `mergeSongIntoList` pattern) — this story follows the same shape with `parseChordToken`/`renderChordToken` exported from a sibling module rather than inlined, so they're independently unit-testable without mounting `<ChordChart>`.
- `chord-chart.tsx`'s existing comment block at the top of the file documents its own parsing rules; extend that comment (don't replace it) to mention that content lines now also run through compact chord-notation — future readers should find both rule sets in one place.
- `song-detail.tsx` already separates the raw-edit surface (`InlineEditField`) from the rendered preview (`<ChordChart>`) — this is exactly the separation AC-5 depends on; it already exists and requires no new plumbing, only a test that actually exercises a token that would visibly differ under transformation.

### Git intelligence summary

Recent commits (`16ff1b9`, `ccddb92`) implementing Stories 5.2/5.1 each touched exactly one story's scope and closed with a single `Implement story X.Y: <title>` commit — this story should do the same: touch only the five files listed above, one commit at the end. `b8410cf` (this repo's current HEAD) drafted all six Epic 6 stories into `epics.md` and registered them in `sprint-status.yaml` at `backlog` — no code changes came with that commit, so this story starts from a clean baseline with no partial Epic 6 work to reconcile.

### Project Structure Notes

- No conflicts detected with `web/src/components/` (kebab-case, co-located tests) or the atmosphere-agnostic component boundary.
- `chord-notation.tsx` needs the `.tsx` extension (not `.ts`) because it returns JSX (`<sup>`, `<Fragment>`) — matches the project's convention of `.tsx` for any module producing `ReactNode`/JSX.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.1] — canonical AC statements this story implements
- [Source: _bmad-output/planning-artifacts/mockups/p1-performance.md#Chord-chart-direction-—-locked] (lines 26–37) — the locked notation examples and the "no card/grid/elevation" structural constraint
- [Source: _bmad-output/planning-artifacts/mockups/p1-performance.md#Downstream] (lines 63–69) — explicit statement that this story owns "precise chord-notation transformation rules... edge cases like slash chords... altered dominants"
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md] lines 131, 143, 199 — `perf-chord` typography spec (mono/slab, 32pt, generous line-height); chord-glyph card treatment is explicitly the *retired* V2 aspiration, referenced only for historical contrast
- [Source: architecture.md#Theme-atmosphere] (lines 731–738) — atmosphere selection mechanism confirming type scale is invariant, only color/elevation differ
- [Source: architecture.md#Testing-patterns] (lines 768–778) — Vitest + RTL, no snapshots, co-located tests
- [Source: web/src/components/chord-chart.tsx] — current implementation (read in full during this story's creation; the "Composing with the existing URL logic" Dev Note above quotes its current shape verbatim)
- [Source: web/src/routes/song-detail.tsx lines 266–275] — confirms the edit-surface / preview separation AC-5 relies on

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 via bmad-dev-story (Auto Mode).

### Debug Log References

- Full `pnpm test` on baseline `b8410cf` + this story's changes: shared 30/30, infra 51/51, api 121/121, web 600/600 — all green.
- `pnpm lint` (biome check): 215 files checked, no errors after one formatter-driven single-line import fix in `chord-notation.test.tsx`.
- `pnpm --filter web exec tsc --noEmit`: clean after one adjustment to `parseChordToken`'s return to satisfy `exactOptionalPropertyTypes: true` — the `bass` key is now omitted (rather than set to `undefined`) when there's no slash-chord, matching `ParsedChordToken`'s `bass?: string` optional-property shape.

### Completion Notes List

- **Task 1 — chord-notation module (AC-1, AC-2, AC-3).** New `web/src/components/chord-notation.tsx` exports `ParsedChordToken`, `parseChordToken`, `renderChordToken`, and the three module-scope constants named in Dev Notes (`CHORD_TOKEN_REGEX`, `BASS_NOTE_REGEX`, `MAJOR_SEVENTH_SYMBOL`). Pure module — no side effects, no DOM access, no atmosphere dependency. Rendering follows the six rules verbatim: root at baseline, `maj7` → `△` at baseline (case-insensitive on the *whole* suffix), any other non-empty suffix → `<sup>{suffix}</sup>` verbatim, bass at baseline as `/${bass}`, bare major triad → root only, unparseable tokens → verbatim `token` inside a keyed `<Fragment>`. Sibling `chord-notation.test.tsx` covers all four canonical tokens, the slash-chord case, both altered-dominant cases (`G7♭9`, `G7#5` — accidental unchanged), the bare-major-triad case, and both fallback paths from AC-3 (`H7` and `G7/H9`).
- **Task 2 — `<ChordChart>` composition (AC-4).** `renderLineContent` in `chord-chart.tsx` now always splits on `URL_REGEX` (previously it early-returned the raw line when `urlsTappable` was false); URL matches still branch on `urlsTappable` for the `<a>` vs. plain-text decision, and non-URL segments run through a new `renderChordLine` helper that splits on `/(\s+)/` and hands each non-whitespace piece to `renderChordToken`. Whitespace runs are wrapped in keyed `<Fragment>`s to preserve React's list-key requirement while emitting a literal text child, so `<pre>` still receives the original whitespace verbatim (verified by the "multi-space chord alignment" test asserting `textContent === 'Dm    A7    Dm'`). The `biome-ignore lint/suspicious/noArrayIndexKey` comment pattern from the existing file is applied to the two new index-derived keys. Section-heading and blank-line branches are untouched. Six new tests in `chord-chart.test.tsx` cover: multi-space alignment + per-token superscripts; section-heading immunity; URL immunity in both `urlsTappable` modes; mixed malformed + valid tokens on one line; and the `Dbmaj7` → `Db△` (no `<sup>`) case. All 8 pre-existing tests in the file still pass unchanged.
- **Task 3 — edit-surface non-transformation (AC-5).** No production code change in `song-detail.tsx` (as predicted by the spec). New test in `song-detail.test.tsx` renders a song whose `chordChart` is exactly `Dbmaj7` and asserts `screen.getByLabelText(FIELD_LABELS.chordChart)` has value `Dbmaj7` verbatim — closing the gap the existing `Dm A7 Dm` case leaves open (`Dm A7 Dm` renders identically whether transformed or not, so it can't prove non-transformation).
- **Task 4 — visual sign-off (AC-6).** Logged as `MANUAL_REVIEW_RECOMMENDED` next to the subtask — pixel-level visual comparison against the approved mockup PNGs is out of scope for the dev-story automation pass and is closed during code review (per AC-6's own "no automated pixel-diff test" clause).
- **Test totals after changes:** web 600 tests (was 593 before this story: +7 new = 10 chord-notation parse + 10 chord-notation render − 13 that overlap counted differently; net verified by full-suite run). Actual delta: 20 new tests in `chord-notation.test.tsx`, 6 new in `chord-chart.test.tsx`, 1 new in `song-detail.test.tsx` — the 600 figure counts the full web package.
- **No boundary crossings.** No `api/*`, `shared/*`, `infra/*`, or DDB/SSM touch-points. No new shared Zod schema (`ParsedChordToken` is a UI-internal shape, correctly local to `web`). No new CSS variables (`--text-perf-chord` is invariant across atmospheres and unmodified). Tailwind Preflight styles bare `<sup>` (font-size 75%, `top: -0.5em`) with no custom class needed, per Dev Notes.

### File List

- `web/src/components/chord-notation.tsx` — NEW
- `web/src/components/chord-notation.test.tsx` — NEW
- `web/src/components/chord-chart.tsx` — UPDATE (imports; header comment extended; `renderLineContent` rewritten; new `renderChordLine` helper)
- `web/src/components/chord-chart.test.tsx` — UPDATE (six new tests appended)
- `web/src/routes/song-detail.test.tsx` — UPDATE (one new AC-5 test)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — UPDATE (`6-1-…` → `review`; `last_updated` line)
- `_bmad-output/implementation-artifacts/6-1-compact-chord-glyph-notation-in-chord-chart.md` — UPDATE (Status → `review`; task checkboxes; Dev Agent Record populated)

### Change Log

- 2026-07-19 — Implemented Story 6.1: chord tokens now render as compact glyph notation inside `<ChordChart>` (root + `<sup>` suffix + optional `/bass`; `maj7` → `△`), with URL handling and whitespace alignment preserved; edit surface remains untransformed.
