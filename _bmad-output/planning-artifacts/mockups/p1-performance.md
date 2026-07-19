---
title: Mockup brief — P1 performance-mode surfaces (iPhone)
surface: /performance/:setlistId/:songIndex + jump overlay + section-break orientation + Currently-performing strip
atmosphere: iPhone performance — "Club Warm" (warm-dark, dim-bar, engraved)
journey: P1 — Perform a set
journey-doc: _bmad-output/planning-artifacts/journeys/journey-p1-performance.md
visual-tokens: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md (Performance palette + typography)
experience-spine: _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md
status: mockup approved 2026-07-19 (three-iteration Claude Design pass; all deferred picks locked; see § "Approved picks and locks")
---

# P1 — performance-mode surfaces — mockup brief

## Approved picks and locks (2026-07-19)

Three iterations of Claude Design composition against real content. All deferred questions resolved. Rendered mockups under `rendered/p1-performance/iteration-{1,2,3}/`. Iteration 3's `state-2a-detour-v1-floor-text-chart.png` (structure) + iteration 2's chord glyph rendering (notation) together represent the approved chord-chart direction.

### Deferred picks — locked

- **Jump-overlay shape:** **5-a** — pinned search field above the scrolling overview, setlist matches first, library matches under `In library`. (Question 1.)
- **Jump-affordance placement:** **A2** — third control in the bottom toolbar between `‹` and `NEXT ›`, rendered as `≡ jump`. Preview slot compresses (`next: Wat…`) — accepted trade-off. (Question 2.)
- **Detour-state visual treatment:** **D3** — word `DETOUR` in the top-right position slot, no numeric indicator, no hairline. (Question 3.)
- **Currently-performing strip detour signal:** **Both** — italic song title + `↩` prefix (`Currently performing: ↩ Sunny`). (Question 4.)
- **Section-break enter affordance:** **S2** — bottom-fixed `Start Set 2 ›` CTA parallel to `Start performance ›`. Highlight on Set 2's first song signals intent; CTA is the tap target. Set 1 rows render at **full strength** (not dimmed) — they remain valid tap targets for encores and skipped-song replays. (Question 5.)

### Chord-chart direction — locked

Structure follows the **V1 floor** (text run, no cards, no elevation, line breaks respected as authored). Notation follows the **V2 aspiration** (compact chord glyphs — `Dbmaj7` renders as `Db△`, `Gm7` as `G` with `m7` superscript, `Gb9` as `Gb` with `9` superscript, `G7sus4` as `G` with `7sus4` superscript, etc.).

The shipped `<ChordChart text={...}>` component must therefore:
- Render authored text lines verbatim in mono/slab at `perf-chord` size, honouring line breaks.
- Parse each chord token and render it with compact typographic notation (base note + accidentals + tension/quality as superscript or symbol).
- **No card borders. No 2-column grid. No elevation.**

**Authoring convention:** Sandy authors chord charts with a maximum of **3–4 chords per line** to fit iPhone width at `perf-chord` 32. Longer musical lines (e.g. `Fm Ab7 Dbmaj7 Gm7 C7`) get broken across two authored lines (`Fm Ab7 Dbmaj7 / Gm7 C7`). This is a personal editorial discipline, not enforced by the app.

The **V2 aspiration** (engraved chord-glyph cards in a 2-column grid) is **retired**. It was invalidated by real-content composition — cards clipped past the iPhone edge at 5-chord lines, and the fixed grid imposed a rhythm the music doesn't have.

### Chrome fixes — locked

- **Key/patch chrome:** single inline row below the title on the same lifted surface as the title (or a compact strip just below — the token-extraction implementation story owns exact surface stacking against `board-1-performance.png`). Format: `G   Rhodes` — key glyph (large mono) then patch (smaller mono), generous whitespace, no `KEY` / `PATCH` labels, no two-column cards. Applies to every performance-card state.
- **Section-break dimming:** Set 1 rows render at full strength (no reduced opacity). Any Set 1 row remains tappable as a jump target from the section-break state.
- **Return-arrow glyph:** `↩` (U+21A9 LEFTWARDS ARROW WITH HOOK) everywhere the brief calls for a return arrow. `↵` is not used.
- **Section-count format:** section headings render as `Set 1   6 songs` / `Set 2   5 songs` — literal count + word `songs`, matching the T4 MacBook lock.

### State inventory (approved)

Approved renderings live in `rendered/p1-performance/iteration-2/` for all states except State 2 (the detour card), which is superseded by iteration 3's `state-2a-detour-v1-floor-text-chart.png` (structure) once the compact-notation rendering is applied per the chord-chart lock above.

| State | Approved file |
|---|---|
| 1a — Plan song, chord chart | `iteration-2/state-1a-plan-v1-floor-text-chart.png` (structure only; apply compact notation at implementation) |
| 2 — Detour to Sunny | `iteration-3/state-2a-detour-v1-floor-text-chart.png` (structure) + compact notation per iteration-2 chord glyphs |
| 3 — Last song | `iteration-2/state-3-last-song.png` |
| 4 — Wake-lock lost | `iteration-2/state-4-wake-lock-lost.png` |
| 5-a-i — Overlay, setlist match | `iteration-2/state-5-a-i-overlay-setlist-match.png` |
| 5-a-ii — Overlay, library reach | `iteration-2/state-5-a-ii-overlay-library-reach.png` |
| 6 — Section-break, S2 CTA | `iteration-2/state-6-section-break-S2-cta.png` |
| 7 — Currently-performing strip, detour signalled | `iteration-2/state-7-strip-detour-signalled.png` |

State 1b (V2 aspiration chord chart) is **not approved** and should not be treated as a design target. It's retained in `iteration-2/state-1b-plan-v2-chord-grid.png` for historical reference only.

### Downstream

- Epic 5+ stories that touch performance mode reference the approved files above.
- The token-extraction implementation story owns:
  - Precise chord-notation transformation rules (which tensions become superscripts, which become symbols, edge cases like slash chords `Bm/D`, altered dominants `G7♭9`).
  - Final surface stacking for the title + key/patch block against `board-1-performance.png`.
  - Chord-chart line-overflow behaviour if the 3–4 chord authoring convention is breached (wrap, overflow, or shrink — deferred).

---

This is the **iPhone performance atmosphere** brief. One brief, four surfaces, because the surfaces are one system: the performance card, the setlist overview used as a jump overlay, the setlist overview used as a section-break orientation view, and the Currently-performing strip that carries the exit/resume cycle. They share atmosphere, chrome, and the state machine locked in the P1 journey doc.

Downstream composition (Claude Design) must render **every alternative** listed in the three "compose all N" sections below — Sandy will pick from concrete alternatives on real content, then a follow-up pass locks the survivors.

## Surfaces

- `/performance/:setlistId/:songIndex` — the performance card. Full-screen, no bottom tabs, no top nav.
- **Jump overlay** — the same setlist overview surface used pre-gig (a MacBook-side artefact) rendered as an overlay on top of performance. Different chrome per context (see § "Overview in three contexts"). iPhone rendering, dark atmosphere.
- **Section-break orientation view** — the same setlist overview, scrolled and highlighted differently. iPhone rendering, dark atmosphere.
- **Currently-performing strip** — top-anchored strip on the setlist overview after a `×` exit. iPhone rendering, dark atmosphere.

## Purpose

Sandy is on stage. Phone face-up on top of the Nord. Twenty-second glances between passages. Every pixel earns its keep. The interface must survive:

- Linear progression through a plan (B1).
- Step-back-one-song (B2).
- Jumps to any song in the setlist (B3) or the library (B4) — detours against a persistent plan cursor.
- Between-section orientation (B8) with the phone put down for 10–15 minutes.
- Deliberate `×` exit (B5) and cold re-entry (B6).
- Inert end-of-setlist (B7); no ceremony (B9).

## States to mock

Twelve labelled compositions across four surfaces. Grouped by surface. States 5-a/5-b/5-c are the **three alternative shapes** for the jump-overlay question; states A1/A2/A3 are the **three alternative placements** for the jump affordance; states D1/D2/D3 are the **three alternative treatments** for the detour-state position indicator.

### Performance card (core surface)

1. **Plan song (baseline).** Sandy is 5 / 11 on the plan. Not on a detour. Wake lock held. Not the last song. All four corners visible. Real content per § "Content for the mock".
2. **Detour song.** Sandy has jumped from song 5 to a target elsewhere. Plan cursor is still at 5 (return anchor). The card shows the detour song. Compose all three variants below at states **D1**, **D2**, **D3**.
   - **D1** — position indicator reads `↩ 5 / 11` (return-arrow glyph prefix; the number is the return anchor, not the detour song's setlist position).
   - **D2** — position indicator reads `detour · SUNNY` (small-caps "detour" label + return-anchor song title in mono).
   - **D3** — numeric indicator dropped entirely; a subtle chrome cue (e.g. a hairline of `accent` along the top edge of the card, or a low-emphasis `on a detour` label) is the only signal.
3. **Last song of the setlist.** Position 11 / 11. `NEXT ›` is visually unchanged but rendered inert (per Story 4.4 shipped). Preview slot in the toolbar is empty. Rest of card is a plan song (not a detour).
4. **Wake-lock lost.** Same as State 1 but with the `☽` "Screen may sleep" indicator visible in the top-right (between the `×` and the position indicator per shipped placement). All other content unchanged. This is a rare but visible state.

### Jump affordance placement (compose all three, on State 1 chrome)

Where does the "open setlist overview" control live on the performance card? Compose the baseline (State 1) card three times, differing only in the affordance's placement.

- **A1 — Top chrome.** Affordance sits in the top row alongside the position indicator, low-emphasis (secondary text, small icon or short label). Shares the top-right space with the position indicator and wake-lock glyph when present.
- **A2 — Bottom toolbar.** Affordance sits inside the bottom toolbar as a third control, between `‹` and `NEXT ›`. Preview text moves to accommodate (or the affordance replaces the preview slot when open is imminent — pick the composition that reads best; document the trade-off in the mock caption).
- **A3 — Dedicated corner.** Affordance is a distinct control in a corner not currently occupied — most likely mid-right edge, off the top and bottom toolbars, as a small "list" glyph. Deliberately spatially separated from `×`, `‹`, and `NEXT ›` per the "four corners, four purposes" spatial-safety rule in DESIGN.md.

The affordance icon/label should read as "open list" or "jump to song", not as "menu" (avoid hamburger connotations). Copy TBD at mockup — candidates: `≡ setlist`, `↔ jump`, `list`, iconography only. Downstream can pick a plausible glyph and label per placement; Sandy will confirm at audit.

### Jump overlay — compose all three shapes

The overlay opens on top of the performance card. Performance state is preserved (wake lock held, current song remembered as plan cursor). The overlay is dismissible without cost.

Compose each of the three shapes as **two sub-states**:

- **-i (setlist match)** — Sandy is scanning/searching for a song that IS in tonight's setlist (a B3 jump). Show the overlay with sections and songs visible; highlight one candidate row as tap target (e.g. `Sunny`, which is in Set 2 in the mock content).
- **-ii (library reach)** — Sandy is searching for a song that ISN'T in tonight's setlist but IS in the library (a B4 jump). Only meaningful for shapes with a search field (5-a-ii, 5-c-ii). Show setlist matches first (labelled `In this setlist`), library matches second (labelled `In library`). Query for the mock: `alm` → matches `Almost Like Being In Love` in library (not in setlist). Skip 5-b-ii (shape (b) has no search).

The three shapes:

5-a. **Overview + pinned search field.** A search input sits pinned at the top of the overlay (below the "you are jumping from" affordance strip — see § "Overview in three contexts"). Below it, the full setlist overview scrolls. Typing filters the overview in place: setlist rows filter first, and when a query has no setlist hits or partial hits, library rows appear labelled `In library` beneath the setlist section. One surface, one path.
   - **5-a-i** — setlist match (no query, or query `sun` filtering to `Sunny`).
   - **5-a-ii** — library reach (query `alm`, library section revealed).

5-b. **Overview alone, no search.** No search field. Overlay is just the setlist overview, scrollable, with sections and songs visible. Sandy scans and taps. Library reach is impossible from this surface — the shape rejects B4 entirely (or requires a separate escape hatch; the shape as posed offers none).
   - **5-b-i** — setlist match. Just the overview, sections rendered, tap targets visible.

5-c. **Overview + separate search picker (two paths).** The overview renders without a search field; a distinct "search library" affordance (e.g. a magnifying-glass control in the overlay chrome) opens a **separate** search picker surface — text field on top, results below. The picker's results are setlist-first then library, same as (a). Two paths: scan the overview for known-position songs, or open the picker for name-driven lookup.
   - **5-c-i** — the overview shape (no search field visible; the search-picker affordance is visible in the chrome but not activated).
   - **5-c-ii** — the search picker in its activated state (separate surface), query `alm`, results grouped `In this setlist` (empty) / `In library` (one match).

### Section-break orientation view (B8)

6. **Section-break state.** Sandy has just tapped `NEXT ›` on the last song of Set 1. The overlay opens automatically, scrolled to Set 2, with the first song of Set 2 highlighted as the visible target. A "start section" affordance is present. Wake lock still held. Chrome is distinct from the jump overlay — see § "Overview in three contexts".

### Currently-performing strip (B5 aftermath)

7. **Setlist overview with strip.** Sandy has tapped `×` from mid-performance. He lands on `/setlists/:setlistId`. The `Currently performing: [song] · Resume ›` strip renders top-anchored above the overview. This is an existing shipped visual (Story 4.3); the mock formalises its Club Warm composition on iPhone. If Sandy was on a detour when he exited, use `Sunny` as the current song and note the detour state in the strip (or don't — see § "Deferred to mockup" question 4).

## Overview in three contexts

The same setlist-overview surface renders in three contexts across P1. Same layout, different chrome. Each surface's mock must make its context legible at a glance.

Per journey doc P1 §B8, the three contexts differ **only by scroll position and highlight** — plus a small amount of context-specific chrome where an interaction is context-specific (dismiss the overlay; enter a new section). The mock must make each context legible without inventing prose that the journey doc doesn't sanction.

| Context | When | Chrome differences |
|---|---|---|
| **Pre-gig prep** | Sandy is orienting himself before starting the set (arrived via Tonight card). Wake lock NOT held. | Bottom-fixed `Start performance ›` CTA visible. No dismiss strip. Read-only view. |
| **Mid-performance jump (B3 / B4)** | Sandy has opened the overlay from the performance card. Wake lock still held. Plan cursor is a specific song. | No prose strip. Small `‹` dismiss control top-left (parallel to section-break `‹`). No `Start performance ›` CTA. Rows are tap-to-jump; the plan cursor row is highlighted in `accent` (carries the "you are jumping from here" semantic). |
| **Section-break orientation (B8)** | Sandy has just tapped `NEXT ›` on the last song of the previous section. Wake lock still held. | Overview auto-scrolled to the new section. First song of the new section highlighted as the enter target. No top prose strip. Enter affordance TBD — see § "Deferred to mockup" question 5. `‹` from this view returns to the last song of the previous section. |

For each of the three jump-overlay shapes (5-a, 5-b, 5-c), the "mid-performance jump" chrome above applies.

Compose the pre-gig prep context implicitly through the section-break state (State 6) and jump-overlay states (5-*) contrasting against it. A separate "pre-gig prep" state is **not** in this brief — the pre-gig setlist overview is a separate iPhone journey not yet drafted.

## Layout & elements

### Performance card

Inherited from shipped Story 4.1–4.5. Reference `web/src/routes/performance-card.tsx` for the built structure. Do not redesign the layout — this brief locks the additive elements (jump affordance, detour state) only.

```
┌──────────────────────────────────────────┐
│ ×                    ☽?  ↩? 5 / 11       │  fixed top chrome
│ Sunny                                    │  title (serif, perf-title 36)
│ Am  Rhodes                               │  key + patch (mono, perf-meta 22)
├──────────────────────────────────────────┤
│                                          │
│   Am7    D7    Gmaj7    Cmaj7            │  scrollable chord region
│   ...                                    │  (mono/slab, perf-chord 32)
│                                          │
│   {per-gig annotation, italic accent}    │  (serif italic, perf-annotation 20)
│                                          │
├──────────────────────────────────────────┤
│ ‹    next: Trouble Man        NEXT ›     │  fixed bottom toolbar
└──────────────────────────────────────────┘
```

The jump-affordance placement variants (A1/A2/A3) slot into this layout at the three positions described above.

### Jump overlay (all three shapes)

Full-screen overlay on top of the performance card. Slides up from the bottom or fades in — motion spec deferred to implementation (DESIGN.md says ≤150ms; downstream mock is static so this doesn't matter).

No prose strip. Small `‹` dismiss control top-left is the only chrome above the overview content.

Below the `‹`, depending on shape:
- **(a)** — search input, then the setlist overview scrolls.
- **(b)** — the setlist overview scrolls directly.
- **(c)** — the setlist overview scrolls directly; a small search-picker affordance sits in the top chrome alongside `‹`.

The setlist overview itself is a vertical stack of sections (`Set 1`, `Set 2`) with song rows. Rows show title (serif) + key (mono, small). No `NEXT ›` button, no wake-lock indicator, no position indicator inside the overlay — those belong to the performance card underneath. The plan cursor's row is highlighted in `accent` (`current-row marker` per DESIGN.md Performance palette) — this is the sole signal telling Sandy "you are jumping from here."

### Section-break orientation view (State 6)

Same setlist-overview surface. Per P1 §B8, the difference from the other two contexts is **scroll position and highlight**, not prose chrome. Compose accordingly:
- No top prose strip.
- Overview auto-scrolled so the first song of Set 2 is prominent (top of viewport or just below a small breathing gap).
- First song of Set 2 highlighted as the enter target (visual treatment: full-row `accent` fill, `bg`-colored text — same "current row" treatment used for the plan cursor in the jump overlay).
- Enter affordance — TBD per § Deferred question 5. Compose both alternatives:
  - **S1** — the highlighted first-song row IS the affordance. Tap the row to enter. No separate CTA.
  - **S2** — a bottom-fixed CTA (`Start Set 2 ›` or similar) parallel to the shipped `Start performance ›` shape. Highlight signals intent; CTA is the tap target.
- `‹` back control (top-left, low-emphasis) returns to the last song of Set 1. This is the only chrome addition beyond scroll+highlight.

### Currently-performing strip (State 7)

Existing shipped surface. On iPhone / Club Warm:
- Full-width strip pinned at the top of `/setlists/:setlistId`.
- `accent` background, `bg` text. ~48pt tall.
- Left: `Currently performing: Sunny` (serif, italic if the current song is a detour target).
- Right: `Resume ›` button (mono/serif hybrid — match shipped).
- Below the strip, the setlist overview renders normally (with `Start performance ›` CTA hidden because performance is active).

## Content for the mock

Use these locked real values across every state. Continuity across states matters — the same song names in the same sections so Sandy can compare compositions on identical content.

- **Band:** `The Jack Ruby 5`
- **Venue:** `Howlin Wolf`
- **Setlist total:** 11 songs across two sets. All titles drawn from the documented set (no invented / reprise placeholders).

**Set 1** (6 songs):
```
1  Into The Mystic
2  Comin' Home Baby
3  Mas Que Nada
4  Move on Up
5  Kelvingrove Street       ← plan cursor for detour states / return anchor
6  Watermelon Man
```

**Set 2** (5 songs):
```
7  Fire Eater
8  Cantaloupe Island
9  Sunny                    ← detour target (B3)
10 In and Out
11 Trouble Man
```

The section-break enter target (State 6) is Set 2's first song, `Fire Eater` (position 7).

**Library song (not in tonight's setlist):** `Almost Like Being In Love` — the target for the B4 library-reach search states (5-a-ii, 5-c-ii). Query: `alm`.

**Performance card content per state:**

- State 1 (plan, baseline): song 5 = `Kelvingrove Street`. Key: `G`. Patch: `Rhodes`. Chord chart: 4 rows of illustrative slab-mono chords (e.g. `Gmaj7  Am7  Bm7  Cmaj7`), any plausible progression. No per-gig annotation.
- State 2 (D1/D2/D3): detour to `Sunny` (position 9 in the plan, currently rendered as the detour). Key: `Am`. Patch: `Rhodes`. Return anchor: song 5 = `Kelvingrove Street`. Chord chart: 4 rows of illustrative slab-mono. Per-gig annotation present: `for Ivan's solo — slow the outro` (italic serif in `accent`).
- State 3 (last song): song 11 = `Trouble Man`. Key: `Em`. Patch: `Wurli`. Chord chart: 4 rows. No annotation.
- State 4 (wake-lock lost): identical to State 1 with `☽` glyph visible.

**Preview slot** ("next: [song]") in the bottom toolbar:
- State 1: `next: Watermelon Man`
- State 2 (D1/D2/D3): `next: Watermelon Man` (because `NEXT ›` from the detour returns to plan cursor + 1 = song 6, `Watermelon Man`)
- State 3: preview empty
- State 4: `next: Watermelon Man`

**Jump-overlay content:**
- No top prose. `‹` dismiss control top-left.
- Plan cursor row `Kelvingrove Street` highlighted in `accent` fill (this carries the "jumping from" semantic).
- For 5-a-ii / 5-c-ii, query `alm`, results:
  - `In this setlist` — (empty, or omitted if no results)
  - `In library` — one row: `Almost Like Being In Love`. Key visible: `F`.
- For 5-a-i, if a query is shown, use `sun` → filters to `Sunny` (setlist match, Set 2).

**Section-break state (State 6):** overview scrolled to Set 2. First row of Set 2 (`Fire Eater`) highlighted in `accent` fill. Compose both S1 (row-is-affordance, no CTA) and S2 (bottom CTA `Start Set 2 ›`). `‹` back visible top-left.

**Currently-performing strip (State 7):** `Currently performing: Sunny` (Sandy exited while on a detour to `Sunny`). `Resume ›` right-aligned.

## Microcopy (final strings)

| Element | String | Notes |
|---|---|---|
| Position indicator (plan) | `5 / 11` | Mono. Shipped. |
| Position indicator (detour) — D1 | `↩ 5 / 11` | Mono; `↩` glyph prefix. The number is the return anchor. |
| Position indicator (detour) — D2 | `detour · SUNNY` | Small-caps "detour" + return-anchor song title in mono. |
| Position indicator (detour) — D3 | *(numeric indicator absent)* | Chrome cue only. Downstream picks the chrome cue; suggested: hairline `accent` along the top edge, or a low-emphasis word `detour` in the position slot. |
| Wake-lock lost glyph | `☽` | Shipped. Aria label: `Screen may sleep`. |
| Bottom toolbar preview label | `next: [song title]` | Mono. Lowercase `next:` (no colon-space vs. sentence-case issue — always lowercase `next:` per shipped). |
| `NEXT ›` primary action | `NEXT ›` | Shipped. All-caps serif on `accent` fill. |
| `‹` step back | `‹` | Shipped. Glyph only. |
| `×` exit | `×` | Shipped. Glyph only. |
| Jump-affordance label (A1/A2/A3) | *(deferred — see § "Deferred to mockup" question 2)* | Candidates: `≡ setlist`, `↔ jump`, `list`, iconography only. |
| Jump-overlay dismiss | `‹` | Glyph only. Top-left. Parallel to section-break `‹`. |
| Jump-overlay setlist group label | `In this setlist` | Small-caps section heading, `text-secondary`. Only present when a query has any setlist matches. |
| Jump-overlay library group label | `In library` | Small-caps section heading, `text-secondary`. Only present when library results are shown (5-a-ii, 5-c-ii). |
| Search field placeholder (5-a, 5-c picker) | `Search this setlist or library` | Serif. |
| Section-break enter CTA (only for S2 variant) | `Start Set 2 ›` | Serif. `accent` fill. Full-width. See § Deferred question 5. |
| Currently-performing strip | `Currently performing: [song title]` | Serif. `Resume ›` right-aligned. Shipped. |
| Currently-performing `Resume` | `Resume ›` | Shipped. |
| Detour indication in strip (State 7) | *(deferred — see § Deferred question 4)* | If Sandy exited during a detour, does the strip signal that? Candidates: (i) italicise the song title, (ii) prepend `↩`, (iii) do nothing (return-anchor state is implicit in the resumed card). |

Per voice rules (EXPERIENCE.md): no exclamation marks, no emoji, no encouragement, no ceremony.

## Locked constraints (composition rules)

These come from the P1 journey doc (§ "Locked decisions") and adjacent locked memories. Non-negotiable for the mock:

- **Four corners, four purposes.** `×` top-left; position indicator top-right; `‹` bottom-left; `NEXT ›` bottom-right. Spatial separation is a safety primitive. The jump affordance MUST NOT displace any of these into a shared corner. (DESIGN.md "Don'ts" — spatial-separation rule.)
- **`NEXT ›` never terminates.** Last-song `NEXT ›` is inert (disabled visual + no-op onClick). It must not transform into `End performance ›` or any destructive action. (P1 §B7, Story 4.4, `[[feedback-no-terminate-on-advance-gesture]]`.)
- **No swipe or tap-anywhere navigation.** All navigation is button-driven. The chord region scrolls; scroll must not conflict with navigation. (P1 §B12, `[[feedback-check-scroll-conflict]]`.)
- **Jump overlay preserves state.** Opening the overlay does NOT release wake lock, does NOT unmount the performance card underneath, does NOT change the plan cursor. The overlay is a *view*, not an exit. (P1 §B3, decision 10.)
- **Plan cursor is persistent.** On a detour, the plan cursor stays at the return anchor. `NEXT ›` from a detour returns to `plan cursor + 1`. `‹` from a detour undoes the jump (returns to the return anchor, not to `detour - 1`). This is visible-through-behaviour; the mock must make the return-anchor legible in the overlay (highlighted row on `Kelvingrove Street`, not on the detour song). (P1 §B3, decision 1.)
- **One overview surface, three contexts.** The setlist overview renders identically in structure across pre-gig prep, mid-performance jump, and section-break orientation. Chrome differs; layout does not. (P1 §B8, decision 5.)
- **No end-of-set ceremony.** No summary card, no `End performance ›`, no post-gig congratulation. `×` is the universal exit. (P1 §B9, decision 6.)
- **Jump targets are name-driven, not positional.** No "go to song 12" affordance. Search / scan by title only. (P1 decision 3.)
- **Unified jump scope.** Setlist and library results live in the same search surface. Setlist first, library second. No separate "library escape hatch" flow. (P1 decision 2.)
- **Currently-performing strip preserves detour state.** After `×`, `Resume ›` returns Sandy to the exact song (plan or detour) he left. The strip surfaces the current song, which is the detour target if he was on a detour. (P1 §B5, decision 8.)
- **Backgrounding is invisible.** No visual state for "returned from background." Card renders as it was. (P1 §B6, decision 9.)
- **Wake-lock indicator does not propagate to the overlay.** If the wake lock is lost while the jump overlay is open, the `☽` glyph renders on the performance card underneath (out of sight) but NOT on the overlay's chrome. Sandy sees it again when the overlay dismisses. (Locked 2026-07-18.)

## Visual tokens

Use the **Performance atmosphere** ("Club Warm") from DESIGN.md:

- Palette: `bg #1a1209` (warm-dark), `surface #241910` (slightly lifted), `text-primary #f1e6cf` (warm cream), `text-secondary #c9b486`, `accent #e6b855` (amber/gold), `accent-strong #f0c668`. WCAG AAA (7:1+) required for every text/background pair.
- Type: editorial serif for titles (song titles, top-strip prose, `NEXT ›` label); mono/slab for chord glyphs, key/patch, position indicator, preview slot. `perf-title` 36 / `perf-chord` 32 / `perf-meta` 22 / `perf-annotation` 20 / `perf-body` 18 floor / `section-heading` 22.
- Spacing: 4pt base unit; tokens per DESIGN.md "Layout & Spacing". iPhone edge-to-edge inside safe-area insets (47pt top, 34pt bottom). Horizontal gutter 16pt.
- Elevation: no shadows over 4pt. Cards on warm-dark use `surface` lift, not shadow. Chord-glyph card treatment (if any) uses `rounded.chord-glyph` 8pt.
- Motion: static mockups — no motion spec required. Downstream should assume ≤150ms transitions honour `prefers-reduced-motion` in implementation.
- Color is never the only signal. Detour states pair chrome cue (D3) or icon/label (D1/D2) with the semantic. Section-break state pairs highlighted row with top-strip copy.

Do not introduce colors, faces, weights, or visual tokens not present in DESIGN.md. Do not compose in the practice (cream) atmosphere anywhere.

## Out of scope for this surface

The mock should NOT include any of the following — they belong to other surfaces, later journeys, or are V1-rejected:

- **Bottom tab bar.** Hidden in performance mode. Not visible in any state.
- **Top nav.** iPhone has no top nav in performance mode.
- **Setlists home surface (`/`).** Reached via `×` → overview, not directly. Separate journey.
- **iPhone library tab** (`/library`). Separate journey. Library reach is only visible inside the jump overlay's search results (5-a-ii, 5-c-ii).
- **Pre-gig setlist overview surface** (the pre-performance orientation view). The "one view, three contexts" pattern *mentions* it but the pre-gig context itself is a separate iPhone journey not yet drafted.
- **Edit affordances inside the overview** — reorder, annotate, delete. iPhone overview is read-only orientation in P1.
- **Multi-band chrome / band switcher.** V1 assumes single active band.
- **Post-gig ceremony** — summary card, "songs played tonight," share. B9 rejects this in performance mode; if it exists elsewhere it's a separate surface.
- **`End performance ›` button.** Rejected by decision 6. `×` is universal exit.
- **Confirmation dialogs / modals** for jump, exit, or section-break. All performance-mode transitions are single-tap and reversible; no confirms.
- **Positional jump ("go to song 12") affordances.** Rejected by decision 3.
- **Swipe gestures, tap-anywhere advance.** Rejected by decision 12.
- **Notification / deep-link entry points.** Not in V1 (P1 § Entry points).
- **iPhone practice atmosphere (cream).** iPhone default atmosphere is dark; performance mode is Club Warm. No cream anywhere.
- **Setlist overview MacBook variant.** This is an iPhone brief.

## Deferred to mockup

Downstream should compose all alternatives listed below and label each clearly. Sandy will pick from the concrete compositions.

1. **Jump-overlay shape (a) vs (b) vs (c).** Compose all three per § States (5-a, 5-b, 5-c). Sandy will pick one.
2. **Jump-affordance placement (A1 top / A2 bottom / A3 dedicated corner).** Compose all three on State 1 chrome. Sandy will pick one. Also propose an affordance icon/label per placement; Sandy will pick / veto at audit.
3. **Detour-state position indicator (D1 icon prefix / D2 label + song / D3 dropped-numeric + chrome cue).** Compose all three on State 2 content. Sandy will pick one.
4. **Currently-performing strip: signal detour explicitly?** State 7 renders the strip with `Sunny` as the current song. Should the strip signal that Sunny is a detour target (not the plan cursor)? Compose one variant with an explicit signal (e.g. italicise the song title, or prepend `↩`) and one without. Sandy will pick.
5. **Section-break enter affordance (S1 row / S2 CTA).** Per P1 §B8, an enter affordance exists but its shape is deferred to mockup. Compose both:
   - **S1** — the highlighted first-song-of-new-section row IS the tap target. No separate CTA.
   - **S2** — a bottom-fixed CTA parallel to `Start performance ›` (candidate copy `Start Set 2 ›`). Highlight signals intent; CTA is the tap target.
   Sandy will pick.

## Open micro-questions

Answer before handoff to Claude Design:

- **Jump-affordance label copy.** Candidates listed above. Sandy will lock at mockup audit. Do NOT canonicalise a label before the mock; downstream picks a plausible one per placement.
- **State 7 detour signal.** See Deferred question 4.

## Source-doc cross-references

- P1 § Framing (why this matters).
- P1 § "What exists in the build today" (shipped vs. this-brief-governs).
- P1 § Branches B1–B9 (state machine — each branch drives a mock or a locked constraint).
- P1 § Locked decisions (all 12 — see § Locked constraints above).
- P1 § "Deferred to mockup" (three items 1–4 — see § Deferred above).
- DESIGN.md "Performance" palette, typography, "Components → Performance card" spec.
- DESIGN.md "Don'ts" — spatial separation, motion cap, color-alone rule.
- EXPERIENCE.md "Voice and Tone" — microcopy discipline.
- Auto-memory: `[[user-improvises-non-linear-setlist]]`, `[[project-visual-direction-locked]]`, `[[feedback-check-scroll-conflict]]`, `[[feedback-no-terminate-on-advance-gesture]]`, `[[feedback-dont-impose-design-taste]]`, `[[user-scottish]]`, `[[feedback-dont-invent-personal-details]]`.
- Shipped: `web/src/routes/performance-card.tsx` (built structure — do not redesign, extend).
