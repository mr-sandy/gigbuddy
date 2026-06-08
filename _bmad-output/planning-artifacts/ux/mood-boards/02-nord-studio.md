---
title: Mood Board — Nord Studio
status: draft
created: 2026-05-31
direction: 02
---

# Nord Studio

## Mood

Your Nord keyboard, made into software. Hardware-coded, instrumental, technically warm. The app reads as gear that respects the user — same family as Tannoy monitors, Neumann mics, a Nord Stage. Less "design," more "instrumentation."

Visually echoes the keyboard physically sitting under the iPhone. The tool becomes part of the rig.

## Palette

| Token | Hex | Role |
|---|---|---|
| Panel Black | `#0A0A0A` | Primary surface, performance background |
| Chassis Gray | `#1C1C1F` | Practice mode surfaces, raised cards |
| Nord Red | `#E02020` | THE accent. Active state, KEY value, current-song indicator. Used like the red anodized knob — one per screen |
| LED Amber | `#F0B040` | Secondary status (e.g. "unknown song" flag) — used twice in the whole app |
| Panel White | `#FAFAFA` | Primary text |
| Etched Gray | `#8A8A90` | Labels (CAPS), secondary text |
| Hairline | `#2A2A2E` | Subtle borders — silkscreen lines on a panel |

## Typography

- **All UI:** IBM Plex Sans. 14-16px body, weight 400. Weight 600 for emphasis. Humanist enough to feel warm; geometric enough to feel instrumental.
- **Labels:** IBM Plex Sans 12px, ALL CAPS, +0.08em letter-spacing, Etched Gray. Think "MASTER VOLUME" silkscreen.
- **Performance mode song title:** IBM Plex Sans 48px, weight 700. Tighter than Stage & Score because Plex is wider.
- **Chord symbols & numerals:** IBM Plex Mono, 16-18px. Monospace IS the visual language here — it belongs.

The whole stack is IBM Plex (free, open, professional). One family, three voices.

## Texture & detail

- A subtle red hairline accent on raised surfaces (echoing the red border around a Nord display)
- A small red LED dot `●` as the "active" indicator throughout — used as a sequencer-step indicator on the setlist
- No photographs. No textures beyond a very subtle screen grain on Panel Black.
- Sections separated by hairline rules, never boxes

## Practice mode feel

Chassis Gray background. Information laid out in modules — like the zones of a Nord control panel. Labels above values: "BAND" "KEY" "PATCH" "TEMPO" — caps, etched gray. Values in Plex Sans or Plex Mono depending on type. Mono everywhere for fixed-width data: chord symbols, patch numbers, BPM, set position.

## Performance mode feel

Panel Black, near-pure. Song title 48px white Plex Sans at the top. Below in caps: "KEY" "PATCH" — values huge in Plex Mono. A single Nord Red LED dot pulses gently (the "I am the current song" tell). Setlist progress as a row of red dots at the bottom of the card — lit = played or current, dim = remaining. Feels like the Nord's own display, scaled up.

## Risks

- Cold-developer-tool risk. Plex Sans is humanist enough to mitigate, but spacing must be generous.
- Nord Red must NOT appear everywhere. One red element per screen. The moment you have two, the language collapses.
- Avoid feeling like a synth editor — this is a performance tool, not a patch programmer.

## Microcopy tone

> PATCH 23 — STAGE 3 PIANO
> SET 1 — 7 / 12
> BAND: JAZZ
> UNKNOWN — ADD NOTES

## Accessibility

| Pair | Ratio | Verdict |
|---|---|---|
| Panel White `#FAFAFA` on Panel Black `#0A0A0A` | 19.5:1 | AAA |
| Nord Red `#E02020` on Panel Black | 4.5:1 | AA (normal), AAA (large) — use for large text or non-text indicators only |
| Etched Gray `#8A8A90` on Panel Black | 6.4:1 | AAA (large) |
| Panel White on Chassis Gray `#1C1C1F` | 16.1:1 | AAA |
