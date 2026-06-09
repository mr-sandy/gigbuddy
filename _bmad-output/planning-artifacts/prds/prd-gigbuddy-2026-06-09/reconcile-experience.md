---
title: PRD ↔ EXPERIENCE.md reconciliation
created: 2026-06-09
purpose: Identify EXPERIENCE.md content NOT reflected in the PRD body. Pointer (§C) counts as covered when the PRD references the spine deliberately.
---

# Reconciliation pass

Legend:
- **MAPPED** — explicitly covered by an FR/NFR/§5 entry.
- **POINTER (§C)** — intentionally left in EXPERIENCE.md and correctly referenced by PRD §C / inline `per EXPERIENCE.md` callouts. Acceptable.
- **GAP (a)** — qualitative gap worth folding into PRD body.
- **GAP (b)** — actually a pointer; OK to leave but worth flagging.
- **GAP (c)** — constraint that should be promoted to an FR or NFR.

---

## §Foundation

| Source claim | Status |
|---|---|
| Two surfaces deliberately different; no shared UI system | MAPPED — §1 Vision, §B Platform, FR-15 (perf-mode iPhone-only) |
| Practice ↔ performance are not toggles, they're different surfaces with shared data — user moves by picking up a different device | **GAP (a)** — the PRD says "MacBook = Practice, iPhone = Performance" but does not articulate the *anti-toggle* principle. This is a framing constraint that prevents downstream from inventing a "switch view" affordance. Worth one line in §1 or §3 (Glossary entries for Practice/Performance Mode). |
| iPhone 13 geometry: 390×844pt, 47pt top inset, 34pt bottom inset, 44×44pt tap target | MAPPED — §B Platform |
| Performance Mode is iPhone-only; no perf mode on MacBook | MAPPED — Glossary, FR-15 |

## §Information Architecture

| Source claim | Status |
|---|---|
| Surface inventory (Setlists, Library, Setlist overview, Song detail, New setlist, Performance card) | MAPPED — FR-3, FR-4, FR-13, FR-14, FR-16, FR-23, FR-24 |
| MacBook top nav: `GigBuddy · The Jack Ruby 5` — `Setlists` — `Library` — `New setlist` | MAPPED — FR-24, FR-26 |
| iPhone bottom tabs: `Setlists` / `Library`, two tabs, no third in V1 | MAPPED — FR-24, §5 implicit |
| Routing rule: "Open setlist" always lands on overview, never directly on performance card | **GAP (c)** — implied by FR-13 + FR-15 (only entry to perf via `Start performance ›`) but not stated as a routing invariant. Strictly covered by FR-15 ("only entry path"). POINTER (§C) acceptable. |
| Routing rule: tap a song row anywhere → song detail | MAPPED — FR-3, FR-13, FR-24 |
| Routing rule: performance `×` exit returns to setlist overview, state preserved | MAPPED — FR-19, FR-20 |
| Routing rule: returning to app after backgrounding mid-performance lands on current performance card, not home | MAPPED — FR-22 |

## §Voice and Tone

| Source claim | Status |
|---|---|
| Microcopy table (TONIGHT, dates as `Sat 13 Jun · 9:00 PM`, `Did you mean…`, `+ Add to library`, `Resume ›`, `No upcoming gigs.`, `No songs in this library yet.`) | MAPPED (specific strings) — FR-4, FR-7, FR-14, FR-20, FR-23. POINTER (§C) for the rest. |
| "No marketing voice. No personality-as-product. The app states what is." | POINTER (§C) — PRD §C explicitly cites EXPERIENCE.md §Voice and Tone. Acceptable; this is exactly the kind of qualitative content §C is designed to delegate. |
| "Short, complete sentences. Streak counters/encouragement/exclamation marks/emoji = Don't" | MAPPED — §C explicit reference + §5 Non-Goals ("encouragement layer") |

## §Component Patterns

| Source claim | Status |
|---|---|
| Gig card, Section heading, Song row (setlist), Song row (library) behavioral rules | MAPPED — FR-3, FR-4, FR-10, FR-11, FR-13 with `per EXPERIENCE.md Component Patterns` inline pointers |
| Inline edit field: click to focus, type, blur to save; debounce; no edit mode, no save button | MAPPED — FR-2 (verbatim) |
| Parse-row status (matched/fuzzy/unknown) | MAPPED — FR-7, FR-8, FR-9 |
| `Start performance ›` CTA: bottom-fixed above tab bar, always visible, single tap, no confirm, lands on song 1 of first non-empty section | MAPPED — FR-15 |
| Performance card structure (top chrome, scrollable middle, bottom toolbar with `‹` / `NEXT ›` / preview) | MAPPED — FR-16, FR-17 |
| Chord chart: V1 floor is monospaced text run with `{...}` section breaks, blank lines preserved, URLs tappable (practice only) | MAPPED — FR-5 (verbatim) |
| Chord chart aspiration: chord glyphs as engraved cards; "implementation decides; both honor the same data model (free-text)" | MAPPED — §5 Non-Goals ("chord-glyph visual direction is implementation aspiration, not contract") + FR-5 notes |
| `× exit`: tap returns to overview; wake lock + position preserved; state ends only on navigate-away from setlist | MAPPED — FR-19, FR-21 |
| `Currently performing` strip with `Resume ›`, wake lock indicator implied | MAPPED — FR-20 |
| Band label: passive in V1, interactive in V2 with 2+ bands | MAPPED — FR-26 |
| Bottom tabs persistent except in performance mode | MAPPED — FR-15, FR-24 |

## §State Patterns (the most likely source of behavioral gaps)

| State | PRD coverage |
|---|---|
| Cold open, gig today: TONIGHT badge, same layout otherwise | MAPPED — FR-14, FR-23 |
| Cold open, no upcoming gig: empty state `No upcoming gigs.`, past still visible, no CTA | MAPPED — FR-14, FR-23 |
| Empty library: `No songs in this library yet.`, no CTA in V1 | MAPPED — FR-4 |
| Song record, sparse content: empty fields just absent, no `(not specified)` placeholders, chord-chart honest-empty | MAPPED — FR-3, FR-5 consequences |
| Long chord chart (overflow): top + bottom chrome stay fixed, middle scrolls, no reflow | MAPPED — FR-16 |
| Parsed row matched: quiet treatment, no user action | MAPPED — FR-7 |
| Parsed row fuzzy: attention treatment + inline accept/reject single-tap | MAPPED — FR-7, FR-8 |
| Parsed row unknown: attention treatment + inline `+ Add to library` | MAPPED — FR-7, FR-9 |
| Per-gig annotation present: visually distinct from canonical | MAPPED — FR-11 |
| Per-gig annotation absent: row collapses to title only, no empty slot | **GAP (c)** — FR-11 says the annotation is visible when present, but does not explicitly say the row collapses (i.e., no empty placeholder rendered). This is a small but real behavioral constraint that prevents a "blank annotation line" implementation. POINTER (§C) via FR-11's inline pointer is acceptable but borderline — worth a one-line consequence in FR-11. |
| Active performance, returning to overview: `Currently performing` strip + `Resume ›` | MAPPED — FR-20 |
| Active performance, app backgrounded: re-open lands on current card; wake lock reacquires on resume | MAPPED — FR-18, FR-22 |
| End of setlist: `NEXT ›` does not loop; inert vs `End performance ›` (resolved as inert) | MAPPED — FR-21 |
| Save in progress: silent, no indicator | MAPPED — FR-2 |
| Save failed: error toast, optimistic display until failure | MAPPED — FR-2, FR-30 |
| Offline: edit locally, queue for sync, no banner, no nag | MAPPED — FR-31 |
| Sync error (persistent): surfaced quietly, never blocks writing | MAPPED — FR-31 |

## §Interaction Primitives

| Primitive | PRD coverage |
|---|---|
| Tap/click to act; no long-press for primary actions | **GAP (a/c)** — `no long-press` is not stated anywhere in the PRD. POINTER (§C) via "Interaction Primitives" reference is the intended home. Acceptable. |
| Click-to-focus, blur-to-save; no edit mode, no save button | MAPPED — FR-2 |
| Drag-and-drop for setlist row reorder, MacBook only | MAPPED — FR-12 |
| No swipe gestures in performance mode; all nav via fixed-chrome buttons | MAPPED — FR-17 |
| No tap-anywhere advance; middle region scrolls — tap does nothing | MAPPED — FR-17 |
| Bottom tabs hide in performance mode | MAPPED — FR-15 |
| **No double-taps, pinches, multi-finger gestures anywhere** | **GAP (c)** — not in §5 Non-Goals, not in any FR. This is a behavioral constraint that an implementer could violate (e.g., pinch-to-zoom on chord chart). POINTER (§C) is acceptable, but this is the kind of "Banned" item that often gets lost. Worth flagging. |
| **Single-tap is the only required input vocabulary under live conditions** | POINTER (§C) — qualitative; FR-15, FR-17 cover it operationally. Acceptable. |
| **Banned: Modals during performance mode** | **GAP (c)** — not explicit in §5. POINTER (§C). |
| **Banned: Toasts during performance mode** | **GAP (c)** — FR-30 references "quiet error toast" generally; PRD doesn't say toasts are banned in *performance mode specifically*. EXPERIENCE.md is explicit. This matters because FR-30's "save failed → error toast" could be read as applying everywhere. The two are reconciled by EXPERIENCE.md, but the PRD reader could miss it. **Worth one line in FR-30 or §A.1 NFRs.** |
| **Banned: Animations longer than 150ms in performance mode** | MAPPED — §A.1 Performance NFRs |
| **Banned: Push notifications** | MAPPED — §5 Non-Goals |
| **Banned: Streak counters, gamification, badges-on-arrival** | MAPPED — §5 Non-Goals ("streaks, gamification, badges") |

## §Accessibility Floor

| Source claim | PRD coverage |
|---|---|
| Performance mode WCAG AAA (7:1+); Practice WCAG AA (4.5:1) | MAPPED — §A.5 |
| No information conveyed by color alone; paste-status combines icon+label, annotation distinction uses weight+position | MAPPED — FR-7 consequences, §A.5 |
| Type sizing: perf body 18pt, primary 32pt+; practice body 17–18pt | MAPPED — FR-16, §A.5 |
| Tap targets ≥44×44pt | MAPPED — §B Platform, §A.5 |
| VoiceOver labels on paste-status rows, Start performance, advance/back/exit, position indicator, per-gig annotation | MAPPED — §A.5 |
| Status changes announced (parse-state transitions) | MAPPED — §A.5 (covered by "VoiceOver labels on Paste-to-parse states") — borderline; "announced on transition" is slightly more specific than "labels on states." POINTER (§C) acceptable. |
| Reduce Motion: all perf-mode transitions become instant | MAPPED — FR-17, §A.1, §A.5 |
| Focus order follows reading order on every surface | **GAP (a)** — not stated in PRD. POINTER (§C) acceptable, but this is a testable accessibility constraint. Borderline — could be one bullet in §A.5. |

## §Key Flows

UJ-1 through UJ-4 in PRD §2.3 explicitly mirror EXPERIENCE.md §Key Flows. The PRD correctly delegates the narrative and points at the source. Failure modes in EXPERIENCE.md (accidental `×` mid-set, accidental `NEXT ›`, parser misses section break) are mapped to FR-19/FR-20, FR-17, and FR-7 respectively. **MAPPED via delegation.**

## §Inspiration & Anti-patterns

| Anti-pattern | PRD coverage |
|---|---|
| Lifted from Apple Notes — friction-free editing, no save buttons | MAPPED — FR-2 |
| Lifted from Day One — today-is-the-artifact framing | **GAP (a)** — qualitative framing not explicit in PRD body. POINTER (§C) acceptable; this is "rationale not requirement." |
| Rejected — streaks, gamification | MAPPED — §5 Non-Goals |
| Rejected — chord recognition / lead-sheet parsing | MAPPED — §5 Non-Goals, FR-5 |
| Rejected — collaborative editing / bandmate access; "architecture preserves the door (per-user data model is private); no UI invites a guest" | MAPPED — §5 Non-Goals, FR-28. The architecture-preserves-the-door nuance is qualitative; POINTER (§C). |
| Rejected — push notifications | MAPPED — §5 Non-Goals |
| Rejected — "Ready to perform" state machine | MAPPED — §5 Non-Goals ("Every Setlist is performable; the user decides readiness") |
| Rejected — Band switcher chrome in V1 | MAPPED — §5 Non-Goals, FR-26 |

## §Responsive & Platform

All claims (two surfaces only, MacBook ~1280–1680pt, iPhone 13 viewport, portrait-lock in performance, PWA install required, browser baseline, network/offline tolerance) — **MAPPED** to §B Platform, FR-15, FR-31, §A.2.

## §Open items (rolled up from decision log)

All eight open items in EXPERIENCE.md are mirrored in PRD §8 Open Questions or resolved there (end-of-setlist, multi-fuzzy, library compact, VoiceOver next-song preview, tab labels, header band label visual, per-gig annotation positioning). **MAPPED.**

---

## Summary — actionable GAPs

Ranked by likelihood of causing downstream drift:

1. **GAP (c): "Toasts during performance mode" is banned, but FR-30 references "quiet error toast" without scoping out performance mode.** Risk: implementer reads FR-30 globally and emits a toast on save-failure during a gig. EXPERIENCE.md is the corrective; PRD should add one line to FR-30 saying "Toasts are suppressed during Performance Mode (per EXPERIENCE.md Interaction Primitives)." One-line fix.

2. **GAP (c): "No double-taps, pinches, multi-finger gestures anywhere" — not in §5 Non-Goals.** Risk: someone adds pinch-zoom on the chord chart. EXPERIENCE.md Banned list is the source of truth; POINTER (§C) covers it but this one's high-risk because pinch-zoom is a browser default. Borderline — could add one bullet to §5 Non-Goals or accept the §C pointer.

3. **GAP (a): "Practice ↔ Performance are not user toggles between the same screens" — the anti-toggle framing.** Risk: a downstream implementer (architect, frontend dev) invents a "view mode switcher." The PRD's Glossary entries for Practice/Performance Mode would carry this well as a one-line clarification.

4. **GAP (c): Per-gig annotation absent → row collapses, no empty slot.** Not stated as a consequence in FR-11. Small risk but explicit in EXPERIENCE.md State Patterns. One-line consequence on FR-11.

5. **GAP (a/c): "No long-press for primary actions" and "Modals during performance mode" are banned but live only via §C pointer.** Acceptable as pointers but each is a one-line addition away from being explicit. Lower priority.

Items not flagged as actionable but worth noting:
- "Today-is-the-artifact framing (lifted from Day One)" — qualitative rationale, correctly delegated.
- "Architecture preserves the door for sharing in V2" — qualitative, POINTER (§C).
- "Focus order follows reading order on every surface" — borderline; could be one bullet in §A.5.

Overall: the PRD does a careful job of delegating to §C and inline-pointing at EXPERIENCE.md State Patterns / Component Patterns / Interaction Primitives by name. The genuine gaps are small (1–4 above) and would each be a single-line addition. No structural changes warranted.
