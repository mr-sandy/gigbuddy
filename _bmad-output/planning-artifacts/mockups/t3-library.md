---
title: Mockup brief — /library (T3)
surface: /library
atmosphere: MacBook practice (warm paper cream, daylight)
journey: T3 — Browse library, edit a song
journey-doc: _bmad-output/planning-artifacts/journeys/journey-t3-library-maintain.md
visual-tokens: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md (Practice palette + typography)
experience-spine: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md
status: mockup approved 2026-06-28 (Claude Design composition; audit clean)
---

# /library — mockup brief

## Surface

`/library` — the canon of songs for the active band (The Jack Ruby 5). Independent of any setlist.

## Purpose

Sandy maintains the song catalogue here: scans the alphabetical list, filters by title to find a specific song, opens one to edit. The entry surface for the T3 (library maintenance) journey on MacBook. Sessions are 20–40 minutes at the kitchen table.

## States to mock

Four states. Same surface; the filter input and the list region change.

1. **Empty input** — no filter query. Full alphabetical list visible.
2. **Filter query typed** — filter input contains a query; the list shows only matching rows.
3. **No-match** — filter input contains a query that matches zero songs. List region shows the no-match message.
4. **Empty library** — the active band's library has zero songs total. List region shows the empty-state copy `No songs in this library yet.` Filter input is rendered but Sandy has nothing to filter.

## Layout & elements

Top to bottom, single column. Page is the full app surface — no other panels.

1. **Top nav** (shared across all MacBook surfaces). Left: `GigBuddy · The Jack Ruby 5` (passive band label, not interactive in V1). Right: `Setlists · Library · + New setlist`. The Library item is the current page.
2. **Filter row.** A filter input on the left and a `+ New song` link on the right, both on the same row, sitting above the song list.
   - Filter input: text field. Placeholder copy: `Filter songs`.
   - `+ New song`: link/button. Destination: `/songs/new`.
3. **Song list.** A single-column vertical list of song-title rows, alphabetical.
   - Each row is the song title only — no subline, no metadata, no badges, no completeness glyphs.
   - Each row is a single click target (the whole row navigates to `/songs/:songId`).
   - Server-ordered alphabetically; the page trusts that order.

## Behaviors (state-dependent)

### State 1 — Empty input

- Filter input is empty (placeholder visible).
- Full song list renders, alphabetical.

### State 2 — Filter query typed

- Filter input contains a query string (use `fire` for the mock).
- Substring match against titles, case- and diacritic-insensitive, client-side, instant (no debounce, no loading state).
- List collapses to matching rows only.
- URL state: `/library?q=fire` (not mocked visually unless the address bar is in frame).
- The filter input itself does not move; only the list region changes.

### State 3 — No-match

- Filter input contains a query (use `xyz` for the mock — a string that won't match the library).
- List region shows the no-match message in place of the list: `No songs match "xyz".`
- Filter input remains editable — Sandy can edit the query without clearing first.
- No `+ Add to library: xyz` affordance on this surface (that affordance lives inside the SongSearchRow on `/setlists/new`, not on `/library`).

### State 4 — Empty library

- The active band's library has zero songs total. Distinct from State 3 (which is a populated library with a no-match query).
- Filter input rendered as in State 1 (empty placeholder visible). Active but Sandy has nothing to filter — typing anywhere just lands him back in State 3-equivalent (empty-state copy wins when both apply — see journey doc T3 §3 edge case).
- `+ New song` link present.
- List region shows the empty-state copy in place of the list: `No songs in this library yet.`
- Quiet treatment matching the no-match copy style.
- No CTA suggesting Sandy add songs (per EXPERIENCE.md "Voice and Tone" — the app states what is; no encouragement). The `+ New song` link in the filter row is the only mint affordance and it's already visible.

## Content for the mock

Use these real song titles for the alphabetical list (drawn from documented examples in EXPERIENCE.md, paste-to-parse-design.md, and the journey docs). The list should look like a believable jazz/funk/soul library:

```
Cantaloupe Island
Comin' Home Baby
Fire Eater
In and Out
Into The Mystic
Kelvingrove Street
Mas Que Nada
Move on Up
Sunny
Trouble Man
Watermelon Man
```

For State 2, use the query `ma`. The list should show three matches in alphabetical order:

```
Mas Que Nada
Trouble Man
Watermelon Man
```

(Substring match, case-insensitive — `ma` is a prefix in `Mas Que Nada` and a mid-word substring in `Man` for the other two. Good demonstration that filtering is substring, not prefix-only.)

For State 3 (`xyz` filter), the list region shows: `No songs match "xyz".`

## Microcopy (final strings)

| Element | String |
|---|---|
| Top-nav band label | `GigBuddy · The Jack Ruby 5` |
| Top-nav items | `Setlists` · `Library` · `+ New setlist` |
| Filter input placeholder | `Filter songs` |
| New-song link | `+ New song` |
| No-match message | `No songs match "<query>".` (with the query string in straight double quotes) |
| Empty-library message | `No songs in this library yet.` |

Per voice rules (EXPERIENCE.md): no exclamation marks, no emoji, no encouragement.

## Locked constraints (composition rules)

These come from the T3 journey doc (§2). They are non-negotiable for the mock:

- **Title only per row.** No subline, no completeness glyph, no metadata. (T3 §2.2)
- **Filter input above the list, `+ New song` to the right of the filter input on the same row.** (T3 §2.1)
- **Top-nav `Library` is the current page** — renders in `accent` color per DESIGN.md `Top nav (MacBook)` component spec; the inactive items (`Setlists`, `+ New setlist`) render in `text-primary`.
- **Band label is informational, not interactive.** (T3 §2.7)
- **No alphabet rail, no filter chips, no grouping.** (T3 §7)

## Visual tokens

Use the **Practice atmosphere** from DESIGN.md:

- Palette: warm paper cream background, warm-dark ink, deeper amber accent. Tokens listed under DESIGN.md "Colors → Practice".
- Type: editorial serif for titles (song titles, band label); mono/slab reserved for chord glyphs and other roles defined in DESIGN.md (not used on this surface).
- Type scale: practice-body floor 17pt; section-heading 22pt where applicable.
- Spacing: 4pt base unit; tokens per DESIGN.md "Layout & Spacing".
- Page bounds: MacBook content max-width ~960pt, centered.
- Single-column vertical stack. No multi-column dashboards (DESIGN.md "Layout vocabulary").
- Generous whitespace; the page should breathe (DESIGN.md "Don'ts" → no over-packed density on practice surfaces).

Do not introduce colors, faces, weights, or visual tokens not present in DESIGN.md.

## Out of scope for this surface

The mock should NOT include any of the following — they belong to other surfaces or are V1-rejected:

- Song detail editing chrome (lives on `/songs/:songId` — separate brief).
- Setlist references / "songs in setlists" cross-links.
- Bulk actions (delete, retitle, merge).
- Per-song completeness indicators ("missing chord chart", "needs key").
- Band switcher / band picker chrome.
- Search-result `+ Add to library` affordance (lives inside SongSearchRow on `/setlists/new`).
- Recent / favourites / pinned sections.
- Sort options.
- iPhone variant (separate journey, not yet drafted).

## Source-doc cross-references

- T3 §1 frames 1–2 (storyboard for arriving and filtering).
- T3 §2.1 (filter input decision).
- T3 §2.2 (title-only rows).
- T3 §2.7 (band label).
- T3 §3 (edge cases, including empty library and zero-match).
- T3 §7 (out-of-scope inventory).
- EXPERIENCE.md "Voice and Tone" (microcopy rules).
- DESIGN.md "Practice" palette and typography sections.
