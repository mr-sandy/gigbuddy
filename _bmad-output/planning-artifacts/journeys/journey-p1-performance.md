---
title: P1 — Perform a set (iPhone, on stage)
status: text-level decisions locked 2026-07-18 — visual mockup required before development (per memory [[feedback-mockup-decisions-before-dev]])
purpose: IA/nav/journey storyboard for Sandy's live-performance work on the iPhone. First journey in the iPhone-side design pass — mirrors the shape of T1/T3/T4 in the MacBook pass.
sources:
  - _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md (Flow 1, Flow 2, State Patterns, Navigation Map — iPhone half)
  - _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md (Club Warm atmosphere, performance card component spec)
  - _bmad-output/planning-artifacts/epics.md (Epic 4 stories 4.1–4.5 — what shipped)
  - apps/web — current performance mode surface (`web/src/routes/performance.tsx`, `performance-card.tsx`, wake-lock hooks)
  - Auto-memory: [[user-improvises-non-linear-setlist]], [[project-visual-direction-locked]], [[feedback-check-scroll-conflict]], [[feedback-no-terminate-on-advance-gesture]], [[user-scottish]]
created: 2026-07-18
locked: 2026-07-18
---

# P1 — Perform a set

> iPhone. Performance atmosphere ("Club Warm" — warm-dark, dim-bar, engraved). Phone face-up on top of the Nord. 20-second glances between passages. The interface earns every pixel.

## Framing

This is the sacred journey. Everything else in GigBuddy serves this moment. Friction here is a defect, not a polish item.

The naïve version of the journey is linear: song 1 → NEXT → song 2 → NEXT → … → end. That's the happy path, and it's roughly what EXPERIENCE.md Flow 1 and Flow 2 describe. The real journey isn't linear. Per [[user-improvises-non-linear-setlist]]:

- The band jumps mid-set to a song that isn't next in the setlist.
- Sometimes that song is elsewhere in the setlist. Sometimes it isn't in the setlist at all — only in the library.
- The setlist plan is a **starting point**, not a script. Jumps do not modify the plan.

Both the linear happy path *and* the jump paths must feel first-class. Neither can be a punishment. The semantic model resolved in this journey doc treats every jump — whether within the setlist or reaching into the library — as a **detour** against a persistent plan cursor. That single rule governs the whole state machine.

## What exists in the build today

Shipped in Epic 4 (stories 4.1–4.5):

- **`/performance/:setlistId`** — full-screen performance surface, tabs hidden, dark theme forced.
- **Performance card layout** — fixed top chrome (`×` exit, position `n / total`, title, key/patch), scrollable chord region, fixed bottom toolbar (`‹` back, big `NEXT ›`, next-song preview).
- **Single-tap navigation** — `NEXT ›` and `‹` back are the only advance controls. No swipe gestures. No tap-anywhere advance. (Middle scrolls.)
- **Wake lock** — persistent indicator; exponential backoff on release.
- **Exit via `×`** — returns to setlist overview. `Currently performing: [song] · Resume ›` strip appears at top of overview. State preserved.
- **Backgrounding survives** — re-opening the app lands on the current performance card. Wake lock reacquires. Tonight-gig pre-fetch keeps the target setlist warm.
- **Navigate-away kills the state** — leaving `/performance/:setlistId` (tapping Library tab, opening a different setlist, etc.) ends performance. Last-song `NEXT ›` is inert, not terminating (per [[feedback-no-terminate-on-advance-gesture]]).

Not yet in the build (this journey doc governs their design):

- Jumping mid-set to a song elsewhere in the setlist (B3).
- Jumping mid-set to a library song (B4).
- Any UI that expresses "you're on a detour" — position indicator on a detour song, return anchor cue.
- Section-break orientation state between sets (B8).
- The affordance that opens the jump surface from the performance card.

## Entry points

Where Sandy arrives at the performance card *from*:

- **`Start performance ›` from setlist overview** — the canonical entry. Bottom-fixed CTA on `/setlists/:setlistId`. Lands on song 1 of the first non-empty section. Plan cursor initialises at position 1.
- **`Resume ›` from the "Currently performing" strip** — mid-performance re-entry after a deliberate `×` exit. Lands on the exact song Sandy was on when he left. If he was on a detour, resumes on the detour song with detour state intact.
- **App relaunch during active performance** — cold-start or foreground-from-background. Lands directly on the current performance card, bypassing setlists home and overview. Wake lock reacquires. Detour state preserved if present.

There is no other entry point in V1. In particular: no notification, no deep link, no "start from library."

## Branches within performance

The state machine of P1. Each branch is a named path through the performance card. Branches are semantically locked; visual composition is deferred to mockup.

### B1 — Linear progression (the happy path)

Sandy taps `NEXT ›`. The card transitions instantly to the next song in the setlist. Position indicator advances (`5 / 19` → `6 / 19`). Wake lock stays active. This is the highest-frequency branch and matches EXPERIENCE.md Flow 2 exactly.

### B2 — Step back one song

Sandy taps `‹` bottom-left. The card returns to the previous song in the setlist. Position indicator regresses. Used when the band repeats a song or when Sandy taps NEXT one song too early. Documented in EXPERIENCE.md Flow 2 as a failure-mode recovery.

On a **plan song**, `‹` means "previous in the setlist." On a **detour song**, `‹` means something different — see B3 for the contextual behaviour.

### B3 — Jump within the setlist (a detour)

The band calls a song that isn't next. The target is always named — the band says the song title, not a setlist position. The target could be anywhere in the setlist — one row away, halfway across, in the other set.

**Interaction shape (semantic lock):**

- An "open setlist overview" affordance on the performance card opens the setlist overview view — the *same* surface Sandy uses pre-gig — as an overlay on top of performance. Performance state is preserved: wake lock stays active, the current song is remembered as the plan cursor, and the overview is dismissible without cost.
- Sandy taps the target song in the overview. The overlay dismisses. The performance card renders the target song. This is now a **detour state**.
- The plan cursor does **not** move. It remains at the song Sandy was on before the jump (the "return anchor").
- Sandy plays the detour song. When he taps `NEXT ›`, the card transitions to `plan cursor + 1` — the song *after* the return anchor. The plan resumes from where it was headed.
- When Sandy taps `‹` on a detour song, the jump is undone: the card returns to the return anchor (the song he jumped from), *not* to the setlist song at position `detour - 1`. `‹` on a detour is contextually "undo the jump."
- Detour chains are supported: from a detour song, Sandy can jump again. The plan cursor stays put — it doesn't drift across detours.

**Position indicator on a detour song:** expresses "you're on a detour outside the plan." Exact visual TBD at mockup — candidates include `↩ 5 / 19`, `detour · SUNNY`, or dropping the numeric indicator entirely.

**Mechanism candidates for mockup:**

- **(a)** Setlist overview + a search field pinned at the top. Search filters the overview; scanning is available for positional glance.
- **(b)** Setlist overview alone, no search. Sandy scans sections and taps.
- **(c)** Setlist overview + a separate, distinct search picker (e.g. summoned from a different affordance). Two paths for two mental models.

Mockup pass will compose all three so Sandy can compare on real content.

### B4 — Jump to a library song (a detour, reaching outside the setlist)

The band calls a song that isn't in tonight's setlist at all, but exists in the library. Occasional but real. Unified with B3 into a single search surface: the jump overlay reaches setlist songs first, library songs second.

**Interaction shape (semantic lock):**

- Sandy opens the same jump affordance used for B3.
- Search behaviour: setlist matches shown first (labelled as such), library matches shown after (labelled as such), when the query matches a library song that isn't in the setlist.
- Sandy taps a library song. The performance card renders that song. Detour state applies exactly as B3 — plan cursor unchanged, `NEXT ›` returns to `plan cursor + 1`, `‹` undoes the jump.
- The library song's performance card renders with the same chrome as a setlist song's card. There is no visual distinction on the card itself — the only signal that Sandy is "outside the plan" is the position indicator (see B3).

Library reach is not a first-class flow with its own affordance; it lives inside the jump overlay. This matches its real-world frequency (occasional, not rare, not common).

### B5 — Exit via `×`, then Resume

Sandy taps `×` top-left. Performance state ends locally: wake lock releases, the surface unmounts. Sandy lands on the setlist overview at `/setlists/:setlistId`. A `Currently performing: [song] · Resume ›` strip renders at the top of the overview. Song position and detour state are preserved server-side (or in local session state).

Sandy taps `Resume ›`. The performance card re-renders on the exact song he left. Wake lock reacquires. If he was on a detour, the detour resumes — return anchor preserved, `NEXT ›` still points at `plan cursor + 1`, `‹` still undoes the jump.

Shipped in Story 4.3. Journey doc formalises the visual state of the strip and the resume interaction; the state machine matches shipped code.

**Note:** `×` is a *deliberate* exit — Sandy chose to leave performance. This is distinct from opening the jump overlay (B3/B4), which does *not* release wake lock or end state. The two gestures serve different purposes and are unambiguously distinct affordances.

### B6 — Backgrounded and returned

Sandy locks the phone, or a call comes in, or he switches to another app mid-performance. Performance state is preserved across the suspension. On return — whether cold-start or foreground-from-background — the app lands directly on the current performance card, bypassing setlists home and overview. Wake lock reacquires (OS permitting). If Sandy was on a detour, the detour resumes with all state intact.

Shipped in Story 4.5. Journey doc formalises the invariant: the performance card is the entry point during active performance, regardless of app lifecycle.

### B7 — Last song of the setlist

Sandy is on the last song of the last section (position `n / n`). `NEXT ›` is inert — visually unchanged from other positions, but tap does nothing. Per shipped Story 4.4 and [[feedback-no-terminate-on-advance-gesture]], NEXT never transforms into a destructive/terminating action.

Sandy leaves performance via `×` when the gig is done. No end-of-set card, no `End performance ›` button, no ceremony in performance mode itself. See B9 for the rationale.

### B8 — Between sections (a section break)

Sandy finishes the last song of Set 1. He taps `NEXT ›`. Instead of transitioning directly to the first song of Set 2, the surface enters a **section-break orientation state** — a moment of forward orientation for the physical break that follows.

**Why:** Sandy's gigs have real set breaks (drinks, tuning, chat with venue, typically 10–15 minutes). The section boundary isn't a musical moment — it's a physical one. Sandy taps NEXT at the end of Set 1's last song, puts the phone down, comes back after the break. When he picks the phone back up, he wants to see "here's what's coming" — not just Set 2 song 1 with no context.

**Interaction shape (semantic lock):**

- After Sandy taps NEXT on Set 1's last song, the surface renders a section-break orientation view. It summarises what's coming: section name (`Set 2`), song count (`N songs`), and the first song of the new section (title, key, patch).
- Sandy can put the phone down. When he returns, the surface is still showing the orientation view. He reads it, orients himself.
- Sandy taps a "start section" affordance (exact copy TBD at mockup) to enter the first song of Set 2.
- `‹` from the section-break view returns to the last song of Set 1 (in case Sandy tapped NEXT too early).
- If Sandy jumps *from* the section-break view (opens the jump overlay and picks a song), detour semantics apply: the section-break view is the return anchor. `NEXT ›` on the detour song returns to Set 2 song 1. `‹` undoes the jump back to the section-break view.

**Rendering:** the section-break state is a *reuse* of the setlist overview surface — the same view Sandy uses pre-gig, the same view the jump overlay opens (B3, B4), the same view Sandy lands on after `×` (B5). At a section break, the overview renders scrolled to the new section with the first song of the new section as the visible target. No distinct "section-break card" — one surface, three contexts (orientation before performing, mid-performance jumping, section-break orientation), differing only by scroll position and highlight.

This reuse is a deliberate consequence of the "one view, three contexts" pattern that fell out of this session's design discussion. It means Sandy sees the same layout every time a plan-context view is needed. Zero new mental model for section breaks.

### B9 — End of the whole set

After the last song of the last section, no summary card. No end-of-performance ceremony in performance mode.

**Rationale:** end-of-set is *ambiguous* to the app. Sandy's non-linear improvisation means the last song *played* might not be song `n / n` — it could be a jumped-to song 5 minutes earlier, or a library detour. The app can't reliably fire an end-of-set treatment because it doesn't know when Sandy considers the gig over. The universal signal is Sandy tapping `×` — regardless of which song he was on.

Any post-gig ceremony ("here's what you played tonight") belongs to Setlists home / a past-gigs surface, not to performance mode itself.

`×` is the universal exit for every end-of-set case (plan-end, skip-ahead, library-song-as-finale).

## Exit points

Where Sandy leaves performance from:

- **`×` top-left** — deliberate exit to setlist overview. Wake lock released. Song position and detour state preserved. Re-entry via Resume (B5).
- **Bottom tabs (Setlists / Library)** — hidden in performance mode. Not an exit path.
- **Navigate to a different setlist** — kills performance state entirely (shipped Story 4.4). No confirmation dialog; the navigation is deliberate.
- **Close / kill app** — implicit "exit." State survives per Story 4.5. Re-entry lands back on the current performance card.
- **End of the set** — no explicit exit affordance. Sandy uses `×`.

## Locked decisions

Consolidated from this session's design pass. Each decision is a lock that governs mockup composition and implementation.

1. **Semantic model of jumps: detour.** All jumps (within setlist, into library) are detours against a persistent plan cursor. `NEXT ›` after a detour returns to `plan cursor + 1`. `‹` on a detour undoes the jump.
2. **Jump target scope: unified.** Setlist and library are one search surface. Setlist matches first, library matches after. No separate "library escape hatch" flow.
3. **Jump targets are always named.** No positional-jump affordance ("go to the third song of Set 2"). Real-world usage is name-driven.
4. **Skip-ahead-due-to-overtime is not a jump.** Handled by rapid `NEXT ›` taps. No dedicated mechanism. Sandy accepts the friction of "next-next-next" in that rare case.
5. **Section boundary has a dedicated orientation state (B8), rendered as the setlist overview.** Not a silent seam. `NEXT ›` at the end of a non-final section opens the setlist overview scrolled to the new section. The overview surface is reused across three contexts: pre-gig prep, mid-performance jump overlay (B3/B4), and section-break orientation (B8). One layout, contextual scroll and highlight.
6. **End of set has no ceremony in performance mode (B9).** No card, no `End performance ›`. `×` is universal exit. Any post-gig ceremony lives elsewhere in the app.
7. **Last-song `NEXT ›` stays inert (B7).** Shipped behaviour preserved. Never transforms to a terminating action.
8. **Post-`×` Resume restores exact state (B5).** Song position + detour state preserved through the exit/resume cycle.
9. **Backgrounding preserves exact state (B6).** Same invariant across app lifecycle.
10. **Jump overlay does NOT release wake lock or end performance.** Opening the overview from performance is a *view* action, not an exit. Only `×`, navigate-away, and app-kill end performance state.
11. **`‹` is contextual.** On a plan song: "previous in setlist." On a detour song: "undo the jump." Same button, unambiguous in context because the two cases never overlap.
12. **No swipe gestures for jump / navigation.** All performance-mode navigation is button-driven, avoiding scroll-conflict with the chord region (per [[feedback-check-scroll-conflict]]).

## Deferred to mockup

Three items explicitly deferred to the mockup pass, to be composed against real content so Sandy can choose from concrete alternatives:

1. **Jump-overlay composition (§ B3, B4).** Mock all three shapes:
   - **(a)** Setlist overview + search field pinned at the top.
   - **(b)** Setlist overview alone, no search.
   - **(c)** Setlist overview + separate search picker (two paths).
2. **Jump affordance placement on the performance card.** Where does the "open overview" control live? Top chrome, bottom toolbar, dedicated corner. Composition to explore alternatives.
3. **Detour-state visual treatment.** Position indicator on a detour song (e.g. `↩ 5 / 19`, `detour · SUNNY`, dropped-numeric). Return-anchor cue if any.
4. **Overview highlight in each of its three contexts.** How the same setlist overview surface signals context: (i) pre-gig prep — no active-performance strip, `Start performance ›` CTA visible; (ii) mid-performance jump — active-performance strip with the current song, list is tap-to-jump; (iii) section-break orientation — scrolled to new section, first song of new section highlighted. Same layout, different chrome.

Alongside these, mockup pass also finalises:

- Per-gig annotation styling in Club Warm atmosphere (DESIGN.md has partial locks; final composition confirms in-context read).
- Wake-lock indicator placement (shipped in Story 4.2; mockup formalises visual placement in the Club Warm composition).

## Not in scope for P1

- **iPhone library tab** (`/library` on iPhone) — belongs to a separate journey. B4 reaches library songs via the jump overlay, but that's the only touchpoint here.
- **Between-gigs library editing on iPhone** (EXPERIENCE.md Flow 4) — separate journey. Read-mostly on iPhone; edit paths are lightweight but a separate design pass.
- **Setlists home on iPhone** — separate journey. P1 only touches it as an *entry point* (Tonight card → setlist overview → Start performance).
- **iPhone setlist overview as an editing surface** — annotations, reorder. P1 uses overview as *read-only orientation* inside performance. Editing overview is a separate concern.
- **Bottom tab bar composition** — cross-cutting chrome. Locks after individual journey docs.
- **Multi-band handling in performance** — V1 assumes a single active band. Band-switch during performance is not a supported flow.

## Next step

Mockup brief for the performance-mode iPhone surfaces. Same handoff discipline as the MacBook pass (per [[feedback-dont-impose-design-taste]]): brief + content + facts only. Downstream tool composes against the LOCKED Club Warm atmosphere in DESIGN.md. Approved mockups become the visual reference for any Epic 5+ story that touches performance mode.
