---
title: Mood Board — Stage & Score
status: draft
created: 2026-05-31
direction: 01
---

# Stage & Score

## Mood

A late-set jazz club. The room is ink-dark; one warm amber light hangs over the music stand. Practice mode is the green room before the gig — cream-paper notes, calm, considered. Performance mode is the room itself — black, with the amber stand light doing the work.

Two modes, two atmospheres, one product. This direction commits hardest to the brief's "practice and performance are distinct states" principle.

## Palette

| Token | Hex | Role |
|---|---|---|
| Stage Black | `#0E0E12` | Performance mode background — deep but not pure |
| Music Stand Amber | `#E0A04A` | The accent. Used sparingly: KEY, PATCH numeral, active state |
| Brass | `#B8862F` | Hover / pressed states for amber elements |
| Programme Cream | `#F5EDD8` | Practice mode background |
| Ink | `#1A1A20` | Text on cream |
| Smoke | `#6B6B73` | Secondary text, dividers |
| Burgundy Reserve | `#5A1F22` | Used once or twice max — destructive / Reserve set indicator |

## Typography

- **Display & song titles (practice):** Playfair Display, 600/700. Italic for emphasis. Editorial moments only.
- **Body & UI:** Inter, 16/17px regular, 1.55 line-height. Workhorse.
- **Performance mode song title:** Inter, 56px, weight 700. Sans-serif deliberately — sharper at distance than serif. We mix serif/sans on purpose: editorial in the green room, instrumental on stage.
- **Chord symbols:** IBM Plex Mono, 16-18px. Monospace because chord charts depend on alignment.
- **Numerals:** Tabular figures throughout (`font-variant-numeric: tabular-nums`) so set positions and patch numbers don't jitter.

All Google Fonts — free, instantly available.

## Texture & detail

- A very subtle film-grain on Stage Black (so low it reads as warmth, not noise)
- Brass-rule dividers (1px solid Brass) between sections in practice mode
- No photographs. No filigree. Typography and color do all the work.
- A brass "•" as the only decorative glyph — used as a separator

## Practice mode feel

Cream background, ink text, Playfair song titles in semibold or italic. Section headings in italic small caps. Generous line-height (1.65). Links in Burgundy. Reads like a programme note from a Wigmore Hall recital — but for jazz.

## Performance mode feel

Pure Stage Black. Song title 56px white Inter Bold at the top of the card. Below: KEY and PATCH in amber, single line, tabular numerals at huge size. Chord chart in white Plex Mono with generous line spacing. Per-gig annotation in amber italic at the bottom. Setlist position indicated by a row of small dots — current = amber, others = smoke.

The amber must read as a stand light, not as gold leaf.

## Risks

- Playfair can drift "wedding invitation" if used too widely. Confine to titling roles.
- Amber must stay restrained — one amber element per screen ideally, two max.
- "Editorial" must not become "decorative." Restraint is the discipline.

## Microcopy tone

> Tonight's setlist.
> Reserve.
> Patch 23.
> Added during gig.

## Accessibility

| Pair | Ratio | Verdict |
|---|---|---|
| White `#FFF` on Stage Black `#0E0E12` | 19.4:1 | AAA |
| Amber `#E0A04A` on Stage Black | 8.6:1 | AAA (large text), AA (small) |
| Ink `#1A1A20` on Cream `#F5EDD8` | 14.2:1 | AAA |
| Burgundy `#5A1F22` on Cream | 9.1:1 | AAA |
