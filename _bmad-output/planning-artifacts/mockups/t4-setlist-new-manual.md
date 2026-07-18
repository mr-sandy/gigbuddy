---
title: Mockup brief — /setlists/new (T4 — manual entry)
surface: /setlists/new
atmosphere: MacBook practice (warm paper cream, daylight)
journey: T4 — Create a new setlist from scratch (manual entry, no paste)
journey-doc: _bmad-output/planning-artifacts/journeys/journey-t4-new-setlist-from-scratch.md
sibling-brief: t1-setlist-new-paste.md (paste-to-parse path through the same surface)
visual-tokens: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md (Practice palette + typography)
experience-spine: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md
status: mockup approved 2026-06-28 (Claude Design composition; audit clean except minor composition precision on States 8/9 drag positioning — concept correct, no constraint violations)
---

# /setlists/new (manual entry) — mockup brief

## Surface

`/setlists/new` — the unified setlist-creation surface for the manual-entry path. Sandy fills gig metadata, picks songs from the library one at a time, optionally splits into sets, and saves. Same URL hosts the paste-to-parse path (T1 — separate brief).

## Purpose

Sandy is putting together a setlist for an upcoming gig with no pasted source. He types the venue and date, picks songs via type-ahead one at a time, optionally splits into sets, and saves. Draft persists across navigation and tab close.

## States to mock

Nine states. All on the same surface; the page region between gig metadata and the sticky Save bar evolves as Sandy works.

1. **Fresh** — page just opened. Gig metadata fields empty. No songs. `+ Add song`, `+ Add set`. Sticky Save bar visible but disabled. Top-right badge reads `Unsaved draft`.
2. **Flat song list** — Sandy has filled gig metadata and added several songs. Single implicit section; **no section chrome rendered**. Just a flat list of song rows.
3. **Multi-section** — Sandy has clicked `+ Add set`. `Set 1` and `Set 2` headings now appear with `× Remove section` affordances. Songs from the flat list now sit under `Set 1`; `Set 2` may contain songs of its own.
4. **Remove-section confirm** — Sandy clicked `×` on a section that contains songs. An in-context confirm line replaces the row (not a modal). `Yes, remove` / `Cancel` actions.
5. **Draft-saved indicator** — focus on the top-right badge transition. Three sub-states to render side-by-side or as a small filmstrip: `Unsaved draft` (fresh) → `Draft saved just now` (immediately after first debounced save) → `Draft saved 4 minutes ago` (later).
6. **SongSearchRow — type-ahead open** — Sandy clicked `+ Add song`; the button is replaced by an autofocused search input with type-ahead matches listed below.
7. **SongSearchRow — `+ Add to library: <query>`** — Sandy typed a query with no matches; the picker shows the mint affordance instead of type-ahead matches.
8. **Within-section drag-reorder** — Sandy is dragging a song row within `Set 1` from the bottom of the section up toward the top. The lifted row, the originating gap, and the drop indicator at the target position are all visible.
9. **Cross-section drag-reorder** — Sandy is dragging a song row from `Set 1` down into `Set 2`. The lifted row visually crosses the section boundary; the drop indicator sits inside `Set 2` at the target position.

## Layout & elements

Top to bottom, single column.

1. **Top nav** — same as every MacBook surface: left `GigBuddy · The Jack Ruby 5`, right `Setlists · Library · + New setlist`. `+ New setlist` is the current page and renders in `accent`; `Setlists` and `Library` render in `text-primary`. (Top-nav active-state rule: DESIGN.md `Top nav (MacBook)` component spec.)
2. **Page header row.**
   - Left: breadcrumb `‹ Setlists · New setlist`. The `‹ Setlists` segment is the click target.
   - Right: draft indicator. See state 5 for values.
3. **Gig metadata fields**, stacked, each preceded by its label:
   - `Venue` — single-line text input.
   - `Date` — date input.
   - `Time (optional)` — time input. The `(optional)` is part of the label.
4. **`Paste a setlist instead ›` link** — single line, positioned between gig metadata and the song list region. Click expands the T1 paste area in place (out of scope for this brief — covered in `t1-setlist-new-paste.md`).
5. **Song list region** — the variable part of the page. Contents depend on state (see below).
6. **`+ Add set` button** — sits below the song list region, before the sticky Save bar.
7. **Sticky Save bar** — fixed at the bottom of the viewport above the form content. Single `Save` button, full bar treatment. Disabled state when validation fails (Venue empty or Date empty). When disabled, a one-line **save-blocked explainer** sits near the button (positioning left to the designer — above the button, beside it, or inside the bar). Copy: `Venue and Date required to save.`

## Behaviors (per state)

### State 1 — Fresh

- Gig metadata fields empty (placeholders visible).
- Song list region empty; only `+ Add song` button visible inside it.
- `+ Add set` button below.
- Sticky Save bar present, button visually disabled. Save-blocked explainer reads `Venue and Date required to save.`
- Draft indicator: `Unsaved draft`.

### State 2 — Flat song list

- Gig metadata filled with the example content below.
- Song list region shows a flat vertical list of song rows. **No section heading. No section count. No section chrome of any kind.**
- Each song row shows the canonical song title and a `×` remove affordance at the right edge.
- `+ Add song` button sits below the song list, still inside the song region.
- `+ Add set` below that.
- Draft indicator: `Draft saved just now` (or a similar recent state).
- Save bar still disabled (gating depends on validation — Venue + Date present is the only manual-entry gate; once those land Save is enabled regardless of song count, since FR-6 allows an empty setlist).

### State 3 — Multi-section

- Same gig metadata as State 2.
- Song list region now shows section chrome.
- Section heading format: `Set 1   8 songs` with a `×` (Remove section) affordance at the right. The section name is inline-renameable (no separate edit affordance; click into the heading to focus).
- Songs from the previously-flat list now appear under `Set 1`.
- A `+ Add song` button sits at the bottom of each section.
- A second heading `Set 2   0 songs` appears below `Set 1` with its own `× Remove section` and `+ Add song`.
- (Optional richer mock: show `Set 2` populated with a few songs to demonstrate the populated heading count `Set 2   3 songs`.)
- `+ Add set` button moves to below `Set 2`.

### State 4 — Remove-section confirm

- Builds on State 3.
- One section heading's `×` was clicked **on a section that contains songs**. In place of the section row (or directly beneath it — pick the composition that reads cleanest), a confirm line appears:
  - Copy: `Remove Set 2 and its 4 songs?`
  - Actions: `Yes, remove` and `Cancel`, both inline.
- The confirm is **not a modal**, not a popover, not a dialog. It is an in-context inline element that pushes the rest of the page down by its own height while it's present.
- The rest of the page is interactive throughout (page is not disabled).

**Empty-section case (no separate mock):** clicking `×` on a section with zero songs removes the section instantly — no confirm line, no transient state. The section just disappears. This case isn't mocked because the static composition is identical to "after-removal" — there's nothing to see beyond the absence of the section.

### State 5 — Draft-saved indicator

- Focus on the top-right of the header row. Three values, to be rendered side-by-side or as a small comparison:
  1. `Unsaved draft` — fresh page, no edits yet.
  2. `Draft saved just now` — first debounced save just flushed.
  3. `Draft saved 4 minutes ago` — relative-time bucket, same schedule as T3 §2.6.
- The badge text changes; no other animation, no toast, no flash.

### State 6 — SongSearchRow — type-ahead open

- Sandy clicked `+ Add song`. The button is replaced by a single-row picker:
  - Autofocused text input. Placeholder copy: `Search library`.
  - Type-ahead results listed below the input. Use up to 8 results visible (8-result cap is the build behavior).
  - Each result is a single line of canonical song title.
  - On click of a result: the picker closes, the song is appended to the section, `+ Add song` returns below it.
  - Keyboard: arrow keys navigate, Enter selects the highlighted result, Escape closes the picker.
- Visual treatment of the input shape: **the picker input reuses the same shape as `/library`'s filter input.** This is the unification locked in T4 §2.9.

### State 7 — SongSearchRow — `+ Add to library: <query>`

- Same input as State 6, but the query string has no library matches.
- In place of the type-ahead results, a single action row appears: `+ Add to library: <query>` where `<query>` is the typed string.
- Click → song is minted into the library with title only, then appended to the section. No "edit details first" gate.
- The action also exists when there are partial matches; the picker shows both the matches and the `+ Add to library` action together if the query has no exact (case-insensitive) match in the library. For this mockup, render the no-matches variant — clean single action.

### State 8 — Within-section drag-reorder

- Builds on State 3, but `Set 1` now has **9 songs** instead of 8: Sandy has just appended `Sunny` via `+ Add song` at the bottom of the section, realising it was missing.
- He now drags `Sunny` from position 9 up to between position 2 (`Comin' Home Baby`) and position 3 (`Mas Que Nada`). The mockup captures the mid-drag moment.
- Visible composition:
  - **Lifted row** — `Sunny` rendered in a lifted/floating treatment near the pointer location (somewhere between position 9 and the destination). The lifted row may visually detach from the section, sit slightly elevated, or be rendered with reduced opacity — the downstream tool composes the lift treatment.
  - **Originating gap** — the slot at position 9 of `Set 1` where `Sunny` was lifted from. May render as a compressed gap or be backfilled visually; either is fine.
  - **Drop indicator** — a horizontal cue between current positions 2 and 3 of `Set 1` (between `Comin' Home Baby` and `Mas Que Nada`) showing where `Sunny` will land on release.
- No drag handle anywhere — the row itself is the drag affordance (see locked constraint below).
- `Set 2` (3 songs) visible below `Set 1` for context — unchanged in this state.
- Sticky Save bar visible, enabled state (Venue + Date filled).

### State 9 — Cross-section drag-reorder

- Builds on State 3 (8 songs in `Set 1`, 3 in `Set 2`).
- Sandy drags `Trouble Man` from position 8 of `Set 1` down into `Set 2`, landing between position 1 (`Sunny`) and position 2 (`In and Out`).
- Visible composition:
  - **Lifted row** — `Trouble Man` rendered in the lifted/floating treatment near the pointer, with the pointer somewhere over `Set 2`'s top area. The lifted row visually crosses the section boundary between `Set 1` and `Set 2`.
  - **Originating gap** — position 8 of `Set 1` rendered as a compressed gap or backfilled — designer's call.
  - **Drop indicator** — a horizontal cue inside `Set 2` between `Sunny` (position 1) and `In and Out` (position 2).
  - The destination section's heading (`Set 2   3 songs`) is visible above the drop indicator; the count badge does NOT pre-update during the drag (still reads `3 songs`).
- The section boundary between `Set 1` and `Set 2` is clearly visible in the composition — the value of this state is showing that drag works **across** sections, not just within.
- No drag handle anywhere.
- Sticky Save bar visible, enabled.

## Content for the mock

### Gig metadata (used in states 2–5)

| Field | Value |
|---|---|
| Venue | `Howlin Wolf` |
| Date | `Sat 13 Jun 2026` |
| Time | `9:00 PM` |

### Flat song list (state 2 — 8 songs)

In order:

1. `Into The Mystic`
2. `Comin' Home Baby`
3. `Mas Que Nada`
4. `Move on Up`
5. `Kelvingrove Street`
6. `Watermelon Man`
7. `Cantaloupe Island`
8. `Trouble Man`

### Multi-section (state 3)

`Set 1   8 songs` — the eight songs above, in the same order.

`Set 2   3 songs`:

1. `Sunny`
2. `In and Out`
3. `Fire Eater`

(All song titles drawn from documented examples in EXPERIENCE.md / paste-to-parse-design.md / journey docs.)

### Remove-section confirm (state 4)

Confirm line attached to `Set 2`:

`Remove Set 2 and its 3 songs?`   `Yes, remove`   `Cancel`

(Note: 3 songs in this brief's example, not 4 — matches the populated `Set 2` count above.)

### SongSearchRow — type-ahead (state 6)

Query: `into`

Results:

1. `Into The Mystic`

(The library in this mock contains only one `into…` title. To show a richer type-ahead with multiple results, the designer can add additional matches drawn from the documented song set — e.g., `In and Out` does not start with `into` so it wouldn't match. If a richer mock is needed, swap the query to `mas` to show `Mas Que Nada` alone or to a 2-char query like `co` to surface `Comin' Home Baby` + `Cantaloupe Island`. Pick what reads cleanest.)

### SongSearchRow — `+ Add to library: <query>` (state 7)

Query: `fire eater` (a song not yet in the library at the time of this picker open — this is the mint-mid-flow case from T4 Frame 5).

Action row: `+ Add to library: Fire Eater`

(Title case applied to the mint affordance — the live build does this; confirm with implementation if uncertain.)

### Within-section drag-reorder (state 8)

`Set 1   9 songs` — same as state 3's Set 1 plus `Sunny` appended at position 9:

1. `Into The Mystic`
2. `Comin' Home Baby`
3. `Mas Que Nada`
4. `Move on Up`
5. `Kelvingrove Street`
6. `Watermelon Man`
7. `Cantaloupe Island`
8. `Trouble Man`
9. `Sunny` ← being dragged

Drag target: between rows 2 (`Comin' Home Baby`) and 3 (`Mas Que Nada`).

`Set 2   3 songs` visible below — unchanged content (`Sunny`, `In and Out`, `Fire Eater`).

(The `Sunny` duplicate across Set 1 and Set 2 is realistic for the in-flight moment — Sandy just appended Sunny to Set 1 without first removing it from Set 2. Either state is OK for the mock; if visual cleanliness is preferred, drop Sunny from Set 2 for this state and show Set 2 with `In and Out`, `Fire Eater` as a 2-song section.)

### Cross-section drag-reorder (state 9)

Same baseline as state 3:

`Set 1   8 songs`:

1. `Into The Mystic`
2. `Comin' Home Baby`
3. `Mas Que Nada`
4. `Move on Up`
5. `Kelvingrove Street`
6. `Watermelon Man`
7. `Cantaloupe Island`
8. `Trouble Man` ← being dragged

`Set 2   3 songs`:

1. `Sunny`
2. `In and Out`
3. `Fire Eater`

Drag target: inside `Set 2`, between rows 1 (`Sunny`) and 2 (`In and Out`).

The `Set 2   3 songs` count badge does NOT pre-update during the drag — still reads `3 songs`.

## Microcopy (final strings)

| Element | String |
|---|---|
| Breadcrumb | `‹ Setlists · New setlist` |
| Draft indicator (fresh) | `Unsaved draft` |
| Draft indicator (after save) | `Draft saved just now` / `Draft saved N minutes ago` / `Draft saved N hours ago` / `Draft saved yesterday` |
| Gig metadata labels | `Venue` · `Date` · `Time (optional)` |
| Paste affordance | `Paste a setlist instead ›` |
| Add-song button | `+ Add song` |
| Add-set button | `+ Add set` |
| Section heading format | `Set N   M songs` (the count uses three-space separation in the locked layout; designer may interpret) |
| Remove-section affordance | `×` glyph on the section heading row |
| Remove-section confirm copy | `Remove <Section name> and its <M> songs?` |
| Remove-section confirm actions | `Yes, remove` · `Cancel` |
| Save button | `Save` |
| Save-blocked explainer (Venue/Date empty) | `Venue and Date required to save.` |
| Save-blocked explainer (T1 paste rows pending) | `Resolve Fuzzy and Unknown rows to save.` |
| Search input placeholder (SongSearchRow) | `Search library` |
| Mint-from-search affordance | `+ Add to library: <query>` (query echoed verbatim; case as typed) |
| Row remove affordance | `×` glyph on the song row right edge |

Per voice rules (EXPERIENCE.md): no exclamation marks, no encouragement, short complete sentences.

## Locked constraints (composition rules)

From T4 §2 — non-negotiable:

- **Section chrome only appears when 2+ sections exist.** Single implicit section renders as a flat list with no heading. (T4 §2.2)
- **`Paste a setlist instead ›` is the only paste affordance.** No textarea visible by default. The paste textarea expands in-place on click (covered in `t1-setlist-new-paste.md`). (T4 §2.1)
- **`× Remove section` confirm is inline, not modal.** Confirm fires only when the section contains songs; empty sections remove instantly with no confirm. (T4 §2.3)
- **`+ Add song` is append-only.** No insert-between affordance on the picker. Reordering happens via drag. (T4 §2.4)
- **Drag-reorder works within a section and across sections** during creation. (T4 §2.4, revised 2026-06-26)
- **No visible drag handle on song rows.** The row itself is the drag affordance — there is no grip glyph, no hover-revealed handle, no chevron. This is a deliberate deviation from DESIGN.md's `Song row (setlist)` component spec which reads "MacBook: drag-handle icon visible on row hover" — locked 2026-06-27 by Sandy.
- **Draft persists to localStorage; indicator at top-right of the header row.** (T4 §2.5, §2.8)
- **Sticky Save bar at the bottom of the viewport.** Always visible. Disabled state when Venue or Date is empty. (T4 §2.6)
- **Breadcrumb `‹ Setlists · New setlist`** at top-left. Fixed back target — creation pages have no prior state to restore. (T4 §2.7)
- **SongSearchRow input shape is visually unified with `/library`'s filter input.** Behaviors differ (8-result cap, autofocus, `+ Add to library`, Enter/Escape) but the visual shape is the same. (T4 §2.9)
- **No completeness cue on minted songs.** Songs minted via `+ Add to library` render identically to populated rows. (T4 §2.10)

## Visual tokens

Use the **Practice atmosphere** from DESIGN.md:

- Palette: warm paper cream background, warm-dark ink, deeper amber accent (Practice tokens).
- Type: editorial serif for song titles, section headings, gig metadata labels, breadcrumb. Mono/slab is not used on this surface (no chord glyphs here).
- Type scale: practice-body 17pt floor; section-heading 22pt per DESIGN.md.
- Spacing: 4pt base unit; `section-gap` between major regions (gig metadata / song list / save bar).
- Page bounds: MacBook content max-width ~960pt, centered, with whitespace generous enough that the page breathes.
- Single-column vertical stack.

The sticky Save bar's visual treatment should match the "iPhone `Start performance ›` precedent" referenced in T4 §2.6 — a full-width bottom bar with the action centered/prominent — adapted to practice atmosphere (cream surface, deeper amber accent on the button).

## Out of scope for this surface

- The paste-to-parse path — covered in `t1-setlist-new-paste.md`.
- Setlist overview (post-Save state) — separate journey, separate brief if needed.
- Cloning an existing setlist as the starting point (V2).
- Setlist templates (V2).
- Section reorder (V2; rejected in T4 §2.3).
- Per-song annotation editing (lives on setlist overview, not creation).
- Cmd-S override (T4 §3 edge case — deferred).
- Multi-tab draft sync visualization (T4 §3 edge case — not designed around).
- iPhone variant of manual entry (separate journey, not yet drafted).
- Navigate-away confirmation modal — explicitly rejected; localStorage handles recovery.
- Visible drag handle / grip glyph on song rows — explicitly excluded (see Locked constraints).

## Source-doc cross-references

- T4 §1 Frames 1–10 (full storyboard).
- T4 §2.1–§2.10 (locked decisions).
- T4 §3 (edge cases).
- T4 §4 (open questions — affordance copy, validation explainer; see "Open micro-questions" below).
- EXPERIENCE.md "Component Patterns" → `Section heading`, `Song row (setlist)`, `Inline edit field`.
- DESIGN.md "Components" → `Setlist section heading`, `Song row (setlist)`, `Inline edit field`.

## Open micro-questions surfaced by this brief

These are T4 §4 items that the journey doc said "lock at mockup time":

1. ~~**`+ Add a set` copy.**~~ **Locked 2026-06-27 to `+ Add set`** (article-less, parallel to `+ Add song` on the same surface). T4 §4 question 1 resolved.
2. ~~**Save-blocked explainer.**~~ **Locked 2026-06-27 to yes — one-line reason.** Strings: `Venue and Date required to save.` (T4 case) / `Resolve Fuzzy and Unknown rows to save.` (T1 case). Venue/Date string wins if both blocking causes apply at once. T4 §4 question 3 resolved.
3. ~~**Section-heading count format.**~~ **Locked 2026-06-27 to `Set 1   8 songs`** (literal count + word). The DESIGN.md `4 / 4` fraction-badge style is rejected because the fraction implies a completeness model that T3 §2.2 rejected. Designer should render the count text in either serif or mono per DESIGN.md type pairing rules — the format itself is fixed.
