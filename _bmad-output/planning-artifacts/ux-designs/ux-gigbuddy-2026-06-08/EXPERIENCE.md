---
name: GigBuddy
status: final
sources:
  - {planning_artifacts}/briefs/brief-gigbuddy-2026-05-31/brief.md
  - {planning_artifacts}/ux/design-handoff/context-facts.md
  - {planning_artifacts}/ux/design-handoff/real-example.md
  - {planning_artifacts}/ux/design-handoff/real-example-2.md
  - {planning_artifacts}/ux/open-ux-questions.md
  - {planning_artifacts}/ux/visual-direction/README.md
updated: 2026-06-09
---

# GigBuddy — Experience Spine

> Personal tool for one jazz pianist. Practice on MacBook (light, dense, editable). Performance on iPhone PWA (dark, glanceable, sacred). One database. Two genuinely different products.

→ Composition reference: `mockups/key-screens.html` (IA mockups of load-bearing surfaces). Spine wins on conflict.

## Foundation

**Two surfaces, deliberately different.**

- **MacBook (practice).** Web app. Light theme by default. Hours-long sessions; keyboard + trackpad; library browse + edit; setlist creation via paste-to-parse.
- **iPhone 13 PWA (performance).** Native-feeling installed PWA. Dark theme by default. 20–30 second glances on top of the Nord; portrait-locked; thumb-driven nav.

No shared UI system. Custom build against the locked visual direction in `_bmad-output/planning-artifacts/ux/visual-direction/`. `DESIGN.md` is the visual identity reference; this spine is the experience.

**iPhone 13 geometry:** 390 × 844pt viewport. 47pt top safe-area inset (notch + status). 34pt bottom safe-area inset (home indicator). 44 × 44pt minimum tap target.

**Performance mode** is iPhone-only. There is no performance mode on MacBook.

**Practice ↔ performance** are not user toggles between the same screens — they are different surfaces with shared data. The user moves between *contexts* by picking up a different device, not by hitting a switch.

## Information Architecture

### MacBook surfaces

| Surface | Reached from | Purpose |
|---|---|---|
| Setlists (home) | Top nav | Tonight/Next card + Upcoming + Recent past, one scrollable list, sectioned. |
| Library | Top nav | Alphabetical song list for the active band. |
| Setlist overview | Setlists row tap | Per-setlist prep view: metadata header, sections, songs, per-gig annotations, edit affordances. |
| Song detail | Library row tap, or song row in setlist | Full song record. View = edit, inline. |
| New setlist | Top nav `New setlist` action | Paste-to-parse + manual entry, single unified screen. |

Top nav: `GigBuddy · The Jack Ruby 5` (passive band label) — `Setlists` — `Library` — `New setlist`.

### iPhone surfaces

| Surface | Reached from | Purpose |
|---|---|---|
| Setlists tab (home) | Bottom tab | Tonight/Next card + Coming up + Past, one scrollable list, sectioned. |
| Library tab | Bottom tab | Alphabetical song list. |
| Setlist overview | Setlists row tap, or Tonight card tap | Per-setlist prep view. Bottom-fixed `Start performance ›` CTA. |
| Song detail | Library row tap, or song row in setlist | Same as MacBook; inline edit. |
| Performance card | `Start performance ›` only | Single-song view. Fixed top + bottom chrome; scrollable middle. **Tabs hidden in this state.** |

Bottom tabs: `Setlists` — `Library`. Two tabs. No third tab in V1. Hidden in performance mode.

### Routing rules

- "Open setlist" anywhere always lands on **setlist overview**, never directly on performance card.
- Tap a song row from any source always lands on **song detail**.
- `Start performance ›` is the only path into the performance card view.
- Performance card `× exit` always returns to setlist overview (state preserved — see State Patterns).
- Returning to the app after backgrounding mid-performance lands back on the **current performance card**, not on home. State is sticky until explicit end.

## Voice and Tone

Microcopy. Brand voice and aesthetic posture live in `DESIGN.md`.

| Do | Don't |
|---|---|
| `TONIGHT` | `Time to rock!` |
| `Sat 13 Jun · 9:00 PM` | `Your big night is coming up soon!` |
| `Did you mean Kelvingrove Street?` | `We think you meant…` |
| `+ Add to library` | `Click here to create a new song` |
| `Resume ›` | `Continue performance ›` |
| `No upcoming gigs.` | `You don't have any gigs yet — schedule one to get started!` |
| `No songs in this library yet.` | `Your library is empty — let's add your first song!` |
| Short, complete sentences. | Streak counters, encouragement, exclamation marks, emoji. |

No marketing voice. No personality-as-product. The app states what is.

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md.Components`.

| Component | Use | Behavioral rules |
|---|---|---|
| Gig card | Home (next-gig slot), Setlists list rows, Setlist overview header | Shows venue · date · time. Optional `TONIGHT` badge on today. Tap → setlist overview. |
| Section heading | Setlist overview, paste-to-parse result | Free-text label (`Set 1`, `Reserve`, etc.). Renameable inline on MacBook; static label on iPhone. |
| Song row (setlist) | Setlist overview | Shows canonical title + optional per-gig annotation subline. Tap → inline expand for per-gig annotation edit (iPhone sheet, MacBook inline). MacBook: drag handle visible. |
| Song row (library) | Library list | Shows canonical title only. Tap → song detail. No row actions. |
| Inline edit field | Song detail, paste-to-parse, per-gig annotation, gig metadata | Click/tap to focus; type; blur to save. Debounce rapid input. No edit-mode toggle, no save button. |
| Parse-row status | Paste-to-parse result | One of three states (matched / fuzzy / unknown) — see State Patterns. Inline resolution for fuzzy and unknown; no separate gap-fill screen. |
| `Start performance ›` CTA | iPhone setlist overview only | Bottom-fixed bar above the tab bar. Always visible. Single tap → performance card view, song 1 of first non-empty section. No confirm. |
| Performance card | Performance mode (iPhone) only | Fixed `×` exit (top-left) + position indicator `n / total` (top-right). Fixed title + key/patch below top chrome. Scrollable middle (chord chart + per-gig annotation). Fixed bottom toolbar (`‹` back, big `NEXT ›`, next-song preview). |
| Chord chart | Performance card, song detail | **Floor (V1):** monospaced text run with light visual parsing — `{...}`-wrapped lines become visual section breaks; blank lines preserved as breathing space; URLs tappable (practice notes only). **Aspiration (per locked visual direction):** chord glyphs rendered as engraved cards in a grid; non-chord lines as flowing prose. Implementation decides; both honor the same data model (free-text in the field). |
| `× exit` (performance) | Performance card top-left | Tap → returns to setlist overview. Wake lock + song position preserved. State ends only when navigating away from the setlist entirely. |
| `Currently performing` strip | Setlist overview, during active performance | Top-anchored strip with current song name and `Resume ›`. Wake lock indicator implied. |
| Band label | MacBook header | Passive informational label (`GigBuddy · The Jack Ruby 5`). Not interactive in V1. Becomes interactive in V2 when 2+ bands carry content. |
| Bottom tabs | iPhone outside performance mode | `Setlists` / `Library`. Two tabs. Persistent except in performance mode. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Cold open, gig today | Setlists (home) | Tonight card carries `TONIGHT` badge. Otherwise same layout as every other day. |
| Cold open, no upcoming gig | Setlists (home) | Tonight slot shows empty state (`No upcoming gigs.`). Past list still visible below. No CTA. |
| Empty library | Library | `No songs in this library yet.` No CTA in V1 (Jack Ruby 5 library is seeded). |
| Song record, sparse content | Song detail, performance card | Title + filled fields render. Empty fields just absent; no `(not specified)` placeholders. Chord-chart area honest-empty if no chord field content. |
| Long chord chart (overflow) | Performance card | Top chrome (title + key/patch) and bottom toolbar stay fixed. Chord-chart region scrolls vertically within its bounds. No layout reflow. |
| Parsed row: `✓ matched` | Paste-to-parse result | Quiet treatment. No user action required. |
| Parsed row: `? did you mean …` | Paste-to-parse result | Attention treatment (yellow per visual direction). Inline `Yes, that one` accept and `No — new song` reject. Both single-tap. |
| Parsed row: `+ unknown` | Paste-to-parse result | Attention treatment (red per visual direction). Inline `+ Add to library` creates a minimal song record. |
| Per-gig annotation present | Setlist overview row, performance card | Visually distinct from canonical chord/notes (different weight or accent — DESIGN.md). |
| Per-gig annotation absent | Setlist overview row | Row collapses to just the canonical title — no empty annotation slot. |
| Active performance, returning to overview | Setlist overview | `Currently performing: [song]` strip + `Resume ›` button at top. Wake lock continues. |
| Active performance, app backgrounded | App lifecycle | Re-open lands on current performance card. Wake lock survives if OS permits; reacquires on resume. |
| End of setlist (last song) | Performance card | `NEXT ›` does not loop. **Open:** inert vs. transforms to `End performance ›` — choose at implementation. |
| Save in progress | All edit surfaces | Silent. No indicator. |
| Save failed | All edit surfaces | Error toast appears. Optimistic display until failure. |
| Offline | All surfaces | Edit locally; queue for sync on reconnect. No banner. No "you are offline" nag. |
| Sync error (e.g., persistent failure) | Settings (if added) or banner-on-MacBook | Surfaced quietly. Never blocks writing. |

## Interaction Primitives

- **Tap / click to act.** No long-press for primary actions.
- **Click-to-focus, blur-to-save.** No edit mode, no save button.
- **Drag-and-drop** for setlist row reorder. MacBook only.
- **No swipe gestures in performance mode.** All performance-mode nav is via fixed-chrome buttons.
- **No tap-anywhere advance.** Performance card's middle region scrolls — tap there does nothing.
- **Bottom tabs hide in performance mode.** All non-card chrome disappears when performance is active.
- **No double-taps, pinches, multi-finger gestures.** Anywhere.
- **Single-tap is the only required input vocabulary** under live conditions.

**Banned:**
- Modals during performance mode.
- Toasts during performance mode.
- Animations longer than 150ms in performance mode.
- Push notifications.
- Streak counters, gamification, badges-on-arrival.

## Accessibility Floor

Behavioral. Visual contrast lives in `DESIGN.md`.

- **Performance mode:** WCAG AAA contrast (7:1+) for all text. Non-negotiable.
- **Practice mode:** WCAG AA contrast (4.5:1) minimum.
- **No information conveyed by color alone.** Paste-to-parse status combines icon + label (✓ / ? / +), not just color. Per-gig annotation distinction uses weight + position, not color alone.
- **Type sizing for a 55-year-old:**
  - Performance mode body text: 18pt minimum anywhere visible at glance.
  - Performance mode primary content (title, key, patch): 32pt+.
  - Practice mode body text: 17–18pt+.
- **Tap targets ≥ 44 × 44pt** (iOS HIG).
- **VoiceOver / Screen reader labels** on: paste-to-parse status rows (with state announced), `Start performance ›`, advance/back/exit affordances, position indicator, per-gig annotation field.
- **Status changes announced** (e.g., parse state transitions during paste).
- **Reduce Motion:** all performance-mode transitions become instant. No fades.
- **Focus order** follows reading order on every surface.

## Key Flows

Named protagonist: **Sandy**. (Sole user; persona ceremony skipped per project memory.)

### Flow 1 — Saturday-night load-in (Sandy, 8:55pm at the venue)

1. Sandy unlocks the iPhone in his pocket, opens GigBuddy.
2. Setlists tab is the default. Home card shows `TONIGHT — Howlin Wolf — Sat 13 Jun — 9:00 PM`.
3. Sandy taps `Open setlist ›`.
4. Setlist overview renders: two sections (`Set 1`, `Set 2`), 19 songs, three of them carrying per-gig annotations ("Ivan on solo", "vocal tonight?", "[GUITAR CHANGE]"). He glances, gets oriented.
5. Sandy slides the phone face-up onto the top of the Nord.
6. The band counts in. Sandy reaches over and taps `Start performance ›`.
7. **Climax:** Performance card view for `INTO THE MYSTIC` — title huge, `Eb · R41 Piano and Cello` beneath, the chord skeleton filling the middle. The setlist has become a single song. Sandy plays the first downbeat.

**Failure mode:** Sandy accidentally hits `×` mid-set instead of `NEXT ›`. Returns to setlist overview with `Currently performing: COMIN' HOME BABY · Resume ›`. He taps `Resume ›`; back on the song card without losing his place.

### Flow 2 — Between songs, mid-set (Sandy, on stage)

1. Sandy finishes `COMIN' HOME BABY`. The band calls `SUNNY` next, as expected.
2. Sandy taps `NEXT ›` on the performance card.
3. Card transitions instantly to `SUNNY`. Title huge. `Wurlitzer P13 · F#m(Ian) Fm(Sandy) · Fm Blues` below. Chord chart visible. Next-song preview at the bottom reads "In and Out."
4. Sandy reaches across the keyboard, dials in P13 on the Nord while the singer counts off.
5. **Climax:** Sandy plays the intro figure without thinking. The card is just confirmation — he already knew. The signal is "you are where you think you are."

**Failure mode:** Sandy taps `NEXT ›` one song too soon (band repeats COMIN' HOME BABY). He taps the small `‹` back button bottom-left. Card returns to COMIN' HOME BABY. He plays again.

### Flow 3 — Tuesday-evening setlist prep (Sandy, MacBook at the kitchen table)

1. Ivan WhatsApps Sandy the setlist for Saturday's Howlin Wolf gig.
2. Sandy opens GigBuddy on his MacBook. Home shows `TONIGHT` (the next gig is Saturday's Howlin Wolf — already exists from a prior gig? No, it's new — empty next slot).
3. He clicks `New setlist` in the top nav.
4. Paste-to-parse screen opens. Metadata fields empty; paste field empty.
5. He fills `Venue: Howlin Wolf`, `Date: 13 Jun 2026`, `Time: 9:00 PM`. No gig-level notes.
6. He cmd-V's the WhatsApp text into the paste field.
7. Parsed result renders live below — two sections detected (`Set 1`, `Set 2`), 19 songs total. 17 matched (✓), one fuzzy (`KELVINGROVESTREET` → `? Did you mean Kelvingrove Street?`), one unknown (`FIRE EATER + Add to library`).
8. He clicks `Yes, that one` on the fuzzy. He clicks `+ Add to library` on FIRE EATER — a new minimal song record is created.
9. **Climax:** Sandy clicks `Save setlist`. The new gig surfaces on the home page as `TONIGHT` (since the date is upcoming). The compile-notes-from-Apple-Notes workflow is dead. There's one new library entry to flesh out before Saturday.

**Failure mode:** Parse fails to detect a section break (no `----` rule in pasted text). All 19 songs land in `Set 1`. Sandy notices on review. He renames a song row mid-list to insert a section break: drags rows down past the inserted boundary, types `Set 2` as the new section name.

### Flow 4 — Sunday-morning library polish (Sandy, with coffee, post-gig)

1. Sandy opens GigBuddy on iPhone (between gigs use). Setlists tab default.
2. He taps `Library` tab.
3. Scrolls to M, taps `Mas Que Nada`.
4. Song detail page. He focuses the Performance Notes field, adds: `Remember prominent piano in gap towards end — voice as Fm9 not Fm.`
5. Taps outside the field.
6. **Climax:** Silent save. He locks the phone. The next time he plays Mas Que Nada — next weekend's gig — that note appears on the performance card under the chord chart, distinct from the canonical record because it was added today.

## Inspiration & Anti-patterns

- **Lifted from Apple Notes.** Friction-free editing model — click into a field, type, click away. No save buttons. (Q8: view = edit, silent save.) This is the *exact* habit GigBuddy replaces; preserving it eliminates re-learning.
- **Lifted from Day One.** Today-is-the-artifact framing. Tonight is foregrounded on the home; everything else is library.
- **Rejected — streaks, gamification.** Sandy plays gigs because gigs exist, not because the app rewards him. No "7 weeks in a row." No "Add 3 songs to unlock a badge."
- **Rejected — chord recognition / lead-sheet rendering parsing (V1).** Loose notation resists structure. "Gm blues" and "descending line F E Eb D" would fight a chord parser. Visual chord-card rendering remains an aspiration via the locked visual direction; data model stays free-text. Light typographic response (Q7) is the V1 floor.
- **Rejected — collaborative editing / bandmate access.** Explicit V1 exclusion. Architecture preserves the door (per-user data model is private); no UI invites a guest.
- **Rejected — push notifications.** GigBuddy is not a calendar. The user opens it when they want to use it. No "Your gig is in 30 minutes."
- **Rejected — "Ready to perform" state machine.** Every setlist is performable. Unknowns and gaps are visible on the overview; the user decides if they're ready. No workflow gate.
- **Rejected — band switcher chrome in V1.** One populated band; a switcher with one option is dead weight. Passive band label only.

## Responsive & Platform

- **Two surfaces only.** MacBook (web) + iPhone 13 PWA. No tablet, no native desktop, no other phone form factors in V1.
- **MacBook layout** assumes ~1280–1680pt-wide laptop displays. Pages flow vertically. No multi-column dashboards. Plenty of whitespace.
- **iPhone layout** designed for the iPhone 13 viewport (390 × 844pt). Other iPhones (mini, Plus, Pro Max) should render acceptably but are not test targets in V1.
- **Performance mode is portrait-locked.** Device rotation ignored.
- **Practice mode** is not orientation-locked on either device — but MacBook is always landscape; iPhone in library/setlist views may auto-flip, no harm done.
- **PWA installation** required for iPhone — Sandy installs GigBuddy as a home-screen app, granting wake-lock and full-screen privileges.
- **Browser baseline** for MacBook: current Safari, Chrome, Firefox. No legacy browser support.
- **Network:** assumes broadly online. Offline tolerance enough to survive a venue with bad Wi-Fi (writes queue locally; reads from cache); no first-class offline-first architecture in V1.

## Open items (rolled up from the decision log)

These are surfaced here so they don't disappear into the log. Each should be resolved at implementation time or in a follow-up UX pass.

- **End of setlist treatment.** `NEXT ›` on the last song: inert vs. transforms to `End performance ›`. Decide at implementation.
- **Multiple fuzzy candidates.** Does `? Did you mean …` offer top-3 candidates or only top-1? Defer to State Patterns refinement.
- **Library row compact info on iPhone.** Title only is the V1 default. Revisit if scanning gets hard at higher song counts.
- **VoiceOver behavior for next-song preview** on the performance card. Accessibility pass.
- **Tab labels.** `Setlists` / `Library` are working titles; could revisit at copy pass.
- **MacBook header band label visual treatment.** DESIGN.md call.
- **Per-gig annotation positioning on the performance card.** Above chord chart? Below title? Defer to per-feature refinement at first build.
