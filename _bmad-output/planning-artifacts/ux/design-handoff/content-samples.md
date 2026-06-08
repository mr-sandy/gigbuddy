---
title: GigBuddy — Content Samples for Design
purpose: Real song, chord, and setlist data for The Jack Ruby 5 (V1's only active band). Read alongside real-example.md and real-example-2.md, which are the authoritative format references.
created: 2026-05-31
updated: 2026-05-31
---

# Content samples — The Jack Ruby 5

Use these as the actual content in any mockup or prototype. Real titles, real keys, real chord progressions drawn from Sandy's actual repertoire. The goal is that a screen feels like *the real product*, not a template.

> **V1 scope:** GigBuddy serves The Jack Ruby 5 only in V1. Sandy plays in two other bands (Middle Aged Dad Band — rock/indie covers, and Fram — indie originals) but their content is out of scope here. See `real-example-3.md` for the covers band setlist shape if you need to confirm the data model doesn't preclude future expansion.

## Song records

### Body and Soul
- **Band:** The Jack Ruby 5
- **Key:** D♭ (E♭ when there's a vocalist)
- **Patch:** 23 — Stage 3 Piano
- **Tempo:** 62 BPM — ballad
- **Performance note:** vocal tonight — start in E♭
- **Practice note:** Intro rubato, four bars of D♭∆ — wait for the nod. Head twice, piano solo, head out. The bridge modulates to D major; that's the trap.
- **Chord sketch (A section, two-bar phrasing):**
  ```
  E♭m7   A♭7
  D♭∆    D♭∆
  E♭m7   A♭7
  D♭∆    Gm7♭5  C7
  ```
- **External reference:** Hancock / Williams, 1965 (YouTube)

### Autumn Leaves
- **Band:** The Jack Ruby 5
- **Key:** E minor (sometimes G major depending on lead)
- **Patch:** 12 — Trio Grand
- **Tempo:** 132 BPM — medium swing
- **Performance note:** —
- **Practice note:** Standard ii–V–I cycle. Watch the bridge — the rhythm section sometimes pushes it.
- **Chord sketch (A section):**
  ```
  Am7    D7
  G∆     C∆
  F♯m7♭5 B7
  Em     Em
  ```

### All The Things You Are
- **Band:** The Jack Ruby 5
- **Key:** A♭
- **Patch:** 12 — Trio Grand
- **Tempo:** 168 BPM — up-medium
- **Performance note:** trade fours on the out chorus
- **Practice note:** Modulates through several keys — keep the cycles clean. The C major arrival in the bridge is the moment.
- **Chord sketch (first 8 bars):**
  ```
  Fm7    Fm7
  B♭m7   B♭m7
  E♭7    E♭7
  A♭∆    D♭∆
  ```

### Stella By Starlight
- **Band:** The Jack Ruby 5
- **Key:** B♭
- **Patch:** 23 — Stage 3 Piano
- **Tempo:** 96 BPM — medium ballad
- **Performance note:** —
- **Practice note:** Opening Em7♭5 — don't rush the A7♭9 resolution.

### Watermelon Man *(drawn from real-example.md, abbreviated)*
- **Band:** The Jack Ruby 5
- **Key:** F minor (Fm B♭ C)
- **Patch:** Piano
- **Per-gig annotation example:** "Ivan Ian John" (soloist list for the gig)
- **Practice note:** After initial solos, stick on Fm for jam, before returning.

> The Jack Ruby 5 also plays standards like Sweet Georgia Brown, There Will Never Be Another You, Take The A Train, plus a wide funk/soul repertoire — see `real-example.md` and `real-example-2.md` for the full picture.

## Sample setlist — The Jack Ruby 5, Saturday 31 May 2026

```
First Set
1. Autumn Leaves
2. All The Things You Are
3. Stella By Starlight
4. Body and Soul

Second Set
5. There Will Never Be Another You
6. Have You Met Miss Jones
7. But Not For Me
8. Take The A Train

Reserve
R1. Sweet Georgia Brown
```

> See `real-example.md` and `real-example-2.md` for actual setlists in the user's own format.

## Sample paste input — what a band leader actually WhatsApps

This is what the paste-setlist parser needs to handle. Casual, abbreviated, real:

```
Sat night setlist 🎷
1st set
Autumn Leaves
ATTYA
Stella
Body and Soul

2nd set
There Will Never Be...
Miss Jones
But Not For Me
A Train

Reserve - Sweet Georgia Brown
```

Notes about parsing realities:
- "ATTYA" = All The Things You Are (musician shorthand)
- "Miss Jones" = Have You Met Miss Jones
- "There Will Never Be..." with ellipsis is common
- Section headers vary: "1st set", "First Set", "Set 1", "SET ONE"
- Reserve / Encore / Extras are common alternate section names

## Sample gap-fill workflow content

When the paste parser hits "Footprints" and Sandy has never logged it:

- **Unknown song detected:** "Footprints"
- **Suggested matches:** none (or, if fuzzy: "Footsteps" — Sandy rejects)
- **Add new song?** Yes — opens minimal song form pre-filled with:
  - Title: Footprints
  - Band: The Jack Ruby 5 (inferred from setlist context)
  - Key: _empty — required before save_
  - Patch: _empty — required before save_
  - Practice notes: _empty_
- After save: song slots back into the setlist position, gap-flag clears.

## Sample per-gig annotations

These are layered ON TOP of the permanent song record, not edits to it:

- "vocal tonight — start in E♭"
- "they want the long intro"
- "skip the bridge solo, time tight"
- "follow drummer on the out"
- "Ivan Ian John" (soloist list — see real-example-2.md)
- "[GUITAR CHANGE]" (staging/hardware note — see real-example-2.md)

## Band metadata

| Band | V1 status | Repertoire |
|---|---|---|
| The Jack Ruby 5 | **Active — V1's only populated band** | Funk, soul, jazz standards, originals — wide range. Most gigs are with this band. |
| Middle Aged Dad Band | Out of V1 scope | Rock, indie, classic rock. Sandy uses paper chord charts from sites like ultimateguitar.com. Different setlist shape — see `real-example-3.md`. |
| Fram | Out of V1 scope | Long-running indie originals project. Plays infrequently. |
