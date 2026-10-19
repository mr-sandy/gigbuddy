---
title: Sprint Change Proposal — Iterative reset to one responsive app
date: 2026-10-19
author: Sandy (with Claude, Correct Course workflow)
status: approved 2026-10-19 by Sandy — document edits applied
scope: Major (product direction + front-end rollback; back end unchanged)
---

# Sprint Change Proposal — Iterative reset to one responsive app

## 1. Issue summary

**Trigger.** After Epic 6 shipped (all six stories at `review`), Sandy started the manual review on iPhone. On 2026-10-05 the real Jack Ruby 5 repertoire was loaded from Apple Notes: 52 songs and 7 setlists, imported through `/api/v1` from 7 gig notes. With real material in the app, the app proved close to unusable.

**Evidence (all observed on the live app with real data):**

1. **Navigation is unclear and there is no obvious way home.** Sandy: "The navigation seems less intuitive than I'd thought we'd agreed. Also I can't find my way home."
2. **The iPhone home, library and tab bar were never designed.** The IA/journeys pass covered the MacBook (T1/T3/T4) and iPhone performance (P1) only. Epic 6 built P1 inside screens that still ran on Epic 1–3 scaffolding.
3. **Prose is rendered as chords.** The Story 6.1 parser treats any word starting with A–G as a chord, so `Blues` shows as B with "lues" raised, and the same happens to `Empty`, `Dorian` and `Classic`. Sandy's real charts mix chords and prose on purpose. The sample data never did.
4. **Performance notes are not shown on stage.** `performance-card.tsx` never renders `performanceNotes`. Sandy wants performance notes visible on the phone.

**Problem statement.** The issue type is a *failed approach that needs a different solution*. The long chain of PRD, architecture, epics, journeys, mockups and autonomous whole-epic runs meant Sandy's first real use came at the very end. Each artefact was careful, but none of them involved Sandy actually using the app, so basic usability problems surfaced only after about six epics of work. The MacBook/iPhone surface split also doubled the design surface: every screen needed two designs, and half of them were never drawn.

**Sandy's direction (2026-10-19):**

- Continue with BMAD, not ad-hoc coding.
- Work in short iteration loops from a tiny MVP. The first MVP is *just a landing page*, deliberately less than gig-ready.
- Mockups are welcome where they help.
- Keep manual testing to a minimum. Automated checks do the verifying; Sandy's part is a quick look.
- Build **one responsive app**. Drop the MacBook/iPhone split and its device-specific behaviour; optimise later.

## 2. Impact analysis

### 2.1 Epic impact

| Epic | Current status | Impact |
|---|---|---|
| 1 Foundation, Access Gate & Deploy | stories done, retro done (epic still marked in-progress) | **Kept.** Close as `done`. The two looks (Story 1.2), the nav scaffold (1.5) and the platform split are removed from the front end by Story 7.1. The infrastructure, auth and deploy pipeline stay as they are. |
| 2 Song Library & Sync Layer | stories done, retro done (epic still marked in-progress) | **Kept.** Close as `done`. The API, persistence, sync layer, service worker and data hooks stay. The install gate (2.2), library page (2.5) and Song Detail screen (2.6) are removed from the front end by Story 7.1. |
| 3 Setlists Home & Paste-to-Parse | done | **Superseded.** The API from Story 3.1 stays. The screens are removed and rebuilt slice by slice where still wanted. |
| 4 Performance Mode | done | **Superseded.** It was iPhone-only by design. Gig-ready performance features come back later as slices. |
| 5 Export & Restore | 5.1, 5.2 at `review` | **Kept.** The export endpoint stays, but the library-footer button goes with the library page. 5.2 (restore drill) stays deferred, as before. |
| 6 P1 Performance Enhancements | six stories at `review`, never accepted | **Superseded before acceptance.** The code is removed. The design thinking (detours, jump overlay, compact chord notation) stays as reference for later slices. |
| **7 Iterative rebuild (NEW)** | — | **New epic.** Thin vertical slices, one story at a time. Only the next one or two stories are written in detail. |

### 2.2 Story impact

- **Stories 6.1–6.6** do not move to `done`. They are recorded as superseded (see §4.5).
- **New Story 7.1** (front-end reset to a responsive landing page) and **Story 7.2** (review snapshots) are added.
- Later stories are **not** written up front. Likely candidates appear in §3.3 for orientation only.

### 2.3 Artefact conflicts

| Artefact | Conflict | Action |
|---|---|---|
| **PRD** (`prds/prd-gigbuddy-2026-06-09/prd.md`) | **Fundamental.** §1 Vision says Practice and Performance are *different surfaces on different devices*. FR-10 to FR-24, FR-26, FR-33, §5 non-goals, §6 MVP and §B Platform all assume that split. | Add a course-correction section, rewrite the Vision paragraph and the MVP, and mark the device-split FRs as parked. FR-1 to FR-5, FR-25 and FR-27 to FR-34 (data, sync, access, backup) are unchanged. See §4.1. |
| **Architecture** (`architecture.md`) | The back end, data, sync, auth, infrastructure, deploy and backup are **unaffected**. The front-end sections conflict: theme atmospheres, the iPhone install gate, Performance Mode invariants, pre-fetch rules, MacBook-only banners, and the `platform.ts`/`install-detect.ts` entries in the directory tree. | Add a course-correction section listing the superseded sections, and replace the "Theme atmosphere" section. See §4.2. |
| **UX** (`ux-designs/…/DESIGN.md`, `EXPERIENCE.md`, `journeys/*`, `mockups/*`, `ux/*`) | Every surface, flow and mockup is split by device. | Mark them as **reference, not contract**: a short banner at the top of DESIGN.md and EXPERIENCE.md. Journeys and mockups are left untouched as history. Visual tokens (type, colour) remain usable as raw material. See §4.3. |
| **CLAUDE.md** | It calls architecture.md "the contract" and says the epic-run workflow enforces commit subjects. | Add a working-agreement note: one story at a time, no epic runs, keep the commit convention. See §4.4. |
| **sprint-status.yaml** | It lists Epic 6 at `review`, and Epics 1–2 as `in-progress` although they are complete. | Update per §4.5. |

### 2.4 Technical impact

- **Back end (`api/`, `shared/`, `infra/`):** no change.
- **Front end (`web/src`, about 7,500 lines of non-test source):**
  - About 4,000 lines are screens and device-specific logic. These are **deleted** after a `pre-reset` git tag:
    - six routes
    - `performance/`
    - the jump overlay
    - the paste-to-parse UI and `paste-parse/`
    - bottom tabs and top nav
    - `lib/atmosphere.ts` and `lib/platform.ts`
    - the install gate and install-instructions page
    - the MacBook-only stale-write banner
    - the Song Detail screen and inline-edit field
  - About 3,500 lines of plumbing **stay**: `sync/`, `api/`, `auth/`, data hooks, `cache/`, the service worker and manifest, the error boundary and the error reporter.
- **E2E:** `e2e/smoke/shell.spec.ts` is updated to the new landing page. The restore-drill spec is unchanged.
- **Deploy blackout:** unchanged. Note that the test setlists carry made-up dates; a future-dated test gig within 24 hours will block deploys, as designed.
- **Production data:** unchanged. The 52 songs and 7 setlists stay and drive the new slices.

## 3. Recommended approach

### 3.1 Options considered

| Option | Viable? | Effort | Risk | Notes |
|---|---|---|---|---|
| 1. Direct adjustment (fix the screens in place) | No | High | High | Keeps the device split Sandy has rejected. Each fix inherits the undesigned surroundings. |
| 2. Rollback (remove the front-end screens) | Yes | Low | Low | A git tag keeps everything recoverable. The back end is untouched. |
| 3. MVP review (redefine the MVP) | Yes | Low | Low | Directly what Sandy asked for. |

**Selected: a hybrid of 2 and 3.** Redefine the MVP as a landing page, roll the front end back to it on top of the existing foundation, and rebuild in thin vertical slices.

**Rationale:**
- It keeps everything that is slow and risky to build and is working: the AWS stack, deploy pipeline, auth, sync, offline cache, export and backups.
- It discards only what failed, which is the screen design and the device split.
- The cheapest layer to change (screens) becomes the one that iterates.
- It shortens the loop from an epic to a single story, which addresses the root cause.

### 3.2 Working agreement (how each loop runs)

1. **One story at a time.** `bmad-create-story`, then `bmad-dev-story`, then `bmad-code-review`, then commit and deploy. **No `epic-run`.** One commit per story with the subject `Implement story X.Y: <title>` (unchanged).
2. **Each story is a thin, visible slice.** It must be deployable on its own and leave the app working.
3. **Mockups are optional per story.** Sandy decides when a slice deserves one.
4. **Verification is automated.** Unit tests, typecheck, lint and build, plus review snapshots at phone and laptop widths of the deployed screens (Story 7.2). **Sandy's part is a quick look**, giving a yes or a "change this". No AC checklists on the device.
5. **One responsive app.** No device detection and no device-specific features. Light/dark follows the device setting. Device-specific optimisation is a later, explicit decision.
6. **Real data first.** Slices are judged against the real Jack Ruby 5 repertoire already in production.
7. **Only the next one or two stories are specified.** The backlog beyond that is a list of candidates, re-prioritised after each loop.

### 3.3 Candidate next slices (orientation only, not committed)

These are decided one at a time after each loop:
- gigs list
- open a gig (its songs in order)
- read a song (chart, notes, key, patch, with prose shown as written)
- library with search
- edit a song
- create or edit a gig
- start reading a gig song by song

Earlier designs (P1 detours, the jump overlay, paste-to-parse, compact chord notation) can be restored from `pre-reset` if a slice needs them.

### 3.4 Effort, risk, timeline

- **Story 7.1:** small to medium, mostly deletion plus one small screen. **Story 7.2:** small.
- **Risk is low.** The back end is untouched, everything is recoverable from the tag, and production data is unaffected.
- **Timeline:** the first visible result, the landing page live on phone and laptop, comes in one loop.

## 4. Detailed change proposals

### 4.1 PRD — `prds/prd-gigbuddy-2026-06-09/prd.md`

**4.1.a Front matter**

```
OLD: status: final
     updated: 2026-06-09
NEW: status: final — amended 2026-10-19 (Sprint Change Proposal)
     updated: 2026-10-19
```

**4.1.b New section inserted after §0, "0a. Course correction 2026-10-19"**

```
NEW:
## 0a. Course correction (2026-10-19)

See `_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-19.md`.

- GigBuddy is now **one responsive app**. The MacBook/iPhone surface split (Practice vs Performance
  as device-bound surfaces, atmospheres by device, iPhone-only Performance Mode, install gate)
  is withdrawn. Device-specific optimisation is a later, explicit decision.
- The MVP is rebuilt in **thin vertical slices**, starting from a signed-in landing page.
  Requirements below that assume the device split are **parked**, not deleted: each is
  re-derived (or dropped) when a slice touches it.
- **Unchanged and in force:** FR-1–FR-5 (song record and fields), FR-25 (band scoping),
  FR-27–FR-28 (access), FR-29–FR-32 (persistence, optimistic writes, offline, LWW),
  FR-33 export *endpoint*, FR-34 backup, Appendix A NFRs except where they name a device.
- **Parked (device-split or screen-specific):** FR-6–FR-24, FR-26, and the device clauses of
  FR-3, FR-33, §5, §6.1 and §B.
```

**4.1.c §1 Vision, third paragraph**

```
OLD: Practice and Performance are not view modes the user toggles between. They are different
     surfaces — one on MacBook, one on iPhone — that share a single data store. The user moves
     between contexts by picking up a different device, not by hitting a switch. Implementations
     must honor this: a "view mode toggle" inside one surface would defeat the design.
NEW: ~~(struck through, retained for history)~~ — Superseded 2026-10-19: GigBuddy is one
     responsive app that works on any screen size. Practice and performance needs are met by the
     same app; any device-specific optimisation is a later, explicit decision (see §0a).
```

**4.1.d §6.1 MVP In Scope: replace the list**

```
OLD: (10 bullets: Song Library, Setlist creation via Paste-to-parse, Setlist overview,
     Performance Mode on iPhone, Practice Mode on both devices, MacBook web app + iPhone 13 PWA
     with light/dark per surface, access gate, export, backup, multi-band data model)
NEW:
- The MVP is grown slice by slice; the first slice is a signed-in, responsive landing page
  showing the band and live song/gig counts (Story 7.1).
- Already delivered and retained: access gate, canonical persistence + sync + offline cache,
  song and setlist APIs, JSON export endpoint, automated backup, multi-band data model.
- Each subsequent slice is chosen after the previous one is live and Sandy has looked at it.
- Gig-ready performance features are in scope for the product but not for the first slices.
```

**4.1.e §B Platform: replace**

```
OLD: MacBook web app (…) / iPhone 13 PWA (…) / PWA installation is required for the iPhone
     surface (…) / No tablet, no desktop-native, no Android, no other phones in V1.
NEW: One responsive web app (installable as a PWA, not required). Must be usable from
     ~360pt phone width up to ~1680pt laptop width with no horizontal scroll. Primary devices
     are Sandy's iPhone and MacBook; no device-specific behaviour. Light/dark follows the
     device's system setting.
```

**4.1.f §5 Non-goals, two bullets amended**

```
OLD: - Surface a user-facing theme toggle in V1 chrome. Light Practice / dark Performance are
       surface defaults, not user-selectable variants.
NEW: - Surface a user-facing theme toggle. Light/dark follows the device's system setting.

OLD: - Import Apple Notes or any other source format beyond plain-text paste.
NEW: - Provide an in-app Apple Notes importer. (A one-off import script was used on 2026-10-05
       to load real repertoire for testing; it is not a product feature.)
```

### 4.2 Architecture — `architecture.md`

**4.2.a New section inserted after the title, "Course correction 2026-10-19"**

```
NEW:
## Course correction (2026-10-19)

See `sprint-change-proposal-2026-10-19.md`. The back-end, data, sync, auth, infrastructure,
deploy, blackout and backup decisions in this document are **unchanged and in force**.

Front-end decisions **superseded** (one responsive app, no device split):
- Theme atmosphere (practice/performance by device) → replaced; see "Theme atmosphere" below.
- iPhone install-detection gate (§4 Sync & Offline bullet; `install-detect.ts`, `platform.ts`).
- Performance Mode invariants and Performance-Mode pre-fetch rules — parked until a slice
  reintroduces performance reading; the offline cache itself (TanStack persist + outbox) stays.
- MacBook-only banners (stale-write, reauth) — any banner that returns is device-agnostic.
- Directory-tree entries for removed screens/components (see Story 7.1 File List).

Front-end code removed by Story 7.1 is preserved at git tag `pre-reset`.
```

**4.2.b "Theme atmosphere" section: replace body**

```
OLD: - Tailwind v4 `@theme` block per atmosphere in `web/src/styles/tokens.css`
     - Selector: `<html data-atmosphere="practice">` or `<html data-atmosphere="performance">`
     - Default on MacBook: `practice`. Default on iPhone outside Performance Mode: `performance`. (…)
     - **No user toggle** (per PRD §5)
     - Practice tokens lifted from `DESIGN.md` Practice palette; Performance tokens from Club Warm palette
     - Both atmospheres ship in every bundle; switched via CSS variable scope, no JS theme provider
NEW: ### Theme (amended 2026-10-19)
     - One token set in `web/src/styles/tokens.css` with a light and a dark variant.
     - Variant chosen by `@media (prefers-color-scheme: dark)` — the device's system setting.
     - No `data-atmosphere`, no device detection, no JS theme provider, no user toggle.
     - Light values may be lifted from the DESIGN.md Practice palette and dark from Club Warm,
       as raw material — not as a device-bound contract.
```

### 4.3 UX: `DESIGN.md` and `EXPERIENCE.md` (banner at the top of each)

```
NEW (inserted after the title):
> **Status 2026-10-19: reference, not contract.** Superseded as a specification by
> `sprint-change-proposal-2026-10-19.md` (one responsive app, iterative slices). Visual tokens,
> type choices and interaction ideas here remain available as raw material for future slices.
```

Journey docs, mockup briefs and rendered mockups are left untouched as history.

### 4.4 CLAUDE.md

```
ADD under "Story workflow":
5. Since 2026-10-19 (Sprint Change Proposal): work one story at a time —
   create-story → dev-story → code-review → commit → deploy → review snapshots → Sandy's
   quick look → `done`. Do not use `epic-run`. One responsive app: no device detection or
   device-specific behaviour.

CHANGE in "Commit cadence":
OLD: (the epic-run workflow enforces this)
NEW: (convention; previously enforced by the epic-run workflow, which is no longer used)
```

### 4.5 Epics (`epics.md`) and sprint status

**4.5.a `epics.md` Epic List: add a status note under Epics 3, 4 and 6**

```
NEW (one line under each heading):
> **Superseded 2026-10-19** by the iterative reset (sprint-change-proposal-2026-10-19.md).
> Retained as history; code at git tag `pre-reset`.
```

**4.5.b `epics.md`: append Epic 7 and its first two stories**

```
NEW:
## Epic 7: Iterative rebuild — one responsive app

Grow GigBuddy in thin, deployable slices on top of the Epic 1–2 foundation, judged against the
real Jack Ruby 5 repertoire. One story at a time; only the next one or two stories are
specified. Each story ends with review snapshots and Sandy's quick look — no device checklists.

### Story 7.1: Front-end reset to a responsive landing page

As Sandy, I want GigBuddy to open on one simple page that works on my phone and my laptop,
so that we have a clean, working base to grow from.

**Acceptance criteria**
1. Before any deletion, the current `main` commit is tagged `pre-reset` and the tag is pushed.
2. Signed in, `/` shows "GigBuddy", the band name "The Jack Ruby 5", and live counts from the
   API in the form `52 songs · 7 gigs` (values from data, not hard-coded). While loading it
   shows a plain loading line; on error a plain one-sentence message.
3. Signed out, any URL shows the existing login; after login the user lands on `/`.
   Any other path redirects to `/`.
4. One layout for all screen sizes: readable with no horizontal scroll from 360px to 1680px
   wide. No device detection anywhere in `web/src` (`lib/platform.ts`, `lib/atmosphere.ts`,
   install gate and install-instructions removed).
5. Light/dark follows `prefers-color-scheme`; one token set with two variants; text contrast
   meets WCAG AA in both.
6. Removed from `web/src` (with their tests): the library, song, setlist, setlist-creation and
   performance routes; `performance/`; `paste-parse/`; jump overlay; bottom tabs; top nav;
   band label; currently-performing strip; MacBook-only banners; components and hooks used
   only by removed code.
7. Kept and still passing their tests: `sync/`, `api/`, `auth/`, `cache/`, data hooks
   (`use-songs`, `use-setlists`, mutations), error boundary, error reporter, service worker
   and manifest. No change to `api/`, `shared/` or `infra/`.
8. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass; `e2e/smoke` is updated
   to the landing page and passes.
9. Deployed to gig.cormie.com via the normal pipeline.

### Story 7.2: Review snapshots of the deployed app

As Sandy, I want each change shown to me as phone- and laptop-sized screenshots of the live
app, so that reviewing a story is a quick look rather than a test session.

**Acceptance criteria**
1. One command (e.g. `pnpm review:snap`) signs in to gig.cormie.com using a password read
   from the environment or macOS Keychain (never committed, never printed), and captures every
   current screen at 390×844 (dark) and 1440×900 (light).
2. Screenshots are written to a git-ignored folder, named by screen and size, and the command
   prints the folder path.
3. The command is documented in README.md and referenced from CLAUDE.md as the last step of
   every story ("review snapshots").
4. Running it after Story 7.1 produces the landing page in both sizes.
```

**4.5.c `sprint-status.yaml`**

```
epic-1: in-progress  →  done
epic-2: in-progress  →  done
# Epics 3, 4: unchanged (`done`), add comment "# superseded 2026-10-19 — code at tag pre-reset"
# Epic 6: block replaced by comment:
#   Epic 6 (P1 Performance-Mode Enhancements) — superseded 2026-10-19 before acceptance
#   (stories 6.1–6.6 were at `review`). Code at tag pre-reset. See sprint-change-proposal-2026-10-19.md.
# Epic 5: unchanged (5.1 review — endpoint retained, footer UI removed by 7.1; 5.2 review, drill deferred)
NEW:
  # Epic 7: Iterative rebuild — one responsive app
  epic-7: in-progress
  7-1-front-end-reset-to-responsive-landing-page: backlog
  7-2-review-snapshots-of-deployed-app: backlog
  epic-7-retrospective: optional
```

*Note: sprint-status only allows the values backlog, ready-for-dev, in-progress, review and done, so Epic 6 is recorded as a comment rather than given a made-up `superseded` status.*

## 5. Implementation handoff

**Scope classification: Major.** It changes product direction, so the PRD and architecture are amended. It is small in execution, because the back end is untouched.

| Role | Responsibility | Deliverable |
|---|---|---|
| PM / Architect (this workflow, on approval) | Apply the document edits in §4.1–4.4 and §4.5.a–b. Update sprint-status (§4.5.c). | Amended PRD, architecture, UX banners, CLAUDE.md, epics.md, sprint-status.yaml, in one commit: `Apply sprint change proposal 2026-10-19` |
| SM (`bmad-create-story`) | Write the Story 7.1 spec from §4.5.b. | `implementation-artifacts/7-1-front-end-reset-to-responsive-landing-page.md` |
| Dev (`bmad-dev-story`, then `bmad-code-review`) | Implement and review 7.1, commit, deploy. Then the same for 7.2. | Landing page live, then the snapshot command |
| Sandy | A quick look at the landing page on phone and laptop. Pick the next slice. | Yes, or "change this" |

**Success criteria:**
- The landing page is live at gig.cormie.com, showing the real counts.
- It works on iPhone and MacBook with the same code.
- There is no device-detection code in `web/src`.
- The `pre-reset` tag exists.
- The back-end tests are unchanged and passing.
- Sandy's review of the change takes minutes, not a test session.
