---
title: GigBuddy — Real example #3, covers band setlist format
purpose: A real Middle Aged Dad Band setlist (excerpt), preserved verbatim. Read alongside real-example.md and real-example-2.md — the format is fundamentally different from the Jack Ruby 5 documents, which is the most important signal.
created: 2026-05-31
---

# Real example #3 — Middle Aged Dad Band setlist excerpt

A real setlist excerpt from Sandy's covers band (Middle Aged Dad Band), pasted verbatim below.

> **V1 scope status:** Reference only — **not** a V1 design target. V1 of GigBuddy serves The Jack Ruby 5 only. This document is kept in the package so the data model isn't accidentally designed in a way that precludes covers-band support later (V2+).

**This document has a completely different shape from `real-example.md` and `real-example-2.md`.** It is not a per-song notes compilation; it is a **band-wide instrument-assignment matrix** — songs as columns, band members as rows, role/instrument per song per member. The chord content for these songs lives elsewhere (Sandy currently uses paper printouts from sites like ultimateguitar.com).

## Signals to honour

- **Setlist format ≠ song notes format.** The setlist coordinates the whole band's per-song roles. Chord/lyric content is separate, currently external (ultimateguitar.com prints).
- **Songs are notated as `Artist - Title`** ("Eagles - New Kid", "Ace - How Long", "Elvis - Suspicious Minds", "Elvis C - Pump It Up", "Semisonic - Chemistry"). The artist is part of the identifier — covers can share titles or shorthand titles need disambiguating.
- **`Elvis` vs `Elvis C`** — Elvis Costello disambiguated from Elvis Presley. Real-world ambiguity.
- **Sandy's column shows per-song patch/instrument intent** — "Keys/Organ", "Elec piano/keys", "Keys/strings/Horns etc..", "Piano/Keys". One song may demand multiple sounds within itself ("Keys/strings/Horns etc..").
- **Each row is a band member.** Their roles vary per song: Craig is Lead Vox on most but Backing Vox on "Chemistry"; Colin moves between Acoustic, Lead, and Vox; Chris and Gilad sometimes swap Bass/Guitar; Ken sometimes adds Vox.
- **The first table has a trailing empty column** in the header row (three songs, four columns) — likely a holdover from a wider working version. The second table has an empty trailing song slot. Treat as artefact of an evolving document.
- **Sandy = "SANDY" row.** He is the keyboards player for the band. The user perspective in GigBuddy could either show all rows (band-wide view) or filter to just Sandy's row (personal view).

## Implication worth flagging

If GigBuddy is to serve this band, it has at least two big shape questions to answer:
1. **Setlist data model** — does it support band-wide multi-perspective setlists (this format), Sandy-perspective only (the Jack Ruby 5 format), or both? They are structurally different.
2. **Chord content provenance** — does GigBuddy store/render external chord charts (paste from ultimateguitar.com), or does the covers band stay on paper for V1?

These should be answered before designing covers-band screens. The brief currently treats setlist structure as a single shape (1st Set / 2nd Set / Reserve), which doesn't accommodate this matrix format.

---

| | Eagles - New Kid | Ace - How Long | Elvis - Suspicious Minds |
|---|---|---|---|
| CRAIG | Lead Vox | Lead Vox | Lead Vox |
| COLIN | Guitar - Acoustic/Vox | Guitar - Acoustic/Vox | Guitar - Lead |
| CHRIS | Guitar - Lead | Guitar - Lead | Guitar - Acoustic |
| ANGUS | Guitar - Rhythm | Guitar - Rhythm | Guitar - Rhythm |
| GILAD | Bass | Bass | Bass |
| SANDY | Keys/Organ | Elec piano/keys | Keys/strings/Horns etc.. |
| KEN | Drums/Harmonies | Drums/Harmonies | Drums |

| | Elvis C - Pump It Up | Semisonic - Chemistry | |
|---|---|---|---|
| CRAIG | Lead Vox | Backing Vox/harmonies | |
| COLIN | Guitar - Lead/Vox | Lead Vox/Lead guitar | |
| CHRIS | Bass | Guitar - Acoustic | |
| ANGUS | Guitar - Rhythm | Guitar - Rhythm | |
| GILAD | Guitar - Acoustic/Vox | Bass | |
| SANDY | Keys/Organ | Piano/Keys | |
| KEN | Drums/Vox | Drums | |
