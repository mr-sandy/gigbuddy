# Reconciliation: Brief → PRD

**Source:** `_bmad-output/planning-artifacts/briefs/brief-gigbuddy-2026-05-31/brief.md`
**Target:** `_bmad-output/planning-artifacts/prds/prd-gigbuddy-2026-06-09/prd.md`
**Date:** 2026-06-09

Method: walk the brief section by section, map each substantive claim/principle to a PRD location (FR-N or §X) or mark GAP. Classify GAPs as (a) qualitative gap worth folding in, (b) intentional omission, (c) deferred to downstream doc.

---

## Executive Summary

| Brief claim | PRD location | Status |
|---|---|---|
| "Replaces a musician's scattered Apple Notes gig preparation system with a structured, performance-ready tool." | §1 Vision | Covered. |
| "Built for a jazz pianist who performs with multiple bands several times a month." | §1, §2 | Covered. |
| "Manages a song library, creates and tracks gig setlists, presents the right information at the right moment." | §4.1, §4.2, §4.3 | Covered. |
| "Rich notes during practice, clean essential cards during live performance." | FR-5 split, §4.3 | Covered. |
| **"A musician's information needs during a gig are fundamentally different from their needs during preparation. Existing note-taking tools conflate these contexts. GigBuddy separates them deliberately — making the right thing effortless in the moment that matters most."** | §1 Vision touches it; FR-5 split implements it | **PARTIAL GAP (a).** The *core insight* framing — that this product exists because note-taking tools *conflate* contexts — is not stated as the organizing thesis. PRD treats the split as a feature; the brief treats it as the reason the product exists. |

---

## Design Principles

The brief enumerates three principles. None are restated verbatim in the PRD; they are implied by feature shape.

| Brief principle | PRD location | Status |
|---|---|---|
| **P1. Context-appropriate information.** "Practice and performance are distinct states with different information needs. The app surfaces different content in each — not the same content filtered differently." | FR-5 (Performance vs Practice fields); §4.3 description | **PARTIAL GAP (a).** The nuance "*not the same content filtered differently*" is not captured. PRD describes the fields-per-surface mapping but doesn't articulate the principle that this is content selection, not a view filter. Matters for downstream: an architect could legitimately model this as a "view filter" and satisfy FR-5 without honoring the principle. |
| **P2. Setlist-driven library growth.** "The library grows organically through gig preparation, not as a standalone data entry project. Paste a setlist, fill the gaps, play the gig." | FR-9 (Resolve Unknown inline); §4.1 description | Covered (FR-9 mechanism + §4.1 mentions implicit creation). The slogan "Paste a setlist, fill the gaps, play the gig" is not present but the mechanism is. |
| **P3. Performance mode is sacred. "Anything that slows reading or navigation under live conditions is a defect."** | §4.3 description ("The sacred state."); SM-C2 counter-metric | **PARTIAL GAP (a).** The PRD says "sacred state" once in §4.3 prose, but the *defect framing* — that latency/friction in Performance Mode is a defect class, not a polish item — is not surfaced anywhere downstream-readable. This has direct implications for QA triage and architecture trade-offs. |

---

## The Problem

| Brief claim | PRD location | Status |
|---|---|---|
| "Manually copying individual song notes from Apple Notes into a single ordered document … must be repeated from scratch for every gig." | §2.1 JTBD bullet 1; SM-1 | Covered. |
| "That compiled note … mixes preparation detail with the few essential cues actually needed on the night. Finding the patch number or a key chord in dense text, in a dim bar, between songs, is harder than it should be." | §2.1; §4.3 description; FR-16 | Covered. |
| "When a setlist includes a new or rarely played song, there is no structured workflow to catch the gap and address it before the gig." | FR-7 (Unknown state), FR-9 | Covered. |
| **"Over time, no history is built. There is no way to know which songs have not been played recently, which are over-relied upon, or what a balanced setlist for the next gig might look like."** | §6.2 (Deferred V2+ items); §2.1 bullet 5 | Covered as scope deferral. The *pain* framing (the user feels the absence of history today) is downgraded to a forward-looking V2 commitment. Acceptable. |

---

## The Solution

| Brief claim | PRD location | Status |
|---|---|---|
| Song Library: structured per-song record; performance view + practice view; band-scoped, fully separated. | §4.1, FR-5, FR-25 | Covered. |
| Setlist Management: paste WhatsApp text, parse, match, flag unknowns; section structure; per-gig annotations. | §4.2, FR-6–FR-14 | Covered. |
| Performance Mode: one song at a time, large text, high contrast, single-tap navigation, screen wake lock, "everything not needed on stage is out of the way." | §4.3, FR-15–FR-22 | Covered. |
| **"Everything not needed on stage is out of the way."** | §4.3 description prose | **PARTIAL GAP (a).** This is the *editorial principle* for Performance Mode (subtractive design). Not articulated as a rule. EXPERIENCE.md / DESIGN.md may carry it; PRD does not state it as a constraint downstream must honor. |

---

## Who This Serves

| Brief claim | PRD location | Status |
|---|---|---|
| Jazz pianist, 2–3 gigs/month, multiple bands. | §1, §2 | Covered. |
| Jazz band (primary, ~35-song repertoire). Covers band (heavier reliance on full chord charts). Originals band (infrequent). | §1, §6.1 | Partially covered. Repertoire size (~35) not stated in PRD. Covers band's reliance on full chord charts — see below. |
| **"Covers band, heavier reliance on full chord charts."** | — | **GAP (c, defer-to-V2).** The fact that different bands have different content-density needs is in the brief but not in the PRD. Acceptable: V1 ships JR5 only. But note it: when V2 lands MADB content, the Performance Card may need to accommodate denser chord charts. Flag for V2 architecture, not V1. |
| Prepares on MacBook at home; performs with iPhone on top of the Nord. | §1 Vision | Covered. |
| **"Notes are read between songs — roughly 20–30 seconds."** | — | **GAP (a).** This is a load-bearing performance budget for Performance Card design. The reader has 20–30 seconds to find what they need. PRD specifies render times (300ms cold, 150ms transitions) but does not state the *user-side time budget* that informs why those numbers exist. Worth folding into Performance Mode description or A.1. |

---

## Scope (In for V1)

All In-Scope items map cleanly:

| Brief item | PRD location |
|---|---|
| Song library with structured fields | §4.1, FR-1–FR-5 |
| Multi-band, JR5 only in V1 | §4.5, FR-25, FR-26 |
| Paste-to-parse + manual entry | FR-6, FR-7 |
| Section structure (1st Set / 2nd Set / Reserve) | FR-10; §3 Glossary |
| Per-gig annotations | FR-11 |
| Performance mode + wake lock | FR-15–FR-22 |
| Practice mode | §3 Glossary; FR-3 |
| Web app + PWA | §B Platform |
| Self-hosted AWS, single-user | §4.6, FR-27, A.3 |

Note: brief says section structure is "(1st Set / 2nd Set / Reserve)"; PRD treats Section names as free-text (§3 Glossary, FR-10). This is consistent with the "brief examples ≠ schema" memory rule — PRD correctly generalizes rather than locking the example values.

## Scope (Out of V1)

All out-of-scope items in the brief are reflected in §5 Non-Goals or §6.2 Out of Scope for MVP. Specifically:
- Setlist intelligence — §5, §6.2
- Gig history analytics — §5, §6.2
- Bandmate access / sharing — §5, FR-28
- Apple Notes import — §5
- Audio/MIDI/hardware — §5
- Multi-tenant / SaaS — §5, FR-28

---

## V2 Horizon

| Brief claim | PRD location | Status |
|---|---|---|
| Setlist history enables repertoire balance, over-reliance alerts, assisted setlist creation. | §6.2 (V2+ Deferred); §2.1 JTBD 5 | Covered. |
| **"The data model should treat full setlist history as a first-class concern from day one, so V2 requires no migration."** | §4.5 (Multi-Band data model migration claim); FR-29 implied | **PARTIAL GAP (a).** PRD explicitly addresses *Band* as a V2-no-migration concern (FR-25, FR-26). The brief makes the same claim about *setlist history*. PRD does not explicitly state that every played setlist must be preserved as first-class V2-mineable data. JTBD 5 ("Preserve every setlist played — even though V1 doesn't surface analytics, the data must be there for V2 to mine.") is the closest, but it's a user-job framing not a data-model constraint. Worth lifting into FR-29 or §4.7 as a consequence: "Setlists are never deleted on user action without explicit confirmation" / "Played status is captured per Setlist." |
| **"If the tool proves genuinely valuable, there is a distant possibility of opening it to other musicians — the architecture should not foreclose that path, but should not be designed for it either."** | — | **GAP (b, intentional omission).** PRD makes the *opposite* explicit commitment in §1 ("not a platform, not multi-tenant, not collaborative") and §4.6 / FR-28. This is a deliberate sharpening — the brief leaves a distant door open, the PRD closes it for V1 cleanly. Acceptable: V1 architecture single-user is well-defined; the brief's "don't foreclose" is a soft constraint that doesn't translate cleanly to an FR. Note for the record but no action. |

---

## Success Criteria

| Brief criterion | PRD location | Status |
|---|---|---|
| Pre-gig compile workflow eliminated | SM-1 | Covered. |
| Any song's performance view reachable in under 3 taps from the setlist | SM-4 | Covered. (PRD says "from Setlists home" not "from the setlist" — slight scope shift; SM-4 measures from home, brief implies from any setlist. Minor.) |
| New setlist with unknowns processable in a single workflow session | SM-2 | Covered. |
| Performance mode readable on iPhone in a dim bar without adjustment | SM-3 | Covered. |
| **"The app is stable and available on gig nights; no dependencies that can fail at 9pm."** | A.2 (operational floor); SM-5 | Covered. SM-5 makes it a measurable. A.2 codifies the maintenance-window constraint. Strong coverage. |

---

## Cross-cutting tonal / framing observations

These are the qualitative threads in the brief that don't map to FRs but inform downstream tone:

1. **"This is a personal tool, not a platform."** — Brief states it in §Design Principles preamble. PRD §1, §2.2, §5 enforce it structurally. Covered (and SM-C4 counter-metric reinforces it). Strong.

2. **"Personal AWS account"** — Brief scope bullet. PRD §8 Q10 surfaces this as a cost-discipline constraint on Architecture. Stronger in PRD than brief. Covered.

3. **The brief's voice is declarative and unhedged.** ("Performance mode is sacred." "Anything that slows reading … is a defect.") The PRD inherits this voice in §4.3 and the counter-metrics, but most FR consequences are more neutral. Acceptable: FR sections need to be precise; the declarative tone lives in §1, §4 descriptions, and counter-metrics.

4. **"Make the right thing effortless in the moment that matters most."** — The brief's tagline. Not in the PRD. Probably belongs in DESIGN.md / EXPERIENCE.md rather than PRD. **GAP (c, downstream).**

---

## Summary of GAPs by classification

### (a) Qualitative gaps worth folding into the PRD

1. **"Existing note-taking tools conflate contexts; GigBuddy separates them deliberately."** — The *raison d'être* framing in §1 Vision could be sharpened. Currently §1 says the tool "knows the difference between preparing and performing"; the brief's "conflate" language makes the negative-space case stronger.

2. **"Not the same content filtered differently."** — Important nuance on the Practice/Performance split. Could be added as a §4.1 or FR-5 Note: "The Performance/Practice split is a content-selection decision, not a view filter." This prevents an architect from modeling it as a single document with display rules.

3. **"Anything that slows reading or navigation under live conditions is a defect."** — Performance Mode defect framing. Could be added to §4.3 description or as a Note under §A.1 Performance. Has direct triage implications.

4. **"Everything not needed on stage is out of the way."** — Subtractive editorial principle for Performance Mode. Could be added to §4.3 description as a guiding constraint for downstream UI work.

5. **"Notes are read between songs — roughly 20–30 seconds."** — User-side time budget. Could be added to §2 (Target User context) or §4.3 description. Informs why 18pt body floor, why no scroll-to-find pattern, why single-tap navigation.

6. **"Full setlist history as a first-class concern from day one."** — Data-model V2-readiness for setlist history specifically (parallel to the multi-band V2-readiness already in §4.5). Could be a new FR under §4.7 Persistence, or a Note under FR-29: "Played setlists are preserved indefinitely; the data model anticipates V2 analytics over the full history."

### (b) Intentional omissions

- The brief's "distant possibility of opening it to other musicians" is deliberately closed in V1 by FR-28 and §1. No action.

### (c) Deferred to downstream docs

- "Make the right thing effortless in the moment that matters most" → EXPERIENCE.md / DESIGN.md voice & tone.
- Covers band's heavier reliance on full chord charts → V2 design consideration, not V1 architecture.
