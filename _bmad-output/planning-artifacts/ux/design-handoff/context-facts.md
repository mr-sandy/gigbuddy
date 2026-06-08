---
title: GigBuddy — Context Facts for Design
purpose: Physical, contextual, and product facts that aren't design choices — facts Claude Design needs so it doesn't have to guess
created: 2026-05-31
---

# Context facts

These are not design preferences. They are facts about the user, the devices, the environment, and the product shape. Design freely *around* them — but don't design *against* them.

## The user

- **One user. Singular.** The product is built for one person (a jazz pianist who performs 2–3 times a month). It is not a SaaS, not multi-tenant, not a team product.
- No login screens, account management, billing, onboarding-for-strangers, or empty-state-for-new-team-members are needed. The user is signed in by virtue of being on the device.
- **User profile:** Sandy is 55. Small text is harder to read than it used to be. Favor generous type and spacing throughout the app — not only in performance mode. Practice-mode body text on MacBook should err larger (17–18pt+); performance-mode primary content (song title, key, patch) should be very large (32pt+).

## Devices

| Context | Device | Usage |
|---|---|---|
| Preparation | MacBook (any modern model) | Hours-long sessions, full keyboard + trackpad, browser-based |
| Performance | iPhone 13 — installed as PWA | 20–30 second glances between songs |

### iPhone 13 geometry (must respect)
- CSS viewport: **390 × 844 pt**
- Display: 6.1" OLED, 460 ppi
- **Notch** at top — design safe-area inset of ~47pt for status bar + notch
- **Home indicator** at bottom — design safe-area inset of ~34pt
- Tap-target minimum: **44 × 44pt** (Apple HIG)
- Always portrait unless specified otherwise (see open question below)

## Physical performance context

This is the most important section. Designing performance mode without these facts in mind will fail.

- **Lighting:** dim bar / dim jazz club. Stage lights variable and sometimes unhelpful. Phone screen brightness will be the dominant light on the device.
- **Phone position:** resting flat on top of a Nord keyboard. Read at arm's length while standing.
- **Time per glance:** 20–30 seconds, between songs. Not during songs.
- **Hands:** may be sweaty, may be holding sticks/sheet music for half a second. Single-tap navigation only. No precise gestures, no long-presses for primary actions.
- **Attention:** divided. The user is also talking to bandmates, watching the room, drinking water. The screen is a glance, not a focus.
- **Wake lock:** the screen must NOT sleep during performance mode. (Implementation concern, but design must not assume sleep can save state visually.)

## Visual modes (light / dark)

- **Practice mode (MacBook): light by default.** Sandy works in normal daylight conditions and reaches for a light UI when prepping.
- **Performance mode (iPhone): dark by default.** Gigs are dim, and a bright phone shining out from on top of the keyboard is visually obtrusive — both for Sandy and the room. Dark mode keeps the device functional and discreet.
- This light/dark split aligns naturally with the brief's "practice and performance feel different" principle — it's part of how they feel different.
- A toggle is fine to expose, but the defaults above are the right defaults.

## Product principles (from the brief — treat as facts here)

1. **Performance mode is sacred.** Anything that slows reading or navigation under live conditions is a defect. No animations longer than 150ms in performance mode. No modals. No toasts. No nags.
2. **Practice and performance are distinct contexts with different information needs.** The app surfaces *different content* in each — not the same content filtered differently. The two modes are allowed to look and feel different.
3. **Setlist-driven library growth.** Library is built by working through setlists, not as standalone data entry. The "add unknown song" flow lives inside the setlist workflow, not as a top-level command.

## Structural facts

- **Bands** are first-class containers. Sandy plays in three: **The Jack Ruby 5** (primary jazz band — funk, soul, jazz standards, originals), **Middle Aged Dad Band** (covers — rock, indie, classic rock), and **Fram** (long-running indie originals project, plays infrequently). Each band has its own song library, fully separated. Band-switching is a core navigation move, but the user typically operates within one band's context for an entire session.
- **Setlists** belong to a band and a date. They have section structure: **1st Set**, **2nd Set**, **Reserve** (sometimes also Encore — treat as another reserve-like section).
- **Per-gig annotations** are layered onto songs but never modify the permanent song record. E.g. "vocal tonight" appears only in this setlist's view of this song.
- **Setlist history** is preserved — every setlist played is kept. (V2 will mine this for repertoire balance.)

## Accessibility floor

- **Performance mode:** WCAG AAA for text/background contrast (7:1+). Non-negotiable.
- **Practice mode:** WCAG AA minimum (4.5:1).
- **No information conveyed by color alone.** A red dot indicating "current song" must also be larger / glowing / accompanied by a label.
- Text in performance mode must be readable at arm's length in dim light — **minimum 18pt** for any text the user might need to read at a glance; **primary content (song title, key, patch) should be 32pt+**. Sandy is 55; don't compromise on type size. (See user profile under "The user".)

## Out of scope (don't design these)

- Audio playback, MIDI, hardware integration
- Bandmate access, sharing, collaboration
- Setlist intelligence / suggestions / analytics (V2)
- Apple Notes import
- Multi-band-at-once views (one band context at a time)
- Login / signup / billing

## Open questions (would benefit from Claude Design's exploration)

These are genuinely open — propose options, don't assume:

1. **Portrait vs. landscape for performance mode** — the iPhone rests on the Nord, could be either. What's the trade-off? Test both if possible.
2. **Chord chart density** — 4-line chord sketches (current samples) or full lead sheets with melody? May depend on song complexity.
3. **Navigation between songs in performance mode** — tap-anywhere? swipe? Bottom buttons? Edge-tap zones? The hands-may-be-sweaty constraint matters here.
4. **Band switching in practice mode** — top-of-screen toggle? sidebar? Modal? How often does it happen — once per session? Once per song?
