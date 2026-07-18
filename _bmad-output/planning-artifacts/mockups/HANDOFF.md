---
title: Mockup handoff to Claude Design — process + per-brief packages
purpose: Step-by-step procedure for getting each brief composed into visual mockups by Claude Design (Anthropic Labs), and brought back for audit before Epic 5 development resumes.
gated-by: All four briefs locked (open micro-questions resolved 2026-06-27; completeness sweep done 2026-06-28).
created: 2026-06-28
---

# Handoff to Claude Design

## The loop

For each brief, repeat this loop:

1. **Sandy uploads the package to Claude Design** — the brief + DESIGN.md + the practice-atmosphere board image. Pastes the kickoff prompt below (with the brief filename swapped in).
2. **Claude Design returns mockups** — one per state listed in the brief.
3. **Sandy brings the result back to this conversation.** Either pastes the images or describes them; either way I can audit against the brief.
4. **I audit each mockup against the brief's locked constraints** using the checklist below.
5. **Mismatches go on a feedback list.** If non-trivial, Sandy re-sends with feedback to Claude Design.
6. **Once a brief's mocks pass audit, mark it `mockup approved`** in `README.md`'s inventory table.

Order to send: `t3-library.md` → `t3-song-detail.md` → `t4-setlist-new-manual.md` → `t1-setlist-new-paste.md`. Simplest first so we can refine the kickoff prompt before sending the heavier briefs.

## Kickoff prompt template

Paste into Claude Design alongside the uploaded files. Swap `<BRIEF>` for the brief filename (e.g. `t3-library.md`).

> I'm composing static mockups for GigBuddy — a personal tool for one jazz pianist. Visual direction is **already locked**. Your job is **composition, not exploration**.
>
> Attached:
> - `t3-library.md` — surface brief: states to mock, layout, behaviors, content, microcopy, locked constraints, out-of-scope.
> - `DESIGN.md` — locked visual tokens (colors, type, spacing, component specs).
> - `board-2-practice.png` — reference image for the **practice atmosphere** (warm paper cream, daylight).
>
> Compose one mockup per state listed in the brief's **States to mock** section. Label each composition with the state name (e.g. `State 1 — Empty input`).
>
> Discipline (non-negotiable):
> - Use the tokens in `DESIGN.md` exactly. Do not propose new colors, faces, weights, or spacing values.
> - Atmosphere is **MacBook practice** (warm paper cream). Do not render dark / performance atmosphere.
> - Microcopy strings must be verbatim from the brief's **Microcopy (final strings)** table.
> - Do not invent affordances not specified in the brief.
> - Honor the brief's **Out of scope** list — do not add chrome, badges, callouts, or affordances listed there.
> - The brief's **Locked constraints** section is the design contract; treat as non-negotiable.
>
> Render each composition as a static image (PNG or similar). One image per state.

## Per-brief packages

### Package 1 — `t3-library.md` (4 states)

**Upload:**
- `_bmad-output/planning-artifacts/mockups/t3-library.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md`
- `_bmad-output/planning-artifacts/ux/visual-direction/board-2-practice.png`

**States to render:** 4 — empty input · filter query typed (`ma` → 3 matches) · no-match (`xyz`) · empty library.

**Brief-specific note for the kickoff prompt:** *(none — standard package)*

---

### Package 2 — `t3-song-detail.md` (3 states; chord-chart preview gets 2 variants)

**Upload:**
- `_bmad-output/planning-artifacts/mockups/t3-song-detail.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md`
- `_bmad-output/planning-artifacts/ux/visual-direction/board-2-practice.png`

**States to render:** 3 — populated · fresh-mint (paste-to-parse origin) · blank slate (`/songs/new`).

**Brief-specific note for the kickoff prompt:** Append this:

> State 1 (Populated) requires **two composition variants** of the chord-chart rendered preview:
> - **Primary (V1 floor):** monospaced text run with light visual parsing per DESIGN.md `Chord chart` component spec.
> - **Secondary (aspiration):** chord glyphs rendered as engraved cards in a 2-column grid (`rounded.chord-glyph` 8pt). No parser rules exist yet; treat isolated tokens like `Em`, `F#m7`, `Bm/D` as glyph candidates and compose what the aspiration looks like on real content. This is exploration to inform a V2 decision, not a commitment.
>
> Label them `State 1a — Populated (V1 floor)` and `State 1b — Populated (aspiration)`.

---

### Package 3 — `t4-setlist-new-manual.md` (9 states)

**Upload:**
- `_bmad-output/planning-artifacts/mockups/t4-setlist-new-manual.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md`
- `_bmad-output/planning-artifacts/ux/visual-direction/board-2-practice.png`

**States to render:** 9 — fresh · flat list · multi-section · remove-section confirm · draft-saved indicator (filmstrip of 3 sub-states) · SongSearchRow type-ahead · SongSearchRow `+ Add to library` · within-section drag · cross-section drag.

**Brief-specific note for the kickoff prompt:** Append this:

> State 5 (Draft-saved indicator) is a small filmstrip of three sub-states side-by-side: `Unsaved draft` → `Draft saved just now` → `Draft saved 4 minutes ago`. Compose them as a single image showing the badge transition.
>
> States 8 and 9 are drag-reorder mid-action mockups (lifted row + originating gap + drop indicator). **No visible drag handle anywhere** — this is a deliberate deviation from DESIGN.md's `Song row (setlist)` component spec which mentions a handle on hover. The row itself is the drag affordance.

---

### Package 4 — `t1-setlist-new-paste.md` (5 states)

**Upload:**
- `_bmad-output/planning-artifacts/mockups/t1-setlist-new-paste.md`
- `_bmad-output/planning-artifacts/mockups/t4-setlist-new-manual.md` (sibling brief — the T1 brief sits on top of T4's chrome)
- `_bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md`
- `_bmad-output/planning-artifacts/ux/visual-direction/board-2-practice.png`

**States to render:** 5 — Phase A textarea + parsed preview · Phase A per-gig annotation detail · Phase B transition (just confirmed) · Phase B fully resolved · Phase B inline `Start a new set here ›` chevron revealed.

**Brief-specific note for the kickoff prompt:** Append this:

> The T1 brief sits on top of the T4 brief — every surface element outside the paste area (top nav, breadcrumb, gig metadata, sticky Save bar, draft indicator) is inherited from T4. Read both briefs; render only the T1-specific states. The Phase B states reuse the post-Confirm section chrome from T4.

## Audit checklist (one per brief, after receiving mockups)

For each brief, walk this list:

### Coverage
- [ ] Every state listed in the brief's **States to mock** is present in the bundle.
- [ ] Each state is labeled with the state name from the brief.

### Content
- [ ] Every microcopy string in the brief's **Microcopy (final strings)** table is rendered verbatim.
- [ ] Real content (song titles, venue, dates) matches the brief — no invented bandmates / venues / songs.
- [ ] "Illustrative" content (chord chart, patch, etc.) is plausibly composed but not canonicalized.

### Constraints
- [ ] Every item in the brief's **Locked constraints** is visibly honored.
- [ ] No affordance listed in **Out of scope** appears in any mockup.

### Tokens
- [ ] Atmosphere is practice (warm paper cream); no dark-mode elements.
- [ ] Type and spacing read consistent with DESIGN.md `Practice` tokens.
- [ ] No invented colors, faces, or shadows.

### Cross-brief
- [ ] Chrome shared across briefs (top nav, breadcrumb, sticky bar) renders consistently.
- [ ] Top-nav active-state shows in `accent` per the cross-cutting lock.

Findings go in a per-brief feedback note for the re-send. If audit passes, mark `mockup approved` in `README.md`.

## After all four briefs are approved

- Update each brief's frontmatter `status:` to `mockup approved`.
- Update `README.md` inventory table.
- Notify the Epic 5 stream that the mockup gate is lifted; story specs can resume.
- Stash the approved mockups under `_bmad-output/planning-artifacts/mockups/rendered/t3-library/`. The rendered/ subdirectory is created when the first bundle returns.
