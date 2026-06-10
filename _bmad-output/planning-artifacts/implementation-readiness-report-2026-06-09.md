---
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
filesUnderReview:
  prd: _bmad-output/planning-artifacts/prds/prd-gigbuddy-2026-06-09/prd.md
  prd_companions:
    - _bmad-output/planning-artifacts/prds/prd-gigbuddy-2026-06-09/reconcile-brief.md
    - _bmad-output/planning-artifacts/prds/prd-gigbuddy-2026-06-09/reconcile-design.md
    - _bmad-output/planning-artifacts/prds/prd-gigbuddy-2026-06-09/reconcile-experience.md
    - _bmad-output/planning-artifacts/prds/prd-gigbuddy-2026-06-09/review-rubric.md
  architecture: _bmad-output/planning-artifacts/architecture.md
  epics: _bmad-output/planning-artifacts/epics.md
  ux_primary:
    - _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md
    - _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md
  ux_supporting:
    - _bmad-output/planning-artifacts/ux/design-handoff/
    - _bmad-output/planning-artifacts/ux/visual-direction/
---

# Implementation Readiness Assessment Report

**Date:** 2026-06-09
**Project:** gigbuddy

## Step 1 — Document Inventory

**PRD (sharded):** `prds/prd-gigbuddy-2026-06-09/prd.md` (643 lines, 2026-06-09) plus reconciliation companions (`reconcile-brief.md`, `reconcile-design.md`, `reconcile-experience.md`, `review-rubric.md`).

**Architecture (whole):** `architecture.md` (1,229 lines, 2026-06-09).

**Epics & Stories (whole):** `epics.md` (1,822 lines, 2026-06-09).

**UX Design (sharded):** `ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md` (244 lines) and `DESIGN.md` (236 lines), with `ux/design-handoff/` and `ux/visual-direction/` as supporting context. Per [[project_visual_direction_locked]], visual direction is locked but the features/flows inside the Claude Design output are NOT authoritative scope; PRD/epics/EXPERIENCE.md govern scope.

**Duplicates:** none. **Missing:** none.

---

## Step 2 — PRD Analysis

The PRD (`prd.md`, 643 lines, status: `final`) is a capability contract referencing brief, DESIGN.md, and EXPERIENCE.md as upstream authoritative inputs. It defers visual/IA/state patterns to UX, deliberately doesn't duplicate them, and uses Glossary-anchored vocabulary.

### Functional Requirements

**§4.1 Song Library**

- **FR-1: Create a Song** — User can create a Song in the active Band's Library with a title; all other fields optional and may be added later.
- **FR-2: Edit a Song inline** — User can edit any field by clicking/tapping in, typing, tapping away; no edit mode, no save button; saves debounced and silent; failures surface error toast (optimistic value remains until acknowledged).
- **FR-3: View Song Detail** — Song's complete record reached by tapping any Song row in Library or Setlist; view and edit share a single surface (per FR-2); empty fields render as absent.
- **FR-4: List Songs in the Library** — Library tab presents all Songs in active Band alphabetically by title; no row actions/drag handles/contextual menus; empty state copy `No songs in this library yet.`
- **FR-5: Song record structure** — Defined field set with Performance/Practice surface mapping: Title (required), Key, Patch, Chord chart, Performance notes, Practice notes (Practice-only). Light typographic parsing for `{...}` and blank lines in chord chart; no structured chord model; URLs tappable in Practice only.

**§4.2 Setlist Management**

- **FR-6: Create a Setlist** — User provides Gig metadata (venue, date, time) and either pastes raw text or adds Songs manually; empty Songs valid; Setlist requires a Band (V1 = The Jack Ruby 5 with no user-facing choice).
- **FR-7: Paste-to-parse** — System parses pasted text into Sections (free-text names) and Song rows; Section boundaries inferred from common plain-text patterns (`Set 1`/`Set 2`, `---`, blank-line breaks); each row labelled Matched/Fuzzy/Unknown with glyph+label+color (not color-alone).
- **FR-8: Resolve Fuzzy match** — Single-tap `Yes, that one` to accept, `No — new song` to reject (converts to Unknown); top-1 candidate only in V1.
- **FR-9: Resolve Unknown inline** — `+ Add to library` creates minimal Song (title only), converts row to Matched, Song persists in Library after Setlist save.
- **FR-10: Section structure** — Setlist organised into ≥1 Section with free-text names; rename inline on MacBook, static on iPhone; default single section if paste-to-parse infers none; Section names not coupled across Setlists.
- **FR-11: Per-gig annotation** — Note attached to (Setlist, Song) pair; never modifies Song record; visible on Setlist overview row and on Performance Card for that Song in that Setlist only; inline edit on MacBook, sheet on iPhone.
- **FR-12: Reorder Songs within a Setlist** — Drag rows within and between Sections on MacBook; drag handle on row hover; not available on iPhone in V1; persistence silent and immediate.
- **FR-13: View Setlist overview** — Displays Gig metadata, Sections, Song rows, annotations, "Currently performing" strip when active (FR-20); fixed-bottom `Start performance ›` CTA visible on iPhone regardless of Song count.
- **FR-14: List Setlists by date** — Setlists home shows one scrollable sectioned list: Tonight, Upcoming, Past; today's Gig carries `TONIGHT` badge, else next upcoming, else `No upcoming gigs.`; Past in reverse chronological order.

**§4.3 Performance Mode**

- **FR-15: Enter Performance Mode** — Only via `Start performance ›` on iPhone Setlist overview; bottom-fixed CTA above tab bar; single tap, no confirm; lands on first Song of first non-empty Section; tabs hide on entry.
- **FR-16: Performance Card layout** — Three regions: fixed top (title/key/patch), scrollable middle (chord chart + per-gig annotation), fixed bottom toolbar (`‹` back, `NEXT ›`, next-song preview); title ≥36pt, key/patch 22pt, body floor 18pt; sparse content renders without reflow.
- **FR-17: Advance and back via single tap** — `NEXT ›` advances across Section boundaries, `‹` returns to previous; both single-tap; no swipe, no tap-anywhere, no edge zones; transitions <150ms; `prefers-reduced-motion` collapses to instant.
- **FR-18: Wake Lock** — Acquired on entry via W3C Screen Wake Lock API; reacquired on every foreground transition and after detected release; released on exit (FR-19) and navigate-away (FR-21); when not held, persistent static indicator on the Performance Card (no toast, doesn't block input); indicator disappears on reacquire; recovery is user-tap-to-wake; reacquisition backs off appropriately on persistent failure.
- **FR-19: Exit Performance Mode** — Top-left `×` (~28pt, low-emphasis) returns to Setlist overview; current Song index/Section position/Wake Lock state preserved; "Currently performing" strip appears (FR-20).
- **FR-20: "Currently performing" strip and Resume** — Top-anchored strip on Setlist overview while Performance state active, with `Resume ›` button that returns to current Performance Card without changing Song index.
- **FR-21: End Performance state** — Performance state ends only on navigate-away (closes Setlist, opens another Setlist, opens a Song from outside this Setlist's chain); on last Song `NEXT ›` becomes inert (disabled visual, no action); no `End performance ›` button — safety rationale: same gesture must not terminate. Wake Lock released and strip disappears when state ends.
- **FR-22: Backgrounding survives** — OS backgrounding doesn't advance/retreat/reset Song index; Wake Lock reacquired on foregrounding if OS permits; no interstitial on resume.

**§4.4 Home & Gig Surfaces**

- **FR-23: Setlists home** — Default landing on both devices; Tonight slot at top, Upcoming, Past; one scrollable sectioned list (FR-14); vertical scroll only.
- **FR-24: Library navigation** — Library is top-level destination: bottom tab on iPhone, top-nav item on MacBook; tapping a Library row opens Song Detail; chrome hides when Performance Mode active (FR-15).

**§4.5 Multi-Band Data Model**

- **FR-25: Band scoping** — Every Song, Setlist, Per-gig annotation owned by exactly one Band; no cross-Band content; data model permits any number of Bands; V1 contains The Jack Ruby 5.
- **FR-26: No Band switcher in V1 chrome** — MacBook header shows `GigBuddy · The Jack Ruby 5` as passive (non-interactive) label; iPhone chrome shows no Band label; V2 makes label interactive without UI migration.

**§4.6 Access Control**

- **FR-27: Single-user access gate** — Lightweight gate sufficient to prevent unauthenticated reads of any surface; authenticate once per device; device-bound credential survives browser restarts; no account-management UI; gate is only entry point; mechanism deferred to Architecture.
- **FR-28: No sharing or multi-user** — No share affordance; no owner-other-than-Sandy concept.

**§4.7 Persistence and Sync**

- **FR-29: Canonical persistence** — Single canonical store for Songs/Setlists/Sections/annotations/Gig metadata; a write on one device visible on other after sync; **Setlist history preserved in full from day one** including Songs in order, annotations, Sections, Gig date and venue (V2 analytics depend on it).
- **FR-30: Optimistic local writes** — UI shows new state immediately on edit; inline edits never block on server round-trip; save failure surfaces quiet error toast; **toasts suppressed during Performance Mode** — held and surfaced on exit.
- **FR-31: Offline tolerance** — Writes queue locally and flush on reconnect; reads serve from local cache; no "you are offline" banner; Performance Mode session runs end-to-end offline if Setlist cached on entry; persistent sync failure surfaces quiet banner on MacBook only.
- **FR-32: Last-write-wins conflict resolution** — Per-record (not per-field); no conflict-resolution UI; per-field merging not implemented.

**§4.8 Backup and Export**

- **FR-33: Manual JSON export** — User triggers complete export of all Bands/Songs/Setlists/Sections/annotations/Gig metadata as single JSON archive; human-readable JSON; reachable as footer affordance on Library page (MacBook); MacBook-only in V1.
- **FR-34: Automated backup** — Automated backup at least daily with reasonable retention, restorable to live store; verified end-to-end restore procedure before V1 ships; data-loss window ≤24h; restore-to-live-store ≤2h from decision-to-restore; mechanism/retention/recovery deferred to Architecture.

**Total FRs: 34**

### Non-Functional Requirements

**Feature-scoped NFRs (inline in §4):**

- **NFR-F1 (FR-7 Paste-to-parse latency):** Parsed result rendered within 500ms of paste on a typical ~20-Song Setlist.
- **NFR-F2 (FR-18 Wake Lock indicator):** Indicator must conform to DESIGN.md visual language and must not animate (no animation longer than 150ms in Performance Mode).
- **NFR-F3 (FR-18 Wake Lock reacquisition):** Reacquisition must not run a tight loop on persistent failure; back-off strategy required (specific strategy deferred to implementation).

**§A.1 Performance (cross-cutting, defect-class targets):**

- **NFR-1:** Performance Card transitions (`NEXT ›`, `‹`) complete in <150ms; `prefers-reduced-motion` collapses to instant.
- **NFR-2:** Performance Card cold render (first display after `Start performance ›`) completes within 300ms on iPhone 13.
- **NFR-3:** Paste-to-parse renders parsed result within 500ms for a ~20-Song Setlist (overlaps NFR-F1).
- **NFR-4:** Inline edits commit (debounced) within 200ms of blur.

**§A.2 Reliability and operational floor:**

- **NFR-5:** Product available during scheduled gig windows ("no dependencies that can fail at 9pm" is operational floor).
- **NFR-6:** Routine maintenance (deploys, patches, cert renewals, dep updates) must not be scheduled within 24h of any future Gig recorded in the system; deploy automation enforces by querying upcoming Gig dates and blocking if any falls within window. Static fallback when no Gig data: avoid Fri–Sun 18:00–24:00 local. Architecture owns the enforcement mechanism — **not advisory**.
- **NFR-7:** Best-effort availability outside scheduled gig windows; no numeric SLO; single-user, single-region.
- **NFR-8:** Performance Mode never blocked by sync error.
- **NFR-9:** Reachable internet not a precondition for a Performance Mode session whose Setlist and Songs were last loaded online.

**§A.3 Security:**

- **NFR-10:** All transport HTTPS.
- **NFR-11:** All data at rest encrypted using the data store's standard mechanism (e.g., AWS-managed encryption at rest).
- **NFR-12:** No secrets in client-side code or VCS; secrets via AWS-managed mechanisms (Secrets Manager / Parameter Store).
- **NFR-13:** Access gate (FR-27) is sole entry point; no unauthenticated read of any surface.

**§A.4 Observability:**

- **NFR-14:** Server-side error logging sufficient for personal diagnosis; standard AWS logging (CloudWatch).
- **NFR-15:** Client-side errors in Performance Mode logged silently to a server endpoint when online; no in-app error display in Performance Mode beyond FR-31.
- **NFR-16:** No user analytics, telemetry, or behavioral instrumentation.

**§A.5 Accessibility (referenced from EXPERIENCE.md and DESIGN.md):**

- **NFR-17:** Performance Mode WCAG AAA contrast (7:1+); body floor 18pt; primary content 32pt+.
- **NFR-18:** Practice Mode WCAG AA (4.5:1); body floor 17–18pt.
- **NFR-19:** No information conveyed by color alone.
- **NFR-20:** Tap targets ≥ 44×44pt.
- **NFR-21:** `prefers-reduced-motion` honored throughout Performance Mode.
- **NFR-22:** VoiceOver labels on Paste-to-parse states, Performance Mode controls, position indicator, per-gig annotation.

**§B Platform:**

- **NFR-23:** MacBook web app — current Safari, Chrome, Firefox; layout assumes ~1280–1680pt-wide displays; single-column vertical layout; no multi-column dashboards.
- **NFR-24:** iPhone 13 PWA — 390×844pt viewport; 47pt top inset, 34pt bottom inset; 44×44pt minimum tap target; portrait-locked in Performance Mode; other iPhones acceptable but not V1 test targets.
- **NFR-25:** PWA installation required for iPhone surface to grant Wake Lock and full-screen privileges.
- **NFR-26:** No tablet, no desktop-native, no Android, no other phones in V1.

**Total NFRs: 26** (3 feature-scoped + 23 cross-cutting).

**Note on NFR numbering between PRD and epics:** the epics document re-numbers the feature-scoped Wake Lock NFRs as NFR-27 and NFR-28 (rather than the PRD's NFR-F2/F3) and uses NFR-1..NFR-26 + NFR-27/NFR-28 = 28 total. Same content, different numbering. The coverage matrix below uses the epics' NFR numbering for ease of cross-reference.

### Additional Requirements & Constraints

**Glossary contract (§3):** 13 terms with verbatim usage required downstream — `Band`, `Song`, `Library`, `Gig`, `Setlist`, `Section`, `Per-gig annotation`, `Patch`, `Chord chart`, `Practice Mode`, `Performance Mode`, `Performance Card`, `Tonight`, `Wake Lock`, `Paste-to-parse`, `Matched/Fuzzy/Unknown`.

**Explicit Non-Goals (§5):** 13 items — bandmate access/sharing; non-paste imports (incl. Apple Notes); setlist suggestion/auto-generation; gig-history analytics; audio/MIDI/hardware integration; structured chord/lead-sheet rendering (free-text only); multi-tenant/SaaS; push/streaks/gamification; pinch/double-tap/multi-finger gestures (single-tap only; pinch-zoom suppressed); user-facing theme toggle; tablets/desktop-native/Android/non-iPhone-13 form factors; Band switcher in V1 chrome; "Ready to perform" gate.

**MVP Scope (§6):** explicit in/out partitioning. Notable V2-committed deferrals: Middle Aged Dad Band + Fram populated content; setlist intelligence (repertoire balance/frequency/recency); Band-switcher UI. Conditional deferrals: multi-candidate Fuzzy match; iPhone Library row compact info; dedicated Settings surface.

**Success Metrics (§7):** SM-1..SM-5 primary/secondary; SM-C1..SM-C4 counter-metrics (don't optimize prep speed at cost of record quality; don't optimize Performance Mode density at cost of legibility; don't optimize offline at cost of online responsiveness; don't add settings/toggles).

**Open Questions (§8):** 7 open (down from 10; 3 resolved 2026-06-09):
- Open: Q1 access gate mechanism (to Architecture); Q2 data store choice (to Architecture); Q5 multiple Fuzzy candidates (revisit if needed); Q6 per-gig annotation positioning on Performance Card (defer to first build); Q8 backup mechanism/retention/recovery (to Architecture); Q9 VoiceOver behaviour for next-song preview (accessibility pass); Q10 AWS operational cost — Architecture must flag any choice materially more expensive than the cheapest viable alternative.
- Resolved: Q3 (FR-21 inert NEXT ›); Q4 (FR-18 Wake Lock fallback indicator); Q7 (FR-33 Export as Library page footer).

**Assumptions Index (§9):** 2 explicit assumptions tagged:
- §4.7 FR-29 — single AWS-hosted store; specific choice deferred to Architecture.
- §4.8 FR-34 — at-least-daily automated backup with verified restore procedure; specifics deferred to Architecture.

### PRD Completeness Assessment

**Strengths**
- Sharp authority boundaries: PRD owns capability+NFR+data; DESIGN.md owns visual; EXPERIENCE.md owns behaviour/IA/state. No duplication.
- Every FR is numbered, has testable consequences, and references upstream artifacts by ID (UJ-1..UJ-4 to EXPERIENCE flows; explicit DESIGN/EXPERIENCE pointers throughout).
- Resolved open items carry rationale (e.g., FR-21 inert-NEXT safety rationale aligns with [[feedback_no_terminate_on_advance_gesture]]).
- Counter-metrics (§7) and Non-Goals (§5) are explicit — important guardrails for downstream story shaping.
- Brief→PRD reconciliation companions exist (`reconcile-*.md`) — provenance is auditable.
- NFRs are calibrated: Performance Mode latency framed as defect class (not polish), single-user reliability framed without numeric SLOs (proportionate).

**Watch-outs to carry into epic coverage**
- **NFR-6 (deploy maintenance window enforcement)** is unusual and high-leverage — easy to under-spec in stories. Will check epic coverage explicitly.
- **FR-29 setlist history preservation from day one** is a V2-readiness requirement that has *no V1 UI surface*. Easy to miss in epic decomposition unless an explicit story locks it down.
- **FR-22 backgrounding survives + FR-18 Wake Lock reacquire on foreground** — implementation contract is precise; need a story with explicit reacquire-on-foreground acceptance criteria.
- **FR-30 toasts suppressed during Performance Mode** — cross-cutting UI rule; needs a story or shared component contract.
- **FR-34 verified restore procedure end-to-end before V1 ships** — operational gate, not a coding task. Easy to leave un-storied.
- **NFR-22 VoiceOver labels** is conditional on Q9 resolution but still a V1 accessibility commitment.

---

## Step 3 — Epic Coverage Validation

The epics document (1,822 lines, status: post-`stepsCompleted: [1,2,3]`) inventories Requirements verbatim from PRD §4 + §A, adds an Architecture Requirements layer (AR-1..AR-48) and a UX Design Requirements layer (UX-DR1..UX-DR9), and provides an explicit FR Coverage Map (lines 215–249).

### Coverage Matrix (FR)

| FR | PRD Requirement (short) | Epic / Story | Status |
|----|-------------------------|--------------|--------|
| FR-1 | Create a Song | Epic 2 — Story 2.5 (Library `+ New song` affordance) + Story 2.6 (Song Detail create path) | ✓ Covered |
| FR-2 | Edit a Song inline (silent debounced save) | Epic 2 — Story 2.6 (InlineEditField, debounced PUT, no toast on success) | ✓ Covered |
| FR-3 | View Song Detail (view = edit) | Epic 2 — Story 2.6 (single surface for `/songs/new` + `/songs/:songId`) | ✓ Covered |
| FR-4 | Alphabetical Library list | Epic 2 — Story 2.5 | ✓ Covered |
| FR-5 | Song record structure (Performance/Practice surface mapping, chord-chart parsing) | Epic 2 — Story 2.3 (schema) + Story 2.6 (rendering + ChordChart) | ✓ Covered |
| FR-6 | Create a Setlist (manual + paste) | Epic 3 — Story 3.4 (manual) + Story 3.5 (paste) | ✓ Covered |
| FR-7 | Paste-to-parse → Matched/Fuzzy/Unknown | Epic 3 — Story 3.5 | ✓ Covered |
| FR-8 | Resolve Fuzzy match inline | Epic 3 — Story 3.5 | ✓ Covered |
| FR-9 | Resolve Unknown inline (`+ Add to library`) | Epic 3 — Story 3.5 | ✓ Covered |
| FR-10 | Section structure (free-text, MacBook rename, iPhone static) | Epic 3 — Story 3.3 (SectionHeading) + Story 3.4 (creation default) + Story 3.5 (default Set 1) | ✓ Covered |
| FR-11 | Per-gig annotation on (Setlist, Song) — inline on MacBook / sheet on iPhone | Epic 3 — Story 3.3 | ✓ Covered |
| FR-12 | MacBook drag-reorder | Epic 3 — Story 3.6 (with keyboard-fallback AC) | ✓ Covered |
| FR-13 | Setlist overview (incl. `Start performance ›` CTA on iPhone, "Currently performing" strip slot) | Epic 3 — Story 3.3 (overview surface + CTA inert in Epic 3, wired in Epic 4) | ✓ Covered |
| FR-14 | Setlists list by date (Tonight / Upcoming / Past) | Epic 3 — Story 3.2 | ✓ Covered |
| FR-15 | Enter Performance Mode | Epic 4 — Story 4.1 (single tap, prefetch, chrome hide, first-Song-of-first-non-empty-Section, NFR-2 cold-render budget) | ✓ Covered |
| FR-16 | Performance Card three-region layout | Epic 4 — Story 4.1 (fixed top, scrollable middle, fixed bottom; sparse content no-reflow; long chord chart scroll) | ✓ Covered |
| FR-17 | Single-tap advance/back across Section boundaries | Epic 4 — Story 4.1 (NEXT/back ACs; first-song-back inert; chord area no-tap-advance; swipe ignored) | ✓ Covered |
| FR-18 | Wake Lock + persistent indicator | Epic 4 — Story 4.2 (acquire, reacquire-on-foreground, reacquire-on-release-event, static indicator, backoff, retain-on-×, release-on-end) | ✓ Covered |
| FR-19 | Exit via `×` (state preserved) | Epic 4 — Story 4.3 | ✓ Covered |
| FR-20 | "Currently performing" strip + Resume | Epic 4 — Story 4.3 | ✓ Covered |
| FR-21 | End on navigate-away; last-song `NEXT ›` inert; no End button | Epic 4 — Story 4.4 (explicit "no `End performance ›` button anywhere" codebase audit AC; last-song disabled-visual + `aria-disabled` + no-action + silent next-song preview) | ✓ Covered |
| FR-22 | Backgrounding survives | Epic 4 — Story 4.5 (visibilitychange handling + URL-driven restore + cache reads) | ✓ Covered |
| FR-23 | Setlists home default landing | Epic 3 — Story 3.2 (also touches Story 1.5 default-route scaffold) | ✓ Covered |
| FR-24 | Library top-level destination + chrome hide on Performance | Epic 1 — Story 1.5 (nav chrome + `useChromeVisible()` scaffold); Epic 4 — Story 4.1 (actual hide-on-entry) | ✓ Covered |
| FR-25 | Band scoping in data model | Epic 1 — Story 1.3 (DDB shape `BAND#<bandId>` keys); Epic 2 — Story 2.3 (Song schema `bandId`); Epic 3 — Story 3.1 (Setlist schema `bandId`) | ✓ Covered (cross-epic data-model contract) |
| FR-26 | Passive Band label on MacBook; no label on iPhone | Epic 1 — Story 1.5 (explicit "non-interactive: no `tabindex`, no `cursor: pointer`, no `onClick`, no focus ring, no role" AC + iPhone "Band label NOT shown anywhere" AC) | ✓ Covered |
| FR-27 | Single-user access gate | Epic 1 — Story 1.4 (password + JWT cookie, SSM SecureString, argon2id, time-equal verify, expiry-banner) | ✓ Covered |
| FR-28 | No sharing or multi-user | Implicit across Epic 1–5 (no share affordance built, no multi-user data model). **No dedicated audit AC** — see Gap G1 below. | ⚠ Implicit |
| FR-29 | Canonical persistence + Setlist-history-from-day-one (titleSnapshot, no purging) | Epic 1 — Story 1.3 (PITR, AWS Backup); Epic 2 — Story 2.3 (Song schema + LWW); Epic 3 — Story 3.1 (Setlist schema embedded + AR-11 `titleSnapshot` preservation AC: "existing Setlist records are NOT modified by the Song write"). **No explicit "no purging mechanism" verification** — see Gap G2 below. | ✓ Covered (history-mineable contract storied via titleSnapshot) |
| FR-30 | Optimistic local writes + held toasts in Performance Mode | Epic 2 — Story 2.4 (outbox + stale-write banner suppressed on iPhone in Performance Mode); Story 2.6 (optimistic display); Epic 4 — Story 4.4 (held-toast queue flush on end-state) | ✓ Covered |
| FR-31 | Offline tolerance | Epic 2 — Story 2.1 (SW strategies) + Story 2.4 (outbox); Epic 4 — Story 4.5 (Performance Mode runs offline; cache-only reads in performance) | ✓ Covered |
| FR-32 | LWW per record (no per-field merge) | Epic 2 — Story 2.3 (lww.ts unit tests); Epic 3 — Story 3.1 (whole-record PUT semantics with explicit "no per-field merging" AC) | ✓ Covered |
| FR-33 | Manual JSON export (MacBook footer) | Epic 5 — Story 5.1 (endpoint + Library footer affordance; iPhone explicitly excluded) | ✓ Covered |
| FR-34 | Automated backup + verified restore ship-gate | Epic 1 — Story 1.3 (PITR + AWS Backup vault, 365d retention, cold-storage transition); Epic 5 — Story 5.2 (verified restore drill — 10-phase runbook, sign-off log, ship-blocking gate, RPO/RTO targets, e2e Playwright spec) | ✓ Covered (operational ship gate is explicit) |

### Coverage Matrix (NFR)

| NFR | Description | Epic / Story | Status |
|-----|-------------|--------------|--------|
| NFR-1 | Performance Card transitions <150ms; `prefers-reduced-motion` instant | Epic 4 — Story 4.1 (explicit AC) | ✓ Covered |
| NFR-2 | Cold render <300ms on iPhone 13 | Epic 4 — Story 4.1 (CTA→card visible <300ms with warm cache); Story 4.5 (foreground prefetch keeps cache warm) | ✓ Covered |
| NFR-3 | Paste-to-parse <500ms (~20 Songs) | Epic 3 — Story 3.5 (explicit AC) | ✓ Covered |
| NFR-4 | Inline edits commit (debounced) <200ms of blur | Epic 2 — Story 2.6 (explicit AC) | ✓ Covered |
| NFR-5 | Available during scheduled gig windows | Epic 1 — Story 1.3 (single-region production stack) + Story 1.6 (blackout-check gate) | ✓ Covered |
| NFR-6 | No maintenance within 24h of any future Gig — automated enforcement | Epic 1 — Story 1.6 (two-stage blackout check, fail-closed, named TZ Europe/London, manual-override with venue-name typing) | ✓ Covered (comprehensive AC set) |
| NFR-7 | Performance Mode never blocked by sync error | Epic 2 — Story 2.4 (banner suppressed in Performance Mode); Epic 4 — Story 4.1/4.4 (cache reads, held toasts) | ✓ Covered |
| NFR-8 | Internet not precondition for cached Performance session | Epic 2 — Story 2.1 (SW caching) + Story 2.4 (outbox); Epic 4 — Story 4.5 (offline-capable performance session AC) | ✓ Covered |
| NFR-9 | Best-effort availability outside gig windows; no numeric SLO; single-user, single-region | Epic 1 — Story 1.3 (eu-west-2 single-region, on-demand DDB, no autoscaling/multi-AZ) | ✓ Covered (negative requirement; design satisfies) |
| NFR-10 | All transport HTTPS | Epic 1 — Story 1.3 (ACM + CloudFront + Route 53) | ✓ Covered |
| NFR-11 | All data at rest encrypted (AWS-managed) | Epic 1 — Story 1.3 (KMS-managed AWS Backup vault + DDB default encryption). **Implicit for DDB** — see Gap G3 below. | ✓ Covered (implicit for DDB) |
| NFR-12 | No secrets in client/VCS; secrets via AWS-managed | Epic 1 — Story 1.4 (JWT key + password-hash in SSM SecureString, fetched at cold-start, never logged, never in env vars, logger redacts) | ✓ Covered |
| NFR-13 | Gate is sole entry point; no unauthenticated read | Epic 1 — Story 1.4 (auth middleware on all `/api/v1/*` except login + health; 401 envelope; SPA bundle public but data-free) | ✓ Covered |
| NFR-14 | Server-side error logging (CloudWatch) | Epic 1 — Story 1.3 (CloudTrail + CW retention) | ✓ Covered |
| NFR-15 | Client-side Performance Mode errors logged silently | Epic 2 — Story 2.3 (client-errors endpoint) + Story 2.4 (error-reporter wired to window.onerror / unhandledrejection / ErrorBoundary, payload includes `performanceActive` flag) | ✓ Covered |
| NFR-16 | No analytics/telemetry | AR-46 ("No analytics SDK") + implicit across all stories (no analytics dependencies added) | ✓ Covered |
| NFR-17 | Performance Mode WCAG AAA 7:1; body floor 18pt; primary 32pt+ | Epic 1 — Story 1.2 (tokens reference DESIGN.md `perf-title` ≥36pt and `body` 18pt); Epic 4 — Story 4.1 (title ≥36pt, key/patch ~22pt). **No explicit contrast-ratio audit AC against 7:1** — see Gap G4 below. | ⚠ Partially covered |
| NFR-18 | Practice Mode WCAG AA 4.5:1; body floor 17–18pt | Epic 1 — Story 1.2 (Practice atmosphere tokens). **No explicit contrast-ratio audit AC against 4.5:1** — see Gap G4 below. | ⚠ Partially covered |
| NFR-19 | No information by color alone | Epic 1 — Story 1.2 (UX-DR6 codifies); Epic 3 — Story 3.5 (ParseRowStatus glyph + label + color triple) | ✓ Covered |
| NFR-20 | Tap targets ≥ 44×44pt | Epic 1 — Story 1.2 (`min-w-tap min-h-tap` tokens, `--size-tap: 44pt`); repeated in 2.5, 3.2, 3.5, 4.1 | ✓ Covered |
| NFR-21 | `prefers-reduced-motion` honoured | Epic 1 — Story 1.2 (globals.css zeroes transitions/animations); Epic 4 — Story 4.1 ("collapses to instant" AC) | ✓ Covered |
| NFR-22 | VoiceOver labels on Paste-to-parse, Performance Mode controls, position indicator, per-gig annotation | Epic 3 — Story 3.5 (`aria-live="polite"` on parse rows); Epic 4 — Story 4.1 (aria-labels on `‹`/`NEXT ›`/position indicator); Story 4.2 (`aria-live="assertive"` on indicator); Story 4.3 (`aria-label` on `×` and Resume). **Per-gig annotation VoiceOver label not explicitly captured beyond inherited row semantics** — see Gap G5 below. | ⚠ Mostly covered |
| NFR-23 | MacBook layout 1280–1680pt; single-column | Epic 2 — Story 2.5 ("single-column vertical layout per NFR-23"); implicit elsewhere | ✓ Covered |
| NFR-24 | iPhone 13 PWA viewport / insets / tap target / portrait-locked | Epic 1 — Story 1.5 (bottom tab inset 34pt); Epic 2 — Story 2.1 (manifest); Epic 4 — Story 4.1 (Performance Mode portrait-locked). **No single AC pinning the 47pt top inset, the 390×844pt viewport target, and portrait-lock together** — values are scattered. | ⚠ Mostly covered |
| NFR-25 | PWA install required for Wake Lock | Epic 2 — Story 2.2 (iPhone install gate) | ✓ Covered |
| NFR-26 | No tablet/desktop-native/Android/other phones | Negative requirement; implicit across architecture (single-viewport iPhone 13 target, no Android-specific work) | ✓ Covered (negative requirement; design satisfies) |
| NFR-27 (feature) | Wake Lock indicator no-animate | Epic 4 — Story 4.2 (explicit "STATIC — no animation, no blinking, no pulse" AC) | ✓ Covered |
| NFR-28 (feature) | Wake Lock reacquisition backoff | Epic 4 — Story 4.2 (explicit exponential backoff 1s → 5s → 30s → 60s cap AC) | ✓ Covered |

### Coverage Statistics

- **Total PRD FRs:** 34. **Fully covered:** 33. **Implicitly covered (no dedicated audit AC):** 1 (FR-28). **Missing:** 0.
- **Total NFRs (epics' numbering):** 28. **Fully covered:** 24. **Partially covered:** 4 (NFR-17, NFR-18, NFR-22, NFR-24). **Missing:** 0.
- **FR coverage percentage (hard):** 33/34 = 97% explicit; 100% if implicit-but-design-satisfied is allowed.
- **NFR coverage percentage:** 24/28 = 86% explicit; 100% if "addressed somewhere" is the bar — but the 4 partial NFRs are worth tightening before story execution.

### Missing or Partial Coverage — Gap List

These are NOT requirements absent from the epics. They are requirements covered implicitly or by inheritance, where an explicit acceptance criterion (or a dedicated audit step) would tighten traceability before stories enter implementation. Each is small. The epics already meet a high bar; this list is the "harden traceability" pass.

**Soft Gaps (recommend tightening; not implementation-blocking)**

- **G1 — FR-28 (no sharing/multi-user) has no audit AC.** Implementation never builds a share affordance, but no story includes an explicit codebase audit AC of the form "audit confirms no share affordance, invite link, guest mode, owner-other-than-Sandy concept exists anywhere in the codebase." Suggest: append one AC to Story 1.5 (nav chrome scaffold) or fold into Story 5.2 (ship-gate) given that's where "is V1 actually shippable" is verified. Mirrors the existing FR-21 audit pattern in Story 4.4 ("no component renders an `End performance ›` button anywhere in the UI").

- **G2 — FR-29 "Setlist history preserved in full from day one" has no explicit "no purging mechanism" verification.** Story 3.1 storeing the `titleSnapshot` and AR-11 covers the *retention-survives-Song-rename* contract, but there's no story-level AC that says "no API endpoint, no admin tool, no UI affordance can purge or delete a Setlist record in V1." This is the V2-readiness lever. Suggest: append an AC to Story 3.1 of the form "verify no DELETE endpoint exists on `/api/v1/setlists/*` and no UI affordance deletes a Setlist record" (mirrors the AR-12 `DeletionProtection: true` rationale at the data-store layer).

- **G3 — NFR-11 (encryption at rest) is mostly implicit for DDB.** Story 1.3 explicitly mentions KMS for the AWS Backup vault but does not have an AC that says "DDB table `gigbuddy-data` is encrypted at rest (AWS-managed KMS key by default; explicit configuration verified in the CDK stack)." DDB's default is encryption-at-rest, so the requirement is met — but an explicit AC + a CDK assertion (`encryption: dynamodb.TableEncryption.AWS_MANAGED`) closes the trace. Recommend: small AC addition to Story 1.3.

- **G4 — NFR-17 / NFR-18 contrast ratios (7:1 / 4.5:1) lack an explicit audit AC.** Story 1.2 inherits values from DESIGN.md but never says "Performance Card foreground/background pairs measured against WCAG AAA 7:1; Practice Card pairs measured against WCAG AA 4.5:1; report committed alongside tokens." DESIGN.md sets the visual direction, but the audit step is what ensures the implemented tokens actually deliver the contrast. Recommend: append a "contrast verification" AC to Story 1.2, ideally as a one-off measurement committed to the repo (e.g., `web/test-output/contrast-report.json`).

- **G5 — NFR-22 per-gig annotation VoiceOver label is implicit.** Annotation rendering on the Performance Card (Epic 4) and the Setlist overview (Story 3.3) inherits row-level semantics. No story has an explicit `aria-label` AC for the annotation element itself (e.g., "this Song has a per-gig annotation: <text>"). Recommend: one-line AC in Story 3.3 (`SongRow (setlist)` with annotation) and Story 4.1 (annotation rendering on Performance Card).

- **G6 — NFR-24 iPhone 13 PWA values are scattered.** 47pt top inset, 34pt bottom inset, 390×844pt viewport, portrait-lock — each appears in some story, but no single story consolidates them as a platform-target AC set. Optional: a single AC in Story 1.5 or Story 2.1 that explicitly enumerates the iPhone-13 platform target values.

**No hard gaps.** Every PRD FR has at least one story that addresses it; every NFR has at least one story that addresses it.

### Cross-cutting Observations from Epic Coverage

- **Each FR Coverage Map entry in the epics document was verified against the actual story body.** No story claims coverage that the story body doesn't deliver.
- **The PRD-resolved decisions** (Q3 inert NEXT, Q4 Wake Lock indicator, Q7 export-as-footer) are all storied with the resolved behavior, not the open-question framing — i.e., the epics are post-resolution.
- **Architecture-deferred items** (FR-27 mechanism choice, FR-29 store choice, FR-34 mechanism choice) are resolved in the AR-* layer of the epics document: AR-15..AR-19 resolve the access gate (argon2id + SSM + JWT cookie); AR-9..AR-13 resolve the store (DDB single-table + PITR + AWS Backup); AR-13/AR-14 resolve the backup mechanism. The PRD's open-question pointers and the AR-* resolutions are consistent.
- **The architecture's "Outbox state machine" (AR-20) and "Performance Mode invariants" (AR-28) are non-trivial cross-cutting contracts.** Story 2.4 implements the outbox and Story 4.1/4.4/4.5 enforce AR-28. Both contracts are realised in story-level ACs rather than left abstract.
- **The deploy automation NFR-6 (maintenance blackout)** is a standout — typically under-storied in projects with similar shape. Here, Story 1.6 has a comprehensive AC set including two-stage fail-closed semantics, named-IANA-TZ requirement, GMT/BST self-tests, manual-override with venue-name retyping, and CloudWatch logging of overrides. This is well-storied.
- **The Verified Restore ship gate (Story 5.2)** is an entire story dedicated to operational proof rather than coded behaviour, with a 10-phase runbook AC, sign-off log requirement, RPO/RTO targets, and a Playwright spec. This is unusual rigor for a personal project and aligns with the brief's Principle 3 (Trustworthiness).

---

## Step 4 — UX Alignment Assessment

### UX Document Status

**Found.** Two primary artifacts (sharded), both `status: final`:
- `ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md` — the experience spine: IA, voice, component patterns (behaviour), state patterns, interaction primitives, accessibility floor, key flows.
- `ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md` — the design spine: tokens, type scale, colours, components (visual), do/don't, locked visual direction.

Supporting context (not authoritative for scope, per [[project_visual_direction_locked]]):
- `ux/design-handoff/` — handoff prompt + content samples used to brief Claude Design (May 31).
- `ux/visual-direction/` — locked mood boards + interactive prototype + README.

The PRD explicitly treats EXPERIENCE.md and DESIGN.md as authoritative upstream inputs (PRD §0); the architecture inherits from both (Architecture §0 inputDocuments). All three downstream artifacts (PRD, architecture, epics) reference the UX spec by name and section.

### UX ↔ PRD Alignment

**Strong alignment.**

| Alignment surface | Verdict | Detail |
|---|---|---|
| Glossary terms | ✓ Aligned | PRD §3 Glossary terms map 1:1 to terms used throughout EXPERIENCE.md (`Band`, `Library`, `Setlist`, `Section`, `Per-gig annotation`, `Performance Mode`, `Performance Card`, `Tonight`, `Wake Lock`, `Paste-to-parse`, `Matched/Fuzzy/Unknown`). No terminological drift. |
| User journeys | ✓ Aligned | PRD UJ-1..UJ-4 mirror EXPERIENCE.md Flow 1..Flow 4 (Saturday-night load-in / Between songs / Tuesday-evening prep / Sunday-morning library polish). The Sandy-as-protagonist framing is consistent. |
| Component behaviour | ✓ Aligned | Every component named in PRD FRs (Performance Card regions, `Start performance ›` CTA, `× exit`, `Currently performing` strip, `Section heading`, `Song row`, `Inline edit field`, `Parse-row status`) appears in EXPERIENCE.md Component Patterns with consistent behaviour. |
| State patterns | ✓ Aligned | PRD State Patterns deferred to EXPERIENCE.md (per FR-3, FR-4, FR-13, FR-30 etc.). Empty-state copy (`No songs in this library yet.`, `No upcoming gigs.`), sparse-row absence (no `(not specified)` placeholders), save-silent / save-failure-toast, offline no-banner, sync-error MacBook-banner — all are unidirectional references from PRD to EXPERIENCE.md with consistent treatment. |
| Interaction primitives | ✓ Aligned | EXPERIENCE.md Interaction Primitives (single-tap-only, no pinch/double-tap, no tap-anywhere, no swipe in Performance Mode, tabs hide in Performance Mode, drag-MacBook-only) match PRD §5 Non-Goals + FR-17. |
| Accessibility floor | ✓ Aligned | EXPERIENCE.md Accessibility Floor (WCAG AAA Performance / AA Practice, 18pt body floor, 32pt+ primary, color-never-alone, tap targets ≥44pt, VoiceOver labels, reduce-motion) matches PRD §A.5 verbatim — PRD A.5 explicitly defers to EXPERIENCE.md. |
| Routing rules | ✓ Aligned | EXPERIENCE.md routing rules (open-setlist → overview never card; Start performance only entry to card; × always returns to overview; backgrounding lands back on card not home) match PRD FR-15, FR-19, FR-22. |
| Voice & tone | ✓ Aligned | EXPERIENCE.md Voice and Tone table (short complete sentences; no exclamation marks; no emoji; no marketing voice; no encouragement layer) matches PRD §5 Non-Goals (no encouragement/streaks/gamification). |

**Three minor stalenesses in EXPERIENCE.md** (PRD has resolved items that EXPERIENCE.md still marks as open):

- **S1 — End of Setlist treatment.** EXPERIENCE.md line 122 says: `NEXT › does not loop. **Open:** inert vs. transforms to End performance › — choose at implementation.` PRD FR-21 has now **resolved** this: "On the last Song, `NEXT ›` becomes inert (visibly disabled, no action). There is no `End performance ›` button." The PRD's resolution is the source of truth (status: final 2026-06-09) and downstream (architecture, epics Story 4.4) honour it. EXPERIENCE.md hasn't been updated; this is a doc-staleness, not an implementation risk.
- **S2 — Wake Lock fallback indicator.** EXPERIENCE.md references Wake Lock obliquely ("Wake lock continues" in CurrentlyPerformingStrip; "Wake lock survives if OS permits; reacquires on resume" in state pattern). It does NOT specify the persistent static indicator on the Performance Card when the lock is NOT held. PRD FR-18 (resolved Q4 2026-06-09) fully specifies it. The architecture (Decision 4) and epics Story 4.2 implement it. EXPERIENCE.md hasn't been updated.
- **S3 — Settings surface qualifier.** EXPERIENCE.md line 126 mentions "Settings (if added) or banner-on-MacBook" for persistent sync failure. PRD Q7 (resolved 2026-06-09) has decided no Settings surface in V1; Export lives in Library footer. EXPERIENCE.md's "(if added)" caveat is consistent with the resolution but predates it.

**One genuine ambiguity to surface before implementation:**

- **A1 — MacBook top-nav `New setlist` action.** EXPERIENCE.md IA says: `Top nav: GigBuddy · The Jack Ruby 5 — Setlists — Library — New setlist.` PRD doesn't enumerate the MacBook top nav. Epic Story 1.5 (nav chrome scaffold) builds the top nav with `Setlists` and `Library` only — no `New setlist` slot. Epic Story 3.4 then says the `+ New setlist` affordance lives "on MacBook, a `+ New setlist` action in the top nav or the Setlists home page chrome" — picks one or the other but doesn't commit. Not a contradiction, but Story 1.5's chrome scaffold may need to leave room for the future `New setlist` action so Story 3.4 doesn't require chrome refactoring.

### UX ↔ Architecture Alignment

**Strong alignment.** Architecture explicitly inherits from DESIGN.md and EXPERIENCE.md.

| Alignment surface | Verdict | Detail |
|---|---|---|
| Design tokens | ✓ Aligned | Architecture specifies Tailwind v4 `@theme` blocks in `tokens.css`; DESIGN.md tokens (colours, type scale, spacing, radii) lifted directly. Atmosphere selector is `<html data-atmosphere="...">` — CSS-only, no JS theme provider — matching DESIGN.md "no user-facing theme toggle" + EXPERIENCE.md surface defaults. |
| Type scale | ✓ Aligned | Architecture references DESIGN.md scale by token name (`perf-title` 36, `perf-meta` 22, `perf-body` 18, `practice-body` 17–18) — matches DESIGN.md verbatim. |
| Performance Mode invariants | ✓ Aligned | Architecture's `performanceActive` boolean + AR-28 invariants (no toasts/banners/auth-redirects, cache reads only, Wake Lock held with FR-18 indicator on release, no SW activation) directly encode EXPERIENCE.md State Patterns + Interaction Primitives. |
| Accessibility implementation primitives | ✓ Aligned | Architecture's Accessibility Implementation Primitives subsection (aria-label on icon-only controls, aria-live polite on parse rows, aria-live assertive on Wake Lock indicator, focus management on entry/exit, `prefers-reduced-motion` CSS, `--size-tap: 44pt` token, color-never-alone via component contract) precisely fulfils EXPERIENCE.md Accessibility Floor and DESIGN.md don't-rule about color. Architecture explicitly added these primitives during Gap #3 resolution (per architecture line 1156). |
| Component list | ✓ Aligned | DESIGN.md Components (12 named visual components) + EXPERIENCE.md Component Patterns (12 named behavioural components) + epic UX-DR4 (12 reusable components) cross-reference 1:1. |
| Chord chart V1 floor | ✓ Aligned | DESIGN.md/EXPERIENCE.md specify mono-slab text with `{...}` section breaks + blank-line preservation + URLs tappable in Practice only. Architecture confirms the data model is free-text. Epic Story 2.6 + UX-DR5 implement the floor. |
| Spatial-separation safety | ✓ Aligned | DESIGN.md Don't rule "Place destructive controls (`× exit`, `‹ back`, `NEXT ›`) in the same corner. Spatial separation is a safety primitive." → UX-DR9 + epic Story 4.1 ACs explicitly enforce this. |
| iPhone PWA install gate | ✓ Aligned | EXPERIENCE.md asserts "PWA installation required for iPhone" → PRD NFR-25 → Architecture Decision 4 "iPhone install-detection gate" → epic Story 2.2 implements it. |
| Performance budgets | ✓ Aligned | DESIGN.md/EXPERIENCE.md set the accessibility/legibility floor; PRD A.1 sets the latency budgets (150ms transitions, 300ms cold render, 500ms paste-to-parse, 200ms inline-edit debounce). Architecture's Performance Mode invariants + pre-fetch rules + reduced-motion CSS deliver them. All four are storied with explicit ACs in Stories 4.1, 4.5, 3.5, 2.6. |
| Visual direction lock | ✓ Aligned | DESIGN.md notes "visual identity locked 2026-06-08 from Claude Design output. Precise token extraction is the work of the first implementation story." Architecture defers final tokens to Story 1. Epic Story 1.2 picks them up. Memory [[project_visual_direction_locked]] is respected: visual direction is locked, but the features/flows in the Claude Design output are not treated as authoritative spec. |

**Two minor architecture↔UX touchpoints to note:**

- **T1 — Source of precise tokens.** Architecture says "tokens.css will be lifted from `board-1-performance.png` and `board-2-practice.png`" (line 233 of DESIGN.md echoes this). Epic Story 1.2 AC says lifting from "DESIGN.md Colors (Performance "Club Warm" + Practice "warm paper cream" palettes)". DESIGN.md provides approximate values in its frontmatter; the boards are the source of truth for precise extraction. Story 1.2 should cite both — extract from the boards using DESIGN.md tokens as the structural map. Minor language tightening, not a contradiction.
- **T2 — iPhone 13 platform-target values scattered.** EXPERIENCE.md and DESIGN.md both name 390×844pt viewport, 47pt top inset, 34pt bottom inset, 44×44pt tap target, portrait-locked Performance Mode. Architecture references these in places (Story 1.5: 34pt bottom; Story 4.1: portrait-lock; Story 1.2: `--size-tap: 44pt`). No single platform-target AC consolidates all four. Tracked in coverage Gap G6.

### Warnings

**No hard warnings.** UX documentation exists, is `status: final`, and is consistently honoured by both PRD and architecture.

**Soft watch-outs to address before implementation:**

- **W1 — EXPERIENCE.md is slightly behind the PRD on three resolved open items (S1, S2, S3 above).** Recommend a short editing pass on EXPERIENCE.md to mark these as resolved with the PRD's resolution, so anyone reading EXPERIENCE.md in isolation isn't misled. This is documentation hygiene, not implementation risk.
- **W2 — MacBook top-nav `New setlist` slot ambiguity (A1).** Recommend committing Story 1.5 or Story 3.4 to one location before implementation, ideally as an AC of Story 1.5 ("nav chrome scaffold reserves a right-aligned action slot that Story 3.4 later populates with `+ New setlist`").
- **W3 — Visual contrast verification (carried over from coverage Gap G4).** UX sets WCAG AAA (Performance) and AA (Practice) contrast requirements. Architecture and Story 1.2 inherit the tokens but don't include a contrast audit step. Recommend adding a contrast-measurement AC to Story 1.2.

### Cross-cutting observations

- The PRD ↔ UX ↔ Architecture relationship is unusually tight: the PRD treats UX as upstream, the architecture treats PRD + UX as upstream, and epics inherit from all three. Most projects need a reconciliation pass; this one already has it (the `reconcile-*.md` files alongside the PRD).
- Where the three artifacts disagree, the disagreement is always small and always in the same direction: **EXPERIENCE.md is slightly stale on items the PRD has subsequently resolved.** The PRD's resolutions propagate correctly to architecture and epics. No item is mis-implemented because of this staleness.
- The "personal tool, not a platform" principle from the brief (and [[user_role]] memory) is honoured across all three artifacts: no SaaS framing, no persona ceremony, no settings toggles, no encouragement layer.

---

## Step 5 — Epic Quality Review

Rigorous validation against create-epics-and-stories best practices: user-value focus, epic independence, story sizing, dependency hygiene, AC quality. The epics document is generally high quality — most findings below are soft.

### Per-Epic Quality Assessment

**Epic 1 — Foundation, Access Gate & Deploy Pipeline**

- **User value:** "Sandy can log in to a real, trusted URL. The tool exists at a deploy-protected endpoint with a working backup story." ✓ User-centric. Despite being heavy on infrastructure, the epic's user outcome is concrete (Sandy can log in and see his empty GigBuddy) and meaningful (trustworthiness — directly serves the brief's "no dependencies that can fail at 9pm" principle).
- **Independence:** ✓ Epic 1 stands alone — a deployed, password-gated empty shell of GigBuddy. Subsequent epics never need to retrofit Epic 1.
- **Stories (6):** 1.1 repo scaffold → 1.2 design tokens + atmospheres → 1.3 CDK infra stacks → 1.4 access gate → 1.5 nav chrome → 1.6 deploy pipeline + blackout check. Sensible order with no within-epic forward dependencies.
- **Story sizing:** Story 1.3 is large (5 CDK stacks), but the stacks deploy together via `cdk deploy` and decomposing would create stories that can't independently ship. Story sizing is acceptable.
- **Notable strengths:** Story 1.5 (nav chrome) pre-creates the `PerformanceModeContext` scaffold (with `setActive=false` default) so Epic 4's FR-15 only needs to call `setActive(true)`. This is a clever pattern: building the structural code path in advance so later stories don't need forward-reference. The deferred-AC pattern is explicit and well-handled.

**Epic 2 — Song Library & Sync Layer**

- **User value:** "Sandy can populate his Library by hand. Every edit is captured silently. Writes survive offline. Conflicts resolve LWW." ✓ User-centric.
- **Independence:** ✓ Epic 2 produces a usable Library on top of Epic 1's empty shell.
- **Stories (6):** 2.1 SW + manifest → 2.2 iPhone install gate → 2.3 Song API + DDB + client-errors → 2.4 sync layer + error reporter → 2.5 Library list → 2.6 Song Detail inline edit.
- **Sizing watch-out:** Story 2.4 bundles TanStack Query setup, IndexedDB persister, outbox state machine, flusher with retries+backoff, x-server-now clock-skew detection, `PerformanceModeContext` providership, and the React `ErrorBoundary` + `window.onerror` reporter. Soft issue: this could split into 2.4a (sync foundation) + 2.4b (client error reporter). Both halves are required for the epic outcome but they're orthogonal mechanisms.
- **Within-epic forward dependencies (soft):**
  - Story 2.5 references Story 2.6 by name ("Song Detail (Story 2.6) renders for that Song"); also has the `+ New song` affordance that navigates to `/songs/new` (a Story 2.6 route). Both stories ship together; pairing is natural. Acceptable.

**Epic 3 — Setlists Home, Paste-to-Parse & Setlist Management**

- **User value:** "The Apple-Notes pre-gig compile workflow is replaceable. Sandy can land a 19-song Setlist in minutes without leaving the prep flow." ✓ User-centric and concrete.
- **Independence:** ✓ Epic 3 is the prep-surface payoff — usable on its own atop Epics 1–2.
- **Stories (6):** 3.1 Setlist API + DDB → 3.2 Setlists home → 3.3 Setlist overview → 3.4 manual setlist creation → 3.5 paste-to-parse → 3.6 drag-reorder.
- **Sizing:** All stories appropriately sized.
- **Notable strengths:** Story 3.3 explicitly handles the cross-epic CTA wiring with an INERT-in-Epic-3 / wired-in-Epic-4 pattern. From line 1140: "in Epic 3, tapping the CTA is INERT (no-op or a small toast `Performance mode lands in Epic 4` in dev builds only); Epic 4's Story 4.x wires the entry behavior." This is exactly the right way to surface a deferred dependency in an AC. Same pattern is applied to the `Currently performing` strip slot ("Epic 4's Story 4.x will populate; in Epic 3 the slot renders nothing").

**Epic 4 — Performance Mode**

- **User value:** "Sandy can perform a gig from GigBuddy on iPhone, beginning to end, in a dim bar, with no mid-set surprises." ✓ This is the brief's load-bearing user outcome.
- **Independence:** ✓ Epic 4 turns the prepped Setlists from Epic 3 into a performable surface. The epic itself is fully self-contained.
- **Stories (5):** 4.1 entry + card + nav → 4.2 Wake Lock → 4.3 exit + strip + resume → 4.4 end state + last-song inert → 4.5 backgrounding + prefetch + upcoming-gigs endpoint.
- **Sizing:** Story 4.1 is the largest, but the three concepts it bundles (entry + Card layout + single-tap navigation) are not separable without artificial cuts.
- **Notable strengths:** Story 4.1 includes a "stub Wake Lock acceptable if 4.2 hasn't shipped" allowance, letting 4.1 and 4.2 ship in either order. Story 4.4 includes an explicit codebase-audit AC: "**Given** there is NO `End performance ›` button anywhere in the UI / **When** auditing the codebase / **Then** no component renders such a button / **And** the comment / story documentation explains the safety rationale" — this is excellent ([[feedback_no_terminate_on_advance_gesture]] codified as a code-review check). Story 4.2's Wake Lock backoff explicitly enumerates 1s → 5s → 30s → 60s cap, not "backoff appropriately."

**Epic 5 — Export & Verified Restore Ship-Gate**

- **User value:** "Sandy has a one-tap full data dump and proven recoverability. V1 ships only after this drill passes." ✓ Story 5.2 is unusual in being a primarily *operational* ship-gate (runbook execution + sign-off log), not coded behaviour. Justified by the brief's trustworthiness principle and PRD FR-34's explicit "verified end-to-end before V1 ships."
- **Independence:** ✓ Epic 5 is the final epic; depends on Epics 1–4 by design (you can't drill restore on an empty schema).
- **Stories (2):** 5.1 JSON export endpoint + Library footer → 5.2 verified restore drill + 10-phase runbook (SHIP-BLOCKING).
- **Notable strengths:** Story 5.2 is structured as a runbook authoring + drill execution + sign-off log story, with a Playwright spec providing automated verification. The DDB `DeletionProtection` interaction with the side-table restore is explicitly addressed (line 1811–1815). This level of operational rigor is unusual for a personal project — and warranted, given the user is a working musician depending on the tool.

### Best Practices Compliance Checklist

| Criterion | Epic 1 | Epic 2 | Epic 3 | Epic 4 | Epic 5 |
|---|---|---|---|---|---|
| Delivers user value | ✓ | ✓ | ✓ | ✓ | ✓ |
| Functions independently | ✓ | ✓ | ✓ | ✓ | ✓ (depends on 1–4 by design) |
| Stories appropriately sized | ✓ | ⚠ (2.4 large) | ✓ | ✓ | ✓ |
| No within-epic forward deps | ✓ | ⚠ (2.5 ↔ 2.6 cross-reference) | ✓ | ✓ | ✓ |
| DB/entity creation timing | ✓ (table via CDK in 1.3) | ✓ (Song schema in 2.3) | ✓ (Setlist schema in 3.1) | n/a | n/a |
| Clear acceptance criteria | ✓ | ✓ | ✓ | ✓ | ✓ |
| FR traceability | ✓ | ✓ | ✓ | ✓ | ✓ |

### Cross-Epic Dependency Map

```
Epic 1 (foundation)
   │   nav chrome ships PerformanceModeContext scaffold ──┐
   │   access gate routes-to-login except in PerfMode ──┐ │
   ▼                                                    │ │
Epic 2 (library + sync)                                 │ │
   │   sync layer adds setActive() consumers ───────────┘ │
   │   Song Detail handles stale-write banner ────────────┤
   │                                                      │
   ▼                                                      │
Epic 3 (setlists + paste-to-parse)                        │
   │   Setlist overview reserves CTA + strip slots ───────┤
   │                                                      │
   ▼                                                      │
Epic 4 (performance mode)                                 │
   │   FR-15 calls setActive(true), wires the CTA, etc.   │
   │   AR-28 invariants enforced (held toasts, etc.) ─────┘
   │
   ▼
Epic 5 (export + ship-gate)
```

Cross-epic forward dependencies are handled by one of three patterns, all of which are documented in the relevant stories:

1. **Scaffold-with-default-OFF (Epic 1 → Epic 4):** Story 1.5 ships `PerformanceModeContext` with `setActive=false` default; Story 4.1 calls `setActive(true)`. No retrofit.
2. **Deferred-AC documented in the source story (Epic 1 / 2 → Epic 4):** Story 1.4 and Story 2.6 carry ACs that read "while `performanceActive === true`, ..." with explicit pointer to Epic 4. The behaviour ships when Epic 4 lands; meanwhile the source story's primary path is fully testable.
3. **Inert/empty render (Epic 3 → Epic 4):** Story 3.3 renders the `Start performance ›` CTA as inert and reserves the `Currently performing` strip slot; Story 4.x populates both.

This is well-handled cross-epic layering. None of these patterns are "Epic N requires Epic N+1 to work" violations — every epic ships testable user-visible behaviour on its own.

### Findings by Severity

**🔴 Critical Violations:** none.

**🟠 Major Issues:** none.

**🟡 Minor Concerns**

- **Q1 — Story 2.4 bundles two orthogonal mechanisms.** Sync foundation (TanStack + IndexedDB + outbox + flusher + clock-skew) and the client error reporter (window.onerror + unhandledrejection + ErrorBoundary + POST `/api/v1/client-errors`) are independent. Splitting into 2.4a + 2.4b would clarify scope and make 2.4a's coverage of FR-30/31/32 cleaner. Not a blocker — both halves are required for epic completion. Recommend: split before story refinement.
- **Q2 — Story 1.4 carries a deferred AC that reads cleanly only after Story 4.1 lands.** Story 1.4 line 515–518: "while `performanceActive === true` (Epic 4), the 401 is held." This AC is partially testable in Epic 1 (the routing-to-login path works for `performanceActive === false`) and fully testable only after Story 4.1's `setActive(true)` lands. Recommend either (a) move the held-401 AC fully into Story 4.1 and reference it from Story 1.4 as a "see Story 4.1" note, or (b) keep the AC in Story 1.4 but make it explicit that the test for `performanceActive === true` lands when 4.1 ships. Currently the AC reads as if both branches are testable in Epic 1, which they're not.
- **Q3 — `PerformanceModeContext` provider creation is described in both Story 1.5 and Story 2.4.** Story 1.5 AC: "the structural code path is in place" (line 574). Story 2.4 AC: "`PerformanceModeContext` is provided at the root with `performanceActive=false` and a `setActive(bool)` function" (line 818). Either Story 1.5 creates a stub and Story 2.4 expands it, OR Story 1.5 creates the full thing and Story 2.4's AC is redundant. The intended split should be made explicit so one story doesn't trivially supersede the other.
- **Q4 — Story 2.5 has a small divergence from PRD §State Patterns acknowledged inline** (line 871–873): "a `+ New song` affordance is visible (small action in the page chrome, deliberately mild divergence from PRD §State Patterns to satisfy FR-1 standalone in Epic 2)." The divergence is documented and rationalised (Library must be usable for create/edit before Setlists exist in Epic 3). Acceptable but worth flagging to Sandy as a decision point — the alternative is to defer Library row creation to a setlist-paste-driven path, which contradicts FR-1 ("create a Song in the active Band's Library with a title" — implying a direct affordance).
- **Q5 — Drag-reorder keyboard-fallback AC offers two options without picking one** (Story 3.6 line 1318–1319): "the implementation may pick either; the AC is that drag is not the only path to reorder." This is acceptable for V1 (the AC is testable: "any non-drag path works") but the choice (Tab+Space+arrows vs. Move up/down buttons) will be made during implementation. Worth flagging that this is a story-time decision rather than something pre-decided.
- **Q6 — Story 1.3's IAM scoping is described generally** ("least-privilege scoped to the table ARN + its GSI"), which is correct, but the specific IAM action list isn't enumerated. This is fine for an architecture-level scaffolding story; the precise IAM actions will be picked during implementation. Worth flagging only because IAM scoping mistakes are silent (overly permissive) — a quick code-review checklist would help.
- **Q7 — Story 1.6 expects `infra/scripts/blackout-check.ts` to share semantics with `api/src/routes/upcoming-gigs.ts` (Story 4.5)**, but the two implementations are in different packages and the sharing mechanism isn't pinned. Story 4.5 line 1660–1661 says "the time-window logic ... is shared OR replicated identically with self-tests in both places." For a personal project this is fine; for a larger team you'd want to extract to `shared/` to avoid drift. Minor.

### Acceptance Criteria Quality (spot-check)

A spot-check of high-leverage stories confirms AC quality is consistently high:

- **Given/When/Then BDD format used throughout.**
- **Edge cases are explicit:** empty Library / empty Setlist / sparse Songs / offline writes / stale-write responses / last-song NEXT / OS backgrounding / Wake Lock loss / iPhone clock skew / cookie expiry / fresh deploy with empty DDB / static blackout fallback. The set of edge cases is unusually comprehensive.
- **Voice and tone, accessibility, and platform-specific behaviour are threaded through ACs** rather than relegated to a separate "non-functional" section per story. This makes per-story sign-off enforceable.
- **Negative requirements are auditable:** "no component renders an `End performance ›` button" (Story 4.4); "no UI exposes a share affordance" (gap G1 to add); "no `tabindex`, no `cursor: pointer`, no `onClick`, no focus ring, no role" on the passive Band label (Story 1.5). Negative ACs codify what *shouldn't* exist — invaluable for code review.
- **Performance and accessibility targets are quantified, not described:** "<150ms" (NFR-1), "<300ms" (NFR-2), "<500ms" (NFR-3), "<200ms" (NFR-4), "≥36pt" (FR-16), "44×44pt" (NFR-20). Every quantitative target traces to a PRD NFR.

### Story Quality Assessment Summary

- **5 epics, 25 stories total.** All 25 stories use Given/When/Then BDD format with testable ACs.
- **Zero critical violations; zero major issues; 7 minor concerns** (Q1–Q7 above), all of which are story-refinement rather than re-planning items.
- **Story-to-FR traceability is explicit** via the FR Coverage Map (epics document lines 215–249) and reinforced by inline AC references ("per FR-15", "per UX-DR4", "per AR-23").
- **Database/entity creation timing is correct** for the AWS pattern: the table is provisioned via CDK in Story 1.3; record schemas land per-story as the FRs they back are storied.
- **The ship-gate pattern (Story 5.2)** is unusual and correct: V1 doesn't ship until the verified-restore drill passes, with a sign-off log committed to the repo. This is the kind of explicit operational gate that's normally implicit (and therefore forgotten).

---

## Summary and Recommendations

### Overall Readiness Status

**READY for implementation.**

The four planning artifacts — PRD, Architecture, UX (DESIGN.md + EXPERIENCE.md), and Epics & Stories — are unusually well-aligned for a project at this stage. Every PRD FR maps to at least one epic story; every NFR is addressed; the UX spec is upstream authority for both PRD and architecture, and the epics implement all three coherently. There are zero hard gaps and zero critical violations.

The findings below are **traceability-tightening items** for an already-shippable plan, not blockers. Sandy may choose to act on them or proceed as-is; if proceeding as-is, the items are likely to surface organically during story refinement.

### Findings Inventory

**Coverage gaps (Step 3):**
- G1 — FR-28 (no sharing/multi-user) lacks an explicit audit AC
- G2 — FR-29 setlist history preservation lacks a "no purging mechanism" verification
- G3 — NFR-11 (encryption at rest) is implicit for DDB; needs an explicit CDK assertion AC
- G4 — NFR-17/18 contrast ratios (7:1 / 4.5:1) lack an explicit audit AC against tokens
- G5 — NFR-22 per-gig annotation VoiceOver label is implicit
- G6 — NFR-24 iPhone 13 PWA platform values (390×844, 47/34pt insets, portrait-lock) are scattered across stories

**UX alignment watch-outs (Step 4):**
- S1 — EXPERIENCE.md still marks End-of-Setlist treatment as open; PRD has resolved it (FR-21 inert NEXT)
- S2 — EXPERIENCE.md doesn't specify the Wake Lock fallback indicator; PRD has resolved it (FR-18)
- S3 — EXPERIENCE.md's "Settings (if added)" reference predates the Q7 resolution (no Settings in V1)
- A1 — MacBook top-nav `New setlist` slot ambiguity between Story 1.5 and Story 3.4

**Story quality concerns (Step 5):**
- Q1 — Story 2.4 bundles sync foundation + client error reporter (orthogonal mechanisms; consider split)
- Q2 — Story 1.4 carries a deferred AC about `performanceActive`-gated 401 hold; partially testable in Epic 1
- Q3 — `PerformanceModeContext` provider creation is described in both Story 1.5 and Story 2.4 (clarify split)
- Q4 — Story 2.5's `+ New song` affordance is a documented mild divergence from PRD State Patterns; worth confirming
- Q5 — Story 3.6's drag-reorder keyboard-fallback offers two options without picking one
- Q6 — Story 1.3 IAM scoping is described generally; specific actions left to implementation
- Q7 — `blackout-check.ts` (infra) and `upcoming-gigs.ts` (api) share semantics that aren't pinned to one module

**Total: 17 minor items across 3 categories. Zero critical, zero major.**

### Critical Issues Requiring Immediate Action

**None.** The plan does not have show-stopping gaps that prevent starting implementation.

### Recommended Next Steps

In rough priority order — though all are optional:

1. **Light editing pass on EXPERIENCE.md (~30 min).** Address S1, S2, S3 by marking the resolved items with the PRD's resolution. This is documentation hygiene; the implementation will be correct regardless because the PRD and epics are authoritative. The benefit is that anyone reading EXPERIENCE.md in isolation (now or in V2) sees the resolved decisions inline, not stale open items.

2. **Tighten 4 coverage ACs (~45 min total).** Add explicit ACs for G1 (no-share audit in Story 1.5 or Story 5.2), G2 (no-purge verification in Story 3.1), G3 (DDB encryption-at-rest in Story 1.3), G4 (contrast-ratio measurement in Story 1.2). Each is a single-AC addition. None require re-architecture. G5 (VoiceOver labels) and G6 (iPhone-13 platform values consolidation) are nice-to-have but lower leverage.

3. **Resolve the 3 highest-leverage story-quality concerns (~30 min).**
   - **Q3 (PerformanceModeContext provider split):** Decide whether Story 1.5 creates a stub and 2.4 extends it, or Story 1.5 creates the full context and 2.4 only adds consumers. Update the two stories' ACs accordingly.
   - **Q2 (Story 1.4 deferred AC):** Either move the `performanceActive`-gated 401 hold AC fully into Story 4.1, or make the deferral explicit in Story 1.4 with a "see Story 4.1" note.
   - **A1 (MacBook top-nav `New setlist` slot):** Pin to one location (Story 1.5 chrome scaffold reserves the slot, or Story 3.4 owns it via a different surface affordance).

4. **Consider splitting Story 2.4 (~15 min).** The sync foundation half and the client-error-reporter half are independent. Splitting into 2.4a / 2.4b makes the FR-30/31/32 traceability cleaner and shortens the per-story review surface. Optional.

5. **The remaining items (Q4, Q5, Q6, Q7) are best resolved at the story-refinement stage** (e.g., immediately before each story enters implementation), not in a bulk pre-implementation pass. They're decisions that benefit from being made closer to the code.

6. **Start implementation when ready.** Story 1.1 is the entry point: pnpm workspace scaffold, Vite + React + TS + Tailwind v4, CDK skeleton, Hono skeleton, Zod schemas in shared. Per the architecture's Decision Impact Analysis, the implementation sequence is Story 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 (Epic 1 complete = deployed empty shell), then Epic 2 onwards.

### Standout Strengths of the Plan

These are worth flagging because they're unusual and load-bearing for V1's success:

- **The PRD ↔ UX ↔ Architecture reconciliation is already done.** The `reconcile-brief.md` / `reconcile-design.md` / `reconcile-experience.md` companions alongside the PRD make provenance auditable. Most projects skip this step and pay for it later.
- **The verified-restore ship gate (Story 5.2)** transforms FR-34 from a doc claim into an operational artifact (runbook + sign-off log + Playwright spec). This is unusual rigor at single-user scale and directly serves the brief's "no dependencies that can fail at 9pm" principle.
- **The deploy maintenance blackout (NFR-6 / Story 1.6)** is comprehensively storied with two-stage fail-closed semantics, named IANA TZ requirement, GMT/BST self-tests, and a venue-name-typing manual-override. This is a class of NFR usually under-storied.
- **The Performance Mode invariants (AR-28)** are a single source of truth for "what doesn't happen in Performance Mode" — and they're enforced in story ACs (Story 4.1 cache-only reads, Story 4.4 held-toast flush, Story 2.4 banner suppression). This pattern eliminates a class of cross-cutting bugs.
- **Negative-requirement ACs** ("no component renders an `End performance ›` button" / "no `tabindex`, no `cursor: pointer`, no `onClick` on the passive Band label") codify what shouldn't exist. They're auditable in code review and prevent silent regressions during V2 work.
- **Cross-epic forward dependencies are explicitly handled** with three named patterns: scaffold-with-default-OFF, deferred-AC-documented, and inert/empty-render. Every cross-epic dependency uses one of these — no informal coupling.

### Final Note

This assessment identified **17 minor items across 3 categories** (6 coverage gaps, 4 UX alignment watch-outs, 7 story quality concerns). Zero critical issues; zero major issues. The plan is **ready for implementation**.

Acting on the 5–10 recommended next steps would take ~2 hours total and tighten traceability before stories enter the implementation queue. Proceeding as-is is also reasonable — the items would surface during story refinement and can be resolved then. Sandy's call.

**Assessor:** Implementation Readiness Skill (BMad)
**Date:** 2026-06-09
**Project:** gigbuddy


