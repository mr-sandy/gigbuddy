---
title: T3 — Browse library, edit a song (MacBook practice)
status: text-level decisions locked 2026-06-21 — visual mockup required before development (per memory [[feedback-mockup-decisions-before-dev]])
purpose: IA/nav/journey storyboard for Sandy's library-maintenance work on the MacBook. Independent of any setlist. First journey in the back-to-basics design pass that gates Epic 5.
sources:
  - _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md
  - _bmad-output/planning-artifacts/paste-to-parse-design.md (shape precedent)
  - _bmad-output/implementation-artifacts/epic-4-retro-2026-06-21.md (gap diagnosis)
  - apps/web — current `/library` (`web/src/routes/library.tsx`, `library-song-row.tsx`) and `/songs/:songId` (`web/src/routes/song-detail.tsx`, `inline-edit-field.tsx`)
created: 2026-06-21
locked: 2026-06-21
---

# T3 — Browse library, edit a song

> MacBook. Practice atmosphere (warm paper cream). Late evening, kitchen table. Sandy has 20–40 minutes. No active setlist. He's filling in chord charts and notes for songs he played at last weekend's gig.

## Framing

Library is the **canon of songs** for a band. Setlists are arrangements that *reference* library entries. T3 is the journey for tending that canon: opening a song, fixing or filling its fields, moving to the next song that needs work, stopping when Sandy gets bored.

Three sub-goals fall under this single journey, in declining frequency:

- **(a) Fill in a recently-minted record** — `+ Add to library` from paste-to-parse mints a title-only record. Sandy comes back later (potentially days later) to add key, patch, chord chart, and notes. *Dominant case post-Story-3.5.*
- **(b) Tweak an existing record** — re-key a song, add a performance-note ("watch the bridge — it lands a bar early"), correct a typo. Touches one or two fields, not the whole record.
- **(c) Browse with no specific song in mind** — scan what's there, refresh memory, possibly notice something needs work.

T3 has no performance-mode obligations. The non-linear-setlist requirement (`[[user-improvises-non-linear-setlist]]`) affects how Library composes with the iPhone surface — flagged in §6 — but does not change T3's own shape.

## What exists in the build today

- `/library` renders `+ New song` (anchor → `/songs/new`), then a single `<ul>` of `LibrarySongRow`s in alphabetical order. **Title only.** No search, no filter, no grouping, no alphabet rail.
- Server alphabetizes; route trusts the order.
- `LibrarySongRow` is the whole row as a `<Link>`. Min-tap height. No row actions.
- `/songs/:songId` renders six inline-edit fields stacked vertically: Title, Key, Patch, Chord chart, Performance notes, Practice notes. Every field renders unconditionally. Below the chord-chart input, when non-empty, a read-only `<ChordChart>` preview renders.
- Inline-edit semantics: tap to focus, type, blur to save. 200ms debounce. **Silent save. No save indicator. No back affordance from song detail.**
- Active band is hardcoded to The Jack Ruby 5 (`ACTIVE_BAND_ID`).

## 1. Frame-by-frame storyboard

### Frame 0 — Entry

Sandy is at the kitchen table on the MacBook. He has GigBuddy open in a tab, or opens it via the bookmark. He arrives on **Setlists (home)** by default. The top nav shows `GigBuddy · The Jack Ruby 5 · Setlists · Library · + New setlist`. He clicks `Library`.

### Frame 1 — Library opens (new chrome)

URL: `/library`. The page now leads with a **filter input** above the song list.

```
GigBuddy · The Jack Ruby 5     Setlists · Library · + New setlist
─────────────────────────────────────────────────────────────────

  Filter songs  [ _______________________________ ]   + New song

  Acid Rain
  After You've Gone
  All Blues
  Almost Like Being In Love
  …
  (scroll continues — alphabetical, server-ordered)
```

Behavior of the filter input:

- Empty input → full list, alphabetical (unchanged).
- As Sandy types, the list filters in-place. Substring match on title, case-insensitive, diacritic-insensitive.
- No debounce required (<200 rows, client-side filter).
- Filter state lives in the URL as `?q=<query>` so the filtered Library is bookmarkable and back-restorable.
- No-match state: `No songs match "xyz".` Quiet treatment. Filter input remains, so Sandy can edit the query without clearing first.

`+ New song` stays — same destination (`/songs/new`), now sits to the right of the filter input on the same line.

### Frame 2 — Sandy filters and finds the song

Sandy types `fire`. The list collapses to:

```
  Filter songs  [ fire _________________________ ]   + New song

  Fire Eater
  On Fire
```

He clicks `Fire Eater`. URL changes to `/songs/<id>`.

### Frame 3 — Song Detail opens (new chrome)

```
GigBuddy · The Jack Ruby 5     Setlists · Library · + New setlist
─────────────────────────────────────────────────────────────────

  ‹ Library  ·  Fire Eater                Last edited just now

  Title
  [ Fire Eater                                    ]

  Key
  [                                                ]

  Patch
  [                                                ]

  Chord chart
  [                                                ]
  [                                                ]
  [                                                ]
                                                       ← (no preview — empty)

  Performance notes
  [                                                ]
  [                                                ]

  Practice notes
  [                                                ]
  [                                                ]
```

Three pieces of new chrome:

- **Breadcrumb `‹ Library · <song title>`** at top-left. The `Library` segment is the click target. Clicking it returns to `/library?q=fire` *and* restores the scroll position. The right segment (current song title) is non-interactive.
- **`Last edited <relative time>` indicator** at top-right of the same row. Updates as the debounced save flushes. Values: `just now` (<60s), `N minutes ago`, `N hours ago`, `yesterday`, `<absolute date>` once older than a week. For a freshly-minted record with no edits yet, the value is the mint timestamp (the moment paste-to-parse created the record).
- **Field label "Title"** added above the title input for consistency with the other field labels. (Previously the title input stood label-less at the top of the page.)

Everything else in Song Detail is unchanged from the current build.

### Frame 4 — Editing

Sandy clicks into the Chord chart field. Focused textarea. He types or pastes the chord skeleton. 200ms after he stops typing, the debounced save fires.

The `Last edited` indicator pulses to `just now`. The `<ChordChart>` preview renders below the textarea once the input is non-empty.

He tabs out to Performance notes; adds `Watch the third bar of the bridge — it's a 7 not an 8.` Blurs. `Last edited` updates to `just now` again.

He scrolls up; adds `Em` to Key. Blurs. Save fires. Indicator updates.

Sandy now has a positive, persistent signal that his work is landing — without a toast, without a modal, without a save button.

### Frame 5 — Move to next song

Sandy is done with Fire Eater. Three return paths:

- **Path A (canonical):** Click `‹ Library` breadcrumb → `/library?q=fire` restored, scroll restored, `Fire Eater` row still in the filtered list. From there he edits the query (e.g., backspace, type `watermelon`) to find the next song.
- **Path B:** Top-nav `Library`. Goes to `/library` (no query). Cleared filter, scroll top. Useful for "I'm done with this thread of work, starting fresh."
- **Path C:** Browser back. Equivalent to Path A — browser restores the prior URL including `?q=fire`.

Paths A and C converge; Path B is the explicit "reset" option.

### Frame 6 — Stopping

Sandy closes the tab. Next session, GigBuddy opens on Setlists home. To resume library maintenance he taps Library, types the next song's name, clicks. No "Last visited" or "Continue where you left off" landmark — explicit V1 choice; opportunistic maintenance, not a daily ritual.

## 2. Locked decisions (2026-06-21)

### 2.1 — Discovery: filter input on `/library`

Type-ahead filter input above the song list. Substring match on title, case- and diacritic-insensitive. Client-side, instant (no debounce needed). URL state via `?q=<query>` so the filtered view is bookmarkable, back-button-restorable, and breadcrumb-restorable from song detail. Empty input = full list. No-match state: `No songs match "xyz".`

**Composes with iPhone:** the same filter input is the strongest portable mechanism for the future iPhone Library tab and the non-linear-jump mid-set picker (§6). Alphabet rail and filter chips do not survive thumb-driven dim-bar conditions; type-ahead does.

### 2.2 — Per-row info: title only

No subline. No metadata. No completeness glyph. Same as today. Composes cleanly to the iPhone surface where row height matters more.

### 2.3 — Back-nav: state-restoring breadcrumb

`/songs/:songId` gains a breadcrumb at the top of the page: `‹ Library · <song title>`. Clicking `Library` returns to the previous Library URL (including `?q=<query>` if filtered) and restores scroll position. This replaces "browser back" as the canonical exit, though browser back continues to work via the URL query state.

Implementation notes (for the eventual spec, not for this design doc):
- Library list scroll position is preserved by storing it on `popstate`/`pushstate` or by using React Router's `ScrollRestoration` keyed on the URL.
- The breadcrumb is the symmetric chrome opposite of the song detail title — it does NOT replicate top-nav-Library's "go to top of full list" behavior; it is explicitly the *restore* affordance.

### 2.4 — Paste-to-parse handoff: deferred to T4

The "what happens after `+ Add to library` mints a blank record" question lives in the setlist-creation journey (T4), not in T3. T3 only needs to accept that **days may pass** between mint and population; the recently-minted record's mint timestamp is the only T3-side affordance that helps (it surfaces in the `Last edited` indicator when Sandy opens the song).

### 2.5 — Field-edit affordance: always-input shape

Inline-edit fields remain always-rendered as inputs/textareas. No read-mode vs edit-mode toggle. No hover underline. The Apple Notes vibe (click anywhere, type, click away) is preserved. Pre-focus chrome stays minimal.

### 2.6 — Save feedback: `Last edited <relative time>` indicator

Single, persistent indicator at the top-right of the song detail page, on the same row as the breadcrumb. Updates each time the debounced save flushes successfully. Format:

| Age | Display |
|---|---|
| < 60s | `Last edited just now` |
| < 60min | `Last edited N minutes ago` |
| < 24h | `Last edited N hours ago` |
| < 7d | `Last edited yesterday` / `Last edited N days ago` |
| ≥ 7d | `Last edited DD Mon YYYY` |

For a freshly-minted record with no edits yet, displays the mint timestamp. **The indicator is the only save-signal in V1** — no toasts, no field-level pulses, no "saving…" intermediate state. Errors (save failure) remain the responsibility of the existing toast in `EXPERIENCE.md`'s state-patterns table.

### 2.7 — Active-band scope cap: V1 single-band, IA composes forward

The active band is hardcoded to The Jack Ruby 5 via `ACTIVE_BAND_ID`. The passive band label in the top nav (`GigBuddy · The Jack Ruby 5`) doubles as the cap-visualization. Nothing in this storyboard depends on band-singleton; the IA composes forward to a V2 switcher with no re-architecture — the switcher becomes a chrome change at the top nav, not a journey rewrite.

## 3. Edge cases

| Input shape | Behavior |
|---|---|
| Empty library (no songs) | `/library` shows the filter input + `+ New song` link + empty-state copy (`EMPTY_STATES.noSongsInLibrary`). |
| Filter matches nothing | `No songs match "xyz".` Quiet treatment. Filter input remains; Sandy can edit the query without clearing. |
| Filter query with diacritics or smart quotes | Normalized both sides before substring match (matches matching behavior in paste-to-parse). |
| Library of 200+ songs (multi-band V2) | Filter input scales; alphabetical scroll degrades. Already the right shape. |
| Sandy navigates Library → Song A → Library → Song B | Path A back from Song B restores the latest Library URL (with whatever filter was applied to find Song B), not the earlier one. |
| Sandy edits a field, closes the tab before debounce flushes | Save lost. 200ms is short enough this is unlikely; no `beforeunload` flush in V1. |
| Two browser tabs open on the same song | Last-write-wins per architecture (`version` + `clientWrittenAt`). `Last edited` indicator in each tab reflects that tab's own most-recent save; on next mount the persister reconciles. |
| New song created via `/songs/new`, Sandy hits browser back before titling | The mint only happens on first Title commit. Pre-commit, there's no record. Back navigates to wherever he came from. Breadcrumb on `/songs/new`: `‹ Library · New song`. |
| Sandy types in Key field then clicks into Patch field | Cross-field rapid blur — `pendingRef` accumulates partial updates so both fields land in one save. `Last edited` updates once. |
| Filter has a `?q=` value but list is empty (Library has zero songs total) | Empty-state copy wins; filter input still rendered but inert. |

## 4. Open questions (post-decision)

Two remain, both small:

1. **Mint-timestamp source for `Last edited`.** When a record is created via `+ Add to library` from paste-to-parse, the `Last edited` value should be the mint timestamp. The Song schema already carries `clientWrittenAt`. Confirm the field used is `clientWrittenAt`, not a separate `createdAt`. (Spec-time detail; doesn't affect IA.)

2. **Filter input placeholder copy.** Working title is `Filter songs`. Alternatives: `Find a song`, `Search title`, or just an icon + empty placeholder. Locked at mockup time.

## 5. V1 cut for T3

- **Library:** title-only alphabetical rows (unchanged), filter input above the list, `+ New song` to the right of the filter input, URL state via `?q=`.
- **Song detail:** six inline-edit fields (unchanged), breadcrumb `‹ Library · <title>` at top-left, `Last edited <relative time>` at top-right.
- **Nav:** breadcrumb is the canonical exit; browser back works via URL query state; top-nav Library is the explicit "reset" path.
- **Out:** band switcher, completeness glyphs, filter chips, alphabet rail, read/edit mode toggle, paste-to-parse-handoff chrome.

## 6. Composition with other journeys

- **T4 (Create a new setlist):** Reuses the same alphabetical Library list as the data substrate (the setlist row picker in Story 3.4). The filter input lifts directly into that picker. T4 inherits the `+ Add to library` → days-later handoff question.
- **T1 (Tuesday-evening paste-to-parse prep):** The `+ Add to library` action mints library entries that T3 then populates. T3's `Last edited` indicator surfaces the mint timestamp — that closes the loop with no special chrome on T1's own surface.
- **iPhone Performance — non-linear jump to a library song (`[[user-improvises-non-linear-setlist]]`):** Library on iPhone becomes the mid-set song picker. The MacBook filter input is the prototype for the iPhone analogue — type-ahead survives dim-bar/thumb-driven conditions; alphabet rails and filter chips do not. **This is the load-bearing argument for §2.1.**
- **iPhone Library tab (between gigs):** Same surface as Performance picker, less time pressure. Same filter mechanism.

## 7. Out of scope for T3

- Bandswitcher UX — V2.
- Bulk operations (delete N songs, retitle, merge duplicates) — out.
- Song-level history / diff view — out.
- "What needs chord chart" or "incomplete" surfacing — explicitly rejected in §2.2.
- Library export — Story 5.1, separate IA decision.
- Mobile (iPhone) Library tab journey — separate storyboard.
- Paste-to-parse → Library handoff design — deferred to T4.

## 8. Mockup gate

Per [[feedback-mockup-decisions-before-dev]], the seven locked decisions in §2 must be visually mocked up — alongside T1 and T4's locked decisions, and the performance-mode journeys when those land — **before any T3-related implementation work starts**. The mockups draw exclusively from existing locked DESIGN.md tokens; no new colors, faces, or tokens.
