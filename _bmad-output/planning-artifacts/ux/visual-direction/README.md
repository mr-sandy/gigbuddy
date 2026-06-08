---
title: GigBuddy — Visual Direction (LOCKED)
status: locked
source: Claude Design (Anthropic Labs)
locked: 2026-06-08
---

# Visual direction — LOCKED

The look and feel of GigBuddy is locked, based on Claude Design's output (delivered 2026-06-08). This folder is the source of truth for visual decisions going forward.

## What's in here

| File | What it is |
|---|---|
| `board-1-performance.png` | Static design board — performance mode (dark "Club Warm" — iPhone, dim bar) |
| `board-2-practice.png` | Static design board — practice mode (warm cream light — MacBook, daylight) |
| `design-board.html` | Bundled HTML version of the static design board |
| `interactive-prototype.html` | Bundled HTML interactive prototype |

The HTML files are bundled apps and need to be opened in a browser — they're not source-readable.

## What is locked here

**Visual direction only.** Specifically:

- Mood: warm dark performance ("Club Warm"), warm light practice
- Typography: editorial serif for titles, monospaced for chords
- Palette: warm dark + amber/gold accent (performance); paper cream + ink (practice)
- Approach to chord typography: large monospaced blocks, generous spacing
- Light/dark mapping: practice = light, performance = dark
- Generous type sizing throughout (Sandy is 55)

## What is NOT locked

**Features, flows, screens, states, and interactions** shown in these artifacts are **reference only** — they were Claude Design's interpretation of the brief, not a specification.

Claude Design surfaced many interesting candidate features (TONIGHT banner, transpose flag, multi-key display, "no chart" fallback, MATCHED/SHORTHAND/CHECK/GAP labels, "Ready" badge, "Start performance ›" CTA, "Did you mean?" affordance, etc.). Some are great. Some are V2. Some are inventions to set aside.

The feature set and flows for V1 are determined separately, via the `bmad-ux` skill and downstream BMAD phases (PRD, architecture, stories). Do not treat the screens shown here as a specification.

## How downstream phases should use this

- **UX spec** (`bmad-ux`): consume the visual direction as a constraint. Reference these artifacts when describing visual handling but design flows from the brief upward.
- **PRD**: do not import features from the visual artifacts. PRD scope flows from the brief and UX spec.
- **Architecture**: take type and palette decisions from here when picking CSS frameworks / design tokens.
- **Implementation**: extract design tokens (palette, type scale, spacing) from these references into a `tokens.css` (or equivalent) as part of the first implementation story.

## Originals

The original Claude Design export folder is at `/Users/sandy/dev/gigbuddy/GigBuddy - Claude Design Output/` and can be removed once this copy is verified.
