---
title: Mockup brief — /songs/:songId + /songs/new (T3)
surface: /songs/:songId · /songs/new
atmosphere: MacBook practice (warm paper cream, daylight)
journey: T3 — Browse library, edit a song
journey-doc: _bmad-output/planning-artifacts/journeys/journey-t3-library-maintain.md
visual-tokens: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md (Practice palette + typography)
experience-spine: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md
status: mockup approved 2026-06-28 (Claude Design composition; audit clean; chord-chart aspiration variant rendered)
---

# /songs/:songId + /songs/new — mockup brief

## Surfaces

Two URLs, same layout:

- `/songs/:songId` — song-detail page for an **existing** library record. Inline edit: view = edit; no separate edit mode; silent save on blur.
- `/songs/new` — song-detail page **before** a record exists. Sandy reached it by clicking `+ New song` on `/library`. The mint happens on first Title commit, at which point the URL flips to `/songs/<new-id>`.

## Purpose

Sandy maintains the canonical record for one song: title, key, patch, chord chart, performance notes, practice notes. Reached from `/library` (most often, via a song row or `+ New song`) or from a song row inside a setlist. The same layout serves three moments: blank-slate creation (`/songs/new`), populating a recently-minted blank record (paste-to-parse mint case), and tweaking an established record.

## States to mock

Three states. Same layout; the content and the breadcrumb/`Last edited` chrome differ.

1. **Populated** — established record. Title, Key, Patch, Chord chart, and at least one Notes field all carry content. The chord-chart rendered preview is visible below its textarea.
2. **Fresh-mint (paste-to-parse origin)** — record was created via `+ Add to library` from paste-to-parse and has not yet been populated. Only the Title field carries content; the other five fields are empty. The `Last edited` indicator shows the mint timestamp.
3. **Blank slate (`/songs/new`)** — pre-record. Sandy reached this page by clicking `+ New song` on `/library`. All six fields are empty. The breadcrumb's right segment reads `New song` (literal text, not a real title). The `Last edited` slot is absent — there is no record yet to time-stamp.

## Layout & elements

Top to bottom, single column. The shared MacBook top nav appears as on every surface.

1. **Top nav** — same as `/library`: left `GigBuddy · The Jack Ruby 5`, right `Setlists · Library · + New setlist`. No top-nav item is active on this page (this surface is `/songs/:songId`, not itself a top-nav destination — though Sandy reached it via `Library`, the active-state rule is route-matched, not history-based). All three items render in `text-primary`. (Top-nav active-state rule: DESIGN.md `Top nav (MacBook)` component spec.)
2. **Page header row.** Two halves on one row.
   - **Left half — breadcrumb.** Format: `‹ Library · <song title>`. The `‹ Library` segment is the click target (returns to `/library?q=<query>` with scroll restored). The `<song title>` segment is non-interactive — it's a label, not a link.
   - **Right half — `Last edited` indicator.** Format `Last edited <relative time>` (table in §Behaviors).
3. **Six inline-edit fields**, stacked vertically in this order, each preceded by its label:
   1. **Title** — single-line text input.
   2. **Key** — single-line text input (short).
   3. **Patch** — single-line text input.
   4. **Chord chart** — multi-line textarea. When non-empty, a **rendered chord-chart preview** renders below the textarea (read-only).
   5. **Performance notes** — multi-line textarea.
   6. **Practice notes** — multi-line textarea.
4. **No save button. No back button. No floating chrome.** The breadcrumb is the canonical exit. There is no bottom bar, no toolbar, no sidebar.

All fields render unconditionally — empty fields show as empty inputs, never as `(not specified)` placeholders.

## Behaviors (shared across both states)

- **Inline edit:** click into a field to focus, type, blur to save. 200ms debounce. No edit-mode toggle.
- **Save signal:** the `Last edited` indicator at top-right updates each time the debounced save flushes. There is no toast, no field-level pulse, no `Saving…` intermediate state.
- **Chord-chart rendered preview** appears below the chord-chart textarea only when the textarea has non-empty content. The preview is read-only.
  - **Primary composition (lock for State 1):** the **V1 floor** per DESIGN.md `Chord chart` component spec — a monospaced text run with light visual parsing. `{...}`-wrapped lines render as section breaks (italic or small-caps treatment — designer's call); blank lines preserved as breathing space; URLs tappable on practice notes (not chord chart). This matches the current `web/src/components/chord-chart.tsx` implementation.
  - **Secondary composition (exploratory):** the **aspiration** per DESIGN.md — chord glyphs rendered as engraved cards in a 2-column grid (`rounded.chord-glyph` 8pt radius), with non-chord lines as flowing prose between the glyph rows. No parser rules exist yet; the designer can improvise (treat isolated tokens like `Em`, `F#m7`, `Bm/D` as glyph candidates) and compose what the aspiration looks like on real content. This is **exploration, not commitment** — Sandy wants to see the aspiration on real-shape content before deciding whether to invest in the parser work that would be needed for V2.
- **Breadcrumb back** returns to whatever Library URL Sandy came from (including `?q=<query>` if filtered), and restores the prior scroll position.

### `Last edited` relative-time format

| Age | Display |
|---|---|
| < 60s | `Last edited just now` |
| < 60min | `Last edited N minutes ago` |
| < 24h | `Last edited N hours ago` |
| < 7d | `Last edited yesterday` / `Last edited N days ago` |
| ≥ 7d | `Last edited DD Mon YYYY` |

For the fresh-mint state with no edits yet, the indicator displays the mint timestamp (the moment paste-to-parse created the record).

## Content for the mock

### State 1 — Populated

Use **Fire Eater** as the example song.

| Field | Value |
|---|---|
| Breadcrumb | `‹ Library · Fire Eater` |
| Last edited | `Last edited just now` |
| Title | `Fire Eater` |
| Key | `Em` |
| Patch | *(illustrative — use a believable Nord-style patch string, e.g., a short name; no specific patch is documented for Fire Eater. If the designer wants a real reference, use the documented patch `R41 Piano and Cello` from EXPERIENCE.md Flow 1 — that's the patch for `Into The Mystic`, but the format is illustrative for what a real patch string looks like.)* |
| Chord chart | *(illustrative — provide ~10–14 lines of chord-glyph text in mono/slab style; mix of chord names and lyric/section markers. Actual content is Sandy's free-text input in the live app. The brief does not lock chord-chart content; the mock should look believable.)* |
| Performance notes | `Watch the third bar of the bridge — it's a 7 not an 8.` |
| Practice notes | *(illustrative — one short sentence in Sandy's voice. Optional; if the mock works better with this field empty, leave empty.)* |

The chord-chart rendered preview should appear below the textarea since the chord-chart field is non-empty.

### State 2 — Fresh-mint (paste-to-parse origin)

Use **Fire Eater** as the example song (the journey doc walks through this exact case — Fire Eater was minted via `+ Add to library` during T1 paste-to-parse and is now being populated days later).

| Field | Value |
|---|---|
| Breadcrumb | `‹ Library · Fire Eater` |
| Last edited | `Last edited 4 days ago` (the mint timestamp; T1 paste was Tuesday, T3 visit is the following Saturday morning — illustrative bucket) |
| Title | `Fire Eater` |
| Key | *(empty)* |
| Patch | *(empty)* |
| Chord chart | *(empty)* — no rendered preview |
| Performance notes | *(empty)* |
| Practice notes | *(empty)* |

No rendered chord-chart preview renders in this state (the chord-chart field is empty).

### State 3 — Blank slate (`/songs/new`)

Sandy clicked `+ New song` on `/library`. The URL is `/songs/new`. No record exists yet — the mint happens when Sandy commits the Title field for the first time, at which point the URL flips to `/songs/<new-id>` (no visible transition; the page doesn't reload).

| Field | Value |
|---|---|
| Breadcrumb | `‹ Library · New song` (literal text `New song`, not a song title) |
| Last edited | *(slot absent — no record exists yet, nothing to time-stamp)* |
| Title | *(empty)* |
| Key | *(empty)* |
| Patch | *(empty)* |
| Chord chart | *(empty)* — no rendered preview |
| Performance notes | *(empty)* |
| Practice notes | *(empty)* |

The right segment of the breadcrumb (`New song`) is non-interactive — same rule as the song-title segment on `/songs/:songId`.

No rendered chord-chart preview in this state.

The header row's right half is **empty** (no `Last edited` indicator at all). The slot reappears after the first Title commit lands.

## Microcopy (final strings)

| Element | String |
|---|---|
| Field label — title | `Title` |
| Field label — key | `Key` |
| Field label — patch | `Patch` |
| Field label — chord chart | `Chord chart` |
| Field label — performance notes | `Performance notes` |
| Field label — practice notes | `Practice notes` |
| Breadcrumb (record exists) | `‹ Library · <song title>` (using ` · ` separator with spaces) |
| Breadcrumb (`/songs/new`) | `‹ Library · New song` (literal text `New song`) |
| Last edited indicator | `Last edited <relative time>` per the table above; absent on `/songs/new` until first Title commit |

The `Title` label is a new addition vs. the current build (the title input previously stood label-less). Confirmed in T3 §1 Frame 3.

## Locked constraints (composition rules)

From T3 §2 — non-negotiable:

- **Breadcrumb at top-left, `Last edited` indicator at top-right, on the same row.** (T3 §2.3, §2.6)
- **All six fields render as inputs/textareas unconditionally.** No read-mode vs. edit-mode toggle, no hover-to-edit affordance. (T3 §2.5)
- **`Last edited` is the only save signal.** No toasts, no field-level pulses, no save button. (T3 §2.6)
- **Field labels above each input.** Including `Title` (new vs. current build). (T3 §1 Frame 3)
- **Chord-chart rendered preview renders below the textarea only when non-empty.** (T3 §1 Frame 4; existing build behavior preserved.) Primary composition is the DESIGN.md V1 floor (mono text run); the aspiration (chord-glyph cards in a grid) is requested as a secondary exploratory mock — not a commitment.

## Visual tokens

Use the **Practice atmosphere** from DESIGN.md:

- Palette: warm paper cream background, warm-dark ink, deeper amber accent (Practice tokens).
- Type: editorial serif for the song title and field labels and breadcrumb text. Mono/slab for the chord-chart textarea content **and** the chord-chart rendered preview (DESIGN.md component spec: chord glyphs use mono/slab at large size).
- Type scale: practice-body 17pt floor for body text; field labels can sit at body or one step up — let DESIGN.md scale rules drive.
- Spacing: 4pt base unit; field stack uses `card-stack-gap` or `section-gap` per DESIGN.md.
- Page bounds: MacBook content max-width ~960pt, centered.
- Single-column vertical stack.

Per DESIGN.md "Don'ts": no exclamation marks, no marketing voice, no shadows over 4pt, no animations.

## Out of scope for this surface

- "Open in setlist" cross-links / "songs in setlists" panel.
- Per-gig annotation editing (lives on `/setlists/<id>` overview, not here).
- Tag / category / mood metadata.
- Audio attachment, recording, BPM, tempo, time signature fields beyond what's listed (V2 candidates).
- Delete-song affordance (V2; not in T3).
- Version history / diff view (T3 §7 out).
- Save button, save indicator beyond `Last edited`, manual sync button.
- Section dividers between field groups (e.g. "Metadata / Notes" — not introduced).
- iPhone variant (separate journey, not yet drafted).

## Source-doc cross-references

- T3 §1 Frames 3–4 (storyboard for opening a song and editing fields).
- T3 §2.3 (breadcrumb decision).
- T3 §2.5 (always-input shape).
- T3 §2.6 (`Last edited` indicator).
- T3 §3 (edge cases — empty record, cross-field rapid blur).
- EXPERIENCE.md "Component Patterns" → `Inline edit field`, `Chord chart`.
- DESIGN.md "Components" → `Inline edit field` and "Typography" rules for mono/slab.
