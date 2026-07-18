---
title: GigBuddy mockup briefs — index
purpose: Source briefs for the visual mockup pass that gates Epic 5 development. One brief per surface; each brief covers all locked states of that surface.
gates: Epic 5 implementation work — see [[feedback-mockup-decisions-before-dev]] in auto-memory.
visual-tokens: ../ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md (LOCKED — do not propose new colors / faces / weights)
journeys: ../journeys/
created: 2026-06-26
---

# GigBuddy mockup briefs

This directory holds the source briefs for the visual mockup pass that gates Epic 5 development.

> **Handoff procedure:** see [`HANDOFF.md`](HANDOFF.md) — the kickoff prompt, per-brief package contents, and the audit checklist for reviewing returned mockups. The Epic 4 retrospective (action item #1) mandated this pass: the foundational IA/nav/journeys design pass produced **text-level locked decisions** across three journey docs (T1, T3, T4); those decisions must be **visually composed and reviewed** before Epic 5 development resumes.

## How the briefs are used

1. Each brief is a self-contained specification of one surface — its purpose, states, layout facts, real content, microcopy, locked constraints, and out-of-scope items.
2. Briefs are handed off to a downstream visual tool (Claude Design / Figma AI) **one at a time** or as a small batch. Handoff discipline per [[feedback-dont-impose-design-taste]]: brief + content + facts only. No pre-baked mood boards, no token suggestions beyond pointing at `DESIGN.md`, no "I think it should look like X."
3. The downstream tool composes the mockup against the **LOCKED** visual direction in `DESIGN.md` and the visual-direction folder (`../ux/visual-direction/`). The mockup pass is composition, not visual exploration. See [[project-visual-direction-locked]].
4. Returned mockups are audited against the journey doc locks. Approved mockups become the visual reference for Epic 5 story implementation.

## Atmosphere

All four briefs in this pass live in the **MacBook practice atmosphere** — warm paper cream, daylight, editorial serif. iPhone-side journeys are not yet drafted; performance-atmosphere briefs (warm-dark "Club Warm") will come later.

## Brief inventory

Four briefs covering 21 surface states across three journeys (T1, T3, T4). Each brief covers multiple states of one surface.

**Status (2026-06-28): all four briefs `mockup approved`. The Epic 5 mockup gate is lifted.**

| Brief | Surface | Journey | States | Status |
|---|---|---|---|---|
| [`t3-library.md`](t3-library.md) | `/library` | T3 | 4 — empty input · filter query typed · no-match · empty library | **mockup approved 2026-06-28** |
| [`t3-song-detail.md`](t3-song-detail.md) | `/songs/:songId` + `/songs/new` | T3 | 3 (+ chord-chart aspiration variant on State 1) | **mockup approved 2026-06-28** |
| [`t4-setlist-new-manual.md`](t4-setlist-new-manual.md) | `/setlists/new` (manual entry) | T4 | 9 — fresh · flat list · multi-section · remove-section confirm · draft indicator · SongSearchRow type-ahead · SongSearchRow `+ Add to library` · within-section drag · cross-section drag | **mockup approved 2026-06-28** |
| [`t1-setlist-new-paste.md`](t1-setlist-new-paste.md) | `/setlists/new` (paste-to-parse) | T1 | 5 — Phase A textarea+preview · Phase A annotation detail · Phase B transition · Phase B fully resolved · Phase B inline split chevron | **mockup approved 2026-06-28** |

Status legend:
- **brief drafted** — written, awaiting Sandy's critique.
- **brief locked** — Sandy approved; ready for handoff.
- **mockup received** — downstream tool returned a mockup.
- **mockup approved** — Sandy approved the visual; Epic 5 story may proceed.

## Locked content sources

All real content in these briefs is drawn from documented sources (per [[feedback-dont-invent-personal-details]]):

- **Bands:** `The Jack Ruby 5` (active band).
- **Bandmates:** `Ivan` (the only documented JR5 bandmate).
- **Venue:** `Howlin Wolf` (documented in EXPERIENCE.md Flow 3).
- **Song titles:** drawn from the documented set used across EXPERIENCE.md, paste-to-parse-design.md, and the journey docs — `Into The Mystic`, `Comin' Home Baby`, `Mas Que Nada`, `Move on Up`, `Kelvingrove Street`, `Watermelon Man`, `Fire Eater`, `Cantaloupe Island`, `Sunny`, `In and Out`, `Trouble Man`, `Almost Like Being In Love`.

Where content can't be drawn from documented sources (e.g., chord-chart strings, patch names not specified per song), the briefs mark it as `illustrative` and let the downstream tool use believable placeholder content.

## Completeness-sweep locks (2026-06-27)

The sweep across the four briefs surfaced gaps not covered by the original journey-doc open questions. As each is locked, it's noted here for traceability.

- **Top-nav active-state.** Current-page item highlights in `accent`; inactive items in `text-primary`. DESIGN.md `Top nav (MacBook)` component spec updated to make this rule explicit.
- **`/library` empty-library state** added as State 4 of `t3-library.md`. Locked copy: `No songs in this library yet.`
- **`/songs/new` blank-slate surface** added as State 3 of `t3-song-detail.md`. Breadcrumb: `‹ Library · New song`. `Last edited` slot absent until first Title commit.
- **Chord-chart preview composition.** Primary mock is DESIGN.md V1 floor (mono text run). Aspiration (chord-glyph cards in a grid) is commissioned as a secondary exploratory mock to let Sandy see the aspiration on real-shape content — not a commitment.
- **Empty-section instant remove.** Noted in `t4-setlist-new-manual.md` State 4 + locked constraints — empty sections remove instantly with no confirm; the confirm line fires only on populated sections.
- **Inline `Start a new set here ›` chevron** added as State 5 of `t1-setlist-new-paste.md`. Keeps T1 §2.1 locked; mock will let Sandy decide whether to keep or drop the feature.
- **Single-section parse renders chromeless in Phase A preview** (same rule as Phase B per T4 §2.2). Not mocked as a separate state — composition is State 1 minus the heading and with all rows in one group.
- **`Pick from library` picker** on Unknown rows cross-references `t4-setlist-new-manual.md` states 6 + 7 — same SongSearchRow composition, summoned from a different context.

## Open micro-questions across the briefs

Each brief surfaces 1–4 micro-questions where the journey doc said "lock at mockup time." These should be answered before the briefs go to the downstream tool. Consolidated here for quick reference:

### From `t3-library.md`

- **Filter input placeholder copy.** Working title: `Filter songs`. Alternatives: `Find a song`, `Search title`, icon-only.
- **State 2 mock query.** Currently `fire` → `Fire Eater` (one match). Alternative: pick a 2-char query that hits 2–3 documented titles for a richer filtered-state mock.

### From `t3-song-detail.md`

No open questions — six field labels, breadcrumb format, `Last edited` format all locked.

### From `t4-setlist-new-manual.md`

- ~~**`+ Add a set` copy.**~~ **Locked 2026-06-27 to `+ Add set`** (article-less, parallel to `+ Add song`).
- ~~**Save-blocked explainer.**~~ **Locked 2026-06-27 to yes.** Strings: `Venue and Date required to save.` / `Resolve Fuzzy and Unknown rows to save.` Venue/Date wins if both apply.
- ~~**Section-heading count format.**~~ **Locked 2026-06-27 to `Set 1   8 songs`** (literal count + word; fraction-style rejected — implies completeness which T3 §2.2 rejected).

**Locked 2026-06-27:** no visible drag handle on song rows. Reorder is initiated by dragging the row itself. Deliberate deviation from DESIGN.md's `Song row (setlist)` component spec.

### From `t1-setlist-new-paste.md`

- ~~**`annotation:` prefix in Phase B.**~~ **Locked 2026-06-27 to small `annotation` label** (no colon; matches T3 song-detail field labels; persists across empty/populated).
- ~~**Save-blocked explainer.**~~ **Resolved with T4** — see above.
- ~~**Phase A textarea height.**~~ **Locked 2026-06-27 to auto-grow up to ~20 lines, then internal scroll** (min ~6 lines).
- ~~**`Paste a setlist instead ›` post-Cancel.**~~ **Locked 2026-06-27: link reappears after Cancel** (Cancel reversible; only Confirm is one-shot). Journey doc T1 §2.5 updated for consistency.

## What's NOT in this pass

- **iPhone-side journeys.** Not yet drafted. Performance-mode mockups (performance card, currently-performing strip, bottom-tab chrome) come in a later pass.
- **Setlist overview (`/setlists/:setlistId`).** Reached after Save from `/setlists/new`. Its IA wasn't part of the T3/T4/T1 design pass — it's an established surface. If decisions are needed there, a separate journey doc should land first.
- **Setlists home (`/`).** Same reasoning — established, not part of this design pass.
- **Drag-reorder visual state.** Behavior is locked in T4 §2.4 but a drag-state mockup isn't requested in this pass.
- **Inline `Start a new set here ›` affordance (T1 §2.1).** Locked but not in this mockup pass.
- **Empty-library state on `/library`.** T3 §3 edge case; not requested in this pass.

## Source documents

- `_bmad-output/planning-artifacts/journeys/journey-t1-paste-to-parse-revisit.md` (locked 2026-06-26)
- `_bmad-output/planning-artifacts/journeys/journey-t3-library-maintain.md` (locked 2026-06-21)
- `_bmad-output/planning-artifacts/journeys/journey-t4-new-setlist-from-scratch.md` (locked 2026-06-21, revised 2026-06-26)
- `_bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md` (visual direction — LOCKED)
- `_bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md` (experience spine — journey docs win on conflict)
- `_bmad-output/planning-artifacts/paste-to-parse-design.md` (parser + matcher details)
