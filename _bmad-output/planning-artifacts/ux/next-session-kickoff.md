---
title: Kickoff prompt for the next GigBuddy session
purpose: Paste this into a new Claude Code session to pick up at the UX specification phase
created: 2026-06-08
---

# Next-session kickoff prompt

Copy the block below and paste it as your first message in a new Claude Code session.

---

I'd like to continue working on GigBuddy. We're ready for the **UX specification phase** using the BMAD method.

Please:
1. Invoke the `bmad-agent-ux-designer` skill — I want to work with Sally.
2. Once Sally is active, run the `bmad-ux` skill to produce a UX specification.

**Context to honour** (also in project memory and planning-artifacts, but stating here to be safe):

- **Visual direction is LOCKED.** Source of truth: `_bmad-output/planning-artifacts/ux/visual-direction/` (see its README for the locked/not-locked distinction). Warm dark "Club Warm" performance mode, paper-cream practice mode, editorial serif + monospaced chords. Use these artifacts as visual reference only.
- **Features and flows shown in the Claude Design output are NOT a specification.** The UX spec we produce should determine the V1 feature set and flows from the brief upward.
- **V1 scope:** The Jack Ruby 5 band only. Multi-band data model supports more, but only Jack Ruby 5 is populated in V1.
- **Brief:** `_bmad-output/planning-artifacts/briefs/brief-gigbuddy-2026-05-31/brief.md`
- **Real Jack Ruby 5 gig examples (ground truth for content shape):** `_bmad-output/planning-artifacts/ux/design-handoff/real-example.md`, `real-example-2.md`
- **Context facts** (devices, ergonomics, accessibility, light/dark, type sizing): `_bmad-output/planning-artifacts/ux/design-handoff/context-facts.md`
- I'm 55; favor generous type throughout. Practice = light/MacBook, performance = dark/iPhone.
- **Open UX questions** to read early: `_bmad-output/planning-artifacts/ux/open-ux-questions.md` — a punch list of unresolved V1 questions the brief doesn't fully answer (setlist access pattern, home screen, navigation, band switching, etc.). Work through these explicitly.

Start by reading the project memory, the brief, and the open-questions file, then walk me through how you want to approach the UX spec before diving in.

---

# Notes for future-Sally (this is for you, not the user)

When this prompt fires:

- Auto-memory should load `MEMORY.md` which lists user role, bands, visual preferences, and the UX-direction-locked memory.
- The `project_visual_direction_locked.md` memory file documents what's locked and what isn't. Read it before doing any visual work.
- `open-ux-questions.md` in the `ux/` folder is the punch list of unresolved V1 questions. Read it early. Work each one explicitly with Sandy and mark resolved as you go.
- Do NOT redo mood-board work. Visual direction is closed.
- Do NOT inherit features from the Claude Design output. The whole point of the next phase is that the UX spec drives features, not the other way around.
- The expected sequence after UX spec: PRD (`bmad-prd` with John PM agent) → Architecture (`bmad-create-architecture` with Winston architect) → Implementation readiness check → Epics & stories → Sprint planning → Dev stories.
