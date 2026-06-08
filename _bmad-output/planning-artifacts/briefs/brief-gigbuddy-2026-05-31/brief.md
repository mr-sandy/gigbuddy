---
title: GigBuddy — Gig Preparation & Performance App
status: final
created: 2026-05-31
updated: 2026-05-31
---

# Product Brief: GigBuddy

## Executive Summary

GigBuddy is a personal web and mobile app that replaces a musician's scattered Apple Notes gig preparation system with a structured, performance-ready tool. Built for a jazz pianist who performs with multiple bands several times a month, it manages a song library, creates and tracks gig setlists, and presents the right information at the right moment: rich notes during practice, clean essential cards during live performance.

The core insight is that a musician's information needs during a gig are fundamentally different from their needs during preparation. Existing note-taking tools conflate these contexts. GigBuddy separates them deliberately — making the right thing effortless in the moment that matters most.

## Design Principles

This is a personal tool, not a platform. Three principles shape every decision:

1. **Context-appropriate information.** Practice and performance are distinct states with different information needs. The app surfaces different content in each — not the same content filtered differently.
2. **Setlist-driven library growth.** The library grows organically through gig preparation, not as a standalone data entry project. Paste a setlist, fill the gaps, play the gig.
3. **Performance mode is sacred.** Anything that slows reading or navigation under live conditions is a defect.

## The Problem

Before each gig, the current workflow requires manually copying individual song notes from Apple Notes into a single ordered document so songs can be scrolled through in setlist sequence during the performance. This is time-consuming, error-prone, and must be repeated from scratch for every gig.

During performance, that compiled note — open on an iPhone resting on top of the keyboard — mixes preparation detail with the few essential cues actually needed on the night. Finding the patch number or a key chord in dense text, in a dim bar, between songs, is harder than it should be.

When a setlist includes a new or rarely played song, there is no structured workflow to catch the gap and address it before the gig.

Over time, no history is built. There is no way to know which songs have not been played recently, which are over-relied upon, or what a balanced setlist for the next gig might look like.

## The Solution

GigBuddy provides three interlocking capabilities:

**Song Library.** A structured per-song record — title, band, key, Nord patch/sound, chord symbols, soloing guidance, and practice resources. Each song carries both a performance view (essentials only) and a practice view (full detail including external links and extended notes). The library is band-scoped; each band's repertoire is fully separated.

**Setlist Management.** Create setlists by pasting raw WhatsApp text. The app parses the list, matches known songs, flags unknowns, and prompts the user to add notes for each gap — turning pre-gig preparation into a single structured workflow rather than a manual compilation task. Setlists preserve section structure (1st Set / 2nd Set / Reserve) and support per-gig annotations on individual songs (e.g. "vocal tonight?") without touching the permanent song record.

**Performance Mode.** An iPhone-optimised view presenting one song at a time in setlist order — large text, high contrast, Nord patch and key prominent at a glance. Single-tap navigation between songs. Screen wake lock keeps the display on. Everything not needed on stage is out of the way.

## Who This Serves

GigBuddy serves a jazz pianist performing 2–3 times a month across multiple bands: a jazz band (primary, ~35-song repertoire of standards and originals), a covers band (secondary, heavier reliance on full chord charts), and an originals band (infrequent). Prepares on MacBook at home; performs with iPhone on top of the Nord keyboard. Notes are read between songs — roughly 20–30 seconds.

## Scope

**In for V1:**
- Song library: create, edit, and view songs with structured fields (title, band, key, patch/sound, chord symbols, performance notes, practice notes/links)
- Multi-band support: any number of bands as fully separated contexts. V1 content: **The Jack Ruby 5 only** — covers band (Middle Aged Dad Band) and indie originals (Fram) are V2+. The multi-band data model supports adding them later without migration.
- Setlist creation via paste-to-parse (WhatsApp format) and manual entry
- Setlist section structure (1st Set / 2nd Set / Reserve)
- Per-gig song annotations, kept separate from permanent song notes
- Performance mode: single-song card view, iPhone-optimised, screen wake lock
- Practice mode: full song detail with external resource links
- Web app (MacBook) + PWA (iPhone)
- Self-hosted on personal AWS account — single user [ASSUMPTION: lightweight auth acceptable; no multi-user access control needed]

**Explicitly out of V1:**
- Setlist intelligence and suggestions
- Gig history analytics and reporting
- Bandmate access or any sharing capability
- Apple Notes import (manual entry only; library built organically via setlist workflow)
- Audio, MIDI, or hardware integration
- Multi-tenant or SaaS architecture

## V2 Horizon

Once setlist history accumulates, the app gains a meaningful dataset: which songs were played, when, how often, and how recently. This unlocks repertoire balance reporting ("songs not played in 3 months"), over-reliance alerts, and eventually assisted setlist creation — suggestions shaped by frequency, recency, and balance.

This is a natural V2. The data model should treat full setlist history as a first-class concern from day one, so V2 requires no migration. If the tool proves genuinely valuable, there is a distant possibility of opening it to other musicians — the architecture should not foreclose that path, but should not be designed for it either.

## Success Criteria

- The pre-gig "compile notes document" workflow is eliminated entirely
- Any song's performance view is reachable in under 3 taps from the setlist
- A new setlist with unknown songs can be fully processed — gaps identified, notes added — in a single workflow session
- Performance mode is readable on iPhone in a dim bar without adjustment
- The app is stable and available on gig nights; no dependencies that can fail at 9pm
