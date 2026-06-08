---
title: GigBuddy Design Handoff Package
purpose: What to upload to Claude Design and in what order
created: 2026-05-31
updated: 2026-05-31
---

# Design handoff package

This folder contains the files to upload to Claude Design (or any AI design tool) when you're ready to move into visual direction and prototyping.

> **V1 scope:** GigBuddy serves **The Jack Ruby 5 only** in V1. The covers band (Middle Aged Dad Band) and the indie originals project (Fram) are out of V1 scope. The kickoff prompt and content samples reflect this.

## Files to upload

| # | File | Where it lives | What it does |
|---|---|---|---|
| 1 | `brief.md` | `_bmad-output/planning-artifacts/briefs/brief-gigbuddy-2026-05-31/` | Product brief — what GigBuddy is and why |
| 2 | `real-example.md` | *this folder* | Actual Jack Ruby 5 gig notes (Big Ed's wedding) — verbatim. Ground-truth format reference. |
| 3 | `real-example-2.md` | *this folder* | Actual Jack Ruby 5 gig notes (Howlin Wolf, 2 May) — verbatim. Shows that songs are reused across gigs with per-gig annotations. |
| 4 | `content-samples.md` | *this folder* | Structured song / chord / setlist samples for The Jack Ruby 5 |
| 5 | `context-facts.md` | *this folder* | Physical and product constraints (iPhone 13, dim-bar, single user, etc.) |
| 6 | `real-example-3.md` | *this folder* | **Reference only — not V1 design target.** Covers-band setlist showing a different document shape. Upload so the data model isn't accidentally designed in a way that precludes future expansion. |

## Then paste the kickoff prompt

Open `handoff-prompt.md` and copy the block under the `---` line. Paste it as your first message in Claude Design after the files are uploaded.

## What this package gives Claude Design

- **Intent** (brief)
- **Real ground-truth content** (the two Jack Ruby 5 gig documents — actual format, terseness, signal density)
- **Structured samples** (content-samples.md, for explicit per-field examples)
- **World facts** (iPhone 13, dim-bar, single user) — physical constraints, not visual preferences
- **A clear V1 scope** (one band, two others noted as out-of-scope so the data model stays flexible)

What it does NOT give Claude Design:
- Mood boards (deliberately excluded — they encode Sally's design taste, not yours)
- Pre-locked design tokens
- Pre-locked screen layouts
- Pre-decided interaction patterns

The bet: minimum constraint, maximum divergence, best surprises. Claude Design proposes visual directions from first principles given the brief and the context. You pick. Then it prototypes.

## What about the mood boards in `../mood-boards/`?

Those exist as a record of Sally's exploration during planning — colors, fonts, and atmospheres she imagined for GigBuddy. They are deliberately **not** included in the upload list because they would anchor Claude Design to one designer's taste rather than letting it propose directions you might prefer.

Keep them as a fallback or reference. Don't upload them unless you specifically want Claude Design to start from those three directions.

## After the session

Claude Design exports a handoff bundle that can pass directly to Claude Code. Bring it back to this repo and the implementation phase begins.
