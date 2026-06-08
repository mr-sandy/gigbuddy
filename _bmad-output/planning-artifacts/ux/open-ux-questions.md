---
title: GigBuddy — Open UX Questions for the Spec Phase
purpose: Unresolved V1 questions the brief doesn't fully answer. The bmad-ux phase should work through these explicitly with Sandy.
created: 2026-06-08
---

# Open UX questions

Read this file at the start of the UX spec session. These are real V1 questions the brief doesn't fully answer. Work through them explicitly — don't infer.

## 1. Setlist access pattern *(raised 2026-06-08 by Sandy)*

The brief covers setlist *creation* and *use during performance*, but is silent on how the user **finds** a setlist between those two moments.

Implicitly there must be some access mechanism — you can't create a setlist for Saturday and have no way to open it on Saturday night. But the shape is undetermined:

- A list view of recent / upcoming setlists, ordered by date?
- A calendar view (a month / week showing gigs)?
- A home screen with "tonight's setlist" prominently surfaced?
- A split between upcoming and past?
- Or some hybrid?

> Claude Design's board shows a single "Setlist overview" screen for "Sat 31 May 2026" but doesn't show how that view is reached — no home, no list. The question is fully open.

## 2. Home / landing screen — V1 entry point

What does the user see when they cold-open the app on:
- **MacBook** (practice context — at home, hours-long prep session)?
- **iPhone** (about to perform — opens the app on top of the Nord)?

The brief is silent. Plausible: a dashboard surfacing tonight's gig, the library landing, the setlist list, a context-aware home that differs per device.

## 3. Practice ↔ performance mode transition

How does the user explicitly enter performance mode for a given gig?

> Claude Design showed a "Start performance ›" CTA on the setlist overview screen. That's one option, but the trigger flow isn't decided. Other options: tap a setlist row, a top-level Performance Mode entry, an explicit "go live" confirm. Is there a confirm step so performance mode doesn't fire accidentally during prep?

## 4. Navigation between songs in performance mode

From `design-handoff/context-facts.md` open questions — still unresolved.

> Claude Design appears to use single-tap-to-advance (verify in `visual-direction/interactive-prototype.html`). Confirm or reject. Options: tap-anywhere, swipe, edge zones, bottom buttons. The "hands may be sweaty, attention divided" constraint matters.

## 5. Band switching

From `design-handoff/context-facts.md` open questions — still unresolved.

V1 has only **The Jack Ruby 5** populated, but the data model assumes multiple bands. UX needs to decide whether the band switcher is visible in V1 chrome at all, and if so, how it behaves with a single band.

## 6. Portrait vs. landscape for performance mode

From `design-handoff/context-facts.md` open questions.

> Claude Design picked portrait. UX spec can confirm or revisit, but portrait is the strong default and probably right.

## 7. Chord chart density

From `design-handoff/context-facts.md` open questions.

> Claude Design picked 4-line monospaced chord blocks. UX spec can confirm or revisit. Note: real examples (`design-handoff/real-example.md`, `real-example-2.md`) show some songs have minimal chord info (e.g. `FOOTPRINTS / Piano` with nothing else). The UX needs a sparse-content state — a song card that doesn't fall apart when there's no chord chart to render.

## 8. The "edit" surface — when and where

The brief says practice mode is for editing song records and adding per-gig annotations. But the UX shape is undetermined: inline edit on the song detail page? Modal? Dedicated edit screen? Auto-save vs. explicit save? Optimistic vs. pessimistic? Some of this is implementation detail, but the UX has to commit to a model.

---

**As each question is answered in the UX spec session, mark it resolved here (or move it to the spec doc). New questions surfaced during the spec phase should be added.**
