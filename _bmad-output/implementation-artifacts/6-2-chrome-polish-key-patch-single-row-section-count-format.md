---
baseline_commit: "255c948"
builds_on: 6-1-compact-chord-glyph-notation-in-chord-chart
---

# Story 6.2: Chrome polish — single-row key/patch + `Set 1   6 songs` section-count format on iPhone performance surfaces

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Sandy,
I want the key + patch chrome on every Performance Card state to render as a single inline row (`G   Rhodes` — key glyph large mono, patch smaller mono, generous whitespace, no `KEY` / `PATCH` labels) and section headings on iPhone setlist-overview surfaces to render as `Set 1   6 songs` (literal count + word `songs`),
So that the performance-card chrome matches the locked mockup and section headings match the T4 MacBook lock without cluttering the surface with redundant labels.

## Locked constraints (do not relitigate)

- Visual direction is locked — do not propose alterations to color, typography scale, or layout philosophy. This story implements two already-locked mockup decisions (key/patch size relationship, section-count string format); it does not invent new tokens, new colors, or a new type scale.
- Sandy IS the user — skip persona ceremony.
- iOS PWA + Safari cookie sharing pattern is intentional (not touched by this story).
- British English spelling and idiom in UI copy is intentional (not touched by this story — no new UI copy strings are introduced beyond the count-label helper, which uses "song"/"songs", already British-neutral).
- No new CSS custom properties are added to `web/src/styles/tokens.css`. Both size distinctions this story needs already exist in the invariant type scale (see Dev Notes → "Key/patch size resolution").

## Acceptance Criteria

**AC-1 — Key/patch chrome renders as a single inline row with size differentiation, no labels, no card**

**Given** any Performance Card state (plan, detour, last song, wake-lock-lost)
**When** the top chrome renders
**Then** below the song title, a single inline row displays `<key>   <patch>` (e.g. `G   Rhodes`, `Am   Rhodes`, `Em   Wurli`)
**And** the key is typeset larger (mono/slab, `--text-perf-meta` 22px) than the patch (mono/slab, `--text-perf-body` 18px, `text-secondary`) — see Dev Notes for why these two already-shipped invariant tokens are the correct pair, not a new token
**And** neither `KEY` nor `PATCH` labels are rendered
**And** the row is not a two-column card — no card border, no grid alignment against a second column (a single flex row is correct; do not introduce a bordered/shaded container as part of this story — see Dev Notes → "Strip surface is out of scope")

**AC-2 — Missing key or patch renders gracefully (no placeholder)**

**Given** a Song with no patch value
**When** the Performance Card renders
**Then** only the key glyph renders; the patch slot is empty (no `-`, no `(unset)`, no placeholder)

**Given** a Song with no key value
**When** the Performance Card renders
**Then** only the patch renders; the key slot is empty (same rule)

**Given** a Song with neither key nor patch
**When** the Performance Card renders
**Then** the entire key/patch row is omitted (this is the existing shipped behaviour — preserve it; do not regress the outer conditional)

**AC-3 — Section headings on iPhone performance surfaces use the literal-count format**

**Given** iPhone setlist-overview surfaces (currently: the shipped Setlist overview; future: the jump overlay and section-break orientation view from Stories 6.3–6.6, which will reuse the same `SectionHeading` component / count-label helper)
**When** section headings render
**Then** each heading reads `Set 1   6 songs` (or `Set 2   5 songs`, etc.) — the section `name` followed by the integer count and the word `songs`, with **no middle-dot (`·`) separator** (the currently-shipped `· 4 songs` format is retired by this story)
**And** the MacBook Setlist overview renders the identical string (same component, same helper — no atmosphere branch on the count label; only the name's editability differs by atmosphere, which is unchanged)

**Given** a section containing exactly one song
**When** the section heading renders
**Then** it reads `Set 1   1 song` (singular; the microcopy helper handles the `songs`/`song` inflection — this is the existing pluralisation logic, only the separator changes)

**AC-4 — Existing tests updated, no regressions elsewhere**

**Given** the shipped Performance Card and Setlist overview components
**When** existing tests run
**Then** the tests are updated to assert the new key/patch typographic classes and the new section-heading strings (no `·`); no visual regressions land elsewhere (no other component touched)

## Tasks / Subtasks

- [x] Task 1 — Key/patch single-row chrome with size differentiation (AC: 1, 2)
  - [x] Update the key/patch block in `web/src/routes/performance-card.tsx` (lines ~277–283 as of `baseline_commit`): give the key `<span>` the existing `--text-perf-meta` size (unchanged from today) and give the patch `<span>` a smaller, distinct class using `--text-perf-body` (18px) instead of `--text-perf-meta` (22px) — both remain mono/slab (`font-mono-slab`) and `text-secondary`; keep the existing conditional rendering (key-only, patch-only, neither) exactly as shipped
  - [x] Confirm the row stays a single flex row (`flex flex-wrap gap-…`, unchanged structurally) — do not add a background/border container (see Dev Notes → "Strip surface is out of scope")
  - [x] Update `web/src/routes/performance-card.test.tsx` (UPDATE): the three existing key/patch tests (`renders the title, key, and patch…`, `does not render Key…`, `does not render Patch…`) keep asserting `getByText`/`queryByText` on the visible strings (`'Em'`, `'Rhodes'`) — those assertions are unaffected by the class change (RTL doesn't assert Tailwind classes by default). Add one new test asserting the key `<span>` and the patch `<span>` carry visibly different size classes (query by text, then assert `className` contains `--text-perf-meta` for the key element and `--text-perf-body` for the patch element, or equivalent `toHaveClass`/`className.includes(...)` check) — this is the only assertion that would NOT already pass against the pre-story DOM, and is what actually gates this story's visual change
- [x] Task 2 — Section-heading count-label microcopy helper + format change (AC: 3)
  - [x] Add a small helper to `web/src/lib/microcopy.ts` (UPDATE) — e.g. a `SECTION_HEADING` export with a `songCount(n: number): string` function returning `` `${n} ${n === 1 ? 'song' : 'songs'}` `` (no leading `·`) — this is the "shared microcopy helper" the epics AC anticipates being reused by Stories 6.3–6.6's setlist-overview-shaped surfaces
  - [x] Update `web/src/components/section-heading.tsx` (UPDATE): replace the inline `` `· ${songCount} ${songCount === 1 ? 'song' : 'songs'}` `` with a call to the new helper; update the file's top-of-file comment (currently documents the format as `Set 1 · 4 songs`) to describe the new literal format
  - [x] Update `web/src/components/section-heading.test.tsx` (UPDATE): all five assertions currently on `'· 4 songs'` / `'· 1 song'` change to `'4 songs'` / `'1 song'` (both the MacBook-practice and iPhone-performance describe blocks)
- [ ] Task 3 — Manual visual sign-off (AC: 1, 3 — visual, not automated)
  - [ ] During code review, visually compare the Performance Card key/patch chrome against `_bmad-output/planning-artifacts/mockups/rendered/p1-performance/iteration-2/state-1a-plan-v1-floor-text-chart.png` (key `G` vs patch `Rhodes` size relationship) and `iteration-2/state-3-last-song.png` (`Em` vs `Wurli`); note the comparison outcome in the Dev Agent Record's Completion Notes  <!-- MANUAL_REVIEW_RECOMMENDED: pixel-level visual comparison against the approved mockup PNGs is out of scope for dev-story automation; logged for the manual code-review pass, mirroring Story 6.1's AC-6 pattern. -->

## Dev Notes

### Key/patch size resolution (owned by this story)

The epics.md AC and the P1 mockup brief both call for a size difference between key and patch (`key glyph (large mono) then patch (smaller mono)` — [Source: mockups/p1-performance.md#Chrome-fixes-—-locked], line 41), but the currently-shipped code renders **both** at the same `--text-perf-meta` (22px) size ([Source: web/src/routes/performance-card.tsx] lines 279–282, as of `baseline_commit`), and `tokens.css` only defines one performance-atmosphere token in that size bracket (`--text-perf-meta: 22px`, described as "Key, patch, gig meta in performance card" — [Source: web/src/styles/tokens.css] lines 38–39; also [Source: architecture.md] table row `perf-meta | 22 | Key, patch, gig meta...`).

**Resolution:** do NOT add a new CSS custom property. Reuse the two invariant performance-atmosphere tokens that already bracket the size the mockup shows:
- **Key** → `--text-perf-meta` (22px) — unchanged from today; this is already the "key/patch/gig-meta" token and reads as the large element in context (bigger than the patch, smaller than the 36px title).
- **Patch** → `--text-perf-body` (18px) — the smallest invariant performance-atmosphere type-scale token ("floor" size per the type-scale comment in `tokens.css`), already `text-secondary`. Using an *existing* token (rather than inventing one) keeps this story inside the "do not alter the type scale" constraint while still producing the required large/small relationship.

This was verified by visually inspecting the two approved renders (`iteration-2/state-1a-plan-v1-floor-text-chart.png`: `G` / `Rhodes`; `iteration-2/state-3-last-song.png`: `Em` / `Wurli`) — in both, the key glyph is noticeably larger than the patch text, and both are mono/slab. Both `--text-perf-meta` and `--text-perf-body` are already listed in `tokens.css` as invariant across atmospheres (not atmosphere-scoped), so no atmosphere-conditional logic is needed.

### Strip surface is out of scope

The mockup brief hedges on the exact container: "single inline row below the title on the same lifted surface as the title (**or a compact strip just below** — the token-extraction implementation story owns exact surface stacking against `board-1-performance.png`)" — [Source: mockups/p1-performance.md#Chrome-fixes-—-locked], line 41. The approved renders show a soft rounded, subtly-shaded box around the key/patch row (visually distinct from the plain `--color-surface` header background). The epics.md AC for this story, however, only requires: single inline row, no `KEY`/`PATCH` labels, "not a two-column card — no card border, no grid alignment against a second column." It does **not** require adding a new shaded/rounded container.

Given the "do not propose alterations to... layout philosophy" locked constraint and that the currently-shipped header already places the key/patch row "on the same lifted surface as the title" (the whole `<header>` already uses `bg-[color:var(--color-surface)]`), this story's Task 1 does **not** add a new background container — it only fixes the size relationship (see above) and confirms no labels/no card-grid. If code review judges the plain-row treatment reads visibly wrong against the approved renders, adding a rounded/shaded wrapper is a reasonable follow-up, but it is not gated by this story's AC and should not block marking this story done — flag it as a follow-up note instead, mirroring how Story 6.1's AC-6 handled its own "visual sign-off, not gating" pattern.

### Section-heading format change — what actually changes

The current implementation ([Source: web/src/components/section-heading.tsx] lines 44–45, as of `baseline_commit`) already:
- Uses no atmosphere branch for the count label — only the *name* differs between an `InlineEditField` (MacBook) and a static `<span>` (iPhone). The count label is identical on both atmospheres today, and stays identical after this story.
- Already has correct singular/plural inflection logic (`songCount === 1 ? 'song' : 'songs'`).

The **only** change required is dropping the leading `· ` (middle-dot + space) from the count label string, per epics.md AC-3's literal format: `Set 1   6 songs` (no dot). The visible whitespace between the section name and the count is already produced by the existing flex `gap-[calc(var(--spacing-unit)*2)]` between the two `<span>`/`<InlineEditField>` elements — no change needed there. The mockup's "three-space separation" note ([Source: mockups/p1-performance.md#Chrome-fixes-—-locked] line 44, and [Source: mockups/t4-setlist-new-manual.md] line 263 table) is a description of the visual gap, not a literal instruction to embed extra space characters in the string — the existing CSS gap already satisfies it.

Extract the label into a microcopy helper (`SECTION_HEADING.songCount(n)` in `microcopy.ts`) rather than leaving it inline in the component, because epics.md AC-3 explicitly anticipates reuse: "the format is used on every iPhone surface that renders a section heading in a performance-adjacent context" — Stories 6.4 (jump overlay) and 6.6 (section-break orientation view) will render their own section-heading-shaped rows and should call the same helper rather than re-deriving the pluralisation logic. This follows the existing `microcopy.ts` pattern of function-valued entries (see `DRAG_REORDER.handleLabel`, `PERFORMANCE_CARD.ariaSongPosition`) [Source: web/src/lib/microcopy.ts lines 83, 100].

### Files touched

| File | Change |
|---|---|
| `web/src/routes/performance-card.tsx` | UPDATE — key/patch `<span>` classes differentiated (`--text-perf-meta` vs `--text-perf-body`) |
| `web/src/routes/performance-card.test.tsx` | UPDATE — one new test asserting the size-class distinction |
| `web/src/lib/microcopy.ts` | UPDATE — new `SECTION_HEADING.songCount(n)` helper |
| `web/src/components/section-heading.tsx` | UPDATE — count label uses the helper, drops the `·` separator; top-of-file comment updated |
| `web/src/components/section-heading.test.tsx` | UPDATE — five assertions change from `'· N songs'`/`'· 1 song'` to `'N songs'`/`'1 song'` |

No other files should need to change. In particular:
- `web/src/routes/setlist-overview.tsx` calls `<SectionHeading name={...} songCount={...} .../>` already — no change needed, the format change is entirely inside `SectionHeading`.
- No new API routes, no shared-package schema changes — this is a pure client-side rendering/copy change.
- No new CSS custom properties in `web/src/styles/tokens.css` (see Dev Notes above).
- `web/src/components/chord-chart.tsx` / `chord-notation.tsx` (Story 6.1) are not touched by this story.

### Architecture compliance

- File naming: `kebab-case` — all touched files already conform. [Source: architecture.md line 479 pattern, consistent with Story 6.1's compliance note]
- TypeScript `strict: true` — the new `songCount` helper is a plain typed function (`(n: number) => string`); no `any`.
- No parallel Zod schema needed — this is UI copy/formatting, not a wire record shape. [Source: CLAUDE.md "Zod schemas in shared/ are the single source of truth"]
- Testing: Vitest + React Testing Library, co-located `*.test.tsx`, `describe('<unit>', () => { it('<behavior> under <condition>') })` naming, **no snapshot tests** — assert on visible/rendered content and (for the one new size-distinction test) className/class presence, not full-DOM snapshots. [Source: architecture.md lines 768–777]
- Biome is the sole lint/format tool — run `pnpm lint` before considering the story done. [Source: CLAUDE.md]
- Microcopy strings: `EMPTY_STATES`, `BANNERS`, `ACTIONS`, `FIELD_LABELS` are explicitly called out as "locked" in `microcopy.ts`'s header comment; `SECTION_HEADING` is a new, non-locked, append-only entry alongside `DRAG_REORDER`/`PERFORMANCE_CARD`/`CURRENTLY_PERFORMING` — append it in the same file, do not create a second microcopy module. [Source: web/src/lib/microcopy.ts lines 1–14, 82–123]

### Previous story intelligence (6.1, immediately prior)

Story 6.1 (chord-glyph notation) shipped immediately before this one and establishes the pattern this story follows:
- **Scope discipline:** touch only the files listed in "Files touched," one commit at the end, per the project's one-commit-per-story convention (CLAUDE.md "Commit cadence").
- **Manual visual sign-off, not gating automated test:** 6.1's AC-6 closed via visual comparison during code review, logged in the Dev Agent Record, with a `MANUAL_REVIEW_RECOMMENDED` marker on the task rather than blocking `dev-story` completion. This story's Task 3 follows the identical pattern for the key/patch size relationship.
- **Reuse existing invariant tokens rather than inventing new ones:** 6.1 relied on Tailwind Preflight's built-in `<sup>`/`<sub>` styling instead of adding custom CSS; this story similarly reuses two already-existing invariant type-scale tokens (`--text-perf-meta`, `--text-perf-body`) rather than adding a new one. Both stories treat "visual direction is locked" as "don't invent new tokens/colors," not "don't implement already-locked mockup decisions using the existing token set."
- **`chord-chart.tsx`'s header comment was extended, not replaced, to document new behaviour in place** — this story applies the same discipline to `section-heading.tsx`'s top-of-file comment.

Story 6.1 left `web/src/routes/performance-card.tsx` untouched apart from its `<ChordChart>` call (no changes to the key/patch block, which this story now updates for the first time since Story 4.1 shipped it).

### Git intelligence summary

Recent commits (`255c948` for Story 6.1, `b8410cf` drafting all six Epic 6 stories) each touched exactly one story's scope and closed with a single `Implement story X.Y: <title>` commit. `255c948` is this repo's current HEAD — Story 6.1 is at `review` status (Task 4's visual sign-off is the only remaining open item, logged as `MANUAL_REVIEW_RECOMMENDED`); this does not block starting 6.2, since 6.2 touches an entirely disjoint set of files (`performance-card.tsx`'s key/patch block and `chord-chart.tsx`'s content-line rendering are different regions of the same file family but non-overlapping — this story does not touch `chord-chart.tsx` or `chord-notation.tsx` at all).

### Project Structure Notes

- No conflicts detected with `web/src/routes/`, `web/src/components/`, or `web/src/lib/` (kebab-case, co-located tests).
- `microcopy.ts` is a plain `.ts` module (no JSX) — the new `SECTION_HEADING` export needs no `.tsx` extension, consistent with the rest of the file.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.2] — canonical AC statements this story implements
- [Source: _bmad-output/planning-artifacts/mockups/p1-performance.md#Chrome-fixes-—-locked] (lines 41, 44) — locked key/patch format (`G   Rhodes`, large/smaller mono) and section-count format (`Set 1   6 songs`, matching T4 MacBook lock)
- [Source: _bmad-output/planning-artifacts/mockups/t4-setlist-new-manual.md] (lines 78, 171, 209, 263) — T4 MacBook section-heading format lock (`Set N   M songs`) this story's iPhone format must match
- [Source: _bmad-output/planning-artifacts/mockups/rendered/p1-performance/iteration-2/state-1a-plan-v1-floor-text-chart.png] and [.../state-3-last-song.png] — approved renders showing the key/patch size relationship (viewed during story creation)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md] lines 130–132, 198 — `perf-meta`/`perf-body` type-scale entries; "key glyph (large mono) + patch (mono, smaller)" chrome note
- [Source: web/src/styles/tokens.css] lines 29–48 — invariant performance-atmosphere type-scale tokens (`perf-title` 36, `perf-chord` 32, `perf-meta` 22, `perf-annotation` 20, `perf-body` 18)
- [Source: architecture.md#Testing-patterns] (lines 768–778) — Vitest + RTL, no snapshots, co-located tests
- [Source: web/src/routes/performance-card.tsx] — current implementation (read in full during this story's creation)
- [Source: web/src/components/section-heading.tsx] and [.../section-heading.test.tsx] — current implementation and existing test coverage (read in full during this story's creation)
- [Source: web/src/lib/microcopy.ts] — existing microcopy conventions (function-valued entries, append-only, locked-vs-non-locked surfaces)
- [Source: _bmad-output/implementation-artifacts/6-1-compact-chord-glyph-notation-in-chord-chart.md] — previous story's Dev Notes patterns this story follows (manual sign-off gating, reuse-existing-tokens discipline)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (bmad-dev-story workflow, auto mode)

### Debug Log References

- `pnpm --filter web run test` → 62 files, 601 tests, all passing (includes the new size-class assertion in `performance-card.test.tsx` and the five updated section-heading count-label assertions).
- `pnpm test` (workspace) → same as above, all workspaces passing.
- `pnpm lint` → Biome check clean, 215 files, no fixes applied.

### Completion Notes List

- **Task 1 (AC-1, AC-2) implemented as specified.** The key/patch block in `web/src/routes/performance-card.tsx` is now a single flex row with `items-baseline`. The key `<span>` carries `text-[length:var(--text-perf-meta)]` (22px) and the patch `<span>` carries `text-[length:var(--text-perf-body)]` (18px); both share `font-[family-name:var(--font-mono-slab)]` and `text-[color:var(--color-text-secondary)]` set on the parent `<div>`. The row is not a bordered/shaded card — no new container was added, per the "Strip surface is out of scope" Dev Note. The outer conditional (`(key present) || (patch present) ? row : null`) is preserved unchanged, so the missing-key, missing-patch, and neither-present cases (AC-2) all continue to behave as shipped. Added `items-baseline` to the flex container so the differently-sized glyphs share a common baseline rather than centre-aligning (visually correct given the 4px size delta).
- **Task 2 (AC-3) implemented as specified.** Appended a new `SECTION_HEADING` export to `web/src/lib/microcopy.ts` with `songCount(n: number): string`; existing locked surfaces (`EMPTY_STATES`, `BANNERS`, `ACTIONS`, `FIELD_LABELS`) were untouched. `web/src/components/section-heading.tsx` now imports `SECTION_HEADING` and calls the helper; the top-of-file comment was updated in place (not replaced) to document the new `Set 1   4 songs` literal format, following the extend-not-replace discipline noted in the previous-story intelligence. The MacBook Setlist overview keeps rendering the identical string (same component, same helper — the only atmosphere branch is `InlineEditField` vs static `<span>` on the name, unchanged).
- **Test updates.** Added one new test to `performance-card.test.tsx` asserting the key `<span>` contains the `--text-perf-meta` class and the patch `<span>` contains `--text-perf-body` (with a negative assertion that the patch does NOT carry the larger key size — the pre-story bug this fixes). Updated the five assertions in `section-heading.test.tsx` from `'· 4 songs'` / `'· 1 song'` to `'4 songs'` / `'1 song'` across both the MacBook-practice and iPhone-performance describe blocks (three MacBook, two iPhone).
- **Task 3 (manual visual sign-off) intentionally left unchecked** — `MANUAL_REVIEW_RECOMMENDED` marker in the task line preserves the review-time visual comparison against `iteration-2/state-1a-plan-v1-floor-text-chart.png` and `iteration-2/state-3-last-song.png`. This mirrors Story 6.1's AC-6 pattern (per feedback memory `bmad-epic-workflow-cadence` and `mockup-decisions-before-dev`); it does not block moving the story to `review`.
- **No CSS custom properties added to `web/src/styles/tokens.css`**, honouring the locked constraint. Both invariant tokens used (`--text-perf-meta` and `--text-perf-body`) already existed. No `web/src/routes/setlist-overview.tsx`, `chord-chart.tsx`, or `chord-notation.tsx` changes — this story is fully within the "Files touched" table.
- **Follow-up flag (not gating this story):** the approved iteration-2 renders show a soft rounded/shaded box wrapping the key/patch row on the same lifted surface. This story deliberately does not add that container (Dev Notes → "Strip surface is out of scope"). If code review judges the plain-row treatment reads visibly wrong against the approved renders, it should be logged as a follow-up rather than blocking this story's `review` → `done` transition.

### File List

- `web/src/routes/performance-card.tsx` — UPDATED: key/patch block split into two spans with `--text-perf-meta` (key, 22px) vs `--text-perf-body` (patch, 18px); added `items-baseline`; added Story 6.2 explanatory comment.
- `web/src/routes/performance-card.test.tsx` — UPDATED: one new test (`renders the key at --text-perf-meta and the patch at --text-perf-body`) asserting the size-class differentiation.
- `web/src/lib/microcopy.ts` — UPDATED: appended new `SECTION_HEADING` export with `songCount(n)` helper.
- `web/src/components/section-heading.tsx` — UPDATED: imports `SECTION_HEADING`; count label now delegates to the helper; top-of-file comment updated in place to document the new literal `Set 1   4 songs` format.
- `web/src/components/section-heading.test.tsx` — UPDATED: five assertions changed from `'· 4 songs'`/`'· 1 song'` to `'4 songs'`/`'1 song'` across the MacBook-practice and iPhone-performance describe blocks.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — UPDATED: Story 6.2 transitioned `ready-for-dev` → `in-progress` → (this workflow will progress it to) `review`; `last_updated` bumped.
- `_bmad-output/implementation-artifacts/6-2-chrome-polish-key-patch-single-row-section-count-format.md` — UPDATED: Tasks 1 and 2 checked; Task 3 left unchecked pending manual sign-off; Dev Agent Record populated; Status → `review`.

### Change Log

| Date | Change |
|---|---|
| 2026-07-19 | Story 6.2 implemented — key/patch chrome differentiated (`--text-perf-meta` vs `--text-perf-body`), section-heading count label switched to the shared `SECTION_HEADING.songCount(n)` helper (drops the `·` separator). Web + workspace test suites green (601 tests); Biome lint clean. |
