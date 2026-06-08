---
title: Mood Board — Manuscript
status: draft
created: 2026-05-31
direction: 03
---

# Manuscript

## Mood

A musician's notebook. The Real Book, fountain pens, lead sheets, the back-of-an-envelope chord chart that becomes a setlist. Scholarly, hand-made, quiet.

Practice mode IS the notebook. Performance mode flips the lectern light on — same notebook, in the dark, glowing. The product feels personal because it looks personal.

## Palette

| Token | Hex | Role |
|---|---|---|
| Paper | `#F4ECD8` | Practice mode background — slightly aged manuscript paper |
| Ink | `#1B1816` | Warm black — fountain-pen ink, never pure black |
| Real Book Red | `#B5302C` | Single accent. Section markers, KEY indicator |
| Margin | `#9C9180` | Secondary text, page-edge tone |
| Lectern Black | `#161310` | Performance mode background — warm, never cold |
| Lectern Cream | `#F4ECD8` | Performance mode text — same paper, now glowing |
| Faded | `#5B544A` | Dividers and secondary text on performance mode |

## Typography

- **Display & song titles:** Crimson Pro, weight 600. Slightly hand-set feel of an old music book. Italic forms are beautiful.
- **Body:** Crimson Pro regular, 17px, line-height 1.7. Reads like a book.
- **Chord symbols:** Courier Prime, 16px. Typewriter mono — period-appropriate for a hand-typed lead sheet.
- **Section markers ("1st Set", "2nd Set", "Reserve"):** Crimson Pro Italic, Real Book Red, with a small Margin-colored rule beneath.
- **Performance mode song title:** Crimson Pro, 52px, weight 700. Yes — serif on stage. This is the riskiest call in the whole direction.

All free Google Fonts.

## Texture & detail

- Very subtle paper grain on practice mode (low enough not to interfere with reading)
- 1px Margin-colored rules used as notebook ruling between sections
- A small Real Book Red square `■` as the section glyph
- No drop caps, no flourishes. Restraint is what makes "notebook" work without becoming "scrapbook."

## Practice mode feel

Paper background, ink text, ruled lines between sections. Song titles in Crimson Pro 600 — feels like reading a well-loved music book. Notes set as marginalia: smaller, slightly indented, in Margin gray. Section markers in Real Book Red italic.

## Performance mode feel

Lectern Black — warm, not stark. Cream text — the same paper color, but now emitting light in a dark room. Crimson Pro 52px song title at the top. KEY and PATCH in Real Book Red, large, centered. Chord chart in Courier Prime cream. Looks like a glowing lectern in a dim bar.

## Risks

- **Serif on stage is the load-bearing bet.** Crimson Pro is highly legible, but a 6.1" screen in a dim bar at arm's length is unforgiving. We need to test on your actual iPhone 13 before committing.
- Fallback plan: if Crimson Pro fails the dim-bar test, swap performance-mode song title and chord chart to Inter, keep Crimson everywhere else.
- "Notebook" must not become "twee." Hard discipline on textures and flourishes.

## Microcopy tone

> Tonight's setlist.
> Notes for "Body and Soul."
> Reserve.
> Added at the gig.

## Accessibility

| Pair | Ratio | Verdict |
|---|---|---|
| Ink `#1B1816` on Paper `#F4ECD8` | 13.8:1 | AAA |
| Lectern Cream `#F4ECD8` on Lectern Black `#161310` | 15.2:1 | AAA |
| Real Book Red `#B5302C` on Paper | 5.1:1 | AA (normal), AAA (large) — restrict to large/bold uses |
| Real Book Red on Lectern Black | 4.7:1 | AA (normal), AAA (large) |
