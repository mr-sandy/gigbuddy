---
title: T1 — Tuesday-evening prep / paste-to-parse (MacBook practice, revisit-of-shipped)
status: text-level decisions locked 2026-06-26 — visual mockup required before development (per memory [[feedback-mockup-decisions-before-dev]])
purpose: Revisit the shipped paste-to-parse flow (Stories 3.4 + 3.5) under the new IA/nav locks from T3 and T4. Verify what feels right, capture what doesn't, surface friction the original spec didn't predict.
sources:
  - _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md (Flow 3 — Tuesday-evening setlist prep)
  - _bmad-output/planning-artifacts/paste-to-parse-design.md (the locked algorithm + UX spec for the shipped feature)
  - _bmad-output/planning-artifacts/journeys/journey-t3-library-maintain.md (locked)
  - _bmad-output/planning-artifacts/journeys/journey-t4-new-setlist-from-scratch.md (locked — same surface)
  - apps/web — `web/src/routes/setlist-creation.tsx`, `paste-parse/parser.ts`, `paste-parse/matcher.ts`, `web/src/components/parse-row-status.tsx`
created: 2026-06-21
locked: 2026-06-26
---

# T1 — Tuesday-evening prep / paste-to-parse

> MacBook. Practice atmosphere (warm paper cream). Tuesday evening. Ivan has just WhatsApped Sandy the setlist for Saturday's Howlin Wolf gig. Sandy copies the message body to clipboard, opens GigBuddy, and pastes.

## Framing

T1 is the journey Sandy already lives. Stories 3.4 + 3.5 shipped this feature; `paste-to-parse-design.md` is the canonical reference. The point of this storyboard is **not** to redesign the parser or the row resolution UX — those are locked. It's to:

1. Walk through the experience as Sandy will actually have it **after T3 and T4 lock**.
2. Surface friction the original spec didn't predict.
3. Lock the small set of IA decisions that live above the parser layer but inside this journey.

T4 already covers most of the surface chrome (collapsible paste, sticky Save, breadcrumb, draft persistence, section-chrome-when-≥2). T1 inherits all of those. The T1-specific work is in the parse-review and post-resolve phase.

## What exists in the build today

- Paste textarea + parsed-rows region inside `/setlists/new` (Story 3.5).
- Section detection: `Set N`, `Encore`, `{...}`, markdown `#`, `----` separator, implicit Set 1 (per `paste-to-parse-design.md` §1).
- Fuzzy matching: lowercase + diacritic + whitespace + bracket normalization → exact normalized match → Jaro-Winkler ≥0.92 (§2).
- Per-row resolution UI: `✓ Matched` (no actions), `? Fuzzy` (Yes, that one / No — new song), `+ Unknown` (Add to library / Pick from library / Discard) (§3).
- Inline title edit re-triggers matching.
- Save gated on zero Fuzzy or Unknown rows.
- **Live re-parse only fires when no rows exist yet OR textarea is cleared to empty.** Once Sandy starts resolving, subsequent textarea keystrokes do NOT re-parse — protects his decisions from being clobbered.
- Parsed sections and manually-added sections render as two separate visual regions; on Save they merge into one `DraftSection[]` (parsed first, manual second).

## 1. Frame-by-frame storyboard (post-T3+T4)

### Frame 0 — The WhatsApp arrives

Sandy is at the kitchen table. His phone vibrates. Ivan: a block of text with `Howlin Wolf - 13 Jun`, then `Set 1`, then 10 songs, then `----`, then `Set 2`, then 9 more songs.

He long-presses, selects all, copies to clipboard.

### Frame 1 — `/setlists/new` opens

Same Frame 1 as T4. Breadcrumb top-left, `Unsaved draft` top-right, gig metadata fields, `Paste a setlist instead ›` link, flat song area, `+ Add a set`, sticky Save bar.

### Frame 2 — Fill gig metadata

Sandy types `Howlin Wolf`, picks Saturday, picks `9:00 PM`. localStorage debounce-persists. Indicator: `Draft saved just now`.

### Frame 3 — Expand the paste area (enters Phase A)

Sandy clicks `Paste a setlist instead ›`. The link is replaced by an expanded paste area containing a textarea, a `Confirm` button, and a `Cancel` link. The textarea is autofocused. He cmd-V's the WhatsApp text in.

```
  …gig metadata…

  ┌─ Paste area ──────────────────────────────────────────────┐
  │ ┌────────────────────────────────────────────────────────┐│
  │ │ Howlin Wolf - 13 Jun                                   ││
  │ │ Set 1                                                  ││
  │ │ Into The Mystic                                        ││
  │ │ Comin' Home Baby                                       ││
  │ │ …                                                      ││
  │ │ ----                                                   ││
  │ │ Set 2                                                  ││
  │ │ Move on Up                                             ││
  │ │ …                                                      ││
  │ └────────────────────────────────────────────────────────┘│
  │                                                            │
  │ (parsed preview renders here once parser fires)            │
  │                                                            │
  │                            [ Confirm ]   Cancel            │
  └────────────────────────────────────────────────────────────┘
```

### Frame 4 — Parsed preview renders (Phase A, read-only)

500ms after Sandy stops typing/pasting, the parser fires. Two sections detected. Rows classified. Preview renders inside the paste area below the textarea. **All row controls are display-only — no clickable resolve actions.**

```
  ┌─ Paste area ──────────────────────────────────────────────┐
  │ (textarea — Sandy's pasted text)                           │
  │                                                            │
  │ Set 1   10 songs                                           │
  │   + Howlin Wolf - 13 Jun       (no match)                  │
  │   ✓ Into The Mystic                                        │
  │   ✓ Comin' Home Baby                                       │
  │   …                                                        │
  │ Set 2   9 songs                                            │
  │   ✓ Move on Up                                             │
  │   ? Kelvingrovestreet  → Kelvingrove Street?               │
  │   + Fire Eater                 (no match)                  │
  │   ✓ Into The Mystic            (annotation: first dance)   │
  │   …                                                        │
  │                                                            │
  │                            [ Confirm ]   Cancel            │
  └────────────────────────────────────────────────────────────┘
```

What Sandy sees vs. what he can't do:

- `✓ Matched` rows show the canonical title (with `(was: kelvingrovestreet)`-style caption when normalized differs from paste).
- `? Fuzzy` rows show the suggested match in quiet treatment — **no `Yes, that one` / `No — new song` buttons yet.**
- `+ Unknown` rows show `(no match)` in quiet treatment — **no `+ Add to library` / `Pick from library` / `Discard` buttons yet.**
- Extracted per-gig annotations (§2.4) are previewed below their rows — **not editable yet.**

The `Howlin Wolf - 13 Jun` row is a document-title artifact (V1 has no doc-title heuristics). It lands as Unknown.

**Sandy's recourse in Phase A: edit the textarea.** He deletes the `Howlin Wolf - 13 Jun` line at the top. 500ms later, parser re-fires, the Unknown row disappears from the preview. Two sections, 18 songs, one Fuzzy (Kelvingrove), one Unknown (Fire Eater). Looks right.

### Frame 5 — Confirm (transition to Phase B)

Sandy clicks `Confirm`. Paste area disappears entirely. The two sections + their songs appear in the main section list, identical visual to manual sections. All row resolve actions are now interactive. Per-gig annotation `first dance` is now an editable inline field on its row.

```
  …gig metadata…

  Paste a setlist instead ›    ← link is GONE (one-shot per §2.5)

  Set 1   10 songs
    ✓ Into The Mystic
    ✓ Comin' Home Baby
    …
  Set 2   8 songs
    ✓ Move on Up
    ? Kelvingrovestreet  → Kelvingrove Street    [Yes, that one] [No — new song]
    + Fire Eater                  [+ Add to library] [Pick from library] [Discard]
    ✓ Into The Mystic
        annotation: [ first dance _________________________ ]
    …

  + Add song          ← available on every section
  + Add a set

  [ sticky Save bar — disabled while Fuzzy/Unknown rows remain ]
```

Sandy clicks `Yes, that one` on the Kelvingrove fuzzy. Row turns `✓ Matched`. He clicks `+ Add to library` on Fire Eater. Row turns `✓ Matched`. New song minted (surfaces in T3 sessions later as `Last edited just now`).

### Frame 6 — Save

All rows `✓ Matched`. Sticky Save bar is now enabled. Sandy clicks. URL → `/setlists/<id>`. Overview renders with two sections, 18 songs.

The localStorage draft slot is cleared. Sandy is done.

### Frame 7 — Failure mode resolved at source: parser missed a section break

The variant: Ivan's WhatsApp had no `----` separator. Parser yields one section: `Set 1` with 19 songs.

**Phase A handles this trivially.** Sandy sees the preview shows one section. He clicks back into the textarea, types `Set 2` on a new line at the right spot, the parser re-fires 500ms later, the preview now shows two sections. Confirm.

If Sandy ever notices the issue only **after** Confirm (the rare case where the preview looked OK but he later realised the split was wrong), the post-Confirm fix is §2.1's inline `Start a new set here ›` action on the relevant row.

### Frame 8 — Failure mode: Sandy pasted the wrong WhatsApp message

Sandy realises he pasted last week's setlist, not this week's. Phase A makes this trivial: he selects-all in the textarea, deletes, cmd-V's the right message. Parser re-fires 500ms later, fresh preview. No row decisions to lose — those don't exist until Phase B.

If Sandy realises after Confirm: paste is one-shot per §2.5. He'd need to discard the setlist draft (`Cancel` per T4 §2.5 localStorage draft semantics) or remove the wrongly-imported sections via `× Remove section` and add the right ones manually via `+ Add song`. Friction is real but bounded.

### Frame 9 — Per-gig annotation preserved through the flow

Ivan's WhatsApp says `INTO THE MYSTIC [first dance]`. In Phase A's preview, the row shows as `✓ Into The Mystic` with `annotation: first dance` displayed beneath. Sandy can see the annotation was captured before he commits.

After Confirm (Phase B), the annotation field is an editable inline element on the row. Sandy can keep it as-is, edit it, or clear it. On Save it's written to the SongRef's `perGigAnnotation` field (§2.4).

## 2. IA decisions surfaced

Most of T1's surface is already locked by T4. The remaining T1-specific decisions cluster around the parse-review and post-resolve phases.

### 2.1 — Inline `Start a new set here ›` (post-Confirm split action)

> **Locked 2026-06-26.** Inline split affordance available in Phase B (post-Confirm) on any row in any section. Not paste-specific.
> **Confirmed kept 2026-06-28** after reviewing the State 5 mockup composition in `mockups/t1-setlist-new-paste.md` — the affordance reads as quiet background, doesn't compete with the resolve buttons. Sandy may revisit if usage data shows the affordance never fires.

Each song row carries a small `Start a new set here ›` affordance (chevron, on hover or on focus). Click splits the row's section at that point — the clicked row becomes the first of a new section. The new section is named per §2.2 (auto-renumbered default `Set N+1`).

**Role shift under §2.5:** the section-break-missed recovery happens primarily during Phase A by editing the textarea — Sandy adds `Set 2` between the right rows in the source, re-parse fires, the preview reflects the corrected structure before Confirm. §2.1 is the **post-Confirm** mechanism for any other "split this section" need: manual mid-creation splits, recovery from a Phase A oversight, or restructuring later. Available in any section (parsed or manual) once Phase B is active.

### 2.2 — Naming of inline-created sections (if §2.1(b) lands)

> **Locked:** automatic renumbering. Default-named sections renumber to stay sequential. Custom-named sections preserve their name. Aligned with T4 §4 question 2.

When Sandy splits a parsed Set 1 into Set 1 + Set 2 via an inline action, the new section is named `Set N+1` based on count. Adding, splitting, or removing sections triggers auto-renumber of all default-named sections (`Set N` form) to stay sequential. Custom-named sections (Sandy renamed `Set 2` → `Encore`) preserve their name across renumber events.

**Implementation note (locks at spec time, not now):** either make the section's name nullable (null = "render as default `Set N`" at display time and auto-renumber visually) or store the literal string and pattern-match `Set N` on mutation.

### 2.3 — Document-title rows (Frame 4, first row)

> **Locked:** status quo. Rare in practice (Sandy confirmed 2026-06-26 that doc-title noise is uncommon across senders). Manual Discard via the Unknown row's existing affordance is the V1 answer. V2 heuristic detection (per `paste-to-parse-design.md` §5) remains deferred.

### 2.4 — Annotation capture from paste

> **Locked:** extract. Stripped noise-tokens flow into `perGigAnnotation` at paste-resolve time.

The matcher already isolates noise tokens during normalization (em-dash suffix, trailing `[brackets]`, trailing `(parens)`). Today the stripped portion is thrown away. Locked behavior:

- When the matcher strips a noise-token, the trimmed stripped portion is stored as the row's `perGigAnnotation`.
- All stripped patterns concatenate into a single annotation string in source order. No per-pattern routing — whatever was after the title becomes the annotation as-is.
- The annotation is editable inline on the parsed row before Save (composes with §2.5's parsed-row UI). Sandy can keep, edit, or clear.

Worked examples:

| Paste | Title | Annotation |
|---|---|---|
| `INTO THE MYSTIC [first dance]` | `Into The Mystic` | `first dance` |
| `WATERMELON MAN – Ivan Ian John` | `Watermelon Man` | `Ivan Ian John` |
| `KELVINGROVESTREET – solos – Ivan Ian Clare SANDY John [GUITAR CHANGE]` | `Kelvingrove Street` (fuzzy-matched) | `solos – Ivan Ian Clare SANDY John [GUITAR CHANGE]` |
| `MAS QUE NADA (Brazilian)` | `Mas Que Nada` | `Brazilian` |

This is the only T1 decision that changes the data model — `SongRefSchema.perGigAnnotation` is already optional; this populates it at paste-resolve time.

### 2.5 — Two-phase Preview → Confirmed model

> **Locked 2026-06-26.** Replaces earlier §2.5(b) and §2.6 auto-collapse. The paste flow has two explicit phases separated by a `Confirm` button.

**Phase A — Preview (textarea editable, parsed result read-only):**

When Sandy clicks `Paste a setlist instead ›` (T4 §2.1), the expanded paste area renders:

- **Textarea** at the top — pastes here, edits here.
- **Parsed preview** below — sections, song rows, match status (`✓ Matched` / `? Fuzzy → suggestion` / `+ Unknown`), extracted per-gig annotations. **All display, no action buttons.** Row resolve actions (`Yes, that one`, `+ Add to library`, `Pick from library`, `Discard`, `No — new song`) are inactive in Phase A.
- **`Confirm`** button — commits the preview to the main section list. Enabled even when rows are still Fuzzy / Unknown (their resolution happens in Phase B).
- **`Cancel`** link — clears textarea + preview, collapses back to the `Paste a setlist instead ›` link.

The textarea is the source of truth in Phase A. Every edit, after **500ms** of typing-idle, triggers a re-parse and refreshes the preview. Sandy iterates on the source:

- Sees `first half` was parsed as a song row → edits the textarea to write `Set 1`, re-parse updates the preview.
- Sees a Fuzzy row with the wrong suggestion → fixes the typo in the textarea, re-parse updates.
- Sees a section break missed → adds `Set 2` to the textarea between songs, re-parse updates.
- Sees `Howlin Wolf - 13 Jun` is being treated as a song row → deletes that line in the textarea, re-parse updates.

**Phase B — Confirmed (textarea gone, full manual editing):**

When Sandy clicks `Confirm`:

- Textarea + preview disappear.
- Parsed sections + rows are committed to the main section list — identical visual to manual sections from that moment on.
- All row resolve actions are now interactive: Sandy resolves Fuzzy / Unknown rows in place.
- All section/song editing operations are now active: `+ Add song`, `× Remove section`, `+ Add a set`, rename section, inline `Start a new set here ›` (§2.1), drag-reorder per T4 §2.4. No parsed-vs-manual distinction.
- Save remains gated on zero Fuzzy / Unknown rows (existing AC).

**Multi-paste: one-shot per setlist.** After `Confirm`, the paste UI is gone for this setlist. To paste more material into the same setlist Sandy would need to discard and start over. **`Cancel` is reversible** — clicking Cancel clears the textarea/preview and collapses the paste area back to the `Paste a setlist instead ›` link, which can be expanded again. Only Confirm is the one-shot boundary. Locked 2026-06-27.

**What this resolves:**

- Visual asymmetry between parsed and manual sections — there is no distinction post-Confirm. Just sections.
- Conflict between textarea edits and row decisions — row decisions only exist in Phase B; textarea only exists in Phase A.
- First-class editing of parsed sections — fully available in Phase B.
- Textarea-edits-silently-ignored (was §4 question 8) — textarea always re-parses in Phase A; no textarea exists in Phase B.

This decision supersedes the earlier §2.5(b) lean and the §2.6 auto-collapse mechanism. It's a significant reshape of the shipped Story 3.5 paste flow; flag for the Epic 4 surface audit (Action Item #2 from the retro) to plan re-implementation.

### 2.6 — Confirm transition (supersedes auto-collapse)

> **Locked 2026-06-26.** Explicit `Confirm` button replaces the auto-collapse-on-full-resolve mechanism. Sandy decides when to commit; no magic moment.

Defined in §2.5. The `Confirm` button is the only path from Phase A to Phase B. No auto-collapse, no implicit transitions, no "all rows resolved → commit" event.

**Composition with §2.8 (no undo):** once Confirmed, Phase B row actions (`Discard`, `+ Add to library`, `Yes, that one`, `No — new song`) remain final. To recover from a Phase B mistake Sandy fixes it on the setlist overview after Save (`/setlists/<id>`), or starts the setlist over. Phase A actions are not subject to this constraint — they're textarea edits, fully reversible by editing the textarea.

### 2.7 — Re-paste behavior (moot post-§2.5)

> **Resolved 2026-06-26.** Moot under the two-phase model. In Phase A there are no row decisions to lose — textarea edits always re-parse. In Phase B the textarea no longer exists, so re-paste isn't possible anyway (multi-paste is one-shot per §2.5). The clear-to-restart workaround for the shipped behavior is no longer needed.

### 2.8 — Undo on `Discard` / `+ Add to library` / `Yes, that one` (in-flight)

Once Sandy clicks one of these actions, can he take it back? Today: no for Discard, partial for Add to library (the song minted exists; he'd have to delete it manually from his library), partial for Yes/No on fuzzy (he can click the other one).

Options:

- **(a) Status quo** — no undo. Sandy lives with mistakes; deletes from library later if needed.
- **(b) `Undo` link** appears for ~10 seconds after each action, in-line near where the action happened. Composes with the silent-save model — no toasts.
- **(c) Persistent "Discarded rows (N)" expandable section** — shows what was removed, with `Restore` per row. Doesn't cover the other actions.

**My lean:** (a) until Sandy reports actual mistake-pain. Discard is the most likely regrettable click; the recovery cost (paste a fresh fragment in the textarea? Save and live with it?) is low enough that an Undo affordance feels like over-engineering for V1.

## 3. Edge cases

| Input shape | Behavior |
|---|---|
| Empty paste textarea | Preview region empty inside Phase A. No `Confirm` action useful yet (button still present, clicking it commits nothing and collapses the paste area). |
| Paste with only headers, no songs | Sections render with `0 / 0` counts in Phase A preview; section chrome shows in Phase B if 2+ sections (per T4 §2.2). Save allowed (FR-6 permits empty setlist). |
| Paste with one section, all rows matched | Implicit Set 1; in Phase B's main list, section chrome hidden per T4 §2.2. |
| Paste with rows in same section but parser yielded an unwanted split (rare) | Sandy fixes in Phase A by removing the spurious section header from the textarea. Re-parse merges back. If the issue is noticed only post-Confirm, Sandy drags songs across sections per T4 §2.4 (now allowed during creation) and `× Remove`s the empty section. No dedicated merge-sections affordance needed in V1. |
| Paste from `real-example-2.md` (full BIG ED Wedding text) | Document-title row(s) at top show as Unknown in Phase A preview. Sandy deletes the line from the textarea; re-parse drops them. Confirm proceeds with clean sections. |
| Paste with `KELVINGROVESTREET – solos – Ivan Ian Clare SANDY John [GUITAR CHANGE]` | Title-noise stripped per matcher pipeline; matches `Kelvingrove Street` (Fuzzy). Per §2.4, ` solos – Ivan Ian Clare SANDY John [GUITAR CHANGE]` surfaces as the pre-filled annotation in Phase A preview and is editable post-Confirm in Phase B. |
| Sandy edits the textarea in Phase A | Always re-parses 500ms after typing stops. Preview refreshes. No row decisions are at risk — they don't exist until Phase B. |
| Sandy hits Cmd-V into the textarea twice in Phase A | Second paste overwrites the first (native textarea behavior). Parser re-fires. Existing behavior. |
| Sandy expands paste area in Phase A, types nothing, clicks Cancel | No state lost. Paste UI collapses back to the `Paste a setlist instead ›` link. |
| Sandy adds a manual song via `+ Add song` while still in Phase A (paste area expanded, not yet Confirmed) | The manual section is created in the main list outside the paste area. Manual songs and the in-flight paste preview coexist visually until Sandy clicks Confirm or Cancel; mildly awkward but not broken. Workflow is implicitly serial — most users will finish the paste decision before adding manually. |
| Sandy clicks Confirm with Fuzzy / Unknown rows remaining | Phase B commits with those rows as-is. The rows appear in the main list with their resolve actions now interactive. Save remains gated on zero unresolved rows. |
| Sandy clicks Confirm with zero songs (only headers were parsed) | Sections are committed empty. Save allowed (FR-6). |
| Sandy clicks Cancel mid-paste | Textarea and preview cleared. Paste UI collapses. No commits. |
| After Confirm, Sandy wants to paste more text | Not supported in V1 (multi-paste one-shot per §2.5). To recover Sandy would discard the draft and start over. |

## 4. Open questions

All §2 decisions resolved 2026-06-26. Remaining open items for the broader design pass:

- **iPhone variant of paste (§7):** the V1 cut assumes paste is MacBook-only. Worth probing — Sandy gets the WhatsApp on iPhone; the natural flow might be paste-on-iPhone before switching devices. Not yet confirmed.

## 5. Composition with T3 and T4

T1 sits on top of T4's locked surface. Everything T4 locked applies:

- §T4.2.1 collapsible paste area — T1 is the journey that *uses* it.
- §T4.2.2 section chrome — parsed multi-section input shows chrome; parsed single-section input doesn't.
- §T4.2.3 `× Remove section` — works on parsed sections same as manual ones.
- §T4.2.4 append-only — applies; if Sandy adds a manual song mid-resolve, it goes to the end.
- §T4.2.5 localStorage draft — persists the textarea, the row decisions, and the manual additions. Restored on next visit.
- §T4.2.6 sticky Save bar — same.
- §T4.2.7 breadcrumb — same.
- §T4.2.8 `Unsaved draft` / `Draft saved <when>` indicator — same.
- §T4.2.9 picker visual unification — N/A in T1 (no picker; SongSearchRow only summons when Sandy uses manual `+ Add song`).
- §T4.2.10 no completeness cue on minted songs — same (Fire Eater minted via `+ Add to library` looks identical to populated songs).

T1's only original chrome additions are inside the expanded paste area (parsed rows, action buttons, the §2.1 inline section-break affordance if it lands) and the §2.4 per-gig annotation capture if it lands.

T3 composes via §2.10 — minted songs surface as `Last edited <when minted>` in their detail pages later.

## 6. V1 cut for T1

- **Paste-and-parse pipeline:** parser and matcher are unchanged (Stories 3.4 + 3.5 ship as-is).
- **Two-phase model (§2.5):** Phase A preview (textarea editable, parsed rows read-only) → `Confirm` button → Phase B (textarea gone, full manual editing palette on committed sections + interactive row resolution).
- **Phase A re-parse:** 500ms debounce after typing-idle in the textarea.
- **Phase A Cancel:** clears state, collapses paste UI back to the `Paste a setlist instead ›` link.
- **Phase B affordances:** all standard creation-phase chrome — `+ Add song`, `× Remove section`, `+ Add a set`, inline `Start a new set here ›` (§2.1), section rename, drag-reorder per T4 §2.4.
- **Annotation extraction (§2.4):** stripped noise-tokens populate `perGigAnnotation` at parse time; previewed in Phase A, editable in Phase B.
- **Section auto-renumbering (§2.2):** default-named sections renumber on add/remove/split; custom-named sections preserve their name.
- **Multi-paste:** one-shot per setlist. After Confirm (or Cancel), the `Paste a setlist instead ›` link is gone.
- **Document-title rows:** status quo. Sandy deletes from textarea in Phase A or discards in Phase B (§2.3).
- **Save gating:** unchanged. Zero Fuzzy / Unknown rows + Venue + Date.
- **Out:** undo on Phase B Discard, multi-paste post-Confirm, smart annotation routing per pattern, multi-candidate fuzzy, multi-line title joining, edit-the-source-re-parse-in-Phase-B (Phase A handles this already).

**Implementation note:** the two-phase model is a significant reshape of the shipped Story 3.5 paste flow — controls active throughout in current build vs. gated by Phase B in V1. This should be planned as a re-implementation, not a small refactor. Flag for Action Item #2 (Epic 4 surface audit) when scoping.

## 7. Out of scope for T1

- Parser algorithm tuning (Jaro-Winkler threshold, section-header patterns) — locked in `paste-to-parse-design.md`.
- Multi-candidate fuzzy (top-3 instead of top-1) — V2.
- Pre-paste source-cleaning (auto-Discard headers, key/tempo extraction) — V2.
- Continuation lines, multi-line title joining — V2.
- Per-row "re-parse this row" — out.
- Cloning from a previous setlist — V2 / belongs in T-clone-existing.
- iPhone variant of paste — confirmed out for V1 (Sandy 2026-06-26: "I won't paste on the phone"). Phase A's textarea iteration model is MacBook-shaped; iPhone paste in V1 would be a different surface. Revisit in V2 if the habit changes.
- **Note for the iPhone-side journey work (separate storyboards, not yet drafted):** Sandy expects to make *manual edits* to setlists on iPhone — re-order songs, fix annotations, tweak after-the-fact. iPhone manual editing of an existing setlist is in scope for V1; paste is not. The iPhone variant of T4-manual is its own journey.

## 8. Mockup gate

Per [[feedback-mockup-decisions-before-dev]], the locked decisions in §2 must be visually mocked up — alongside T3 and T4 — before any T1-related implementation work begins. Visual draws from existing locked DESIGN.md tokens only.

Note: §2.5 and §2.6 are the most structurally consequential — they change where the parsed rows live in the page. Mockup time must show paste area collapsed, paste area expanded with un-resolved rows, and the post-auto-collapse state with parsed sections merged into the main list.
