---
title: GigBuddy
status: final
created: 2026-06-09
updated: 2026-06-09
---

# PRD: GigBuddy

## 0. Document Purpose

This PRD is the capability contract for GigBuddy V1. It is written for downstream workflows — solution architecture, epic and story creation, and implementation. It assumes the reader has access to the upstream brief and the UX spec; it does not re-author them.

Upstream inputs treated as authoritative:

- **Brief** — `_bmad-output/planning-artifacts/briefs/brief-gigbuddy-2026-05-31/brief.md`. Scope, principles, success criteria.
- **Design spine** — `_bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md`. Visual identity, tokens, components, do/don't. The PRD does not duplicate these.
- **Experience spine** — `_bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md`. Information architecture, surfaces, components (behavior), state patterns, accessibility floor, key flows. The PRD references this directly for behavioral detail.

The PRD's job is to:

1. Restate the product capability set in functional-requirement form so downstream artifacts have stable, numbered references (FR-1 through FR-N).
2. Surface the **non-functional and cross-cutting concerns** the UX work did not have to answer — access control, persistence, sync, backup, operational floor.
3. Make the V2-readiness implications of the V1 data model explicit so V2 needs no migration.

Vocabulary is Glossary-anchored (§3). `[ASSUMPTION: ...]` tags mark inferred decisions deferred to a downstream stage (typically Architecture); the full set is indexed in §9.

## 1. Vision

GigBuddy is a personal gig-preparation and performance app for a working jazz pianist. It replaces a scattered Apple Notes workflow with a structured tool that knows the difference between **preparing** and **performing** — and serves a different surface for each.

Preparation happens on a MacBook at home: a daylight-style library of song records, a setlist-creation workflow that turns pasted setlist text into a structured setlist, and a place to capture per-gig context without disturbing the canonical song record. Performance happens on an iPhone resting on top of the Nord: dark, dim-bar-readable, single-song-at-a-time, single-tap navigation, screen lock disabled, nothing on screen that isn't earning its place.

The product serves one musician — Sandy — across multiple bands. V1 ships with one band populated (The Jack Ruby 5); the data model accommodates the others (Middle Aged Dad Band, Fram) without migration. The product is not a platform, not multi-tenant, not collaborative. It is a tool built for the moment when the band counts in.

Practice and Performance are not view modes the user toggles between. They are different surfaces — one on MacBook, one on iPhone — that share a single data store. The user moves between contexts by picking up a different device, not by hitting a switch. Implementations must honor this: a "view mode toggle" inside one surface would defeat the design.

## 2. Target User

### 2.1 Jobs To Be Done

- **Compile a performable setlist quickly from pasted text** — turn the band's pre-gig list (WhatsApp, email, a message in any other channel) into something the app can drive, without the manual-copy step that has been wearing thin.
- **Capture per-gig context without dirtying the canonical song record** — "Ivan on solo tonight," "vocal tonight?", "guitar change after the bridge" — visible during this gig only.
- **Read the right thing at the right moment under stage conditions** — title, key, patch, chord skeleton, at arm's length, in a dim bar, between songs, with possibly-sweaty hands.
- **Build the song library as a side-effect of preparing real gigs** — not as a standalone data-entry project.
- **Preserve every setlist played** — even though V1 doesn't surface analytics, the data must be there for V2 to mine.
- **Trust the tool on gig night** — no dependency that can fail at 9 PM.

### 2.2 Non-Users (V1)

- Bandmates — no sharing, no invite, no link.
- Other musicians — not a SaaS, not a platform.
- Multi-tenant scenarios of any kind.

### 2.3 Key User Journeys

UJ-1 through UJ-4 mirror EXPERIENCE.md §Key Flows. Reference the full flow there; the summaries here exist so FRs can cross-reference by ID.

- **UJ-1. Saturday-night load-in (iPhone, 8:55 PM at the venue).** Sandy opens the app, the Tonight card carries the venue, he taps `Open setlist`, glances at the 19 songs and three per-gig annotations, slides the phone onto the Nord, and taps `Start performance ›` as the band counts in. *Realized by:* Home & Gig Surfaces, Performance Mode.
- **UJ-2. Between songs, mid-set (iPhone, on stage).** Sandy taps `NEXT ›`, the card transitions instantly to the next song, key and patch read at a glance, next-song preview visible at the bottom. *Realized by:* Performance Mode.
- **UJ-3. Tuesday-evening setlist prep (MacBook, kitchen table).** Sandy pastes the setlist text (originally from WhatsApp in this case, but the source is incidental); the app parses 19 songs across two sections; 17 matched, one fuzzy, one unknown; he accepts the fuzzy, adds the unknown to the Library, saves the setlist. *Realized by:* Setlist Management (Paste-to-parse), Song Library.
- **UJ-4. Sunday-morning library polish (iPhone, post-gig).** Sandy taps a song in the Library, focuses Performance Notes, types a new observation, taps away. Silent save. *Realized by:* Song Library (inline edit).

## 3. Glossary

Downstream workflows must use these terms exactly. FRs and UJs use these terms verbatim.

- **Band** — Top-level container scoping a Library and Setlists. V1 contains The Jack Ruby 5 only; the data model supports additional Bands without migration.
- **Song** — A record within one Band's Library. Carries both Performance fields (title, key, patch, chord chart) and Practice fields (performance notes, practice notes / external links). Title is the only required field.
- **Library** — The set of all Songs belonging to one Band.
- **Gig** — A Setlist plus its metadata (venue, date, time).
- **Setlist** — An ordered, sectioned list of Songs scheduled for a Gig. Belongs to a Band and a Gig.
- **Section** — A named group of Songs within a Setlist. Section names are free-text strings (e.g., `Set 1`, `Set 2`, `Reserve`, `Encore`).
- **Per-gig annotation** — A note attached to a (Setlist, Song) pair. Never modifies the Song record. Visible on the Setlist overview row and on the Performance Card for that Song in that Setlist only.
- **Patch** — A keyboard preset reference stored per Song. In current use, refers to Nord patches (e.g., `R41 Piano and Cello`, `Wurlitzer P13`); the field is free-text and not tied to a specific instrument.
- **Chord chart** — Free-text content stored per Song, rendered with light typographic parsing in V1 (see FR-5 consequences). No structured chord model in V1.
- **Practice Mode** — The MacBook surface. Light theme, dense, editable. The user is here for hours-long preparation sessions.
- **Performance Mode** — The iPhone-only state entered explicitly via `Start performance ›`. Dark theme, glanceable, single-song-at-a-time. Tabs and other chrome are hidden.
- **Performance Card** — The single-song view within Performance Mode. Fixed top chrome (title, key, patch), scrollable middle (chord chart + per-gig annotation), fixed bottom toolbar.
- **Tonight** — UX-level label and badge for the Gig dated today. When no Gig is dated today, the "Tonight" slot displays the next upcoming Gig (or an empty state).
- **Wake Lock** — Browser/PWA mechanism that prevents the screen from sleeping while Performance Mode is active.
- **Paste-to-parse** — Setlist-creation workflow that ingests pasted plain-text (from any source) and matches Song rows against the active Band's Library.
- **Matched / Fuzzy / Unknown** — The three states a parsed Song row can hold after paste. Matched: exact match in Library. Fuzzy: a candidate Library Song is offered for confirmation. Unknown: no candidate; the user adds it to the Library inline.

## 4. Features

Capabilities, not implementation. Visual treatment lives in DESIGN.md; behavioral and interaction detail lives in EXPERIENCE.md.

### 4.1 Song Library

**Description.** A per-Band collection of Song records, browsed alphabetically. Song detail is the primary editing surface — no separate edit screen, no save button. The Library grows in two ways: explicit creation from the Library tab, or implicit creation through Paste-to-parse when an Unknown row is added inline (§4.2). Sparse Songs are first-class: a Song with only a title and a key is a valid Song. Realizes UJ-3, UJ-4.

**Functional Requirements:**

#### FR-1: Create a Song

The user can create a Song in the active Band's Library with a title. All other fields are optional and may be added later.

**Consequences (testable):**
- A Song with only a title is persisted and rendered in the Library list.
- A new Song appears in alphabetical order without requiring page refresh.
- Inline creation from Paste-to-parse (§4.2 FR-9) creates an equivalent Song record.

#### FR-2: Edit a Song inline

The user can edit any field of a Song record by clicking or tapping into it, typing, and tapping away. There is no edit mode and no save button. Saves are debounced and silent.

**Consequences (testable):**
- Focusing an inline field places the cursor without requiring a mode switch.
- A blur or tap-outside commits the change; rapid input is debounced.
- No save indicator, success toast, or "saved" affordance is displayed.
- A save failure surfaces an error toast (per EXPERIENCE.md State Patterns); the displayed value remains optimistic until the failure is acknowledged.

#### FR-3: View Song Detail

The user can view a Song's complete record on a Song Detail surface, reached by tapping any Song row in the Library or in a Setlist. View and edit are the same surface (FR-2).

**Consequences (testable):**
- Empty fields render as absent (no `(not specified)` placeholders, per EXPERIENCE.md State Patterns).
- The same Song Detail surface renders on both MacBook and iPhone.

#### FR-4: List Songs in the Library

The Library tab/page presents all Songs in the active Band in alphabetical order by title.

**Consequences (testable):**
- The list reflects all Songs in the active Band's Library.
- An empty Library renders the copy `No songs in this library yet.` (per EXPERIENCE.md State Patterns).
- No row actions, drag handles, or contextual menus are present on Library rows.

#### FR-5: Song record structure

A Song record carries the following fields. Performance fields surface in Performance Mode and on the Performance Card; Practice fields surface only on the Song Detail surface.

| Field | Surface | Notes |
|---|---|---|
| Title | Performance + Practice | Required. Case rendered as authored. |
| Key | Performance + Practice | Free-text (e.g., `Eb`, `F#m(Ian) Fm(Sandy)`, `Fm Blues`). |
| Patch | Performance + Practice | Free-text keyboard preset reference (e.g., `R41 Piano and Cello`). |
| Chord chart | Performance + Practice | Free-text. Light typographic parsing in V1: `{...}` lines render as section breaks; blank lines preserved; URLs tappable in Practice only. No structured chord model. |
| Performance notes | Performance + Practice | Free-text. Appears below the chord chart on the Performance Card. |
| Practice notes | Practice only | Free-text, including external URLs (YouTube, charts). |

**Consequences (testable):**
- Performance Mode does not display Practice notes.
- All fields except Title accept empty content. The Performance Card renders sparse Songs without layout reflow (per EXPERIENCE.md State Patterns).

**Notes:** Field set confirmed with Sandy 2026-06-09. The Performance/Practice split is intentional: the data model captures separate Performance and Practice content per the brief's Principle 1 — practice and performance have different information needs; the app surfaces *different content* in each, not the same content filtered differently. Implementations must not satisfy FR-5 by storing one document with display rules and a "show full / show abridged" toggle; the fields are distinct content.

---

### 4.2 Setlist Management

**Description.** Setlists are how preparation translates into performance-ready material. The primary creation path is Paste-to-parse: the user pastes a plain-text setlist from any source (WhatsApp, email, a written list), the app parses it into Sections and Song rows, matches Songs against the active Band's Library, and surfaces the gaps for inline resolution. The Setlist overview then becomes the per-gig prep surface and the launchpad for Performance Mode. Realizes UJ-3 (paste-to-parse end-to-end); the rendered Setlist overview is also the launchpad surface for UJ-1, though UJ-1's experience is realized in §4.3 and §4.4.

**Functional Requirements:**

#### FR-6: Create a Setlist

The user can create a new Setlist by providing Gig metadata (venue, date, time) and either pasting raw text into the Paste-to-parse field or adding Songs manually.

**Consequences (testable):**
- Gig metadata fields persist on the Setlist record.
- A Setlist with empty Songs is valid (manual entry can proceed row-by-row).
- A Setlist requires a Band; in V1 this is The Jack Ruby 5 with no user-facing choice.

#### FR-7: Paste-to-parse

The system parses pasted text into Sections (each with a free-text name) and Song rows. Section boundaries are inferred from common plain-text patterns (e.g., `Set 1` / `Set 2` headers, separator lines like `---`, blank-line breaks). Each parsed Song row is matched against the active Library and labelled Matched, Fuzzy, or Unknown.

**Consequences (testable):**
- Pasted text renders a parsed result live below the paste field.
- Matched rows display `✓` + the canonical Library title.
- Fuzzy rows display `?` + the candidate Library title with inline `Yes, that one` and `No — new song` actions.
- Unknown rows display `+` + an inline `+ Add to library` action.
- Color is never the sole signal: each row pairs glyph + label + color (per EXPERIENCE.md Accessibility Floor).

**Out of Scope:**
- Multi-language parsing.
- Free-form chord recognition from pasted text.

**Notes:** Section-break inference depends on common plain-text patterns; the parser is best-effort and not source-specific. The failure mode in EXPERIENCE.md Flow 3 is "all songs land in Set 1" with mid-list section insert as recovery — the recovery path is the contract, not parser perfection.

#### FR-8: Resolve Fuzzy match

For a Fuzzy row, the user can accept the suggested Library Song (single tap on `Yes, that one`) or reject it (single tap on `No — new song`, which converts the row to Unknown).

**Consequences (testable):**
- Accepting collapses the row to Matched with the canonical title.
- Rejecting converts the row to Unknown with the inline `+ Add to library` action.
- Paste-to-parse returns the top-1 candidate only in V1. Multi-candidate display is a V2 consideration if the parser regularly produces ambiguous matches (see §8 Open Questions).

#### FR-9: Resolve Unknown inline

For an Unknown row, the user can tap `+ Add to library` to create a minimal Song record (title only) and convert the row to Matched. The new Song is added to the active Library and remains there after the Setlist is saved.

**Consequences (testable):**
- Tapping `+ Add to library` creates a Song record using the parsed title as-is.
- The new Song is visible in the Library list immediately.
- The Setlist row converts to Matched and references the new Song.

#### FR-10: Section structure

A Setlist is organised into one or more Sections. Section names are free-text. Section names can be renamed inline on MacBook. On iPhone the Section name is static (per EXPERIENCE.md Component Patterns).

**Consequences (testable):**
- A Setlist created by Paste-to-parse with no inferable sections lands all Songs in a single default Section.
- A Setlist can be created with any number of Sections (1, 2, or more).
- Section names persist with the Setlist; identical Section names across different Setlists are not coupled.

#### FR-11: Per-gig annotation

The user can attach a per-gig annotation to a (Setlist, Song) pair. The annotation is stored against the Setlist row, not the Song record. It is visible on the Setlist overview row and on the Performance Card for that Song in that Setlist only.

**Consequences (testable):**
- Editing the annotation does not modify the Song record.
- Deleting the Setlist row removes the annotation.
- The annotation is visually distinct from the canonical Song content (per DESIGN.md).
- Editing happens inline on MacBook; iPhone uses a sheet (per EXPERIENCE.md Component Patterns).

#### FR-12: Reorder Songs within a Setlist

On MacBook, the user can drag Song rows within and between Sections to reorder them.

**Consequences (testable):**
- A drag handle is visible on MacBook on row hover.
- Drag is not available on iPhone in V1 (per EXPERIENCE.md Interaction Primitives).
- Reorder persistence is silent and immediate.

#### FR-13: View Setlist overview

The Setlist overview surface displays Gig metadata, Sections, Song rows, per-gig annotations, and a "Currently performing" strip when Performance Mode is active (per FR-20). On iPhone, a fixed-bottom `Start performance ›` CTA is always visible.

**Consequences (testable):**
- Tapping any Song row opens Song Detail.
- The CTA appears only on iPhone.
- The CTA appears regardless of how many Songs the Setlist contains.

#### FR-14: List Setlists by date

The Setlists home surface lists Setlists in one scrollable, sectioned list: Tonight, Upcoming, Past. Tap a row to open Setlist overview.

**Consequences (testable):**
- A Setlist whose Gig is dated today carries the `TONIGHT` badge.
- If no Setlist is dated today, the Tonight slot shows the next upcoming Setlist (or the empty state `No upcoming gigs.`).
- Past Setlists are listed in reverse chronological order.

**Feature-specific NFRs:**
- Paste-to-parse must surface a parsed result within 500ms of paste on a typical Setlist (~20 Songs) so the prep flow does not feel laggy. Source format is plain text from any channel; the parser does not depend on WhatsApp-specific structure.

---

### 4.3 Performance Mode

**Description.** The sacred state. iPhone-only. Entered explicitly. One Song at a time. Fixed top chrome, fixed bottom toolbar, scrollable middle. Single-tap navigation only. Screen does not sleep. Exit is intentional but recoverable. Backgrounding does not lose state. Realizes UJ-1, UJ-2.

Reading happens between songs in 20–30 seconds. This is the load-bearing time budget that justifies the 18pt body floor, the 32pt+ primary content (title, key, patch), single-tap navigation, and the no-scroll-to-find layout. Any design choice that violates this budget — denser layouts, smaller type, multi-step nav, search-to-locate — fails the feature.

**Functional Requirements:**

#### FR-15: Enter Performance Mode

The user enters Performance Mode by tapping `Start performance ›` on the iPhone Setlist overview. This is the only entry path.

**Consequences (testable):**
- The CTA is bottom-fixed above the iPhone tab bar.
- A single tap enters; no confirm dialog (per EXPERIENCE.md Component Patterns).
- The user lands on the Performance Card for the first Song in the first non-empty Section.
- Tabs hide on entry.

#### FR-16: Performance Card layout

The Performance Card is structured as three regions: a fixed top region (title, key, patch), a scrollable middle region (chord chart + per-gig annotation if present), and a fixed bottom toolbar (`‹` back, `NEXT ›`, next-song preview).

**Consequences (testable):**
- Title renders at 36pt minimum; key and patch at 22pt; body floor 18pt (per DESIGN.md and EXPERIENCE.md Accessibility Floor).
- Sparse content (e.g., title + patch with no chord chart) renders without layout reflow.
- Long chord charts scroll within the middle region; top and bottom chrome remain fixed.

#### FR-17: Advance and back via single tap

`NEXT ›` advances to the next Song in Setlist order across Section boundaries. `‹` returns to the previous Song. Both are single-tap. No swipe, no tap-anywhere, no edge zones.

**Consequences (testable):**
- `NEXT ›` traverses Section boundaries transparently.
- `‹` is positioned with spatial separation from `NEXT ›` (per EXPERIENCE.md Component Patterns).
- Transitions complete in under 150ms; `prefers-reduced-motion` collapses them to instant.

#### FR-18: Wake Lock

On entry to Performance Mode the system acquires a Wake Lock. The system makes best-effort to maintain it for the duration of Performance Mode. When the Wake Lock is not held — because acquisition failed, the OS revoked it, or the browser does not support the API — the Performance Card surfaces a persistent static indicator so the user knows the screen may sleep.

**Consequences (testable):**
- Wake Lock is acquired on FR-15 entry via the W3C Screen Wake Lock API.
- Reacquisition is attempted on every foreground transition (per FR-22) and after any detected release event.
- Wake Lock is released on FR-19 exit and on FR-21 navigation-away.
- When Wake Lock is not held for any reason, a small persistent state indicator appears on the Performance Card (e.g., adjacent to the position indicator) communicating that the screen may sleep. The indicator is static; it is not a toast and it does not block input.
- The indicator disappears as soon as Wake Lock is successfully (re)acquired.
- If Wake Lock cannot be maintained, the user recovers by tapping the screen to wake it. The session continues otherwise unimpeded.

**Feature-specific NFRs:**
- The persistent state indicator must conform to DESIGN.md visual language and must not animate (per EXPERIENCE.md Interaction Primitives: no animations longer than 150ms in Performance Mode; a state indicator does not need motion to communicate).
- Reacquisition attempts must not run a tight loop on persistent failure; back off appropriately. Specific back-off strategy is deferred to implementation.

#### FR-19: Exit Performance Mode

Tapping `×` on the Performance Card returns the user to the Setlist overview. Performance state is preserved.

**Consequences (testable):**
- `×` is top-left; small (~28pt icon target); low-emphasis (per EXPERIENCE.md Component Patterns).
- The current Song index, Section position, and Wake Lock state are preserved on exit (Wake Lock remains active per FR-18 since the user has not left the Setlist).
- The Setlist overview surfaces a "Currently performing" strip (FR-20).

#### FR-20: "Currently performing" strip and Resume

While Performance state is preserved, the Setlist overview displays a top-anchored "Currently performing" strip showing the current Song name and a `Resume ›` button.

**Consequences (testable):**
- The strip appears only while Performance state is active.
- `Resume ›` returns the user to the current Performance Card without changing the Song index.

#### FR-21: End Performance state

Performance state ends only when the user navigates away from the Setlist entirely (closes it, opens another Setlist, or opens a Song from the Library outside this Setlist's chain). On the last Song, `NEXT ›` becomes inert (visibly disabled, no action). There is no `End performance ›` button — the safety rationale is that the user must not be able to terminate Performance state with the same gesture they use to advance Songs.

**Consequences (testable):**
- `NEXT ›` on the last Song is rendered in a disabled visual state (per DESIGN.md disabled treatment) and does nothing on tap.
- Wake Lock is released when Performance state ends (via navigate-away).
- The "Currently performing" strip disappears when Performance state ends.
- The user can still exit Performance Mode via `×` (FR-19), which preserves state for `Resume ›` (FR-20); explicit termination happens by navigating away from the Setlist.

#### FR-22: Backgrounding survives

Backgrounding the app mid-Performance preserves Performance state. Re-opening the app lands the user back on the current Performance Card (not on Home).

**Consequences (testable):**
- The OS backgrounding the app does not advance, retreat, or reset the Song index.
- Wake Lock is reacquired on foregrounding if the OS permits.
- No interstitial screen appears on resume.

---

### 4.4 Home & Gig Surfaces

**Description.** The first surface the user sees on both devices. Gig-centric. Tonight is foregrounded. Library is one tab/nav-item away. No dashboard chrome. Realizes UJ-1.

**Functional Requirements:**

#### FR-23: Setlists home

On both MacBook and iPhone, the Setlists home surface is the default landing surface. It displays the Tonight slot at the top, Upcoming next, Past below — one scrollable sectioned list (FR-14).

**Consequences (testable):**
- Tonight slot displays the Gig dated today (if any) with the `TONIGHT` badge, else the next upcoming Gig, else `No upcoming gigs.` (per EXPERIENCE.md State Patterns).
- The list scrolls vertically; no horizontal scroll, no carousel.

#### FR-24: Library navigation

Library is a top-level destination — a bottom tab on iPhone and a top-nav item on MacBook. Tapping a Library row opens Song Detail.

**Consequences (testable):**
- Library appears in the persistent navigation chrome on both surfaces.
- The chrome hides when Performance Mode is active (per FR-15).

---

### 4.5 Multi-Band Data Model

**Description.** V1 ships with one populated Band. The data model treats Band as a first-class container so future Bands can be added without migration. The UI does not surface a Band switcher in V1; the MacBook header displays a passive Band label only.

**Functional Requirements:**

#### FR-25: Band scoping

Every Song, Setlist, and Per-gig annotation is owned by exactly one Band. There is no cross-Band content.

**Consequences (testable):**
- A Library lists Songs of one Band only.
- A Setlist references Songs only from its own Band's Library.
- The data model permits any number of Bands; V1 contains The Jack Ruby 5.

#### FR-26: No Band switcher in V1 chrome

The MacBook header displays `GigBuddy · The Jack Ruby 5` as a passive label. The label is not interactive in V1. iPhone chrome does not display the Band label.

**Consequences (testable):**
- The label cannot be tapped or focused.
- No menu, modal, or switcher is reachable from the label.
- V2 (when additional Bands carry content) will make the label interactive — no UI migration required, only the affordance change.

---

### 4.6 Access Control

**Description.** Single user. The product is not multi-tenant. Access protection is sufficient to keep the deployment from being publicly readable on the open internet; it is not sufficient for any threat model beyond that.

**Functional Requirements:**

#### FR-27: Single-user access gate

The deployment is gated by a lightweight access mechanism sufficient to prevent unauthenticated reads of any surface. The user authenticates once per device; thereafter the device is trusted until the trust artifact is revoked or expires. Mechanism choice is deferred to Architecture; the PRD does not constrain it beyond the contract below.

**Consequences (testable):**
- An unauthenticated request to any surface returns the access gate, not application content.
- A successful authentication persists a device-bound credential surviving across browser restarts.
- There is no user account management UI (no signup, password reset, profile, billing).
- The gate is the only entry point; no surface can be reached without traversing it.

**Notes:** The gate exists to keep the deployment from being publicly readable on the open internet. It is not sufficient for any stronger threat model. Architecture may choose any mechanism that satisfies the contract (e.g., basic-auth behind CloudFront, Cognito, Lambda@Edge gate, passkey via WebAuthn).

#### FR-28: No sharing or multi-user

The product has no concept of additional users, sharing, invites, or guest access.

**Consequences (testable):**
- No surface exposes a share affordance.
- No data record carries an owner-other-than-Sandy concept.

---

### 4.7 Persistence and Sync

**Description.** Single-user, multi-device. Sandy works on MacBook and performs on iPhone — sometimes within minutes of each other. The data store is canonical; both devices read from and write to it. Performance Mode is never blocked by sync.

**Functional Requirements:**

#### FR-29: Canonical persistence

Songs, Setlists, Sections, Per-gig annotations, and Gig metadata persist in a canonical data store. `[ASSUMPTION: a single AWS-hosted store. Specific choice (DynamoDB, RDS, SQLite-on-EFS, etc.) is deferred to Architecture.]`

**Consequences (testable):**
- A write made on one device is visible on the other after sync.
- A read returns the latest persisted state.
- **Setlist history is preserved in full from day one.** Every Setlist played persists with its complete record — Songs in order, per-gig annotations, Sections, Gig date and venue. The V1 UI does not surface analytics over this history, but the data model captures it so V2 (repertoire balance, frequency, recency analysis per the brief's V2 horizon) requires no migration.

#### FR-30: Optimistic local writes

The UI displays the new state immediately on edit (per FR-2). Writes propagate to the canonical store in the background.

**Consequences (testable):**
- Inline edits never block on a server round-trip.
- A save failure surfaces a quiet error toast; the displayed value remains optimistic until the user acknowledges (per EXPERIENCE.md State Patterns).
- **Toasts are suppressed during Performance Mode** (per EXPERIENCE.md Interaction Primitives). A save failure that would otherwise toast is held and surfaced when Performance Mode is exited.

#### FR-31: Offline tolerance

When the device is offline, writes queue locally and flush on reconnect. Reads serve from the local cache. No "you are offline" banner appears (per EXPERIENCE.md State Patterns).

**Consequences (testable):**
- A Setlist created or edited offline persists locally and syncs on reconnect.
- A Performance Mode session can run end-to-end offline (the Setlist and its Songs are cached on entry).
- A persistent sync failure surfaces a quiet banner on MacBook only; Performance Mode is never interrupted by a sync error.

#### FR-32: Last-write-wins conflict resolution

Conflicts resolve last-write-wins per record (not per field). In practice, Sandy edits on MacBook hours before performing on iPhone; concurrent same-record edits across devices are expected to be rare.

**Consequences (testable):**
- A later write to the same record replaces the earlier write.
- No conflict-resolution UI is presented to the user.
- Per-field merging is not implemented; the trade-off is accepted given the single-user usage pattern.

---

### 4.8 Backup and Export

**Description.** This is the tool Sandy relies on at 9 PM on a Saturday. Data loss is not recoverable from the band. Backup and export are not optional.

**Functional Requirements:**

#### FR-33: Manual JSON export

The user can trigger a complete export of all Bands, Songs, Setlists, Sections, Per-gig annotations, and Gig metadata as a single JSON archive at any time. The export action is reachable as a footer affordance on the Library page (MacBook). No dedicated Settings surface exists in V1.

**Consequences (testable):**
- The export contains every record in the data store.
- The export is human-readable JSON (not a proprietary or binary format).
- The Library page has a footer action that initiates the export.
- The action is MacBook-only in V1; iPhone does not surface the export affordance.

#### FR-34: Automated backup

The data store is backed up automatically on at least a daily cadence with a reasonable retention window, restorable to the live store. Specific backup mechanism, retention window, and recovery model (daily snapshots, point-in-time recovery, etc.) are deferred to Architecture.

**Consequences (testable):**
- A successful backup occurs at least once per 24-hour period.
- A documented restore procedure exists and has been verified end-to-end at least once before V1 ships.
- Acceptable data-loss window is ≤24 hours (the maximum implied by daily cadence). Architecture may improve on this (e.g., PITR) but may not regress.
- Restore-to-live-store target: ≤2 hours from decision-to-restore to operational. Architecture confirms a mechanism that can meet this bound and includes the bound in the restore runbook.
- Backup retention is sufficient to recover from a data-loss event noticed within the retention window — Architecture picks the specific value.

---

## 5. Non-Goals (Explicit)

V1 does not, and does not aim to:

- Provide bandmate access, sharing, or any collaboration affordance.
- Import Apple Notes or any other source format beyond plain-text paste.
- Suggest, recommend, or auto-generate setlists.
- Surface gig history analytics, repertoire balance reports, or over-reliance alerts (V2 horizon).
- Integrate with audio, MIDI, or hardware.
- Render structured chord/lead-sheet notation. V1 chord chart is free-text with light typographic parsing; the chord-glyph visual direction is implementation aspiration, not contract.
- Support multi-tenant or SaaS architecture.
- Expose push notifications, streaks, gamification, badges, or any encouragement layer.
- Use pinch, double-tap, or any multi-finger gesture anywhere in the app. Single-tap is the only required input vocabulary; pinch-zoom is suppressed (per EXPERIENCE.md Interaction Primitives).
- Surface a user-facing theme toggle in V1 chrome. Light Practice / dark Performance are surface defaults, not user-selectable variants.
- Support tablets, desktop-native apps, Android, or iPhone form factors other than iPhone 13. Other modern iPhones should render acceptably but are not test targets.
- Provide a Band switcher in V1 chrome (one populated Band; switcher with one option is dead weight).
- Provide a "Ready to perform" gate. Every Setlist is performable; the user decides readiness.

## 6. MVP Scope

### 6.1 In Scope

- Song Library for one Band (The Jack Ruby 5), with structured fields per FR-5.
- Setlist creation via Paste-to-parse and manual entry, with Sections and Per-gig annotations.
- Setlist overview surface with metadata header, Sections, Songs, annotations.
- Performance Mode on iPhone with Wake Lock, single-tap navigation, sticky state.
- Practice Mode (Song Detail with inline edit) on both devices.
- MacBook web app + iPhone 13 PWA, light/dark defaults per surface.
- Single-user access gate.
- Manual JSON export.
- Automated at-least-daily backup with a verified restore procedure (specific retention deferred to Architecture per FR-34).
- Data model that supports adding Middle Aged Dad Band and Fram in V2+ without migration.

### 6.2 Out of Scope for MVP

Permanent non-features are listed in §5. This section captures items deliberately *deferred*, not abandoned, and distinguishes V2+ commitments from conditional later-additions.

**Deferred to V2+ (committed in the brief's V2 horizon):**
- Middle Aged Dad Band and Fram populated with content.
- Setlist intelligence — repertoire balance, frequency/recency analysis, assisted setlist creation.
- Band-switcher UI (flips on automatically when V2 Bands carry content; no UI migration required).

**Deferred / undecided (conditional revisit):**
- Multi-candidate Fuzzy match — top-1 only in V1; add multi-candidate if the parser is regularly ambiguous in practice.
- Compact Library row info on iPhone — title-only is the V1 default; revisit if scanning becomes hard at higher Song counts.
- Dedicated Settings surface — Export lives in the Library page footer; Settings surface is added only if toggles accumulate.

## 7. Success Metrics

Sandy is the sole user. Success is qualitative and operational.

**Primary**

- **SM-1**: The Apple-Notes pre-gig compile workflow is gone. After GigBuddy is in use, Sandy never opens a manual compile note before a gig. Validates the brief's primary outcome and FR-6 through FR-14.
- **SM-2**: Sandy can process a new ~20-song Setlist with Unknown Songs end-to-end without context-switching out of the prep flow. Fluency, not speed, is the success signal. Validates FR-7 through FR-9.
- **SM-3**: Performance Mode is readable on iPhone in a dim bar without adjusting brightness or zoom. No font-size or contrast complaint after the first gig with GigBuddy. Validates FR-16 and the Accessibility Floor.
- **SM-4**: Any Song's Performance Card is reachable in under three taps from the Setlists home surface. Validates FR-15, FR-23, FR-24.

**Secondary**

- **SM-5**: The product survives at least one gig night with no critical failure (no crash, no data loss, no Wake Lock failure, no sync error blocking Performance Mode). Validates FR-18, FR-31.

**Counter-metrics (do not optimize)**

- **SM-C1**: Do not optimize prep speed at the cost of Song record quality. Sandy should still feel like Song Detail is a place to capture careful notes; if SM-2 lands but the Library becomes thinner over time, that's a failure of design.
- **SM-C2**: Do not optimize Performance Mode for screen real estate at the cost of legibility. A denser layout that fits more on screen is a failure mode, not a success.
- **SM-C3**: Do not optimize for offline performance at the cost of online responsiveness. Offline tolerance (§4.7) is a survivability requirement, not a primary usage mode; if normal online prep gets slower to make offline cleaner, that is the wrong trade.
- **SM-C4**: Do not add settings or toggles to satisfy "what if I want to also..." cases. Pick a default and live with it. The brief's "personal tool, not a platform" principle says the right answer is opinion, not configuration.

## 8. Open Questions

1. **Access gate mechanism.** Cognito vs. basic-auth behind CloudFront vs. Lambda@Edge gate vs. passkey via WebAuthn. (FR-27.) Fully deferred to Architecture.
2. **Data store choice.** DynamoDB vs. RDS vs. SQLite-on-EFS, etc. (FR-29.) Deferred to Architecture.
3. ~~**End-of-Setlist treatment.**~~ **Resolved 2026-06-09.** `NEXT ›` becomes inert on the last Song. No `End performance ›` button. Rationale: prevents accidental termination via the same gesture used to advance Songs. (FR-21.)
4. ~~**Wake Lock fallback.**~~ **Resolved 2026-06-09.** Best-effort acquisition with reacquisition on every foreground transition and after detected release events. When Wake Lock is not held, a persistent static state indicator appears on the Performance Card. The user recovers manually by tapping the screen. (FR-18.)
5. **Multiple Fuzzy candidates.** Top-1 vs. top-3. (FR-8.) V1 default is top-1; revisit if the parser regularly produces ambiguous matches.
6. **Per-gig annotation positioning on the Performance Card.** Above chord chart or below title. (EXPERIENCE.md Open items.) Defer to first build.
7. ~~**Settings surface.**~~ **Resolved 2026-06-09.** Export lives as a footer action on the Library page (MacBook); no dedicated Settings surface in V1. Future toggles will be revisited if needed. (FR-33.)
8. **Backup mechanism, retention, and recovery model.** Deferred to Architecture. (FR-34.) PRD constrains only the contract: at-least-daily cadence and a verified restore procedure.
9. **VoiceOver behavior for next-song preview on the Performance Card.** (EXPERIENCE.md Open items.) Accessibility pass.
10. **AWS operational cost.** Personal account. No fixed monthly cap, but Architecture should flag any choice that is materially more expensive than the cheapest viable alternative (e.g., RDS Aurora vs. a single small RDS instance, NAT-gateway-heavy networking, multi-AZ when single-AZ would do). Cost-justification statement required in the architecture document for any non-obvious spend.

## 9. Assumptions Index

Each `[ASSUMPTION]` from the document, surfaced for explicit confirmation:

- **§4.7 FR-29 data store** — single AWS-hosted store; specific choice deferred to Architecture.
- **§4.8 FR-34 backup** — at-least-daily automated backup with a verified restore procedure. Specific mechanism, retention, and recovery model deferred to Architecture.

---

## A. Cross-Cutting NFRs

System-wide non-functional requirements not tied to a single feature. Visual and accessibility specifics live in DESIGN.md and EXPERIENCE.md and are not duplicated here; this section captures performance, reliability, security, and operability.

### A.1 Performance

Latency in Performance Mode is a defect class, not a polish target. Per the brief's Principle 3 — "anything that slows reading or navigation under live conditions is a defect" — any miss against the targets below is a bug to be triaged, not a deferred improvement. Practice Mode latency is held to ordinary web-app standards; Performance Mode is held to gig-night standards.

- Performance Card transitions (`NEXT ›`, `‹`) complete in under 150ms (per EXPERIENCE.md Interaction Primitives). `prefers-reduced-motion` collapses transitions to instant.
- Performance Card cold render (first display after `Start performance ›`) completes within 300ms on iPhone 13.
- Paste-to-parse renders the parsed result within 500ms of paste for a ~20-Song Setlist.
- Inline edits commit (debounced) within 200ms of blur.

### A.2 Reliability and operational floor

- The product must be available during scheduled gig windows. The brief's success criterion `no dependencies that can fail at 9pm` is the operational floor.
- Routine maintenance — deploys, patches, certificate renewals, dependency updates — must not be scheduled within 24 hours of any future Gig recorded in the system. Deploy automation enforces this by querying upcoming Gig dates at deploy time and blocking if any falls within that window. As a static fallback when no Gig data is available (e.g., a fresh deploy), maintenance avoids Friday–Sunday 18:00–24:00 local. The architecture document owns the enforcement mechanism; the rule is not advisory.
- Best-effort availability outside scheduled gig windows; no fixed numeric SLO. Single-user, single-region.
- Performance Mode is never blocked by a sync error (FR-31).
- A reachable internet connection is not a precondition for running a Performance Mode session whose Setlist and Songs were last loaded online.

### A.3 Security

- All transport is HTTPS.
- All data at rest is encrypted using the data store's standard mechanism (e.g., AWS-managed encryption at rest).
- No secrets in client-side code or version control. Secrets via AWS-managed mechanisms (Secrets Manager / Parameter Store).
- The access gate (FR-27) is the only entry point. No unauthenticated read of any surface.

### A.4 Observability

- Server-side error logging sufficient for personal diagnosis. Errors are surfaced via standard AWS logging (CloudWatch).
- Client-side errors in Performance Mode are logged silently to a server endpoint when online; no in-app error display in Performance Mode beyond what FR-31 specifies.
- No user analytics, telemetry, or behavioral instrumentation.

### A.5 Accessibility (referenced, not duplicated)

Full accessibility floor is defined in EXPERIENCE.md §Accessibility Floor and DESIGN.md. Summary:

- Performance Mode: WCAG AAA contrast (7:1+); body floor 18pt; primary content 32pt+.
- Practice Mode: WCAG AA (4.5:1); body floor 17–18pt.
- No information conveyed by color alone.
- Tap targets ≥ 44×44pt.
- `prefers-reduced-motion` honored throughout Performance Mode.
- VoiceOver labels on Paste-to-parse states, Performance Mode controls, position indicator, per-gig annotation.

## B. Platform

- **MacBook web app.** Current Safari, Chrome, Firefox. Layout assumes ~1280–1680pt-wide displays. Single-column vertical layout dominates. No multi-column dashboards.
- **iPhone 13 PWA.** 390 × 844pt viewport. 47pt top inset, 34pt bottom inset, 44×44pt minimum tap target. Portrait-locked in Performance Mode. Other iPhones render acceptably; not V1 test targets.
- **PWA installation** is required for the iPhone surface to grant Wake Lock and full-screen privileges.
- **No tablet, no desktop-native, no Android, no other phones in V1.**

## C. Aesthetic, Tone, and IA (referenced)

These are owned by upstream artifacts. The PRD does not duplicate them.

- **Visual identity, type scale, color tokens, component visual specs, do/don't** — see `_bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md`.
- **Information architecture, surfaces, components (behavior), state patterns, interaction primitives, key flows, accessibility floor** — see `_bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md`.
- **Voice and tone for microcopy** — see EXPERIENCE.md §Voice and Tone. Short, complete sentences. No marketing voice. No exclamation marks, emoji, or encouragement.
