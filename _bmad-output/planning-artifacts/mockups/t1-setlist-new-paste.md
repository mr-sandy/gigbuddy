---
title: Mockup brief — /setlists/new (T1 — paste-to-parse)
surface: /setlists/new
atmosphere: MacBook practice (warm paper cream, daylight)
journey: T1 — Tuesday-evening paste-to-parse prep
journey-doc: _bmad-output/planning-artifacts/journeys/journey-t1-paste-to-parse-revisit.md
sibling-brief: t4-setlist-new-manual.md (manual-entry path through the same surface — read first)
paste-algorithm-doc: _bmad-output/planning-artifacts/paste-to-parse-design.md (parser + matcher details)
visual-tokens: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md (Practice palette + typography)
experience-spine: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md
status: mockup approved 2026-06-28 (Claude Design composition; audit clean). T1 §2.1 inline split chevron confirmed kept 2026-06-28 after reviewing the State 5 mock — chevron reads as quiet background, doesn't compete with row resolve buttons.
---

# /setlists/new (paste-to-parse) — mockup brief

## Surface

`/setlists/new` — same URL and same base chrome as the T4 manual-entry brief. T1 covers the additional surface that appears when Sandy clicks `Paste a setlist instead ›` and works through the two-phase paste flow.

> **Read `t4-setlist-new-manual.md` first.** Everything outside the paste area — top nav, breadcrumb, gig metadata fields, sticky Save bar, draft indicator — is inherited from T4. This brief specifies only the parts that are new or change during the paste flow.

## Purpose

Tuesday evening. Ivan WhatsApps Sandy the setlist for Saturday's gig. Sandy fills gig metadata, clicks `Paste a setlist instead ›`, pastes the text, reviews the parsed preview, fixes problems in the source text, clicks `Confirm`, then resolves any remaining Fuzzy / Unknown rows, then saves.

The flow has **two distinct phases** separated by a `Confirm` button. Phase A is read-only preview-driven; Phase B is interactive resolution. Both phases live on the same surface.

## States to mock

Five states. All sit on top of the T4 surface; the paste area and the section list are what change.

1. **Phase A — textarea expanded with parsed preview** — Sandy has clicked `Paste a setlist instead ›` and pasted the WhatsApp text. The paste area is expanded showing the textarea, the parsed preview below it (read-only, no resolve actions), and the `Confirm` / `Cancel` buttons.
2. **Phase A — preview row with per-gig annotation** — focus on a single row in the parsed preview showing how an extracted per-gig annotation is displayed beneath the title. Can be a zoomed detail of state 1, or a standalone composition.
3. **Transition — Phase B just entered** — Sandy has clicked `Confirm`. The paste area is gone. The parsed sections now live in the main section list with full creation-phase chrome. Resolve actions on Fuzzy / Unknown rows are now interactive. The `Paste a setlist instead ›` link is also gone (one-shot per T1 §2.5). Sticky Save bar is still disabled because Fuzzy / Unknown rows remain.
4. **Phase B — fully resolved** — Sandy has resolved every Fuzzy / Unknown row. All rows render as `✓ Matched`. Sticky Save bar is enabled.
5. **Phase B — inline `Start a new set here ›` chevron revealed** — focus on a single song row in Phase B with the `Start a new set here ›` affordance visible (on hover/focus). Composition shows how the per-row split affordance reads in context — Sandy may decide post-mockup whether to keep the feature.

## Layout & elements

### Phase A (states 1 + 2) — expanded paste area

The paste area replaces the `Paste a setlist instead ›` link with an expanded panel that sits between the gig metadata and the song list region. Top to bottom inside the panel:

1. **Textarea** at the top. Multi-line, autofocused on expand. Holds Sandy's pasted source text. Editable throughout Phase A. **Height behavior: auto-grow with content up to ~20 visible lines, then internal scroll.** Starts at a sensible minimum (~6 lines) when empty; grows as Sandy pastes/types; caps before consuming so much vertical space that the preview below scrolls off-screen. (A typical paste is ~23 lines — document title + two set headers + a separator + 19 song rows — so the cap will engage on most real pastes. That's intended.)
2. **Parsed preview** below the textarea. Renders the parser's interpretation of the textarea content. **Display-only — no clickable resolve actions appear in Phase A.** Shape:
   - **Section headings** as detected by the parser: `Set 1   N songs`, `Set 2   N songs`, etc. **Section headings are hidden when only one section was parsed** (single implicit or explicit `Set 1`) — the preview shows a flat list of rows with no heading. Same rule as Phase B's T4 §2.2. The single-section case isn't mocked as a separate state; composition is State 1's preview minus the heading and with all rows in one group.
   - **Song rows** under each section (or in the flat list when 1 section). Each row carries a status glyph + label + the canonical title (or pasted title for Unknown):
     - `✓ Matched <canonical title>` with an optional `(was: <paste form>)` caption when the paste differed from the canonical.
     - `? Fuzzy <paste form> → <suggested canonical>`
     - `+ Unknown <paste form>` with `(no match)` caption.
   - **Per-gig annotation preview** appears beneath the row's title when the matcher extracted one. Format: `annotation: <annotation text>`. Display-only in Phase A.
3. **Actions row** at the bottom: a primary `Confirm` button and a secondary `Cancel` link.

The textarea is the source of truth in Phase A. Edits trigger a re-parse after 500ms of typing-idle; the preview refreshes silently.

### Phase B (states 3 + 4) — paste area gone, sections committed

When Sandy clicks `Confirm`:

- The entire paste area (textarea, preview, Confirm/Cancel) disappears.
- The `Paste a setlist instead ›` link is also gone (one-shot per setlist per T1 §2.5).
- The parsed sections + rows appear in the main section list — identical visual to manual sections. Section chrome shows because there are 2+ sections (per T4 §2.2).
- Each song row now carries the same status glyph + label, AND any Fuzzy / Unknown row carries **interactive resolve actions** inline:
  - Fuzzy row: `[Yes, that one]` `[No — new song]`
  - Unknown row: `[+ Add to library]` `[Pick from library]` `[Discard]`
- Matched rows show no actions.
- Per-gig annotations on rows are now **editable inline** (the row's annotation slot is an inline-edit textarea, not display-only). The slot carries a small `annotation` label above the field, matching T3 song-detail's field-label pattern. Label persists whether the field is empty or populated.
- Standard creation-phase chrome is fully active: `+ Add song` under each section, `× Remove section` on each heading, `+ Add set` below the last section, drag-reorder, section rename.
- Sticky Save bar:
  - Disabled in state 3 because Fuzzy / Unknown rows remain.
  - Enabled in state 4 because every row is `✓ Matched`.

## Behaviors (per state)

### State 1 — Phase A with parsed preview (read-only)

- Paste area expanded. Textarea contains the pasted WhatsApp text (full content given below).
- Parser has detected 2 sections (Ivan included a `----` separator) and parsed 19 rows.
- Preview shows:
  - One Unknown document-title row at the top (the `Howlin Wolf - 13 Jun` line — parser doesn't yet have doc-title heuristics).
  - 17 Matched rows.
  - 1 Fuzzy row (`Kelvingrovestreet` → `Kelvingrove Street`).
  - 1 Unknown row (`Fire Eater`).
- All preview rows are display-only — no buttons.
- One row carries an extracted per-gig annotation (`Into The Mystic` with `first dance`) — preview the annotation beneath the row title in display-only form. (This is a partial preview of state 2's focus.)
- `Confirm` button enabled (Confirm can fire with Fuzzy / Unknown rows; their resolution moves to Phase B). `Cancel` link available.

### State 2 — Phase A — per-gig annotation preview detail

This state focuses on the per-gig annotation preview. It can be a zoomed-in slice of state 1's preview, or a small standalone composition. Show:

- One row: `✓ Matched Into The Mystic`
- Annotation beneath: `annotation: first dance`
- Display-only treatment — no edit affordance in Phase A.

Plus a second row to show the multi-token annotation case:

- One row: `? Fuzzy Kelvingrovestreet → Kelvingrove Street`
- Annotation beneath: `annotation: solos – Ivan Ian Clare SANDY John [GUITAR CHANGE]`

The annotation rendering should look distinct from but visually subordinate to the canonical title. Per DESIGN.md "Components" → `Song row (setlist)`: "per-gig annotation as italic serif subline in accent (subtle distinguishment from canonical notes)." Use that treatment for the annotation preview.

### State 3 — Transition — Phase B just entered

- Paste area gone. `Paste a setlist instead ›` link gone.
- Main section list now contains the parsed sections:
  - `Set 1   10 songs` (after Sandy deleted the doc-title line during Phase A, so 10 not 11)
  - `Set 2   8 songs`
- Each section heading carries `× Remove section` affordance.
- `+ Add song` under each section.
- `+ Add set` below `Set 2`.
- Each song row carries its status glyph + label:
  - 17 rows show `✓ Matched <canonical title>`
  - 1 row shows `? Fuzzy Kelvingrovestreet → Kelvingrove Street` with **interactive** `[Yes, that one]` `[No — new song]` buttons.
  - 1 row shows `+ Unknown Fire Eater` with **interactive** `[+ Add to library]` `[Pick from library]` `[Discard]` buttons. `Pick from library` opens a SongSearchRow-shaped type-ahead picker — composition is the SongSearchRow mock in `t4-setlist-new-manual.md` states 6 + 7 (same input shape, same 8-result cap, same `+ Add to library` action available, same Enter/Escape behavior). The picker is summoned from the Unknown-row context but renders identically to the manual-entry context.
- The `Into The Mystic` row carries an editable annotation field showing `first dance` (the annotation extracted in Phase A, now editable).
- Sticky Save bar disabled. Save-blocked explainer reads `Resolve Fuzzy and Unknown rows to save.` (Venue + Date are filled by this point, so the Venue/Date string doesn't apply here.)

### State 4 — Phase B — fully resolved

- Same layout as state 3, but every row is now `✓ Matched`.
- The Kelvingrove row reads `✓ Matched Kelvingrove Street` (Sandy clicked `Yes, that one`). The pasted form caption `(was: Kelvingrovestreet)` should render in quiet treatment beneath the canonical title.
- The Fire Eater row reads `✓ Matched Fire Eater` (Sandy clicked `+ Add to library`; song minted).
- No remaining inline resolve buttons anywhere.
- The `Into The Mystic` annotation field is still present and editable; show `first dance` as its content.
- Sticky Save bar enabled.

### State 5 — Phase B — inline `Start a new set here ›` chevron revealed

Focused composition showing the per-row split affordance from T1 §2.1. Sandy hovers over a song row mid-section; the `Start a new set here ›` chevron appears on the row (chevron on hover or focus per the journey doc).

Composition:

- Show a slice of `Set 1` from state 4 — roughly rows 5–8 in their `✓ Matched` form. Section heading `Set 1   10 songs` visible above.
- Use row 6 (`Watermelon Man`) as the hovered row. The `Start a new set here ›` affordance is revealed on that row — chevron + label, positioned at the right edge of the row or as a subline beneath the title (designer's call; the journey doc says "chevron, on hover or on focus" without pinning position).
- The other visible rows (5, 7, 8) do not show the affordance — only the hovered/focused row does.
- Treatment should be quiet — the affordance is a backup mechanism, not a primary action. Reads less prominent than the `[Yes, that one]` / `[+ Add to library]` resolve buttons in state 3.

Why this matters as a mock: the chevron is one of the affordances per row, and per-row hover chrome compounds quickly. The mock answers "does this read as background or as noise?" Sandy may keep, drop, or rethink based on the composed result.

What clicking does (not part of the static mock, but for designer context): splits the section at the clicked row. Set 1 collapses to 5 songs (rows 1–5); a new Set 2 appears starting with the clicked row (now rows 1–5 of the new section). All other Phase B chrome continues to apply on the new section.

## Content for the mock

### Gig metadata (states 1–4)

Same as T4:

| Field | Value |
|---|---|
| Venue | `Howlin Wolf` |
| Date | `Sat 13 Jun 2026` |
| Time | `9:00 PM` |

### Paste textarea content (states 1–2)

Sandy's pasted WhatsApp message from Ivan. Use this exact block in the textarea:

```
Howlin Wolf - 13 Jun
Set 1
Into The Mystic [first dance]
Comin' Home Baby
Mas Que Nada
Move on Up
Watermelon Man
Cantaloupe Island
Trouble Man
Sunny
In and Out
Almost Like Being In Love
----
Set 2
Move on Up
Kelvingrovestreet – solos – Ivan Ian Clare SANDY John [GUITAR CHANGE]
Fire Eater
Into The Mystic
Comin' Home Baby
Watermelon Man
Mas Que Nada
Trouble Man
```

(The doubled-up song titles across Set 1 / Set 2 are realistic — bands repeat from time to time. The `Almost Like Being In Love` row is illustrative-only; if the documented library is preferred-strict, the designer may swap it for any documented title.)

### Parsed-preview rows (state 1)

Eleven rows in `Set 1`:

| # | Glyph | Display |
|---|---|---|
| 1 | `+` | `+ Unknown Howlin Wolf - 13 Jun  (no match)` |
| 2 | `✓` | `✓ Matched Into The Mystic`  · annotation: `first dance` |
| 3 | `✓` | `✓ Matched Comin' Home Baby` |
| 4 | `✓` | `✓ Matched Mas Que Nada` |
| 5 | `✓` | `✓ Matched Move on Up` |
| 6 | `✓` | `✓ Matched Watermelon Man` |
| 7 | `✓` | `✓ Matched Cantaloupe Island` |
| 8 | `✓` | `✓ Matched Trouble Man` |
| 9 | `✓` | `✓ Matched Sunny` |
| 10 | `✓` | `✓ Matched In and Out` |
| 11 | `✓` | `✓ Matched Almost Like Being In Love` |

Eight rows in `Set 2`:

| # | Glyph | Display |
|---|---|---|
| 1 | `✓` | `✓ Matched Move on Up` |
| 2 | `?` | `? Fuzzy Kelvingrovestreet → Kelvingrove Street`  · annotation: `solos – Ivan Ian Clare SANDY John [GUITAR CHANGE]` |
| 3 | `+` | `+ Unknown Fire Eater  (no match)` |
| 4 | `✓` | `✓ Matched Into The Mystic` |
| 5 | `✓` | `✓ Matched Comin' Home Baby` |
| 6 | `✓` | `✓ Matched Watermelon Man` |
| 7 | `✓` | `✓ Matched Mas Que Nada` |
| 8 | `✓` | `✓ Matched Trouble Man` |

Section heading counts in the Phase A preview: `Set 1   11 songs`, `Set 2   8 songs` (the doc-title row counts in Phase A — it's still a parsed row until Sandy deletes it from the source text).

### Phase B rows (state 3)

Sandy deleted the `Howlin Wolf - 13 Jun` row from the textarea during Phase A, so the section counts after Confirm are:

- `Set 1   10 songs` (the 10 song rows above, no document-title row).
- `Set 2   8 songs`.

State 3 should show:

- `Set 1` rows 2–11 from the state 1 table (now labelled 1–10).
- `Set 2` rows 1–8 from the state 1 table.
- The Fuzzy row (Kelvingrove) carries interactive `[Yes, that one]` `[No — new song]` buttons.
- The Unknown row (Fire Eater) carries interactive `[+ Add to library]` `[Pick from library]` `[Discard]` buttons.
- `Into The Mystic` row carries an editable annotation field with `first dance` as content.
- `Kelvingrovestreet` row carries an editable annotation field with `solos – Ivan Ian Clare SANDY John [GUITAR CHANGE]` as content.

### Phase B fully resolved (state 4)

Same row inventory as state 3, but:

- Kelvingrove row reads `✓ Matched Kelvingrove Street` with `(was: Kelvingrovestreet)` caption.
- Fire Eater row reads `✓ Matched Fire Eater` (just minted; no `was:` caption since the paste form matched the new canonical exactly).
- All resolve action buttons gone.

## Microcopy (final strings)

| Element | String |
|---|---|
| Paste affordance (collapsed) | `Paste a setlist instead ›` |
| Phase A `Confirm` button | `Confirm` |
| Phase A `Cancel` link | `Cancel` |
| Matched-row glyph + label | `✓ Matched` |
| Fuzzy-row glyph + label | `? Fuzzy` |
| Unknown-row glyph + label | `+ Unknown` |
| Was-caption format (Matched, when paste differed) | `(was: <paste form>)` |
| Fuzzy suggestion separator | `→` (with surrounding spaces) |
| Unknown caption | `(no match)` |
| Per-gig annotation prefix (Phase A) | `annotation:` (inline display caption beneath the row) |
| Per-gig annotation label (Phase B) | `annotation` (small field label above the inline-edit field; no colon — matches T3 song-detail label pattern) |
| Fuzzy actions | `Yes, that one` · `No — new song` |
| Unknown actions | `+ Add to library` · `Pick from library` · `Discard` |
| Save button | `Save` |
| Inline split affordance (T1 §2.1) | `Start a new set here ›` (chevron + label, revealed on row hover/focus in Phase B) |

Per voice rules (EXPERIENCE.md): no exclamation marks, no encouragement.

## Locked constraints (composition rules)

From T1 §2 and the algorithm doc:

- **Two-phase model.** Phase A textarea + read-only preview + Confirm/Cancel; Phase B textarea gone + interactive resolve actions. (T1 §2.5)
- **`Confirm` button is the only path from Phase A to Phase B.** No auto-collapse, no implicit transitions. (T1 §2.6)
- **Phase A re-parses 500ms after typing-idle.** Sandy fixes parse problems by editing the textarea, not by clicking buttons. (T1 §2.5)
- **Multi-paste is one-shot per setlist on Confirm only.** After Confirm, the `Paste a setlist instead ›` link is gone. After Cancel, the link reappears — Cancel is reversible. (T1 §2.5, clarified 2026-06-27)
- **All row controls are display-only in Phase A.** No `Yes, that one`, `+ Add to library`, etc. appears until Phase B. (T1 §2.5)
- **Phase B carries full creation-phase chrome.** `+ Add song`, `× Remove section`, `+ Add set`, drag-reorder per T4 §2.4. Parsed sections are visually indistinguishable from manual sections after Confirm. (T1 §2.5)
- **Single-section parse renders chromeless in both phases.** When the parser detected only one section (implicit or explicit), Phase A's preview shows a flat list with no heading; Phase B's main list also shows a flat list per T4 §2.2. This matches the manual-entry rule and keeps composition consistent across paste and manual paths.
- **Per-gig annotation extraction.** Stripped noise-tokens populate `perGigAnnotation` at parse time. Previewed in Phase A, editable in Phase B. (T1 §2.4)
- **`(was: <paste form>)` caption only when the canonical differs from the pasted form.** (paste-to-parse-design.md §3)
- **Color is never the only signal.** Each row state combines glyph (`✓` / `?` / `+`) + label (`Matched` / `Fuzzy` / `Unknown`) + color. (EXPERIENCE.md, DESIGN.md)
- **Save gating.** Disabled while any Fuzzy or Unknown row remains, OR Venue / Date empty. (Existing AC + T4 §2.6.)

## Visual tokens

Use the **Practice atmosphere** from DESIGN.md, with the `attention-fuzzy` and `attention-unknown` tokens for the parse-row states:

- Matched rows: quiet treatment, `text-secondary`.
- Fuzzy rows: amber dot, `attention-fuzzy` background or accent.
- Unknown rows: red dot, `attention-unknown` background or accent.
- Per-gig annotation rendering: italic serif subline in `accent` per DESIGN.md `Song row (setlist)` component spec.
- Section headings: as per `t4-setlist-new-manual.md` brief.
- Sticky Save bar: as per T4 brief.

Per DESIGN.md "Don'ts": no exclamation marks, no marketing voice, no shadows over 4pt, no animations longer than 150ms.

## Out of scope for this surface

- Phase A multi-candidate fuzzy (top-3 picker) — V2.
- Pre-paste source cleaning (auto-Discard headers, auto-strip key/tempo lines) — V2.
- Smart annotation routing (e.g. extract player names → `players` field) — V2; this brief uses the locked "single concatenated annotation string" model.
- Multi-paste post-Confirm (paste another fragment into the same setlist) — V1 one-shot.
- Undo on Discard / Add to library / Yes-that-one — T1 §2.8 leans status quo; not designed.
- iPhone paste — confirmed out for V1.
- Side-by-side textarea + preview layout — the locked composition is **stacked** (textarea above, preview below) per T1 §1 Frame 4 ASCII; if a side-by-side variant were preferred it would be a deviation requiring a journey-doc update.
- Drag-reorder visual state on parsed sections — drag works in Phase B per T4 §2.4 (parsed sections behave identically to manual sections after Confirm), but the drag mockup is in `t4-setlist-new-manual.md` states 8 + 9. The visual treatment carries over unchanged; no T1-specific drag mockup needed. Also locked there: no visible drag handle on song rows.

## Source-doc cross-references

- T1 §1 Frames 3–6 (storyboard for the paste flow).
- T1 §2.1 (inline `Start a new set here ›` — locked but not in this mockup).
- T1 §2.4 (annotation capture).
- T1 §2.5 + §2.6 (two-phase model + Confirm transition).
- T1 §3 (edge cases — empty paste, no-section paste, document-title rows).
- paste-to-parse-design.md §1 (section detection patterns).
- paste-to-parse-design.md §3 (resolution UX — `Matched` / `Fuzzy` / `Unknown` row specs).
- EXPERIENCE.md "State Patterns" → Parsed row treatments.
- DESIGN.md "Components" → `Parse-row status` (states + visual rules).

## Open micro-questions surfaced by this brief

These need a quick lock before handoff:

1. ~~**`annotation:` prefix in Phase B.**~~ **Locked 2026-06-27 to small `annotation` label above the field** (no colon — matches T3 song-detail field-label pattern). Persists whether the field is empty or populated.
2. ~~**Save-blocked explainer.**~~ **Locked 2026-06-27 to yes — one-line reason.** T1-specific string: `Resolve Fuzzy and Unknown rows to save.` (Venue/Date string from T4 applies if those fields are empty.) See T4 brief microcopy table.
3. ~~**Phase A textarea height.**~~ **Locked 2026-06-27 to auto-grow up to ~20 visible lines, then internal scroll.** Starts at a ~6-line minimum when empty. Cap chosen so the preview below stays visible on typical pastes (~23 lines including headers/separator).
4. ~~**`Paste a setlist instead ›` post-Cancel.**~~ **Locked 2026-06-27: link reappears after Cancel** (Cancel is reversible; only Confirm makes paste one-shot). Journey doc T1 §2.5 updated for consistency.
