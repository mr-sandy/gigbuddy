---
title: GigBuddy — Kickoff prompt for Claude Design
purpose: Copy-paste this as the opening message in Claude Design after uploading the files listed in README.md
created: 2026-05-31
updated: 2026-05-31
---

# Kickoff prompt

> Paste the block below into Claude Design as your first message, after uploading the files listed in `README.md`.

---

I'm building **GigBuddy** — a personal gig-preparation and performance app for myself. I'm a jazz pianist who gigs two to three times a month, primarily with my jazz band **The Jack Ruby 5** (funk, soul, jazz standards, originals). I'd like to use you to propose a visual direction and prototype the key screens.

**V1 scope:** GigBuddy serves The Jack Ruby 5 only in V1. I also play in two other bands (Middle Aged Dad Band — rock/indie covers, and Fram — indie originals), but their workflows are out of scope for V1. The data model supports multiple bands (the band-switcher should exist in the chrome), but only The Jack Ruby 5 will have real content. Please design accordingly.

I've uploaded:

- **`brief.md`** — the product brief (what GigBuddy is and why)
- **`real-example.md`**, **`real-example-2.md`** — actual gig notes from real Jack Ruby 5 gigs, pasted verbatim. **Read these for the ground-truth format and feel of real-world musician notes — terse, abbreviated, full of musician shorthand.**
- **`content-samples.md`** — structured song and setlist samples grounded in real Jack Ruby 5 content. Use these when you need explicit per-field examples.
- **`context-facts.md`** — physical and product facts (iPhone 13 geometry, dim-bar reading conditions, performance-mode-is-sacred, etc.). Treat these as constraints, not preferences.
- **`real-example-3.md`** *(reference only — not V1 design target)* — a covers-band setlist showing a different document shape. Don't design for it; just don't accidentally design *against* it.

I have deliberately *not* pre-decided a visual direction. I want to see what you propose.

## What I want from this session

### Phase 1 — propose visual directions

Based on the brief, content, and context facts, propose **three to five distinct visual directions** for GigBuddy. Show them to me by rendering the **performance mode card** in each direction, side by side, at iPhone 13 width (390pt). Use real Body and Soul content from `content-samples.md` (Key: D♭, Patch: 23, the chord sketch, the "vocal tonight — start in E♭" annotation).

The performance card is the most important screen in the product — it's what I read between songs on stage, in a dim bar, at arm's length, in 20 seconds. Make me *feel* each direction's answer to that moment.

For each direction, briefly explain:
- The mood / what it's trying to be
- The palette and typography choices
- How practice mode would differ from performance mode in this direction

Then I'll pick one (or ask you to remix). After that, Phase 2.

### Phase 2 — prototype the key screens

Once a direction is locked, build an interactive prototype of:

1. **Performance mode card** (the sacred view)
2. **Setlist view** with 1st Set / 2nd Set / Reserve structure
3. **Song library** for The Jack Ruby 5 (the band-switcher exists in the chrome; Jack Ruby 5 is the only band with content in V1)
4. **Paste-setlist → gap-fill workflow** (paste raw WhatsApp text → parse → flag unknowns → fill gaps inline)
5. **Song detail / practice mode** (full info, external links, practice notes)

I want to be able to open the prototype on my actual iPhone 13 and click through.

## What I'd love you to do beyond execution

- **Be opinionated.** Don't give me five safe options. Give me directions that disagree with each other.
- **Show your reasoning.** When you make a meaningful design call (e.g. choosing tap-anywhere over swipe for next-song navigation), tell me why.
- **Propose options on the open questions** listed at the bottom of `context-facts.md` — portrait vs. landscape, chord density, navigation patterns, band switching.
- **Don't invent product features.** Anything not in the brief is out of scope for the prototype. If you have a great idea, flag it as a "V2 thought" rather than building it in.

## Where to start

Propose the visual directions, render each as a performance mode card with real content, and walk me through your reasoning. That's the first thing I want to see.
