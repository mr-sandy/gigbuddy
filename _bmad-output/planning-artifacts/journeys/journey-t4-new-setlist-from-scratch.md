---
title: T4 — Create a new setlist from scratch (MacBook practice, manual entry, no paste)
status: text-level decisions locked 2026-06-21 — visual mockup required before development (per memory [[feedback-mockup-decisions-before-dev]])
purpose: IA/nav/journey storyboard for Sandy's manual-entry setlist creation path on the MacBook. Paste-to-parse is the other path through the same surface and lives in T1.
sources:
  - _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md
  - _bmad-output/planning-artifacts/paste-to-parse-design.md
  - _bmad-output/planning-artifacts/journeys/journey-t3-library-maintain.md (locked decisions compose forward)
  - apps/web — `web/src/routes/setlist-creation.tsx`, `setlist-overview.tsx`, `web/src/components/song-search-row.tsx`, `setlist-song-row.tsx`, `section-heading.tsx`
created: 2026-06-21
locked: 2026-06-21
revised: 2026-06-26 (§2.4 flipped to allow drag-reorder during creation; §4 question 2 resolved to auto-renumber)
---

# T4 — Create a new setlist from scratch

> MacBook. Practice atmosphere (warm paper cream). Sandy is at the kitchen table on Tuesday evening. The band has a gig Saturday at Howlin Wolf. Ivan hasn't sent the setlist yet — Sandy is roughing out a draft from memory. Manual entry, no paste source.

## Framing

T4 is the journey for putting together a setlist when there's no pasted source — Sandy types Venue / Date / Time, picks songs from the Library one at a time, optionally splits into sets, and saves. Same destination as T1 (paste-to-parse) — `/setlists/new` is one surface with two entry paths.

**T1 vs T4 split:** T1 (Tuesday-evening paste-to-parse prep) is when Ivan sends the WhatsApp setlist and Sandy pastes it in. T4 is when Sandy creates the setlist himself, song by song, no paste. Both end on `/setlists/<id>` (setlist overview).

T4 has no performance-mode obligations and does not depend on the non-linear-setlist requirement.

## What exists in the build today

`/setlists/new` is one page, top-to-bottom: Gig metadata header (Venue / Date / Time) → always-visible paste textarea → parsed-rows region → manual sections (auto-create `Set 1` on first `+ Add song`) → `+ Add section` → Save (bottom of page).

Other current facts:
- `SongSearchRow` is a per-section inline picker. Substring match, 8-result cap, `+ Add to library` action when no exact match.
- Section names are inline-editable via `SectionHeading`.
- Songs are `×`-removable; **sections cannot be deleted**; songs append only (no insert-between during creation; reorder is overview-side via drag).
- **Draft state is local `useState`.** Navigating away discards silently.
- On Save: mints setlistId, navigates to `/setlists/<id>` (overview).

## 1. Frame-by-frame storyboard

### Frame 0 — Entry

Sandy is on Setlists home. Top nav `+ New setlist`. Click.

### Frame 1 — `/setlists/new` opens

```
GigBuddy · The Jack Ruby 5     Setlists · Library · + New setlist
─────────────────────────────────────────────────────────────────

  ‹ Setlists · New setlist                            Unsaved draft

  Venue
  [                                                              ]

  Date
  [                              ]

  Time (optional)
  [                              ]

  Paste a setlist instead ›

  + Add song

  + Add a set

  ────────────────────────────────────────────────────────────────
                            [ Save ]                                ← sticky bottom
  ────────────────────────────────────────────────────────────────
```

Notable shape:

- **Breadcrumb `‹ Setlists · New setlist`** top-left. Click `Setlists` to go back. Right side carries the `Unsaved draft` badge.
- **No paste textarea by default.** The `Paste a setlist instead ›` link replaces it. Clicking expands the textarea in place.
- **No `Set 1` heading.** Section chrome is hidden when only one (implicit) section exists.
- **Sticky Save bar at the bottom of the viewport.** Always visible regardless of scroll. The button itself is inert until Venue and Date are filled.

### Frame 2 — Fill gig metadata

Sandy clicks Venue, types `Howlin Wolf`, blurs. Date → Saturday. Time blank.

The draft state is debounce-persisted to localStorage. After ~200ms the badge swaps from `Unsaved draft` → `Draft saved just now`. The change is silent (no toast, no flash) — just the badge text.

### Frame 3 — Add the first song

Sandy clicks `+ Add song`. The button is replaced by an autofocused search input. He types `into`. Type-ahead matches appear below the input:

```
  …gig metadata…

  Paste a setlist instead ›

  [ into _                                                       ]
    Into The Mystic
    Into Each Life

  + Add a set

  [ sticky Save bar ]
```

He clicks `Into The Mystic`. The search row closes; the song row appears in the flat list; `+ Add song` button returns under it.

```
    Into The Mystic                                              ×

  + Add song

  + Add a set
```

No section chrome anywhere. Just a list of songs.

### Frame 4 — Add a few more songs

Sandy repeats `+ Add song` six more times. Each time he picks from the type-ahead. The list grows.

### Frame 5 — Mint a song that isn't in the library

Sandy types `Fire Eater`. No matches. The picker shows:

```
  [ fire eater _                                                 ]
    + Add to library: Fire Eater
```

He clicks the affordance. The song is minted; row added; `+ Add song` returns. There is no visual cue distinguishing the freshly-minted blank record from the populated ones — that's the explicit V1 choice (§2.10).

### Frame 6 — Split into sets

Sandy decides this batch of 8 songs is Set 1 and he needs a Set 2. He clicks `+ Add a set`. Two changes happen at once:

1. The existing flat list of 8 songs is wrapped in a `Set 1   8 songs` heading. Chrome appears around it: a `× Remove section` affordance on the heading, the heading itself is inline-renameable.
2. A new `Set 2   0 songs` heading appears below, with its own `+ Add song` button.

```
  …gig metadata…

  Paste a setlist instead ›

  Set 1   8 songs                                              ×
    Into The Mystic                                            ×
    Comin' Home Baby                                           ×
    …
  + Add song

  Set 2   0 songs                                              ×
  + Add song

  + Add a set

  [ sticky Save bar ]
```

He adds Set 2's songs the same way.

### Frame 7 — Realises he forgot a song for Set 1

Sandy realises Set 1 was missing `Sunny` after `Comin' Home Baby`. `+ Add song` is append-only, but drag-reorder works during creation (§2.4).

His path: he clicks `+ Add song` under Set 1, picks `Sunny`. `Sunny` appears as the 9th row of Set 1, at the end. He drags `Sunny` up to position 3, between `Comin' Home Baby` and the next song. No save required.

### Frame 8 — Save

Sandy clicks the sticky Save bar (always visible). Validation passes. URL changes to `/setlists/<new-id>`. Setlist Overview renders. localStorage draft slot is cleared.

### Frame 9 — Interruption mid-flow (now resolved)

Sandy gets up for coffee mid-edit. Accidentally clicks `Library` in the top nav. Setlist creation page unmounts.

He returns to `/setlists/new`. The form repopulates from localStorage — Venue, Date, all songs, all sections. Badge reads `Draft saved 4 minutes ago`. He sighs in relief and keeps going.

If he had instead clicked the breadcrumb `‹ Setlists`, the draft is still in localStorage and will restore on his next visit to `/setlists/new`.

### Frame 10 — Removing a section he added by accident

Sandy clicked `+ Add a set` twice in a row by mistake. Now there's an empty Set 3 below Set 2. He clicks the `×` on Set 3's heading. Set 3 is empty so it removes instantly (no confirm).

Inverse case: he wants to remove Set 2 which has 4 songs. Clicks Set 2's `×`. A confirm appears in-context (not a modal — a small `Remove Set 2 and its 4 songs?` line + `Yes, remove` / `Cancel` actions). On confirm, Set 2 disappears. If Set 1 was the only section remaining, **the section chrome collapses back to flat-list view** — Set 1's heading vanishes, songs render as a plain list. Set 1's name is preserved in the data model in case Sandy adds another set later.

## 2. Locked decisions (2026-06-21)

### 2.1 — Paste affordance: collapsible link near the top

The paste textarea is removed from the default page render. In its place: a `Paste a setlist instead ›` link, positioned between the gig metadata fields and the song list. Clicking expands the textarea in place; the link becomes `Hide paste area ›` (or similar) for collapse.

The parser, parsed-rows region, and `Yes, that one` / `+ Add to library` / `Pick from library` / `Discard` row actions all live inside the expanded paste area. Manual entry below is unaffected by paste's expansion state.

T1 users pay one click for paste to be there; T4 users see a single quiet link instead of a 6-line textarea.

### 2.2 — Section chrome appears only when 2+ sections exist

The page starts with no visible section chrome. `+ Add song` adds to a flat song list. The implicit single section's data-model name is `Set 1` but **it is not rendered** in the UI.

`+ Add a set` is the trigger that reveals chrome. On click:
- If only one (implicit) section exists: the existing songs are wrapped in a `Set 1` heading (with `× Remove section` chrome); a new `Set 2` heading appears below; the `+ Add a set` button moves below Set 2.
- If 2+ sections exist already: a new `Set N+1` heading appends.

`× Remove section` collapse rules (composes with §2.3):
- Removing a section reduces the visible count.
- If the count drops to 1, section chrome collapses back to flat-list view.
- Section names are retained in the data model even when hidden — re-adding a set later restores the name (e.g., if Sandy renamed Set 1 to "Set A", removed Set 2, then re-added a set, "Set A" reappears as the heading).

**Affordance copy:** working title is `+ Add a set`. Final copy locks at mockup time.

### 2.3 — `× Remove section` affordance

Every section heading carries a `×` affordance. Behavior:
- **Empty section:** click removes instantly.
- **Section with songs:** click reveals an in-context confirm line (no modal — modals are banned in performance and avoided by extension here): `Remove Set N and its M songs?` with `Yes, remove` / `Cancel` actions. On confirm: section removed including its songs.

No section reorder in V1.

### 2.4 — Adding songs is append-only; drag-reorder works during creation

> **Resolved 2026-06-26:** drag-reorder available during creation (including T1 Phase B), not only on the post-Save overview.

`+ Add song` always appends to the end of the section it's under — no insert-between affordance on the picker. To place a song at a specific position, Sandy appends and then drags the row up/down to where he wants it. Drag-reorder works:

- **Within a section** — drag any row up/down to change its position.
- **Across sections** — drag a row from Set 1 into Set 2, etc. Cross-section drag is supported (the `handleReorder` function in `setlist-overview.tsx` already handles this on overview; same behavior extends to creation).

This applies to manual sections, T1 Phase B post-Confirm parsed sections, and the saved overview — all the same drag semantics throughout. **Phase A is exempt** (parsed rows are read-only previews; no drag).

Implementation: lift the drag-reorder logic from `setlist-overview.tsx` so it shares between the creation page and the overview, or re-implement against the local creation-state shape. Either is fine; this is a spec-time decision.

### 2.5 — Draft persistence: localStorage, single slot

The draft state is debounce-persisted (~200ms after change) to a single localStorage slot for `/setlists/new`. On mount of `/setlists/new`, if a draft exists it is restored. On successful Save the slot is cleared.

The slot holds the same shape as the in-memory `DraftState`: venue, date, time, sections (with songs), plus the paste-related state (text + row resolutions) so T1 users get the same survival behavior.

**Multi-tab caveat:** if Sandy opens two tabs both on `/setlists/new`, last-tab-write wins on the localStorage slot. Both tabs can still Save (each mints a fresh setlistId, so two separate setlists land). This is an edge worth noting; not worth designing around in V1.

### 2.6 — Save button: sticky bottom bar

The Save button is rendered in a fixed bar at the bottom of the viewport, always visible above the form content. Disabled state when validation fails (Venue or Date empty, or any unresolved paste row). Visual treatment matches the iPhone `Start performance ›` precedent for the sticky-bottom-CTA shape — adapted to practice atmosphere.

### 2.7 — Breadcrumb: `‹ Setlists · New setlist`

Top-left of the page. Click `Setlists` to return to `/` (Setlists home). Fixed back-target — creation pages have no prior state to restore.

The right side of the same row carries the §2.8 indicator.

### 2.8 — Draft indicator: `Unsaved draft` → `Draft saved <when>` → `Last edited <when>`

Top-right of the page, opposite the breadcrumb. Three states:

| State | Display |
|---|---|
| No edits yet (fresh page) | `Unsaved draft` |
| Edits debounce-persisted to localStorage | `Draft saved <relative time>` (e.g. `Draft saved just now`, `Draft saved 3 minutes ago`) |
| After successful Save | n/a — page navigates to `/setlists/<id>` (overview), so this indicator is replaced by the overview surface |

The relative-time bucketing matches T3's §2.6 schedule.

### 2.9 — Filter input: visual unification, behavior distinct

The `SongSearchRow` picker reuses the same input shape and styling as the `/library` filter input (T3 §2.1). Behavior remains distinct: the picker has its 8-result cap, `+ Add to library` action, autofocus on summon, and Enter/Escape keyboard behavior; the library filter doesn't.

### 2.10 — No completeness cue on minted songs

Songs minted via `+ Add to library: <title>` mid-flow render identically to populated library songs. Sandy populates them later via T3. The mint timestamp surfaces in T3's `Last edited` indicator on the song detail page.

## 3. Edge cases

| Input shape | Behavior |
|---|---|
| Sandy hits Save with Venue empty | Validation error inline; save blocked. |
| Sandy hits Save with Date empty | Validation error inline; save blocked. |
| Sandy hits Save with zero songs | Saves an empty setlist (FR-6 allows). Overview renders with no sections. |
| Sandy hits Save with unresolved paste rows | Save blocked (existing behavior); paste-row resolution required first. Worth a small explainer near the disabled Save state. *Open: see §4.* |
| Sandy types `INTO THE MYSTIC` in the picker; library has `Into The Mystic` | SongSearchRow's exact-match check is case-insensitive — exact match suppresses the `+ Add to library` affordance. |
| Sandy clicks `+ Add a set` then immediately `× Remove section` on Set 2 | Set 2 is empty, instant remove. Chrome collapses back to flat list. |
| Sandy renames Set 1 to "Set A", removes Set 2, re-adds a set | "Set A" reappears as the heading on the still-existing first section (name preserved in the data model); the new section is `Set 2` (or `Set 3` if there had been three before any removal — section-naming counter doesn't auto-renumber). *Open: counter behavior — see §4.* |
| Sandy opens two tabs both on `/setlists/new` | Last-tab-write wins on the localStorage slot; both tabs can independently Save (each mints a fresh setlistId, two setlists result). |
| Sandy hits browser-back from `/setlists/new` after typing | Draft is in localStorage; on next visit the form repopulates. |
| Sandy hits Cmd-S | Browser default ("Save page as…"). T4 doesn't override in V1. |
| Sandy clears Venue and Date but keeps a song list | Validation error on Save; draft still persists. |
| Empty Library (no songs at all) | `+ Add song` opens SongSearchRow; only `+ Add to library: <query>` is available; song list builds from mint-as-you-go. Valid path. |
| Paste textarea expanded but no text typed | Parsed-rows region remains empty; collapse link reverts to closed state on toggle. No state lost. |

## 4. Open questions (post-decision)

Three small spec-time details remain:

1. **Affordance copy:** `+ Add a set` is the working title. Alternatives: `+ Add another set`, `+ Split into sets` (only valid at 1→2 transition), `+ New set`. Lock at mockup time.
2. **Section name auto-numbering on removal:** ~~Probably stays Set 3 to avoid surprise renames.~~ **Resolved 2026-06-26:** auto-renumber. When Sandy has Set 1, 2, 3 and removes Set 2, the section formerly named Set 3 renames to Set 2. Custom-named sections (e.g. `Encore`, `Set A`) preserve their name across renumber events. Aligned with T1 §2.2.
3. **Save-blocked explainer:** the disabled-Save state today has no message explaining why. Worth a small inline reason (`Resolve paste rows to save` or `Venue and Date required`) near the sticky bar when disabled. Lock at mockup time.

## 5. V1 cut for T4

- **Form shape:** Venue / Date / Time → `Paste a setlist instead ›` collapsible → song list (flat until `+ Add a set` is clicked) → `+ Add a set` → sticky Save bar.
- **Sections:** chrome hidden when 1 section exists; `× Remove section` with in-context confirm; section names preserved in data model across hide/show transitions; no section reorder.
- **Songs:** SongSearchRow per section (or under the flat list), `× Remove`, append-only via `+ Add song`, drag-reorder available within and across sections per §2.4.
- **Drafts:** localStorage persistence; single slot; cleared on Save; `Unsaved draft` / `Draft saved <when>` indicator top-right.
- **Save:** validation on Venue + Date and on unresolved paste rows; sticky bar; mint setlistId; navigate to overview.
- **Out:** insert-between-songs, section reorder, completeness glyphs on minted songs, navigate-away confirmation modal, multi-tab draft sync, Cmd-S override.

## 6. Composition with other journeys

- **T1 (paste-to-parse prep):** Same surface — every §2 decision applies. Sandy clicks `Paste a setlist instead ›` to expand the textarea; the parser-and-row UI lives inside that expansion. Sections may or may not show chrome depending on parsed structure (parsed `Set 1` + `Set 2` reveals chrome; parsed implicit `Set 1` keeps chrome hidden). Draft persistence saves Sandy if Ivan's WhatsApp message comes in mid-edit and he has to switch contexts.
- **T3 (library maintenance):** When Sandy mints `Fire Eater` via T4's `+ Add to library`, he'll later open it in a T3 session. The mint timestamp surfaces as `Last edited <when minted>` on the song detail page — no special chrome on either side, just the indicator.
- **iPhone Library tab as mid-set picker (`[[user-improvises-non-linear-setlist]]`):** Not directly related to T4. SongSearchRow's filter behavior is a prototype for the iPhone picker, but the visual unification with the Library filter (§2.9) is the more direct portable pattern.
- **Setlist overview (post-save):** T4 ends on `/setlists/<id>`. Drag-reorder, per-gig annotations, `Start performance ›` on iPhone are established and unchanged. The post-save drag-reorder workflow is the canonical response to Frame 7 (forgot Sunny).

## 7. Out of scope for T4

- Cloning an existing setlist as the starting point — V2.
- Setlist templates — V2.
- Importing setlists from other apps — out.
- Setlist without gig metadata — out per FR-6.
- Multi-tab concurrent draft editing — flagged in §3, not designed around.
- Cmd-S override — deferred.
- Section reorder — deferred to V2.
- Performance-mode entry from `/setlists/new` directly — never; FR-13 requires overview.

## 8. Mockup gate

Per [[feedback-mockup-decisions-before-dev]], the locked decisions in §2 must be visually mocked up — alongside T3 and T1 — before any T4-related implementation work begins. Visual draws from existing locked DESIGN.md tokens only.
