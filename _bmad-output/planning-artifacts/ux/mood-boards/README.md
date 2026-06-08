---
title: GigBuddy Mood Boards — Index
status: draft
created: 2026-05-31
---

# GigBuddy Mood Boards

Three distinct visual directions, each with its own opinion about what GigBuddy is. Pick one (or remix). After we lock direction, the next step is a clickable HTML prototype of the key screens.

## How to use this

- **Open `index.html` in a browser** — that's where you can actually see the directions side-by-side, with palette swatches, type specimens, and sample practice/performance cards rendered at iPhone 13 width.
- Read the per-direction markdown specs for the *why* behind the choices.
- Then come back to Sally and tell me which one to commit to (or what to remix).

## The three directions

### 01 — Stage & Score
Jazz club. Cream-paper practice mode, ink-black performance mode with a single warm amber accent. Editorial. The two modes feel genuinely different.
→ [`01-stage-and-score.md`](01-stage-and-score.md)

### 02 — Nord Studio
Hardware-coded. Panel black, Nord red, IBM Plex everywhere, labels in caps like silkscreen on a Nord. The app as gear.
→ [`02-nord-studio.md`](02-nord-studio.md)

### 03 — Manuscript
Real Book / notebook / lead sheet. Crimson Pro serif, paper cream, fountain-pen ink. Performance mode is the same notebook glowing on a lectern.
→ [`03-manuscript.md`](03-manuscript.md)

## Sally's recommendation

**Stage & Score** — for one reason:

The brief calls performance mode "sacred" and explicitly separates practice from performance as distinct states. Stage & Score is the only direction that gives performance mode its own visual world (ink + amber) while keeping practice warm and editorial (cream paper + ink). Two contexts, two atmospheres, one product.

Mixing Playfair (editorial) with Inter (stage) gives us warmth in the green room and sharpness under the bar light — no compromise on legibility.

**Nord Studio** is my fallback. It would feel like part of your rig — but it's uniform across both modes, which slightly fights the brief's two-worlds principle. Pick this if "it looks like gear" matters more to you than "the two modes feel different."

**Manuscript** is the most beautiful and the most romantic. The risk is the serif on stage — Crimson Pro on a 6.1" screen in a dim bar at arm's length might fail the legibility test. If we go this direction, we test on your actual phone before committing, and we have a fallback (Inter for performance-mode song title and chords only).

## What you decide here drives

- The token file (`tokens.css`) that powers everything downstream
- The clickable HTML prototype of: performance card, setlist view, song library, paste-setlist flow, song detail
- All visual decisions in the architecture/implementation phase

## After you pick

1. **Lock tokens** — palette, type scale, spacing scale into `tokens.css`
2. **Prototype the key screens** — clickable HTML you can open on your actual iPhone 13 in dim conditions
3. **Stress-test performance mode** — readability test in a dim room, arm's length, between-songs glance
4. **Hand off to architecture** — tokens + prototype become the visual contract for implementation

## Open questions Sally has

- **The Nord is red.** Does it matter to you that the app's accent color *not* clash with the actual instrument under your iPhone? (Stage & Score and Manuscript are safe here; Nord Studio leans into it deliberately.)
- **Performance mode in landscape?** The iPhone resting on top of the keyboard — is it portrait or could it be landscape? Affects layout decisions for the prototype.
- **Chord chart density.** Are we showing 4-line chord sketches, or full lead sheets with melody? Affects how much vertical real estate performance mode owes the chord area vs. the song title.
