---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-gigbuddy-2026-06-09/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md
---

# GigBuddy - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for GigBuddy, decomposing requirements from the PRD, Architecture, and UX Design (DESIGN.md + EXPERIENCE.md) into implementable stories.

## Requirements Inventory

### Functional Requirements

Verbatim from PRD §4. IDs are stable; downstream stories reference these.

**Song Library (§4.1)**
- **FR-1** — Create a Song in the active Band's Library with a title. All other fields optional and may be added later.
- **FR-2** — Edit a Song inline (click/tap into field, type, tap away). No edit mode, no save button. Saves debounced and silent.
- **FR-3** — View Song Detail surface (reached by tapping any Song row in Library or Setlist). View and edit are the same surface.
- **FR-4** — List Songs in the Library alphabetically by title for the active Band.
- **FR-5** — Song record structure: Title (required), Key, Patch, Chord chart, Performance notes, Practice notes — with surface-scoping (Performance vs Practice fields) per the PRD table. Chord chart has light typographic parsing (`{...}` lines as section breaks, blank lines preserved, URLs tappable in Practice only).

**Setlist Management (§4.2)**
- **FR-6** — Create a Setlist by providing Gig metadata (venue, date, time) and either pasting raw text or adding Songs manually.
- **FR-7** — Paste-to-parse: parse pasted text into Sections (free-text names) and Song rows; match each row against the active Library, labelled Matched / Fuzzy / Unknown. Glyph + label + color triple (color never sole signal).
- **FR-8** — Resolve Fuzzy match inline: single-tap accept (`Yes, that one`) or reject (`No — new song`, converts row to Unknown). V1 returns top-1 candidate only.
- **FR-9** — Resolve Unknown inline: single-tap `+ Add to library` creates a minimal Song record (title only) and converts the row to Matched.
- **FR-10** — Section structure: free-text names; renameable inline on MacBook; static on iPhone. Default single Section when none inferable.
- **FR-11** — Per-gig annotation attached to a (Setlist, Song) pair; never modifies the Song record; visible on Setlist overview row and Performance Card for that Song in that Setlist only. Inline edit on MacBook; sheet on iPhone.
- **FR-12** — Reorder Songs within a Setlist by drag (MacBook only). Drag handle visible on row hover. Not available on iPhone in V1.
- **FR-13** — View Setlist overview: Gig metadata, Sections, Song rows, per-gig annotations, and a "Currently performing" strip when active. iPhone shows a fixed-bottom `Start performance ›` CTA always visible.
- **FR-14** — List Setlists by date: one scrollable sectioned list (Tonight, Upcoming, Past). Tonight slot follows defined fallback rules; Past in reverse chronological order.

**Performance Mode (§4.3)**
- **FR-15** — Enter Performance Mode by tapping `Start performance ›` on iPhone Setlist overview (only entry path). Single tap, no confirm. Lands on first Song of first non-empty Section. Tabs hide on entry.
- **FR-16** — Performance Card three-region layout: fixed top (title, key, patch), scrollable middle (chord chart + per-gig annotation), fixed bottom toolbar (`‹`, `NEXT ›`, next-song preview). Sparse content renders without reflow.
- **FR-17** — Advance/back via single tap. `NEXT ›` advances across Section boundaries; `‹` returns to previous. No swipe, no tap-anywhere, no edge zones. Transitions <150ms; `prefers-reduced-motion` collapses to instant.
- **FR-18** — Wake Lock acquired on entry; best-effort maintain (reacquire on every foreground and after detected release events); released on exit and navigate-away. Persistent static indicator on Performance Card when not held. Backoff on persistent failure.
- **FR-19** — Exit Performance Mode via `×` (top-left, small ~28pt, low-emphasis). Performance state preserved on exit.
- **FR-20** — "Currently performing" strip on Setlist overview while Performance state is active; `Resume ›` returns to current Performance Card without changing Song index.
- **FR-21** — End Performance state only when user navigates away from the Setlist entirely. On the last Song, `NEXT ›` becomes inert (visibly disabled). No `End performance ›` button.
- **FR-22** — Backgrounding survives: re-opening lands on current Performance Card (not Home). Wake Lock reacquired on foregrounding if OS permits. No interstitial.

**Home & Gig Surfaces (§4.4)**
- **FR-23** — Setlists home is the default landing surface on both MacBook and iPhone: Tonight at top, Upcoming next, Past below — one scrollable sectioned list. Empty-state copy per PRD/EXPERIENCE.
- **FR-24** — Library is a top-level destination (bottom tab on iPhone, top-nav item on MacBook). Tapping a Library row opens Song Detail. Chrome hides when Performance Mode is active.

**Multi-Band Data Model (§4.5)**
- **FR-25** — Band scoping: every Song, Setlist, and Per-gig annotation is owned by exactly one Band. No cross-Band content. Data model permits any number of Bands; V1 contains The Jack Ruby 5.
- **FR-26** — No Band switcher in V1 chrome. MacBook header displays `GigBuddy · The Jack Ruby 5` as a passive (non-interactive) label. iPhone chrome does not display the Band label.

**Access Control (§4.6)**
- **FR-27** — Single-user access gate: lightweight mechanism preventing unauthenticated reads of any surface. Authenticates once per device; device-bound credential persists across browser restarts. No account-management UI. Gate is the only entry point.
- **FR-28** — No sharing or multi-user: no share affordance anywhere; no owner-other-than-Sandy concept.

**Persistence & Sync (§4.7)**
- **FR-29** — Canonical persistence in a single AWS-hosted store. Writes on one device visible on the other after sync. Setlist history preserved in full from day one (every Setlist played persists with its complete record so V2 analytics need no migration).
- **FR-30** — Optimistic local writes: UI shows new state immediately; writes propagate to canonical store in background. Save-failure surfaces a quiet error toast; displayed value remains optimistic until acknowledged. **Toasts suppressed during Performance Mode** — held and surfaced on exit.
- **FR-31** — Offline tolerance: writes queue locally, flush on reconnect; reads serve from local cache. No "you are offline" banner. A Performance Mode session can run end-to-end offline once Setlist + Songs are cached on entry. Persistent sync failure surfaces a quiet MacBook-only banner.
- **FR-32** — Last-write-wins conflict resolution per record (not per field). No user-facing conflict-resolution UI.

**Backup & Export (§4.8)**
- **FR-33** — Manual JSON export of all data (Bands, Songs, Setlists, Sections, Per-gig annotations, Gig metadata) as a single human-readable JSON archive. Reachable as a footer affordance on the Library page (MacBook only). No dedicated Settings surface in V1.
- **FR-34** — Automated at-least-daily backup with reasonable retention, restorable to the live store. ≤24h data-loss window; ≤2h restore-to-operational target. **A documented restore procedure exists and has been verified end-to-end at least once before V1 ships.**

### NonFunctional Requirements

Verbatim from PRD §A (cross-cutting NFRs) plus feature-scoped NFRs surfaced in §4.

**Performance (§A.1) — Performance Mode latency is a defect class, not polish.**
- **NFR-1** — Performance Card transitions (`NEXT ›`, `‹`) complete in under 150ms. `prefers-reduced-motion` collapses transitions to instant.
- **NFR-2** — Performance Card cold render (first display after `Start performance ›`) completes within 300ms on iPhone 13.
- **NFR-3** — Paste-to-parse renders the parsed result within 500ms of paste for a ~20-Song Setlist.
- **NFR-4** — Inline edits commit (debounced) within 200ms of blur.

**Reliability and operational floor (§A.2)**
- **NFR-5** — The product must be available during scheduled gig windows. The brief's success criterion "no dependencies that can fail at 9pm" is the operational floor.
- **NFR-6** — Routine maintenance — deploys, patches, cert renewals, dependency updates — must not be scheduled within 24h of any future Gig recorded in the system. Deploy automation enforces this by querying upcoming Gig dates at deploy time and blocking if any falls within the window. Static fallback when no Gig data is available: avoid Friday–Sunday 18:00–24:00 local.
- **NFR-7** — Performance Mode is never blocked by a sync error.
- **NFR-8** — A reachable internet connection is not a precondition for running a Performance Mode session whose Setlist and Songs were last loaded online.
- **NFR-9** — Best-effort availability outside scheduled gig windows; no fixed numeric SLO. Single-user, single-region.

**Security (§A.3)**
- **NFR-10** — All transport is HTTPS.
- **NFR-11** — All data at rest is encrypted using the data store's standard mechanism (AWS-managed encryption at rest).
- **NFR-12** — No secrets in client-side code or version control. Secrets via AWS-managed mechanisms (Secrets Manager / Parameter Store).
- **NFR-13** — Access gate (FR-27) is the only entry point. No unauthenticated read of any surface.

**Observability (§A.4)**
- **NFR-14** — Server-side error logging sufficient for personal diagnosis via standard AWS logging (CloudWatch).
- **NFR-15** — Client-side errors in Performance Mode are logged silently to a server endpoint when online; no in-app error display in Performance Mode beyond what FR-31 specifies.
- **NFR-16** — No user analytics, telemetry, or behavioral instrumentation.

**Accessibility (§A.5)**
- **NFR-17** — Performance Mode: WCAG AAA contrast (7:1+); body floor 18pt; primary content 32pt+.
- **NFR-18** — Practice Mode: WCAG AA (4.5:1); body floor 17–18pt.
- **NFR-19** — No information conveyed by color alone.
- **NFR-20** — Tap targets ≥ 44×44pt.
- **NFR-21** — `prefers-reduced-motion` honored throughout Performance Mode.
- **NFR-22** — VoiceOver labels on Paste-to-parse states, Performance Mode controls, position indicator, per-gig annotation.

**Platform (§B)**
- **NFR-23** — MacBook web app: current Safari, Chrome, Firefox. Layout assumes ~1280–1680pt-wide displays. Single-column vertical layout dominates.
- **NFR-24** — iPhone 13 PWA: 390 × 844pt viewport. 47pt top inset, 34pt bottom inset, 44×44pt minimum tap target. Portrait-locked in Performance Mode. Other iPhones render acceptably but not V1 test targets.
- **NFR-25** — PWA installation is required for the iPhone surface to grant Wake Lock and full-screen privileges.
- **NFR-26** — No tablet, no desktop-native, no Android, no other phones in V1.

**Feature-scoped NFRs (from PRD §4)**
- **NFR-27** — Wake Lock state indicator must not animate (per EXPERIENCE.md Interaction Primitives — no animations longer than 150ms in Performance Mode).
- **NFR-28** — Wake Lock reacquisition attempts must back off appropriately on persistent failure (no tight loop).

### Additional Requirements

Technical/architectural requirements from the Architecture document that shape epic and story creation. These are **NOT alternative FRs** — they constrain implementation of the FRs.

**Foundation, scaffold, and toolchain**
- AR-1 — Monorepo via pnpm workspace; five packages: `web/`, `api/`, `shared/`, `infra/`, `e2e/`. No monorepo build tool (no Turborepo/Nx).
- AR-2 — Frontend stack: Vite 6 + React 19 + React Router 7 + TypeScript strict + Tailwind CSS v4 (`@theme` tokens) + TanStack Query v5 + vite-plugin-pwa (Workbox).
- AR-3 — Backend stack: TypeScript on Node 22, Hono on Lambda Function URL (ARM64 Graviton, 512MB), esbuild-bundled (<1MB zip target, <200ms cold-start target).
- AR-4 — Shared package: Zod schemas as the single contract source of truth for both ends (`SongSchema`, `SetlistSchema` with nested `SectionSchema` and `SongRefSchema`, response envelopes).
- AR-5 — Tooling: Biome (lint + format), TypeScript strict mode everywhere, Vitest + React Testing Library, Playwright (`e2e/smoke/` + `e2e/restore/`).
- AR-6 — Repo scaffold is the first implementation story; Tailwind v4, vite-plugin-pwa, TanStack Query v5, React Router 7, Zod, Hono, Biome installed.

**AWS infrastructure (AWS CDK v2, TypeScript, eu-west-2)**
- AR-7 — CDK stacks: `web` (S3 + CloudFront + ACM + Route 53 + CAA + WAF rate-limit), `api` (Lambda Function URL + IAM + SSM params), `data` (DDB + PITR + AWS Backup vault + DeletionProtection), `observability` (CloudTrail + Budgets alarms), `ci` (OIDC role for GitHub Actions).
- AR-8 — Single CloudFront distribution with two behaviors: `/api/*` → Lambda Function URL origin (CachingDisabled, forwards Cookie + Authorization); default → S3 origin via OAC (CachingOptimized).
- AR-9 — DynamoDB `gigbuddy-data` single-table, on-demand billing, PITR enabled. Item shapes per architecture.md Decision 2. Setlist content embedded (sections + song refs + annotations) for atomic LWW writes.
- AR-10 — GSI1 — Setlists by date — `gsi1pk = BAND#<bandId>#SETLIST_BY_DATE`, `gsi1sk = <isoDate>#<setlistId>`.
- AR-11 — Each Setlist song ref carries `titleSnapshot` so renaming a Song does not rewrite historical Setlists (V2-mineable history without migration).
- AR-12 — DynamoDB `DeletionProtection: true`; CDK termination protection on the data stack; no admin-delete endpoints in V1.
- AR-13 — Backup: DDB PITR (35-day continuous) + AWS Backup daily plan (365-day retention, cold-storage transition at 30 days), KMS-managed Backup Vault in eu-west-2.
- AR-14 — **Verified-restore release gate**: restore-pitr.md runbook is executed end-to-end before V1 ships (seed canary → restore via PITR to side table → validate → swap env to restored table → confirm → swap back). Ship-blocking story.

**Access gate**
- AR-15 — App-level single-password gate: argon2id-hashed password in SSM Parameter Store SecureString; `POST /api/v1/auth/login` verifies and sets `gigbuddy_session` cookie (HTTP-only, Secure, SameSite=Strict, 365-day expiry, signed JWT HS256, key from SSM).
- AR-16 — Hono middleware enforces cookie on all `/api/*` routes; SPA bundle public; `/api/v1/me` distinguishes "offline → cache" from "online + 401 → login".
- AR-17 — JWT signing key fetched at Lambda cold-start, cached in module-scope memory; never in env vars, never logged, never returned in responses. SSM password hash handled the same way. Manual rotation = redeploy.
- AR-18 — Cookie expiry-within-30-days triggers a foreground-on-MacBook reminder banner.
- AR-19 — Sandy generates a ≥20-char random password (onboarding runbook).

**Sync & offline**
- AR-20 — TanStack Query v5 read cache persisted to IndexedDB. Custom IndexedDB outbox for optimistic writes with **per-record coalescing** (max 2 entries per recordKey: one in-flight, one pending). Outbox state machine per architecture.md §Outbox state machine.
- AR-21 — `navigator.storage.persist()` requested on app boot (iOS Safari eviction protection).
- AR-22 — iPhone PWA install gate: SPA detects `display-mode: standalone` / `navigator.standalone`; routes to install-instructions screen before Performance Mode is reachable.
- AR-23 — LWW comparison server-side on `clientWrittenAt` per record; **whole-record PUT semantics** (Setlist PUT replaces embedded sections+songs+annotations atomically). Stale-write response: `{status: 'dropped-as-stale', currentState}`; client invalidates cache, refreshes, quiet MacBook banner (silent on iPhone in Performance Mode).
- AR-24 — Every response includes `x-server-now: <ISO-8601>` header; client warns on `|serverNow - Date.now()| > 30s` (clock-skew diagnostic).
- AR-25 — Pre-fetch rules: (a) every iPhone foreground checks if a Gig falls within 24h and pre-fetches its Setlist + every referenced Song; (b) `Start performance ›` synchronously prefetches Setlist + every referenced Song before navigation.

**Service worker (Workbox via vite-plugin-pwa)**
- AR-26 — Strategy table: `/api/v1/auth/*`, `/api/v1/me`, `/api/v1/health` → **NetworkOnly**; GET `/api/v1/songs/*`, `/api/v1/setlists/*` → **NetworkFirst** (`api-cache-v1`); POST/PUT/DELETE `/api/v1/*` → **NetworkOnly** (outbox owns offline writes); `*.js`, `*.css`, `*.woff2` → **CacheFirst** (`static-cache-v1`); `/index.html` → **NetworkFirst** (`app-shell-v1`).
- AR-27 — SW config `skipWaiting: false`, `clientsClaim: false` — new SW installs but waits for clean cold-start to activate. Belt-and-braces against mid-gig activation.

**Performance Mode invariants**
- AR-28 — `performanceActive` boolean in `PerformanceModeContext` is the single source of truth. While `true`: no toasts, no banners, no auth-failure redirects, no SW activation, reads from cache only, Wake Lock held (FR-18 indicator if released). Performance Mode renders from cache regardless of auth status.

**Deploy automation + gig-window blackout**
- AR-29 — GitHub Actions pipeline (`.github/workflows/deploy.yml`) with **two-stage blackout check** (fail-closed on any infra error). Stage 1 probe (`DescribeTable`); Stage 2 query upcoming Gigs within 24h Europe/London. Zero records → static fallback (Fri–Sun 18:00–24:00). Script: `infra/scripts/blackout-check.ts`. Named TZ `Europe/London` (BST + GMT covered).
- AR-30 — Manual override workflow (`deploy-force.yml`): `workflow_dispatch` with required `reason` + venue-name typing as second confirmation when blocking Gigs exist within 24h. Logged.
- AR-31 — OIDC trust policy scoped to `repo:<owner>/gigbuddy:ref:refs/heads/main` — PR runners cannot assume the deploy role. No long-lived AWS keys anywhere.

**Operational guardrails**
- AR-32 — AWS Budgets alarms at $5/mo and $20/mo (email Sandy).
- AR-33 — Lambda reserved concurrency = 50 (caps blast radius).
- AR-34 — CloudFront WAF rate-limit rule: 100 requests per IP per 5 min (429 response).
- AR-35 — CloudWatch Logs retention: Lambda 14 days, CloudFront access logs 30 days. CloudTrail to S3 90-day then Glacier.
- AR-36 — CAA DNS record restricting cert issuance to `amazon.com` (ACM).
- AR-37 — All DNS via CDK / Route 53 (IaC).

**Endpoints required beyond CRUD**
- AR-38 — `GET /api/v1/export` — single JSON archive of all data, authenticated, served via Library page footer (MacBook). Schema-versioned.
- AR-39 — `POST /api/v1/client-errors` — fire-and-forget client error reporter (window.onerror, unhandledrejection, React ErrorBoundary). Server writes a structured CloudWatch log line. Failure silent. (Satisfies NFR-15.)
- AR-40 — `GET /api/v1/upcoming-gigs` — used by deploy blackout check.
- AR-41 — `GET /api/v1/health` — Lambda reachability check used by deploy smoke test.

**Architectural boundaries (enforce in code review)**
- AR-42 — All DDB access via `api/src/ddb/*` wrappers; routes never import raw `@aws-sdk/client-dynamodb`.
- AR-43 — All SSM access via `api/src/secrets/ssm.ts` (cold-start fetch + module-scope cache).
- AR-44 — Logger middleware redacts known secret param names.
- AR-45 — Sync layer is consumed via hooks (`useSong()`, `useSetlist()`, `useSongMutation()`); UI never imports `sync/outbox.ts` directly.
- AR-46 — No analytics SDK. No Redux/Zustand/Jotai. No CSS-in-JS. No form library.

**ID and timestamp conventions**
- AR-47 — IDs use NanoID (16-char URL-safe); never UUIDs or auto-incrementing ints.
- AR-48 — All timestamps ISO-8601 UTC. Wire format `camelCase`. DDB key prefixes `SCREAMING_SNAKE_CASE` with `#` separator.

### UX Design Requirements

Cross-cutting UX work items distilled from DESIGN.md and EXPERIENCE.md. Each UX-DR is implementation-shaped and generates testable acceptance criteria. Behavioral encoding of feature surfaces lives in the FRs (which already reference EXPERIENCE.md throughout); the UX-DRs below capture *visual-system* and *consistency* work that would otherwise fragment across feature stories.

- **UX-DR1** — **Design tokens (Tailwind v4 `@theme`).** Lift precise hex values from `DESIGN.md` Colors (Performance "Club Warm" + Practice "warm paper cream" palettes including `accent`, `attention-fuzzy`, `attention-unknown`, `surface`, `bg`, `text-secondary`, etc.); type scale from `DESIGN.md` §Scale (`perf-title` ≥36pt, key/patch 22pt, body floor 18pt for Performance; `home-tonight`, `section-heading`, etc. for Practice); spacing from §Layout (4pt base unit + standard sizes); elevation rules (max 4pt shadow); shapes (`rounded.chord-glyph` and other corner radii). Output: `web/src/styles/tokens.css` with `@theme` blocks per atmosphere.

- **UX-DR2** — **Typography face selection and loading.** Pick final `serif-editorial` (e.g., open-source editorial serif) and `mono-slab` faces per `DESIGN.md` §Typography. Self-host font files (no external font CDN — CAA/security alignment). Subset to required glyphs. Provide fallback stacks.

- **UX-DR3** — **Two-atmosphere theme system.** `<html data-atmosphere="practice">` or `<html data-atmosphere="performance">` selector switches CSS variable scope only — no JS theme provider. Defaults: `practice` on MacBook; `performance` on iPhone outside Performance Mode; `performance` inside Performance Mode (already). Both atmospheres ship in every bundle. **No user-facing theme toggle** (per PRD §5).

- **UX-DR4** — **Reusable component library.** Implement the 12 named components from `DESIGN.md` §Components × `EXPERIENCE.md` §Component Patterns: `GigCard` (with optional `TONIGHT` badge); `SectionHeading` (small-caps editorial serif, inline-rename on MacBook); `SongRow (setlist)` (with per-gig annotation subline + MacBook drag handle on hover); `SongRow (library)` (quiet, title-only); `InlineEditField` (no border in display, accent underline on focus in Practice / accent glow in Performance); `ParseRowStatus` (icon + label + color triple for matched / fuzzy / unknown); `Start performance ›` CTA (bottom-fixed full-width, ≥64pt tall); `PerformanceCard` regions (top chrome / scrollable middle / bottom toolbar with `‹`, `NEXT ›`, next-song preview); `× exit` (top-left, ~28pt icon, low emphasis); `CurrentlyPerformingStrip` (top-anchored, accent background, `Resume ›` right-aligned, ~48pt tall); `BandLabel` (passive MacBook header text); `BottomTabs` (iPhone, two tabs).

- **UX-DR5** — **Chord chart V1 floor rendering.** Monospaced text run with light typographic parsing: `{...}`-wrapped lines render as visual section breaks; blank lines preserved as breathing space; URLs tappable in Practice only (suppressed in Performance per FR-5). Implementation must not require structured chord input — the field is free-text. Aspirational chord-glyph card grid is out of scope for V1 floor.

- **UX-DR6** — **Accessibility implementation primitives.** `aria-label` on icon-only controls (`×` exit, `‹` back, `NEXT ›`, position indicator); `aria-labelledby` preferred where descriptive text is already visible; `aria-live="polite"` on Paste-to-parse status rows; `aria-live="assertive"` on the Wake-Lock-not-held indicator (FR-18); focus management on Performance Mode entry (move focus to `NEXT ›`) and exit-via-× (restore focus to the row being performed); `prefers-reduced-motion` CSS rule in `globals.css` zeroing transitions/animations; tap-target Tailwind tokens `--size-tap: 44pt` with components using `min-w-tap min-h-tap`; color-never-alone enforced by component contract (`ParseRowStatus` and per-gig annotation pair color with glyph + label or italic weight + position).

- **UX-DR7** — **Voice and tone consistency for microcopy.** All user-facing strings (empty states, error toasts, button labels, banners) follow `EXPERIENCE.md` §Voice and Tone: short complete sentences; no exclamation marks; no emoji; no marketing voice; no encouragement layer. Empty-state copy locked: `No songs in this library yet.`, `No upcoming gigs.`, etc. Apply across all surfaces — review by audit, not feature-by-feature.

- **UX-DR8** — **iPhone install instructions screen.** When `display-mode` is not `standalone` and platform is iPhone, the SPA renders an install-instructions surface explaining how to add GigBuddy to the home screen. Performance Mode is unreachable until installed (per AR-22 / NFR-25). Copy and visual treatment follow Voice & Tone and DESIGN.md (UX-DR7, UX-DR1).

- **UX-DR9** — **Spatial-separation safety rule for performance controls.** `× exit`, `‹ back`, and `NEXT ›` are never placed in the same corner. Encoded as a component-layout invariant on `PerformanceCard`, surfaced in the component test plan. (DESIGN.md Don'ts.)

### FR Coverage Map

- **FR-1** — Epic 2 — Create a Song
- **FR-2** — Epic 2 — Inline edit, silent debounced save
- **FR-3** — Epic 2 — Song Detail surface (view = edit)
- **FR-4** — Epic 2 — Alphabetical Library list
- **FR-5** — Epic 2 — Song record structure with Performance/Practice field surfacing
- **FR-6** — Epic 3 — Setlist creation (gig metadata + paste OR manual)
- **FR-7** — Epic 3 — Paste-to-parse → Sections + Matched/Fuzzy/Unknown
- **FR-8** — Epic 3 — Resolve Fuzzy match inline
- **FR-9** — Epic 3 — Resolve Unknown inline (`+ Add to library`)
- **FR-10** — Epic 3 — Section structure (free-text names, rename on MacBook)
- **FR-11** — Epic 3 — Per-gig annotation on (Setlist, Song)
- **FR-12** — Epic 3 — MacBook drag-reorder within Setlist
- **FR-13** — Epic 3 — Setlist overview surface
- **FR-14** — Epic 3 — Setlists list by date (Tonight / Upcoming / Past)
- **FR-15** — Epic 4 — Enter Performance Mode (`Start performance ›`)
- **FR-16** — Epic 4 — Performance Card three-region layout
- **FR-17** — Epic 4 — Single-tap advance/back across Section boundaries
- **FR-18** — Epic 4 — Wake Lock with persistent indicator on loss
- **FR-19** — Epic 4 — Exit Performance Mode via `×` (state preserved)
- **FR-20** — Epic 4 — "Currently performing" strip + `Resume ›`
- **FR-21** — Epic 4 — End state on navigate-away; last-song `NEXT ›` inert
- **FR-22** — Epic 4 — Backgrounding survives
- **FR-23** — Epic 3 — Setlists home default landing surface
- **FR-24** — Epic 1 — Library top-level destination + navigation chrome scaffold _(chrome-hide-on-Performance is implemented as part of FR-15 in Epic 4)_
- **FR-25** — Epic 1 — Band scoping in the data model
- **FR-26** — Epic 1 — Passive Band label, no switcher in V1
- **FR-27** — Epic 1 — Single-user access gate (password + JWT cookie)
- **FR-28** — Epic 1 — No sharing or multi-user
- **FR-29** — Epic 2 — Canonical persistence + Setlist-history-from-day-one
- **FR-30** — Epic 2 — Optimistic local writes + held toasts in Performance Mode
- **FR-31** — Epic 2 — Offline tolerance (no banner; performance-session offline-capable)
- **FR-32** — Epic 2 — LWW conflict resolution per record
- **FR-33** — Epic 5 — Manual JSON export from Library footer (MacBook)
- **FR-34** — Epic 1 (backup infra) + Epic 5 (verified-restore drill ship-gate)

## Epic List

### Epic 1: Foundation, Access Gate & Deploy Pipeline

Deliver a deployed, password-gated, empty shell of GigBuddy at Sandy's URL. Both navigation destinations (Setlists, Library) are reachable but empty. Backups run nightly. CI deploys from `main` with the two-stage blackout check and manual-override workflow. The design system foundation (tokens, typography, atmospheres, accessibility primitives, voice & tone baseline) is in place. AWS account is hardened (CloudTrail, Budgets, WAF, reserved concurrency, CAA, OIDC).

**User outcome:** Sandy can log in to a real, trusted URL. The tool exists at a deploy-protected endpoint with a working backup story.

**FRs covered:** FR-24, FR-25, FR-26, FR-27, FR-28, FR-34 (backup infra; verified-restore drill is the ship-gate story in Epic 5)

**Key NFRs:** NFR-5, NFR-6, NFR-9, NFR-10, NFR-11, NFR-12, NFR-13, NFR-14, NFR-16, NFR-17, NFR-18, NFR-19, NFR-20, NFR-21, NFR-22, NFR-23, NFR-24, NFR-25, NFR-26

**Key ARs:** AR-1 to AR-8, AR-12, AR-13, AR-15 to AR-19, AR-29 to AR-37, AR-41, AR-46, AR-47, AR-48

**Key UX-DRs:** UX-DR1 (tokens), UX-DR2 (typography), UX-DR3 (atmospheres), UX-DR6 (accessibility primitives), UX-DR7 (voice & tone baseline)

---

### Epic 2: Song Library & Sync Layer

Deliver inline-edit Song records on both surfaces. Sandy creates, views, edits, and lists Songs in his Library with silent debounced save. The sync layer is wired end-to-end: TanStack Query cache persisted to IndexedDB, optimistic local writes via an outbox with per-record coalescing, server-side LWW on `clientWrittenAt`, stale-write banner on MacBook, full offline tolerance. iPhone PWA install gate enforces standalone mode; `navigator.storage.persist()` protects the outbox.

**User outcome:** Sandy can populate his Library by hand. Every edit is captured silently. Writes survive offline. Conflicts resolve LWW. The Library is now a place to capture careful notes.

**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-29, FR-30, FR-31, FR-32

**Key NFRs:** NFR-4, NFR-7, NFR-8, NFR-15

**Key ARs:** AR-9, AR-10, AR-11, AR-20, AR-21, AR-22, AR-23, AR-24, AR-26, AR-27, AR-39, AR-42, AR-43, AR-44, AR-45

**Key UX-DRs:** UX-DR4 (InlineEditField, SongRow library), UX-DR5 (chord chart V1 floor), UX-DR8 (iPhone install gate)

---

### Epic 3: Setlists Home, Paste-to-Parse & Setlist Management

Deliver the Setlists home surface (Tonight slot + Upcoming + Past) and end-to-end Setlist creation and management. Sandy creates a new Setlist with Gig metadata, pastes raw text from any source, watches it parse into Sections with Matched / Fuzzy / Unknown rows (glyph + label + color triple), resolves Fuzzy and Unknown inline, manages Sections (free-text rename on MacBook), attaches per-gig annotations, and reorders Songs on MacBook via drag-and-drop.

**User outcome:** The Apple-Notes pre-gig compile workflow is replaceable. Sandy can land a 19-song Setlist in minutes without leaving the prep flow.

**FRs covered:** FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-14, FR-23

**Key NFRs:** NFR-3 (paste-to-parse 500ms)

**Key UX-DRs:** UX-DR4 (GigCard, SectionHeading, SongRow setlist, ParseRowStatus)

---

### Epic 4: Performance Mode

Deliver the sacred state on iPhone. Sandy taps `Start performance ›` on Setlist overview; the Performance Card renders the first Song with three-region layout (fixed top chrome + scrollable middle + fixed bottom toolbar); Wake Lock acquires; tabs hide; single-tap `NEXT ›` / `‹` traverse Section boundaries with transitions <150ms; `×` returns to overview preserving state; the `Currently performing` strip + `Resume ›` brings him back; backgrounding survives. Last-song `NEXT ›` is inert. Tonight-Gig pre-fetch on every iPhone foreground keeps the cache warm. Performance Mode renders from cache regardless of auth status.

**User outcome:** Sandy can perform a gig from GigBuddy on iPhone, beginning to end, in a dim bar, with no mid-set surprises.

**FRs covered:** FR-15, FR-16, FR-17, FR-18, FR-19, FR-20, FR-21, FR-22

**Key NFRs:** NFR-1 (150ms transitions), NFR-2 (300ms cold render), NFR-7, NFR-8, NFR-15, NFR-21, NFR-27 (Wake Lock indicator no-animate), NFR-28 (Wake Lock backoff)

**Key ARs:** AR-25 (pre-fetch rules), AR-28 (Performance Mode invariants), AR-40 (upcoming-gigs endpoint)

**Key UX-DRs:** UX-DR4 (PerformanceCard, × exit, CurrentlyPerformingStrip, Start performance CTA), UX-DR9 (spatial-separation safety rule)

---

### Epic 5: Export & Verified Restore Ship-Gate

Deliver manual JSON export and the FR-34 verified-restore drill that gates V1 ship. The export endpoint returns a single human-readable JSON archive of all Bands, Songs, Setlists, Sections, per-gig annotations, and Gig metadata; the Library page footer (MacBook) carries the affordance. The verified-restore drill is then executed end-to-end against `gigbuddy-data` per the architecture document: seed canary record → restore via PITR to a side table → validate → swap `TABLE_NAME` env to the restored table → confirm app reads → swap back. The runbook is committed to `infra/runbooks/restore-pitr.md`.

**User outcome:** Sandy has a one-tap full data dump and proven recoverability. V1 ships only after this drill passes.

**FRs covered:** FR-33 + FR-34 verified-restore drill (operationalizes the backup infra built in Epic 1)

**Key ARs:** AR-14 (verified-restore release gate), AR-38 (export endpoint)

---

## Epic 1: Foundation, Access Gate & Deploy Pipeline

Deliver a deployed, password-gated, empty shell of GigBuddy at Sandy's URL. Both navigation destinations (Setlists, Library) are reachable but empty. Backups run nightly. CI deploys from `main` with two-stage blackout check and manual-override workflow. The design system foundation (tokens, typography, atmospheres, accessibility primitives, voice & tone baseline) is in place. AWS account is hardened.

### Story 1.1: Repo scaffold and toolchain

As Sandy,
I want a working pnpm workspace with the canonical project structure,
So that I can run `pnpm dev`, see a placeholder GigBuddy page, and every future story builds into a known, contract-enforced shape.

**Acceptance Criteria:**

**Given** a fresh clone of the gigbuddy repo
**When** `pnpm install` is run from the root
**Then** all five workspace packages (`web/`, `api/`, `shared/`, `infra/`, `e2e/`) install without error
**And** the root carries `pnpm-workspace.yaml`, `package.json`, `biome.json`, `tsconfig.base.json`, `.nvmrc` pinned to Node 22, and `.gitignore` per architecture.md

**Given** the installed workspace
**When** `pnpm dev:web` is run
**Then** Vite serves a placeholder page on port 5173 displaying the text `GigBuddy`
**And** the page bundles Tailwind v4, React 19, React Router 7, and TanStack Query v5
**And** TypeScript `strict: true` is enforced in `tsconfig.base.json` and inherited by all packages

**Given** the installed workspace
**When** `pnpm dev:api` is run
**Then** a Hono app starts on port 3000 with `GET /api/v1/health` returning `{status: "ok"}`
**And** the Hono bundle target is Node 22 ARM64 via esbuild

**Given** the installed workspace
**When** `pnpm lint`, `pnpm typecheck`, and `pnpm test` are run
**Then** all three commands succeed across all packages
**And** Biome is the sole lint+format tool (no ESLint, no Prettier present in the repo)

**Given** the `shared/` package
**When** imported from `web/` or `api/`
**Then** Zod schemas (placeholder `BandSchema` with at minimum `bandId`, `name`) are usable from both sides via `z.infer`
**And** there are no parallel TypeScript types redefining the same shape (Zod is the single source of truth per AR-4)

**Given** a PR opened against `main`
**When** the `.github/workflows/ci.yml` workflow runs
**Then** `pnpm install` + `pnpm lint` + `pnpm typecheck` + `pnpm test` all execute
**And** the workflow fails the PR check if any command fails

**Given** the conventions documented in architecture.md
**When** code is reviewed at PR time
**Then** files are kebab-case, identifiers camelCase / PascalCase / SCREAMING_SNAKE_CASE per role, IDs use NanoID (16-char URL-safe), and timestamps are ISO-8601 UTC

---

### Story 1.2: Design system foundation — tokens, typography, atmospheres

As Sandy,
I want the visual identity from DESIGN.md baked into the running app via Tailwind v4 tokens and a two-atmosphere theme system,
So that every subsequent feature inherits the locked visual direction without re-implementing tokens or theme switching.

**Acceptance Criteria:**

**Given** `web/src/styles/tokens.css`
**When** reviewed
**Then** two Tailwind v4 `@theme` blocks define both atmospheres' tokens: colors (`accent`, `attention-fuzzy`, `attention-unknown`, `surface`, `bg`, `text-secondary`, plus the rest of DESIGN.md Color tables for Performance "Club Warm" and Practice "warm paper cream"), the type scale from DESIGN.md §Scale (including `perf-title` ≥36pt, `key/patch` 22pt, `body` 18pt for Performance; `home-tonight`, `section-heading`, body 17–18pt for Practice), spacing on a 4pt base unit, elevation rules (max 4pt shadow), and corner radii including `rounded-chord-glyph`
**And** no token values are hard-coded in component files — every color/size/space references a token

**Given** the finalized tokens in `web/src/styles/tokens.css`
**When** Story 1.2 closes
**Then** every foreground/background token pair used together in Performance atmosphere is measured against WCAG AAA (≥7:1 contrast ratio) — pairs include text-primary/bg, text-primary/surface, text-secondary/bg, text-secondary/surface, accent/bg, bg/accent (for the CTA `accent` background with `bg` text)
**And** every foreground/background token pair used together in Practice atmosphere is measured against WCAG AA (≥4.5:1 contrast ratio) — same pair set plus attention-fuzzy/bg and attention-unknown/bg
**And** the measurements are committed to `web/test-output/contrast-report.json` (machine-readable, one entry per pair with token names, hex values, computed ratio, and AAA/AA pass flag)
**And** any pair failing its target ratio is either remediated (token value adjusted) or explicitly waived in the report with a justification (e.g., "decorative use only, not body text")
**And** the contrast report is regenerated and committed whenever `tokens.css` changes (enforced by a CI step or a documented developer-workflow note — pick at implementation)

**Given** the running web app on a MacBook viewport
**When** the document loads
**Then** `<html data-atmosphere="practice">` is set and the Practice palette is applied via CSS variable scope
**And** no JS theme provider is involved (CSS variable scope only, per AR / UX-DR3)

**Given** the running web app on an iPhone viewport
**When** the document loads outside Performance Mode
**Then** `<html data-atmosphere="performance">` is set and the Performance palette is applied
**And** inside Performance Mode (Epic 4) the atmosphere remains `performance`

**Given** Story 1.2 execution
**When** the developer shortlists 2–3 open-source candidates each for `serif-editorial` and `mono-slab` (per DESIGN.md guidance)
**Then** Sandy is asked to pick one of each before the story closes
**And** the chosen faces are self-hosted in `web/public/fonts/` as WOFF2 with required-glyph subsetting (no external font CDN)
**And** fallback stacks are defined in tokens.css
**And** font files load with `font-display: swap`

**Given** the user's OS has `prefers-reduced-motion: reduce` enabled
**When** the app renders
**Then** a global CSS rule in `web/src/styles/globals.css` zeroes all `transition-duration` and `animation-duration` values

**Given** any tappable component
**When** rendered
**Then** it satisfies `min-w-tap min-h-tap` (44pt minimum) via Tailwind utility tokens defined in tokens.css (`--size-tap: 44pt`)

**Given** an audit of microcopy across `web/src/`
**When** all string literals are scanned
**Then** no exclamation marks, no emoji, no marketing voice, no encouragement copy is present
**And** the empty-state constants `No songs in this library yet.` and `No upcoming gigs.` are defined in a single microcopy module for reuse by Stories 1.5, 2.x, 3.x

---

### Story 1.3: AWS infrastructure stacks — data, api, web, observability, ci

As Sandy,
I want all five CDK stacks authored and deployed to eu-west-2,
So that the AWS account is shaped: the SPA is reachable from CloudFront over HTTPS, the API Lambda responds at `/api/v1/health`, DynamoDB is provisioned with PITR + automated backups, and the account is hardened.

**Acceptance Criteria:**

**Given** `infra/lib/stacks/data-stack.ts`
**When** `cdk deploy` is run
**Then** the `gigbuddy-data` DynamoDB table is created in eu-west-2 with on-demand billing, PITR enabled, and `DeletionProtection: true`
**And** the table CDK config sets `encryption: dynamodb.TableEncryption.AWS_MANAGED` explicitly (not relying on the implicit default), satisfying NFR-11 with a code-level assertion that a future CDK refactor cannot silently drop
**And** GSI1 is created with `gsi1pk` and `gsi1sk` per architecture.md Decision 2
**And** an AWS Backup vault (KMS-managed) holds a daily backup plan with 365-day retention and cold-storage transition at 30 days
**And** the data stack carries CDK termination protection (cannot be destroyed via `cdk destroy` without explicit override)

**Given** `infra/lib/stacks/api-stack.ts`
**When** `cdk deploy` is run
**Then** a Lambda function (Node 22, ARM64 Graviton, 512MB, reserved concurrency = 50) is created with a Function URL
**And** the Lambda has IAM permissions to read/write `gigbuddy-data` (least-privilege scoped to the table ARN + its GSI) and to read SSM SecureStrings under `/gigbuddy/*`
**And** SSM SecureString parameters `/gigbuddy/jwt-key` and `/gigbuddy/password-hash` exist (values populated manually per the bootstrap runbook)
**And** the Lambda handler returns 200 from `GET /api/v1/health`

**Given** `infra/lib/stacks/web-stack.ts`
**When** `cdk deploy` is run
**Then** a private S3 bucket exists for the SPA bundle (uploads performed by deploy pipeline in Story 1.6, not by CDK)
**And** a CloudFront distribution serves the bucket via OAC with `CachingOptimized` for default behavior and `CachingDisabled` for `/api/*` (forwarding Cookie + Authorization headers, never caching)
**And** an ACM certificate in us-east-1 secures Sandy's chosen subdomain
**And** Route 53 A/AAAA alias records point the subdomain to the CloudFront distribution
**And** a CAA DNS record restricts cert issuance to `amazon.com`
**And** a WAF rate-limit rule (100 requests per IP per 5 min, 429 response) is attached to the distribution

**Given** `infra/lib/stacks/observability-stack.ts`
**When** `cdk deploy` is run
**Then** CloudTrail is enabled with an S3 destination in eu-west-2 (S3 lifecycle: 90-day standard then Glacier)
**And** AWS Budgets alarms email Sandy at `$5/mo` and `$20/mo` thresholds
**And** CloudWatch Logs retention is configured: Lambda 14 days, CloudFront access logs 30 days

**Given** `infra/lib/stacks/ci-stack.ts`
**When** `cdk deploy` is run
**Then** a GitHub Actions OIDC provider exists in IAM
**And** a `deploy-role` IAM role is assumable only when `token.actions.githubusercontent.com:sub` matches `repo:<owner>/gigbuddy:ref:refs/heads/main` (PR runners cannot assume)
**And** the role has least-privilege permissions for CDK actions + S3 upload + CloudFront invalidation + DDB read (for blackout check)

**Given** the deployed stacks
**When** Sandy navigates to his subdomain
**Then** CloudFront returns the (currently empty / placeholder) SPA bundle over HTTPS
**And** `GET https://<subdomain>/api/v1/health` returns 200

**Given** `infra/runbooks/bootstrap.md`
**When** read
**Then** it documents the one-time AWS account bootstrap sequence: manual IAM bootstrap-user creation, initial `cdk bootstrap`, SSM SecureString seeding, Sandy generating a ≥20-char password and writing its argon2id hash into `/gigbuddy/password-hash`, and the OIDC provider hand-off

---

### Story 1.4: Access gate — single password, JWT cookie, SSM

As Sandy,
I want a single-password access gate with a long-lived signed-JWT cookie,
So that my deployment is not publicly readable, I authenticate once per device, and I stay logged in for a year without account-management ceremony.

**Acceptance Criteria:**

**Given** an unauthenticated request to any `/api/v1/*` route except `/api/v1/auth/login` and `/api/v1/health`
**When** the request hits the Hono auth middleware
**Then** the response is 401 with envelope `{status: 'error', error: {code: 'UNAUTHORIZED', message: '...'}}`
**And** no data is leaked beyond the error envelope

**Given** an unauthenticated browser load of the deployed subdomain
**When** the SPA bundle (publicly readable, carries no data) hydrates
**Then** the SPA calls `GET /api/v1/me`
**And** on a successful network response with 401, the SPA routes to `/login`
**And** on a network failure (offline), the SPA renders the cached app shell with `authenticated=unknown` (per AR-16) — it does NOT route to login

**Given** `POST /api/v1/auth/login` with `{password: <correct password>}`
**When** the server verifies via argon2id against the SSM-stored hash
**Then** the server sets `gigbuddy_session` cookie with attributes `HttpOnly: true`, `Secure: true`, `SameSite: Strict`, `Max-Age: 31536000`, `Path: /`
**And** the cookie value is a signed JWT (HS256, key fetched from `/gigbuddy/jwt-key` at Lambda cold-start and cached in module-scope memory)
**And** the response is HTTP 200 with `{status: 'applied'}`

**Given** `POST /api/v1/auth/login` with an incorrect password
**When** the server verifies
**Then** the response is HTTP 401 with `{status: 'error', error: {code: 'INVALID_CREDENTIALS', message: 'wrong password'}}`
**And** the response timing does not reveal whether the password is set or wrong (argon2id verification runs to completion regardless)

**Given** an authenticated request with a valid `gigbuddy_session` cookie
**When** the request hits any `/api/v1/*` route
**Then** the middleware verifies the JWT signature using the SSM-fetched key (from module-scope cache)
**And** on signature validity, the route handler executes
**And** on signature failure or expiry, the response is 401

**Given** SPA boot post-login
**When** `GET /api/v1/me` returns 200
**Then** `authenticated=true` is set and the normal app shell renders

**Given** a 401 returned from a successful network call (not from cache) **while `performanceActive === false`**
**When** any API call hits the SPA
**Then** the SPA routes to `/login`
**And** while `performanceActive === true` (Epic 4), the 401 is held — not surfaced (per AR-28)

**Given** the cookie has 30 days or less until expiry
**When** the SPA boots on MacBook
**Then** a quiet, dismissible "Re-authenticate within N days" banner appears
**And** the banner does NOT appear on iPhone

**Given** a Lambda code review
**When** secret handling is audited
**Then** the JWT signing key and the SSM password hash are NEVER in Lambda environment variables
**And** logger middleware redacts known secret param names from structured JSON log lines
**And** no API response body contains the JWT key, password hash, or cookie value

---

### Story 1.5: Navigation chrome scaffold

As Sandy,
I want both top-level destinations (Setlists, Library) reachable post-login with the correct empty states, the passive Band label on MacBook, and accessibility primitives applied,
So that after Epic 1 ships I can verify the deployed app works end-to-end on both devices and feel the visual atmospheres.

**Acceptance Criteria:**

**Given** a MacBook viewport, authenticated
**When** the app renders the root layout
**Then** the top nav shows `GigBuddy · The Jack Ruby 5` (editorial serif at the `home-tonight`-tier size) on the left and nav items `Setlists` and `Library` on the right
**And** the `GigBuddy · The Jack Ruby 5` label is non-interactive: no `tabindex`, no `cursor: pointer`, no `onClick`, no focus ring, no role
**And** a hairline divider sits below the top nav
**And** the default landing route after login is `/` (the Setlists tab)

**Given** the MacBook top nav from the AC above
**When** the layout component is reviewed
**Then** the right-side nav container is structured to accept additional action items appended after `Library` — implemented as a slot/children pattern (e.g., `<TopNav rightActions={...}>`) rather than a hard-coded list
**And** in Epic 1 the slot renders nothing (no visible affordance)
**And** the structural code path is in place so Story 3.4's `+ New setlist` action mounts into the slot without modifying `TopNav`'s implementation

**Given** an iPhone viewport, authenticated (and PWA install gate satisfied — see Story 2.x)
**When** the app renders the root layout
**Then** a bottom tab bar shows two tabs: `Setlists` and `Library`
**And** the Band label is NOT shown anywhere on iPhone chrome
**And** the active tab is rendered in the `accent` token, inactive tabs in `text-secondary`
**And** the tab bar is ~50pt tall and respects the iPhone home-indicator inset (34pt)
**And** the default landing route after login is `/` (the Setlists tab)

**Given** the Setlists route with no Setlist records
**When** the route renders
**Then** the Tonight slot empty state shows `No upcoming gigs.` (using the constant defined in Story 1.2)
**And** no "create new setlist" CTA is shown in the empty state (per EXPERIENCE.md State Patterns)

**Given** the Library route with no Song records
**When** the route renders
**Then** the page shows `No songs in this library yet.` (using the constant defined in Story 1.2)
**And** no row actions, no "+ New song" button, no contextual menus appear (Library row content lands in Epic 2)

**Given** any icon-only navigation control
**When** rendered
**Then** an `aria-label` is set matching the spoken intent (e.g., `aria-label="Setlists tab"`)
**And** focus order follows DOM reading order with no manual `tabindex` other than `0` (focusable) or `-1` (removed)

**Given** `web/src/performance/performance-context.tsx`
**When** the file is reviewed
**Then** it exports `PerformanceModeContext` (React Context), a `PerformanceModeProvider` component, a `useSetPerformanceActive()` hook returning `setActive(bool)`, and a `usePerformanceActive()` hook returning the current flag
**And** the provider's initial state is `performanceActive=false`
**And** the provider is mounted at the root of the React tree (above the router)

**Given** `web/src/hooks/use-chrome-visible.ts`
**When** consumed by the root layout
**Then** the hook reads `performanceActive` from `PerformanceModeContext` and returns its negation
**And** in Epic 1 the hook always returns `true` (default `performanceActive=false`) — chrome is visible
**And** the structural code path is in place so Epic 4's FR-15 only needs to call `setActive(true)` to hide chrome — no additional context plumbing required in Epic 4

---

### Story 1.6: Deploy pipeline with two-stage blackout check

As Sandy,
I want a GitHub Actions deploy pipeline that ships from `main` with a fail-closed blackout check and an auditable manual-override workflow,
So that I can deploy safely and the system refuses to deploy within 24h of any Gig without me explicitly overriding with a venue-name confirmation.

**Acceptance Criteria:**

**Given** `.github/workflows/deploy.yml`
**When** a merge to `main` triggers it
**Then** the workflow runs in order: checkout → setup-node 22 → `pnpm install` → `pnpm lint` → `pnpm typecheck` → `pnpm test` → blackout check → `cdk diff` (informational) → `cdk deploy` → upload SPA bundle to S3 → CloudFront invalidation → smoke test
**And** the workflow assumes `deploy-role` via OIDC; no long-lived AWS keys are present as repo secrets or in code

**Given** `infra/scripts/blackout-check.ts`
**When** invoked by the workflow
**Then** Stage 1 calls `DescribeTable` on `gigbuddy-data`; any failure (IAM, network, throttling, table missing) causes the script to exit non-zero with the message `blackout check could not run reliably; use deploy-force.yml after confirming no Gig in 24h`
**And** Stage 2 queries upcoming Gigs within 24h Europe/London via GSI1; any exception during the query causes the same fail-closed exit
**And** when Stage 2 returns one or more Gigs, the script exits non-zero with venue and date(s) in the message
**And** when Stage 2 returns zero records, the script falls back to a static check: if the current time in `Europe/London` is Fri/Sat/Sun between 18:00 and 24:00, exit non-zero; otherwise exit 0
**And** the script uses the named IANA TZ `Europe/London` (not a UTC offset)
**And** the script's self-tests cover both GMT and BST behavior

**Given** the deploy workflow's smoke test step
**When** it runs after `cdk deploy` + S3 upload + CloudFront invalidation
**Then** `GET https://<subdomain>/api/v1/health` returns 200
**And** `GET https://<subdomain>/index.html` returns 200 with a `cache-control` header indicating CDN cache (proving the S3 origin path is reachable and caching is applied)

**Given** `.github/workflows/deploy-force.yml`
**When** triggered manually via `workflow_dispatch`
**Then** it requires a `reason` text input (required, no default)
**And** before allowing override, the workflow enumerates blocking Gigs in the next 24h Europe/London window
**And** if blocking Gigs exist, the workflow requires Sandy to type the venue name of the nearest blocking Gig as a second confirmation input that must match exactly
**And** the `reason` text plus the typed venue confirmation are written to a CloudWatch log line and to the workflow run summary
**And** the workflow then skips the blackout check and runs the rest of the deploy pipeline

**Given** the `main` branch
**When** a PR is opened against it
**Then** branch protection requires `ci.yml` (lint + typecheck + test) to pass before the PR is mergeable
**And** branch protection does NOT require the deploy blackout check to pass at PR time (the check runs at deploy time only, since Gig times change between PR open and merge)

**Given** a fresh deploy against an empty DDB table (zero Gig records)
**When** the deploy workflow runs on a Tuesday at 10:00 Europe/London
**Then** the blackout check exits 0 via the static fallback
**And** the deploy proceeds to completion

---

## Epic 2: Song Library & Sync Layer

Deliver inline-edit Song records on both surfaces. Sandy creates, views, edits, and lists Songs in his Library with silent debounced save. The sync layer is wired end-to-end: TanStack Query persisted to IndexedDB, optimistic local writes via an outbox with per-record coalescing, server-side LWW on `clientWrittenAt`, stale-write banner on MacBook, full offline tolerance. iPhone PWA install gate enforces standalone mode; `navigator.storage.persist()` protects the outbox.

### Story 2.1: Service worker + PWA manifest

As Sandy,
I want a Workbox-driven service worker and a web app manifest with the right caching strategies and install metadata,
So that the SPA can be installed as a PWA on iPhone (unlocking Wake Lock and full-screen) and the cache strategy is correct for every route from day one.

**Acceptance Criteria:**

**Given** `web/vite.config.ts` configured with `vite-plugin-pwa`
**When** `pnpm build:web` runs
**Then** a Workbox-generated service worker is emitted to `web/dist/`
**And** the service worker config is `skipWaiting: false`, `clientsClaim: false` (new SW installs but waits for clean cold-start to activate)

**Given** the service worker is active in the browser
**When** a request hits `/api/v1/auth/*`, `/api/v1/me`, or `/api/v1/health`
**Then** Workbox uses `NetworkOnly` strategy (no caching of auth state or health probes)

**Given** the service worker is active
**When** a GET request hits `/api/v1/songs/*` or `/api/v1/setlists/*`
**Then** Workbox uses `NetworkFirst` strategy with cache fallback under `api-cache-v1`
**And** successful responses are cached for offline fallback

**Given** the service worker is active
**When** a POST, PUT, or DELETE hits any `/api/v1/*` route
**Then** Workbox uses `NetworkOnly` strategy (the outbox in Story 2.4 owns offline-write semantics — SW must not double-queue)

**Given** the service worker is active
**When** a request hits a static asset (`*.js`, `*.css`, `*.woff2`)
**Then** Workbox uses `CacheFirst` strategy under `static-cache-v1` with revalidate
**And** the request for `/index.html` uses `NetworkFirst` under `app-shell-v1`

**Given** `web/public/manifest.webmanifest`
**When** parsed by a browser
**Then** it declares `name: "GigBuddy"`, `short_name: "GigBuddy"`, `display: "standalone"`, `theme_color` matching the Performance atmosphere `bg` token, `background_color` matching `bg`, and icons at 192px, 512px, and maskable sizes located in `web/public/icons/`

**Given** the deployed PWA on iPhone Safari
**When** the user performs `Share → Add to Home Screen`
**Then** the manifest is honored and a standalone-mode install is created
**And** subsequent launches from the home-screen icon open in full-screen standalone mode

---

### Story 2.2: iPhone PWA install gate

As Sandy,
I want the iPhone surface to route to install-instructions until the PWA is installed,
So that storage eviction by iOS Safari is prevented (`navigator.storage.persist()` is meaningful only post-install) and Performance Mode's Wake Lock prerequisite is enforced.

**Acceptance Criteria:**

**Given** `web/src/lib/platform.ts` exporting `isIPhone()` and `isStandalone()`
**When** invoked from the boot sequence
**Then** `isIPhone()` returns true on iPhone Safari and PWA contexts, false on MacBook and other browsers
**And** `isStandalone()` returns true when `window.matchMedia('(display-mode: standalone)').matches` is true OR `navigator.standalone === true`

**Given** an iPhone visitor (`isIPhone() === true`) where `isStandalone() === false`
**When** the SPA boots
**Then** the router redirects to `/install-instructions` regardless of the requested route
**And** the redirect happens BEFORE any API call or auth check

**Given** an iPhone visitor with `isStandalone() === true`
**When** the SPA boots
**Then** no install gate triggers; the app proceeds to the normal boot sequence (login or app shell)

**Given** a MacBook visitor (`isIPhone() === false`)
**When** the SPA boots
**Then** no install gate triggers regardless of standalone state

**Given** the `/install-instructions` route is rendered
**When** the user views it
**Then** it shows step-by-step iOS install instructions: tap Share → scroll → tap "Add to Home Screen" → tap Add
**And** the visual treatment uses the Performance atmosphere tokens from Story 1.2
**And** copy follows UX-DR7 voice & tone (no exclamation marks, no emoji, no encouragement; short complete sentences)
**And** no skip / dismiss button exists (the gate is hard)

**Given** an installed-PWA iPhone launching from the home-screen icon
**When** Sandy returns to the app after install
**Then** `isStandalone()` returns true and the install gate is bypassed for all subsequent launches

---

### Story 2.3: Song API + DDB persistence + client-errors endpoint

As Sandy,
I want server-side Song CRUD with canonical LWW behavior, plus a fire-and-forget client-error endpoint,
So that the API can persist Songs with the contract Epic 4 will later depend on for sync, and unexpected client errors land in CloudWatch for diagnosis.

**Acceptance Criteria:**

**Given** `shared/src/schemas/song.ts`
**When** reviewed
**Then** `SongSchema` is a Zod object with: `bandId` string, `songId` string, `title` string, optional `key`, `patch`, `chordChart`, `performanceNotes`, `practiceNotes` (all string), `clientWrittenAt` ISO-8601 datetime, `serverReceivedAt` ISO-8601 datetime, `version: 1` literal
**And** the schema is re-exported via `shared/src/index.ts` and consumed by both `web/` and `api/` via `z.infer`

**Given** `api/src/ddb/songs.ts`
**When** reviewed
**Then** it exposes `getSong(bandId, songId)`, `putSong(record)`, and `listSongsByBand(bandId)` functions
**And** all DynamoDB calls go through this wrapper (no `@aws-sdk/client-dynamodb` imports anywhere else in `api/` per AR-42)
**And** items are written/read with pk = `BAND#<bandId>`, sk = `SONG#<songId>`

**Given** `GET /api/v1/songs` with a valid auth cookie
**When** the handler runs
**Then** it returns `{status: 'ok', data: [SongSchema, ...]}` — an alphabetized-by-title list of all Songs for the active Band
**And** the response carries the `x-server-now: <ISO-8601>` header (from a Hono middleware)

**Given** `GET /api/v1/songs/:songId` with a valid auth cookie
**When** the song exists
**Then** the response is `{status: 'ok', data: <SongSchema>}`
**And** when the song does not exist, the response is 404 with `{status: 'error', error: {code: 'NOT_FOUND', message: '...'}}`

**Given** `PUT /api/v1/songs/:songId` with body matching `SongSchema.omit({serverReceivedAt: true})` and a valid auth cookie
**When** the handler runs
**Then** the LWW logic in `api/src/lww.ts` compares incoming `clientWrittenAt` to stored `clientWrittenAt`
**And** when incoming ≥ stored, the record is persisted with `serverReceivedAt = new Date().toISOString()` and the response is `{status: 'applied', data: <SongSchema>}`
**And** when incoming < stored, the record is NOT persisted and the response is `{status: 'dropped-as-stale', currentState: <SongSchema>}` (HTTP 200; the write was processed, just not persisted)

**Given** the LWW server logic
**When** unit-tested
**Then** tests cover: same-timestamp wins (applied), strictly-older drops as stale, strictly-newer applies, missing existing record applies, malformed payload returns 400 with Zod-validation error envelope

**Given** `POST /api/v1/client-errors` with body `{where: string, message: string, stack?: string, performanceActive: boolean, timestamp: ISO-8601}` and a valid auth cookie
**When** the handler runs
**Then** it writes a structured CloudWatch log line at level `error` containing the payload
**And** returns 204 No Content fire-and-forget (the client never blocks on this)
**And** the payload contents (raw stack traces, etc.) are NOT echoed back in the response body

**Given** any handler completing
**When** the response is serialized
**Then** the response includes `x-server-now: <ISO-8601>` header
**And** envelope shapes match `shared/src/schemas/api.ts` envelopes (`applied`, `dropped-as-stale`, `ok`, `error`)

**Given** Hono auth middleware (Story 1.4)
**When** any of `/api/v1/songs/*` or `/api/v1/client-errors` is hit without a valid cookie
**Then** the response is 401 (route handler does not execute)

---

### Story 2.4: Sync layer foundation + client error reporter

As Sandy,
I want a TanStack Query + IndexedDB persistence cache, a custom outbox with per-record coalescing, and a client-side error reporter wired to `window.onerror` / `unhandledrejection` / React `ErrorBoundary`,
So that optimistic writes survive offline, conflicts resolve LWW silently, the cache survives reload, and unexpected client errors land in CloudWatch.

**Acceptance Criteria:**

**Given** `web/src/sync/query-client.ts`
**When** the app boots
**Then** a single `QueryClient` instance is created with an IndexedDB persister (using `@tanstack/react-query-persist-client` or equivalent)
**And** the cache survives a full page reload (re-opening the app surfaces cached data immediately before any network call returns)

**Given** the app boot sequence
**When** it runs
**Then** `navigator.storage.persist()` is requested (the result is logged but does not block boot)
**And** when the request returns true, the cache and outbox are marked persistent (resilient to iOS Safari eviction)

**Given** `web/src/sync/outbox.ts`
**When** reviewed
**Then** it exposes `enqueue(entry)`, `peek()`, `markInFlight(id)`, `markPending(id)`, `remove(id)`, and `listAll()` operations against a dedicated IndexedDB store
**And** an `OutboxEntry` shape matches architecture.md §Outbox state machine: `{id: NanoID, recordKey: string, op: 'PUT', payload: unknown, clientWrittenAt: ISO-8601, status: 'pending'|'in-flight', attempts: number}`

**Given** the outbox enqueue rules
**When** an entry is enqueued for `recordKey="song:<bandId>:<songId>"`
**Then** if an existing entry for the same `recordKey` has `status='pending'`, it is REPLACED (coalesce — the new payload supersedes)
**And** if an existing entry has `status='in-flight'`, the new entry is appended as `pending` (max 2 entries per recordKey: one in-flight + one pending)
**And** otherwise the entry is appended

**Given** `web/src/sync/flusher.ts`
**When** invoked
**Then** it picks the oldest `pending` entry, marks `in-flight`, POSTs/PUTs to the matching `/api/v1/<resource>` route, awaits response
**And** on `200 applied` → removes the entry and invalidates the TanStack Query cache for `recordKey`
**And** on `200 dropped-as-stale` → removes the entry, replaces the TanStack cache with `currentState`, surfaces the quiet MacBook banner `Your earlier edit was superseded.` (NOT shown on iPhone, NOT shown while `performanceActive === true`)
**And** on `4xx` → removes the entry, logs an error (do not retry — schema bug)
**And** on `5xx` or network error → marks back to `pending`, increments `attempts`, schedules a retry per backoff

**Given** the flusher retry triggers
**When** any of `online` event, `visibilitychange` to `visible`, or 30s timer fires (with pending entries present)
**Then** the flusher attempts to flush the oldest pending entry

**Given** exponential backoff
**When** consecutive attempts fail
**Then** the delays are: attempt 1 → 0s, 2 → 5s, 3 → 30s, 4+ → 60s (cap)

**Given** `web/src/api/client.ts` (the fetch wrapper)
**When** any response is received
**Then** the wrapper reads the `x-server-now` header and computes `|serverNow - Date.now()|`
**And** if the drift exceeds 30 seconds, a `console.warn` is emitted with the drift value (no UI; diagnostic only)

**Given** the existing `PerformanceModeContext` created in Story 1.5
**When** Story 2.4's sync subsystems are wired
**Then** the flusher reads `performanceActive` via `usePerformanceActive()` (or the equivalent non-hook accessor for non-React modules) before surfacing any banner
**And** the stale-write banner subsystem reads the same flag before rendering on iPhone
**And** Story 2.4 does NOT re-create the provider (Story 1.5 owns the provider's mounting and the initial-state contract)

**Given** `web/src/lib/error-reporter.ts`
**When** the app boots
**Then** listeners for `window.onerror`, `window.addEventListener('unhandledrejection')`, and a React `ErrorBoundary` are wired
**And** each captured error fires `POST /api/v1/client-errors` with `{where, message, stack?, performanceActive: <current flag>, timestamp}`
**And** failure of the POST is itself silent (never blocks the UI)
**And** the React `ErrorBoundary` renders a generic fallback UI (`Something went wrong. Try refreshing.`) — never raw error messages

**Given** the sync layer's tests
**When** simulated offline / online toggle, simulated 5xx / network failure, simulated stale-write response, and simulated rapid-fire enqueues to the same recordKey are exercised
**Then** the outbox behavior matches the state machine spec (coalescing, retries, backoff, status flows)

---

### Story 2.5: Library list surface (FR-4)

As Sandy,
I want an alphabetically-ordered list of Songs in the active Band's Library on both surfaces, with tap navigation to Song Detail,
So that I can browse my repertoire and pick any Song to view or edit.

**Acceptance Criteria:**

**Given** `web/src/routes/library.tsx` at route `/library`
**When** the route renders post-login
**Then** it calls `useSongs()` (TanStack Query hook reading `GET /api/v1/songs`)
**And** it renders one `SongRow (library)` per Song in alphabetical order by `title`
**And** the list reflects all Songs in the active Band (V1: The Jack Ruby 5)

**Given** the `SongRow (library)` component
**When** rendered
**Then** it shows the Song's title only (no key, no patch, no annotation) in editorial serif body face per UX-DR1
**And** it carries no row actions, no drag handle, no contextual menu, no badges
**And** the row's tap target satisfies `min-h-tap` (44pt)

**Given** the Library route on MacBook
**When** the page loads
**Then** the Practice atmosphere tokens apply (warm paper cream)
**And** the page layout is single-column vertical per NFR-23

**Given** the Library route on iPhone (post-install gate)
**When** the page loads
**Then** the Performance atmosphere tokens apply
**And** the bottom tab bar shows `Library` as the active tab

**Given** the Library route with at least one Song
**When** Sandy taps a Song row
**Then** the router navigates to `/songs/:songId`
**And** Song Detail (Story 2.6) renders for that Song

**Given** the Library route with zero Songs
**When** the page renders
**Then** it shows the empty-state message `No songs in this library yet.` (constant from Story 1.2)
**And** a `+ New song` affordance is visible (small action in the page chrome, deliberately mild divergence from PRD §State Patterns to satisfy FR-1 standalone in Epic 2)
**And** tapping `+ New song` navigates to `/songs/new`

**Given** a new Song created (in Story 2.6) or arriving via API
**When** the Library list is open
**Then** the new Song appears in alphabetical order without a page refresh (TanStack Query cache invalidation)

**Given** a screen-reader user navigating the Library
**When** the list renders
**Then** the list has a logical heading and each row is a focusable element with the Song title as its accessible name (no extra `aria-label` needed when the visible text matches the spoken intent, per UX-DR6)

---

### Story 2.6: Song Detail with inline edit + chord chart rendering (FR-1, FR-2, FR-3, FR-5)

As Sandy,
I want a single Song Detail surface that serves both create and edit, with field-by-field inline editing, debounced silent save, and chord-chart rendering per the V1 floor,
So that I can capture careful notes on every Song without modal ceremony and without losing what I just typed.

**Acceptance Criteria:**

**Given** `web/src/routes/song-detail.tsx` mounted at both `/songs/new` and `/songs/:songId`
**When** the route is `/songs/new`
**Then** the surface renders empty fields ready to receive input
**And** the URL changes to `/songs/:newSongId` (using a generated NanoID) the moment the Title field commits its first non-empty value

**Given** `/songs/:songId`
**When** the route loads
**Then** it calls `useSong(songId)` and renders the Song's fields per FR-5 surface-scoping
**And** the surface shows: Title (required), Key, Patch, Chord chart, Performance notes, Practice notes
**And** empty fields render as absent — no `(not specified)` placeholders (per FR-3 / EXPERIENCE.md State Patterns)
**And** the same surface renders on both MacBook (Practice atmosphere) and iPhone (Performance atmosphere)

**Given** the `InlineEditField` component on the Title field
**When** Sandy clicks/taps into it
**Then** the field becomes focused without a separate edit-mode toggle
**And** the field shows no visible border in the display state; on focus, an accent underline appears in Practice / accent glow in Performance (per UX-DR4)
**And** typing accepts input normally

**Given** the user blurs an `InlineEditField` after typing
**When** the blur occurs
**Then** a debounced commit fires within 200ms (per NFR-4)
**And** `useSongMutation()` enqueues a `PUT /api/v1/songs/:songId` payload with the whole-record body (per AR-23 whole-record PUT) and `clientWrittenAt = new Date().toISOString()` to the outbox
**And** the displayed value remains optimistic (matches what Sandy typed) regardless of network state
**And** NO success toast, no "saved" indicator, no spinner appears (per FR-2)

**Given** the outbox returns `dropped-as-stale` for a Song write
**When** the response arrives on MacBook
**Then** the displayed value is replaced with the server's `currentState` and a quiet banner appears: `Your earlier edit was superseded.`
**And** on iPhone (outside Performance Mode) the same banner shows; inside Performance Mode the banner is suppressed per AR-28

**Given** a save failure (5xx after exhausting outbox retries on MacBook)
**When** the failure surfaces
**Then** an error toast appears (per EXPERIENCE.md State Patterns)
**And** the displayed value remains optimistic until Sandy acknowledges
**And** the entry remains in the outbox for further retry

**Given** the Chord chart field
**When** `ChordChart` component renders its content
**Then** the text is rendered in the `mono-slab` face at `perf-chord`-tier size
**And** lines matching `{...}` (curly-brace wrapped) render as visual section breaks (e.g., centered, smaller mono caps, with vertical breathing space)
**And** blank lines in the source preserve as visual breathing space (not collapsed)
**And** URLs in the chord chart text are tappable links ONLY in Practice atmosphere; in Performance atmosphere URLs render as inert text (per FR-5 / UX-DR5)

**Given** the Library `+ New song` affordance
**When** tapped
**Then** the router navigates to `/songs/new`
**And** Song Detail renders empty fields with focus placed on the Title field

**Given** an empty Title field on `/songs/new`
**When** Sandy types a title and blurs
**Then** a Song record is created with the typed title (per FR-1) and only the title (all other fields empty)
**And** the URL changes to `/songs/:newSongId`
**And** the new Song appears in the Library list (cache invalidation per AR-23) in alphabetical order without page refresh (per FR-1 consequence)

**Given** the Title field on a new Song
**When** Sandy blurs WITHOUT typing anything
**Then** no Song is created (Title is required per FR-5)
**And** the URL remains `/songs/new`

**Given** Song Detail on iPhone in normal mode (NOT Performance Mode)
**When** the surface renders
**Then** Practice notes and Performance notes are BOTH visible (this is the editing surface, not the Performance Card)
**And** the field set matches FR-5 in full

**Given** a Song record being PUT to the API
**When** the request body is built
**Then** it sends the WHOLE Song record (every field), not a partial — per AR-23 whole-record PUT semantics
**And** the LWW comparison on the server uses the `clientWrittenAt` value generated at blur time

---

## Epic 3: Setlists Home, Paste-to-Parse & Setlist Management

Deliver the Setlists home surface and end-to-end Setlist creation and management. Sandy creates a Setlist with Gig metadata, pastes raw text from any source, watches it parse into Sections with Matched / Fuzzy / Unknown rows, resolves Fuzzy and Unknown inline, manages Sections (free-text rename on MacBook), attaches per-gig annotations, and reorders Songs on MacBook via drag-and-drop.

### Story 3.1: Setlist API + DDB persistence

As Sandy,
I want server-side Setlist CRUD with embedded Sections + Song refs + annotations as a single DDB item, plus GSI1 for date queries,
So that the V1 reads of the Setlist overview are one-item-fetches and the V2-mineable history is preserved without migration.

**Acceptance Criteria:**

**Given** `shared/src/schemas/setlist.ts`
**When** reviewed
**Then** `SongRefSchema` is a Zod object: `songId` string, `titleSnapshot` string, optional `perGigAnnotation` string
**And** `SectionSchema` is `{name: string, songs: SongRefSchema[]}`
**And** `SetlistSchema` is `{bandId, setlistId, gigMeta: {venue, date (ISO date), time?: HH:MM}, sections: SectionSchema[], clientWrittenAt, serverReceivedAt, version: 1}`
**And** schemas are re-exported via `shared/src/index.ts` and consumed by both `web/` and `api/`

**Given** `api/src/ddb/setlists.ts`
**When** reviewed
**Then** it exposes `getSetlist(bandId, setlistId)`, `putSetlist(record)`, `listSetlistsByBand(bandId)` functions
**And** writes go to a single DDB item with pk = `BAND#<bandId>`, sk = `SETLIST#<isoDate>#<setlistId>`
**And** the item shape carries `gsi1pk = BAND#<bandId>#SETLIST_BY_DATE`, `gsi1sk = <isoDate>#<setlistId>` for GSI1 reads
**And** all DDB access stays inside this wrapper (per AR-42)

**Given** `GET /api/v1/setlists` with a valid auth cookie
**When** the handler runs
**Then** it queries GSI1 for the active Band, returning all Setlists ordered by `gsi1sk` (date-ordered)
**And** the response is `{status: 'ok', data: [SetlistSchema, ...]}`
**And** the response carries `x-server-now`

**Given** `GET /api/v1/setlists/:setlistId` with a valid auth cookie
**When** the setlist exists
**Then** the response is `{status: 'ok', data: <SetlistSchema>}`
**And** when the setlist does not exist, the response is 404 with `{status: 'error', error: {code: 'NOT_FOUND'}}`

**Given** `PUT /api/v1/setlists/:setlistId` with a body matching `SetlistSchema.omit({serverReceivedAt: true})`
**When** the handler runs
**Then** the LWW logic compares incoming `clientWrittenAt` to stored `clientWrittenAt`
**And** when incoming ≥ stored, the WHOLE record (sections + songs + annotations) is written atomically; response is `{status: 'applied', data: <SetlistSchema>}`
**And** when incoming < stored, the record is NOT persisted; response is `{status: 'dropped-as-stale', currentState: <SetlistSchema>}`
**And** there is no per-field merging — whole-record PUT semantics per AR-23

**Given** the Setlist LWW logic
**When** unit-tested
**Then** the same LWW pattern from `api/src/lww.ts` is used (no Setlist-specific override)
**And** tests cover the same cases as Song LWW plus a Setlist-specific case verifying that a reorder + annotation edit on the SAME `clientWrittenAt` overwrites the stored sections atomically

**Given** the Setlist record carries Song refs with `titleSnapshot`
**When** a Song's title is renamed via `PUT /api/v1/songs/:songId` (Epic 2)
**Then** existing Setlist records are NOT modified by the Song write
**And** the Setlist's `titleSnapshot` continues to render the title as authored at gig time (per AR-11)
**And** new Setlist writes can carry the renamed title in `titleSnapshot`

**Given** the auth middleware (Story 1.4)
**When** any `/api/v1/setlists/*` route is hit without a valid cookie
**Then** the response is 401

---

### Story 3.2: Setlists home — Tonight / Upcoming / Past (FR-14, FR-23)

As Sandy,
I want the Setlists home surface to present one scrollable sectioned list of my Gigs — Tonight at the top with the `TONIGHT` badge, Upcoming next, Past below — on both surfaces,
So that opening the app on gig night puts the right Setlist a single tap away.

**Acceptance Criteria:**

**Given** the `/` route post-login
**When** the route renders
**Then** the Setlists home surface displays three sections in this order: Tonight, Upcoming, Past
**And** the layout is a single scrollable vertical list (no carousel, no horizontal scroll, no tabs between sections)
**And** the route applies the Practice atmosphere on MacBook and the Performance atmosphere on iPhone (outside Performance Mode)

**Given** a Setlist whose `gigMeta.date` matches today in Europe/London time
**When** the home surface renders
**Then** the Tonight slot displays that Setlist as a `GigCard` with the `TONIGHT` badge top-left
**And** the badge uses the `accent` token

**Given** no Setlist is dated today AND at least one Upcoming Setlist exists
**When** the home surface renders
**Then** the Tonight slot displays the next upcoming Setlist as a `GigCard` (no badge)
**And** that same Setlist does NOT also appear in the Upcoming list below (it's promoted into the Tonight slot)

**Given** no Setlist is dated today AND no Upcoming Setlist exists
**When** the home surface renders
**Then** the Tonight slot displays the empty state `No upcoming gigs.` (constant from Story 1.2)
**And** the Past list still renders below if any Past Setlists exist

**Given** Setlists exist after today (excluding any promoted to Tonight)
**When** the home surface renders
**Then** the Upcoming section lists them in chronological order (soonest first)
**And** each is a `GigCard` without the TONIGHT badge

**Given** Setlists exist before today
**When** the home surface renders
**Then** the Past section lists them in reverse chronological order (most recent first)
**And** each is a `GigCard` without the TONIGHT badge

**Given** the `GigCard` component (per UX-DR4)
**When** rendered
**Then** it shows venue in editorial serif at `home-tonight` size (Tonight slot) or the next-tier size (list rows), and date + time in mono `text-secondary`
**And** the card uses a warm surface fill from the active atmosphere
**And** the tap target satisfies `min-h-tap`

**Given** Sandy taps any `GigCard` row
**When** the tap is registered
**Then** the router navigates to `/setlists/:setlistId`

**Given** the home surface renders
**When** Tonight / Upcoming sectioning is computed
**Then** "today" is determined by `Europe/London` calendar date (not UTC) so a Saturday gig is "Tonight" until midnight London time
**And** the home surface re-evaluates Tonight on app foreground (visibilitychange) so a stale session correctly rolls over at midnight

---

### Story 3.3: Setlist overview surface + Section heading + per-gig annotation (FR-13, FR-10, FR-11)

As Sandy,
I want the Setlist overview surface to render gig metadata, sections, song rows, and per-gig annotations, with inline rename and annotation edit on MacBook,
So that the overview is the per-gig prep surface and a launchpad for Performance Mode.

**Acceptance Criteria:**

**Given** `/setlists/:setlistId` route
**When** the route renders
**Then** the top of the page shows the Gig metadata (venue, date, time) as a header
**And** below the header, the Setlist's Sections render in their stored order
**And** each Section renders a `SectionHeading` followed by its Song rows

**Given** the `SectionHeading` component (per UX-DR4)
**When** rendered on MacBook
**Then** the heading shows the section name in small-caps editorial serif at `section-heading` size in `text-secondary`
**And** a `4 / 4` count badge appears inline in mono (e.g., "Set 1 · 4 / 4")
**And** the heading is an `InlineEditField`: clicking enters edit mode, blur commits a `PUT /api/v1/setlists/:setlistId` via the outbox

**Given** the `SectionHeading` component on iPhone
**When** rendered
**Then** the heading is static (no inline rename — per FR-10 / EXPERIENCE.md Component Patterns)
**And** the count badge still renders

**Given** a `SongRow (setlist)` for a Song with no per-gig annotation
**When** rendered
**Then** it shows only the Song title (from `titleSnapshot`) in editorial serif body
**And** no empty annotation slot appears (row collapses)

**Given** a `SongRow (setlist)` for a Song with a per-gig annotation
**When** rendered
**Then** the title renders as above
**And** the per-gig annotation appears as an italic serif subline in the `accent` token (visually distinct from canonical notes per FR-11 / DESIGN.md)

**Given** Sandy taps a song row on MacBook
**When** the tap is on the row body
**Then** the router navigates to `/songs/:songId` (Song Detail)
**And** when the tap is on the row's annotation area (or an explicit annotation affordance), an inline `InlineEditField` opens for the annotation

**Given** Sandy taps a song row on iPhone
**When** the tap is on the row body
**Then** a bottom sheet opens with the per-gig annotation in an editable field (per FR-11 / EXPERIENCE.md Component Patterns)
**And** dismissing the sheet commits the change via `PUT /api/v1/setlists/:setlistId` (whole-record PUT)

**Given** a per-gig annotation edit commits
**When** the PUT lands
**Then** the annotation is stored on the (Setlist, Song) pair within the embedded structure — NOT on the Song record (per FR-11)
**And** the Song record on `/songs/:songId` is unchanged

**Given** a per-gig annotation is added or deleted
**When** the Setlist record is reloaded
**Then** the annotation persists alongside the Song ref within the Setlist record
**And** other Setlists referencing the same Song show the same Song without that annotation

**Given** the iPhone Setlist overview
**When** the route renders
**Then** a bottom-fixed full-width `Start performance ›` CTA appears above the iPhone tab bar (≥64pt tall, `accent` background, `bg` text per UX-DR4)
**And** the CTA is visible regardless of Setlist size
**And** in Epic 3, tapping the CTA is INERT (no-op or a small toast `Performance mode lands in Epic 4` in dev builds only); Epic 4's Story 4.x wires the entry behavior

**Given** the Setlist overview on iPhone
**When** the route renders
**Then** a "Currently performing" strip slot is reserved at the top of the page (Epic 4's Story 4.x will populate; in Epic 3 the slot renders nothing)

**Given** any inline edit (section name or per-gig annotation)
**When** committed
**Then** the optimistic local cache updates immediately
**And** the whole-Setlist PUT is enqueued to the outbox per AR-23
**And** a stale-write response from server is handled per Story 2.4 (cache replaced with currentState; quiet MacBook banner; silent on iPhone in Performance Mode)

---

### Story 3.4: Setlist creation with manual entry path (FR-6 manual)

As Sandy,
I want a Setlist creation surface where I can enter Gig metadata, add Sections, and add Song rows manually with type-ahead matching against the Library,
So that I can build a Setlist by hand when no pasteable source exists (and so the Paste-to-parse story in 3.5 has a creation surface to extend).

**Acceptance Criteria:**

**Given** the `/setlists/new` route
**When** the route loads
**Then** the surface shows three Gig metadata fields: Venue (text), Date (date picker), Time (time picker, HH:MM 24h, optional)
**And** the surface is reachable from a top-level affordance: on MacBook, a `+ New setlist` action in the top nav or the Setlists home page chrome; on iPhone, equivalent affordance in the Setlists tab chrome
**And** the affordance is visible regardless of whether existing Setlists are present

**Given** Gig metadata fields
**When** Sandy enters venue and date (time optional) and blurs
**Then** the values are held in local component state (a draft Setlist) until Save is invoked
**And** the draft persists across in-page navigation within `/setlists/new` (state is not lost when adding sections / songs)

**Given** a draft Setlist
**When** Sandy adds the first Song row without first adding a Section
**Then** a default Section named `Set 1` is created and the song row is added under it (per FR-10 consequence)

**Given** an `+ Add section` affordance
**When** Sandy taps it
**Then** a new Section row is inserted with a default name (`Set N` where N is the next ordinal) and an `InlineEditField` focused for renaming on MacBook (or default-name kept on iPhone since iPhone doesn't allow rename)

**Given** an `+ Add song row` affordance within a Section
**When** Sandy taps it
**Then** an inline type-ahead input appears
**And** typing filters Songs from the active Band's Library (via cached `useSongs()` from Epic 2)
**And** selecting a match creates a `SongRef` with `songId` and `titleSnapshot = <current Library title>` (per AR-11)
**And** if Sandy types a title that doesn't match any Library Song, a `+ Add to library` action appears (mirroring Story 3.5 unknown resolution) — creates a Song via the Epic 2 mutation path and adds it as a SongRef

**Given** a draft Setlist with at least Venue + Date and one Song
**When** Sandy taps Save
**Then** a `PUT /api/v1/setlists/:newSetlistId` is enqueued (with a NanoID `setlistId`)
**And** on `applied` response, the router navigates to `/setlists/:newSetlistId` (Setlist overview from Story 3.3)
**And** the new Setlist appears on the Setlists home surface (Story 3.2) on next read

**Given** an attempt to Save with missing Venue OR missing Date
**When** Save is tapped
**Then** inline validation appears next to the missing field (no toast, no modal)
**And** no API call is made

**Given** a Setlist saved with zero Songs
**When** the Save completes
**Then** the Setlist persists with an empty Section structure (per FR-6 consequence — empty Songs is valid)
**And** the overview surface renders the empty Setlist with just the Gig metadata header

**Given** a Setlist creation flow on iPhone
**When** the surface renders
**Then** the Performance atmosphere applies
**And** Section names cannot be renamed inline (per FR-10) — defaults `Set 1`, `Set 2` apply

---

### Story 3.5: Paste-to-parse with Matched / Fuzzy / Unknown (FR-7, FR-8, FR-9, NFR-3)

As Sandy,
I want a Paste-to-parse text area on the Setlist creation surface that parses pasted plain text into Sections + Song rows, matches each row against the Library, and surfaces Matched / Fuzzy / Unknown rows with inline resolution,
So that I can land a 19-Song Setlist in minutes from a WhatsApp message or any other plain-text source.

**Design reference:** Implementation conforms to [`paste-to-parse-design.md`](paste-to-parse-design.md) (approved 2026-06-19). The design note locks the algorithm (exact normalized match → Jaro-Winkler top-1 ≥ 0.92 → Unknown), the normalization pipeline (lowercase, NFKD, strip apostrophes / diacritics / trailing `– …` / `[…]` / `(…)`), the section-detection patterns (`Set N`, `Encore`, `{…}`, `# …`, `----`), and extends the Unknown-row action set below with **`Pick from library`** and **`Discard`** (in addition to `+ Add to library`).

**Acceptance Criteria:**

**Given** the `/setlists/new` route (from Story 3.4)
**When** the route renders
**Then** a Paste-to-parse text area appears prominently above the manual entry section
**And** the text area accepts multi-line plain-text paste
**And** below the text area, a live parsed-result region renders the parser output

**Given** Sandy pastes raw text into the Paste-to-parse field
**When** the paste event fires
**Then** the parser in `web/src/paste-parse/parser.ts` produces a structured result within 500ms for a ~20-Song input (NFR-3)
**And** the parser splits the input into Sections using these patterns: explicit headers like `Set 1` / `Set 2` / case-insensitive section keywords, separator lines like `---`, blank-line breaks
**And** when no section pattern is detected, all parsed Song rows land in a single default Section named `Set 1` (per FR-7 / EXPERIENCE.md Flow 3)

**Given** the matcher in `web/src/paste-parse/matcher.ts`
**When** invoked with the parsed Song rows and the active Library
**Then** each row is labelled Matched, Fuzzy (top-1 only per FR-8 / PRD §8.5), or Unknown
**And** Matched means exact string match against an existing Library Song title (case-insensitive, whitespace-normalized)
**And** Fuzzy means a candidate above a similarity threshold but not an exact match
**And** Unknown means no candidate above threshold

**Given** the `ParseRowStatus` component (per UX-DR4)
**When** rendered for a Matched row
**Then** it shows `✓` glyph (green dot via `accent` or a success token) + the canonical Library title + a quiet `text-secondary` row treatment
**And** color is paired with the glyph and the label — never the sole signal (per FR-7 / UX-DR6)

**Given** a Fuzzy row
**When** rendered
**Then** it shows `?` glyph (amber dot via `attention-fuzzy` token) + the suggested Library title with an inline `Yes, that one` button and an inline `No — new song` button
**And** both buttons are single-tap and satisfy `min-w-tap min-h-tap`

**Given** an Unknown row
**When** rendered
**Then** it shows `+` glyph (red dot via `attention-unknown` token) + the parsed-as-pasted title with an inline `+ Add to library` button

**Given** Sandy taps `Yes, that one` on a Fuzzy row
**When** the tap is registered
**Then** the row converts to Matched with the canonical Library title (the candidate is accepted)
**And** the row's visual treatment switches to the Matched state

**Given** Sandy taps `No — new song` on a Fuzzy row
**When** the tap is registered
**Then** the row converts to Unknown with the parsed title and shows the `+ Add to library` action

**Given** Sandy taps `+ Add to library` on an Unknown row
**When** the tap is registered
**Then** a new minimal Song record (title only, per FR-9) is created via the Epic 2 mutation path (`PUT /api/v1/songs/:newSongId` through the outbox)
**And** on `applied` response, the row converts to Matched referencing the new Song
**And** the new Song is visible in the Library list immediately (per FR-9 consequence)

**Given** the parsed result region with at least one row
**When** Sandy edits the Gig metadata or proceeds to Save the Setlist
**Then** Save is enabled only when zero Unknown or Fuzzy rows remain (or Sandy explicitly resolves remaining ambiguity)
**And** on Save, the resulting Setlist record carries the resolved Sections + SongRefs (with `titleSnapshot` from the resolved Library title at that moment)

**Given** assistive-tech users
**When** parsed rows transition between states (matched / fuzzy / unknown)
**Then** the parsed-result region carries `aria-live="polite"` so VoiceOver announces the state changes (per UX-DR6 / NFR-22)

**Given** the parser is "best-effort" (per FR-7 Notes)
**When** the parsed result is wrong (e.g., all songs land in Set 1 because no section markers were detected)
**Then** Sandy can recover via manual entry — adding Sections and moving Song rows between them using the affordances from Story 3.4 or the drag-reorder from Story 3.6

---

### Story 3.6: Drag-reorder on MacBook (FR-12)

As Sandy,
I want to drag Song rows within and between Sections on MacBook with a visible drag handle on row hover,
So that re-ordering a Setlist during prep is direct and silent — no modals, no save buttons, no iPhone clutter.

**Acceptance Criteria:**

**Given** the Setlist overview surface on MacBook (Story 3.3)
**When** Sandy hovers over a Song row
**Then** a drag-handle icon appears on the row (per UX-DR4 SongRow setlist visual spec)
**And** the cursor over the drag handle changes to `grab`

**Given** Sandy presses on the drag handle and starts dragging
**When** the drag is active
**Then** the row visually lifts (subtle elevation per DESIGN.md elevation rules — max 4pt shadow)
**And** drop targets within and between Sections highlight

**Given** Sandy drops the row in a new position within the same Section OR in a different Section
**When** the drop completes
**Then** the row moves to the new position
**And** a whole-Setlist PUT is enqueued (per AR-23) reflecting the new section ordering
**And** the change persists silently — no toast, no save confirmation (per FR-12 consequence)

**Given** Sandy drops the row in an invalid drop target
**When** the drop completes
**Then** the row animates back to its original position (≤150ms, respects `prefers-reduced-motion`)
**And** no PUT is enqueued

**Given** the Setlist overview on iPhone
**When** Sandy interacts with any Song row
**Then** NO drag handle is rendered (FR-12 / EXPERIENCE.md Interaction Primitives — drag is MacBook-only)
**And** long-press, swipe, and other gestures do not initiate a drag (per Interaction Primitives "no long-press for primary actions" + "no swipe gestures")

**Given** screen-reader users on MacBook
**When** they encounter a draggable row
**Then** the row is keyboard-operable via standard `Tab` to focus + `Space` to grab + arrow keys to move + `Space` to drop, OR an explicit "Move up / Move down" pair of buttons appears in the row context (the implementation may pick either; the AC is that drag is not the only path to reorder)

**Given** rapid successive reorders
**When** Sandy drags multiple rows in quick succession
**Then** the outbox coalesces by recordKey (`setlist:<bandId>:<setlistId>`) per AR-20 — at most 2 PUTs queued per Setlist at any time
**And** the final order is what gets persisted

---

## Epic 4: Performance Mode

Deliver the sacred state. Sandy taps `Start performance ›` on iPhone Setlist overview; the Performance Card renders the first Song with three-region layout; Wake Lock acquires; tabs hide; single-tap `NEXT ›` / `‹` traverse Section boundaries with transitions <150ms; `×` returns to overview preserving state; the `Currently performing` strip + `Resume ›` brings him back; backgrounding survives. Last-song `NEXT ›` is inert. Tonight-Gig pre-fetch on every iPhone foreground keeps the cache warm.

### Story 4.1: Performance Mode entry + Card layout + single-tap navigation (FR-15, FR-16, FR-17)

As Sandy,
I want a single tap on `Start performance ›` to enter Performance Mode with the first Song's Performance Card already rendered and single-tap `NEXT ›` / `‹` navigation that traverses Section boundaries,
So that on a gig night I can land on the first song and move through the set with one finger between songs.

**Acceptance Criteria:**

**Given** the iPhone Setlist overview from Story 3.3
**When** Sandy taps the bottom-fixed `Start performance ›` CTA
**Then** `onStartPerformance(setlistId)` runs
**And** the handler synchronously prefetches the Setlist record AND every referenced Song via `queryClient.prefetchQuery` (awaiting completion) per AR-25
**And** the handler calls `wakeLock.acquire()` (Story 4.2 supplies the implementation; for this story a stub that resolves cleanly is sufficient if 4.2 hasn't shipped)
**And** the handler sets `PerformanceModeContext.setActive(true)`
**And** the router navigates to `/performance/:setlistId/:songIndex` where `:songIndex` is the position of the first Song of the first non-empty Section in Setlist order
**And** the navigation chrome (bottom tabs) hides on entry (via `useChromeVisible()` reading `performanceActive`)
**And** the CTA tap → card visible time is < 300ms on iPhone 13 with warm cache (NFR-2)

**Given** an iPhone Setlist overview with a Setlist whose Sections are all empty
**When** Sandy taps `Start performance ›`
**Then** the CTA is disabled or non-functional (no entry into Performance Mode with zero Songs)
**And** no entry handler runs

**Given** the `/performance/:setlistId/:songIndex` route is mounted
**When** the route renders
**Then** the surface is in the Performance atmosphere (Club Warm)
**And** the layout has three regions per UX-DR4 / FR-16:
  - **Fixed top region:** Song title at `perf-title` size (≥36pt) in editorial serif; below it, key (large mono) + patch (mono, slightly smaller, ~22pt)
  - **Scrollable middle region:** chord chart rendered per Story 2.6 ChordChart conventions (mono-slab, `{...}` lines as section breaks, blank lines preserved, URLs NOT tappable in Performance atmosphere); per-gig annotation (if present) rendered distinctly per FR-11 / DESIGN.md
  - **Fixed bottom toolbar:** `‹` back (small, left, low emphasis), `NEXT ›` (right-biased, ~half-width, `accent` background, `bg` text), next-song preview text in mono `text-secondary`
**And** the `‹`, `NEXT ›`, and `×` (Story 4.3) controls are placed in spatially separated corners per UX-DR9

**Given** sparse content (e.g., a Song with only title + patch and no chord chart)
**When** the Performance Card renders
**Then** the layout does NOT reflow — the three regions hold their proportions; the middle region simply contains no chord text
**And** no `(not specified)` placeholders appear

**Given** a long chord chart
**When** the Performance Card renders and Sandy scrolls
**Then** the top chrome (title, key, patch) remains fixed
**And** the bottom toolbar remains fixed
**And** only the middle region scrolls vertically within its bounds

**Given** Sandy taps `NEXT ›`
**When** the tap is registered
**Then** the Performance Card transitions to the next Song in Setlist order
**And** the transition completes in under 150ms (NFR-1); `prefers-reduced-motion` collapses the transition to instant (NFR-21)
**And** the next Song's title, key, patch, chord chart, and (if present) per-gig annotation render correctly
**And** the next-song preview in the toolbar updates to the Song AFTER the new current Song
**And** when the current Song is the last in its Section, `NEXT ›` advances to the first Song of the next non-empty Section (Section boundaries traversed transparently per FR-17)

**Given** Sandy taps `‹`
**When** the tap is registered
**Then** the Performance Card transitions to the previous Song in Setlist order (same 150ms / reduced-motion rule)
**And** Section boundaries are traversed transparently going backward

**Given** Sandy is on the first Song of the first non-empty Section
**When** Sandy taps `‹`
**Then** the tap is inert (no action, no error, no toast) — there is no Song before the first

**Given** any tap in the scrollable middle region (chord chart area)
**When** the tap is registered
**Then** the tap does NOT advance, retreat, or otherwise navigate — middle region is for scrolling only (per EXPERIENCE.md Interaction Primitives "no tap-anywhere advance")

**Given** any swipe gesture anywhere on the Performance Card
**When** detected
**Then** the swipe is ignored (no navigation via swipe per Interaction Primitives "no swipe gestures in performance mode")

**Given** the page in Performance Mode
**When** Sandy attempts pinch-zoom or any multi-finger gesture
**Then** the gesture is suppressed (viewport meta tag disables zoom; per Interaction Primitives "no pinch")

**Given** the Performance Card is open
**When** `aria-label` audit runs against icon-only controls
**Then** `‹` has `aria-label="Previous song"`, `NEXT ›` has `aria-label="Next song"`, and the position indicator has `aria-label="Song <n> of <total>"` (per UX-DR6)

**Given** the SPA on entering Performance Mode
**When** focus management runs
**Then** focus moves to the `NEXT ›` button (primary action) per UX-DR6

**Given** `performanceActive === true`
**When** any API call returns a 401 from a successful network response
**Then** the 401 is held — NOT surfaced as a redirect to `/login` (per AR-28)
**And** all reads come from cache (per AR-28)

---

### Story 4.2: Wake Lock with persistent indicator and backoff (FR-18, NFR-27, NFR-28)

As Sandy,
I want a Wake Lock acquired on Performance Mode entry, maintained best-effort with reacquisition on every foreground transition, and a static indicator on the Performance Card whenever the lock is NOT held,
So that the phone resting on the Nord doesn't sleep mid-set and I can see at a glance if it might.

**Acceptance Criteria:**

**Given** `web/src/performance/wake-lock.ts`
**When** reviewed
**Then** it exposes `acquire()`, `release()`, `isHeld()`, and an event subscription `onChange(callback)` API
**And** internally it uses the W3C Screen Wake Lock API via `navigator.wakeLock.request('screen')`

**Given** entry to Performance Mode (Story 4.1)
**When** `onStartPerformance` calls `wakeLock.acquire()`
**Then** the implementation calls `navigator.wakeLock.request('screen')`
**And** on success, the held sentinel is stored in module-scope
**And** on failure (API unsupported, OS denial, browser denial), the failure is caught and the indicator (below) is rendered

**Given** the Wake Lock is held
**When** the user backgrounds the app (visibilitychange to hidden)
**Then** the OS may release the lock automatically (this is expected)
**And** when the app foregrounds (visibilitychange to visible) AND `performanceActive === true`, `wakeLock.acquire()` is called again to reacquire
**And** if reacquisition succeeds, the lock is held again

**Given** the Wake Lock sentinel emits a `release` event (OS-initiated revocation)
**When** the event fires AND `performanceActive === true`
**Then** `wakeLock.acquire()` is called to reacquire

**Given** repeated reacquisition failures (e.g., browser does not support the API at all, or OS persistently denies)
**When** failures accumulate
**Then** retries follow an exponential backoff (e.g., 1s → 5s → 30s → 60s cap) — no tight loop (NFR-28)
**And** retries continue while `performanceActive === true`
**And** retries stop when `performanceActive === false`

**Given** the Performance Card is rendered
**When** `wakeLock.isHeld() === false`
**Then** a persistent static indicator appears on the Performance Card adjacent to the position indicator (top-right area per EXPERIENCE.md Component Patterns)
**And** the indicator is small (~16-20pt icon), uses the Performance atmosphere `text-secondary` or a subtle attention color, paired with a glyph + an `aria-label="Screen may sleep"` (per UX-DR6)
**And** the indicator is STATIC — no animation, no blinking, no pulse (NFR-27)
**And** the indicator does NOT block input — Sandy can still tap `NEXT ›` / `‹` / `×` normally

**Given** the indicator is visible and `wakeLock.acquire()` succeeds
**When** the lock is reacquired
**Then** the indicator disappears immediately
**And** no toast or banner announces the change (silent — per AR-28 no toasts in Performance Mode)

**Given** the indicator is visible and Sandy taps the screen anywhere in the middle region
**When** the tap is registered
**Then** the OS treats the tap as user interaction (waking the screen if it had dimmed)
**And** Sandy can continue using the app (per FR-18 — "the user recovers by tapping the screen to wake it; the session continues otherwise unimpeded")

**Given** the indicator carries `aria-live="assertive"`
**When** the indicator first appears
**Then** VoiceOver announces the state (per UX-DR6 / NFR-22)

**Given** exit via `×` (Story 4.3 — preserves state)
**When** the user is back on the Setlist overview
**Then** the Wake Lock REMAINS held (per FR-18 / FR-19 — Performance state preserved on exit, only released on navigate-away)

**Given** end state via navigate-away (Story 4.4)
**When** Performance state ends
**Then** `wakeLock.release()` is called and the lock is released

**Given** the Wake Lock implementation
**When** unit-tested with a mocked `navigator.wakeLock`
**Then** tests cover: successful acquire, failure on unsupported API, OS release event triggers reacquire, foreground triggers reacquire, exponential backoff under persistent failure, release on end-state

---

### Story 4.3: Exit via × + "Currently performing" strip + Resume (FR-19, FR-20)

As Sandy,
I want a small `×` in the top-left of the Performance Card that returns me to the Setlist overview with Performance state preserved, plus a top-anchored `Currently performing: <song>` strip on the overview with a `Resume ›` button,
So that I can glance back at the setlist mid-gig and pick up where I left off with one tap.

**Acceptance Criteria:**

**Given** the Performance Card from Story 4.1
**When** the card renders
**Then** an `×` exit control appears in the top-left corner
**And** the `×` is small (~28pt icon target) with low emphasis in `text-secondary` color (per UX-DR4)
**And** the `×` is spatially separated from `‹` (bottom-left), `NEXT ›` (bottom-right), and from the position indicator (top-right) per UX-DR9
**And** the `×` has `aria-label="Exit performance mode"` (per UX-DR6)

**Given** Sandy taps `×`
**When** the tap is registered
**Then** the router navigates back to `/setlists/:setlistId` (Setlist overview)
**And** `PerformanceModeContext.performanceActive` REMAINS `true` (state preserved per FR-19)
**And** the current Song index, Section position, and Wake Lock state are preserved
**And** the Wake Lock remains held (Story 4.2)
**And** the bottom tab bar reappears on iPhone (chrome shows when `performanceActive === true` BUT user is on the setlist that has active performance state — see special-case below)

**Given** `performanceActive === true` AND the user is on the Setlist overview for the active Setlist
**When** the overview renders
**Then** the bottom tab bar is visible (so Sandy can switch to Library if needed — this triggers FR-21 end state if he leaves)
**And** the top of the page shows a `CurrentlyPerformingStrip` component

**Given** the `CurrentlyPerformingStrip` component (per UX-DR4)
**When** rendered
**Then** it sits at the very top of the Setlist overview, top-anchored
**And** it has `accent` background and `bg` text
**And** it is ~48pt tall
**And** it displays the current Song's title (in `titleSnapshot` form from the Setlist record)
**And** a `Resume ›` button sits right-aligned within the strip
**And** the strip is visible only while `performanceActive === true` AND the user is on the active Setlist's overview

**Given** Sandy taps `Resume ›`
**When** the tap is registered
**Then** the router navigates back to `/performance/:setlistId/:currentSongIndex` (using the preserved Song index)
**And** the Performance Card renders the same Song that was active when `×` was tapped
**And** the chrome hides again on entry per Story 4.1 chrome-hide behavior

**Given** the `Currently performing` strip is showing on the active Setlist's overview
**When** Sandy taps a non-current Song row on that overview
**Then** the router navigates to `/songs/:songId` (Song Detail) per Story 3.3
**And** because navigating to Song Detail OUTSIDE the Setlist's chain ends Performance state (Story 4.4), `performanceActive` becomes `false` and the strip disappears
**And** Wake Lock is released per Story 4.4

**Given** the strip is showing and Sandy edits a per-gig annotation on the overview (Story 3.3 inline edit on MacBook or sheet on iPhone)
**When** the edit commits
**Then** the strip remains visible (annotation edit does not navigate away)
**And** the PUT is enqueued normally per Epic 2 sync layer

**Given** the strip is rendered
**When** screen-reader audit runs
**Then** the strip has a logical heading/region role announcing "Currently performing"
**And** the Song title within the strip is part of the accessible name
**And** the `Resume ›` button has `aria-label="Resume performance"` (or relies on visible text via `aria-labelledby`)

---

### Story 4.4: End Performance state on navigate-away + last-song inert `NEXT ›` (FR-21)

As Sandy,
I want Performance state to END only when I navigate away from the active Setlist entirely, and I want `NEXT ›` to become inert (visibly disabled, no action) when I reach the last Song,
So that I can never accidentally terminate Performance Mode with the same gesture I use to advance Songs.

**Acceptance Criteria:**

**Given** `performanceActive === true` AND a Setlist is the active performance context
**When** Sandy navigates the router to any of these destinations: a different Setlist overview, a Song Detail OUTSIDE the active Setlist's referenced Songs, the Setlists home, the Library list, the install-instructions screen, or any non-overview route
**Then** Performance state ENDS: `setActive(false)` is called, Wake Lock is released (Story 4.2), the `CurrentlyPerformingStrip` (Story 4.3) disappears, and the held-toast queue from AR-28 flushes (any held toasts surface now)

**Given** the active Setlist is, e.g., `setlist-A`
**When** Sandy is on `/setlists/setlist-A` (active overview) and taps a Song row whose `songId` IS referenced by `setlist-A`
**Then** Song Detail opens for that Song — Performance state REMAINS active (the Song is in the active Setlist's chain)
**And** the `CurrentlyPerformingStrip` remains visible IF the route shows it (Note: the strip is on Setlist overview; on Song Detail there is no strip)
**And** returning back to `/setlists/setlist-A` restores the strip visibility

**Given** Sandy is on `/setlists/setlist-A` (active overview) and taps a Song row whose `songId` is NOT referenced by `setlist-A`
**When** the tap navigates to Song Detail
**Then** this is treated as "navigate away from the Setlist entirely" — Performance state ENDS per the rule above

**Given** the Performance Card is on the LAST Song of the LAST non-empty Section
**When** the card renders
**Then** `NEXT ›` is rendered in DESIGN.md's disabled visual state (e.g., dimmed accent, `text-secondary` text, no shadow)
**And** tapping `NEXT ›` does NOTHING — no action, no toast, no error, no haptic, no transition
**And** `aria-disabled="true"` is set on the `NEXT ›` button (per UX-DR6)
**And** the next-song preview area shows nothing (no "End of setlist" text — silent state per PRD Voice & Tone)

**Given** the Performance Card on the LAST Song
**When** Sandy taps `‹`
**Then** the card transitions normally to the previous Song (per Story 4.1)
**And** `NEXT ›` returns to its enabled visual state for that earlier Song

**Given** the Performance Card on the LAST Song
**When** Sandy taps `×`
**Then** the exit behavior from Story 4.3 applies (state preserved, strip shows on overview)
**And** Sandy can `Resume ›` back to the last Song
**And** Sandy can only end Performance state by navigating away (per FR-21)

**Given** there is NO `End performance ›` button anywhere in the UI
**When** auditing the codebase
**Then** no component renders such a button
**And** the comment / story documentation explains the safety rationale: "the user must not be able to terminate Performance state with the same gesture they use to advance Songs" (per FR-21 + the locked memory note "No terminate on advance gesture")

**Given** end state triggers (`setActive(false)` runs)
**When** the held-toast queue is non-empty
**Then** the queued toasts surface in sequence on the next non-Performance surface (the Setlist overview the user navigated to, or wherever they ended up)
**And** the surfacing follows the standard toast presentation from EXPERIENCE.md State Patterns

---

### Story 4.5: Backgrounding survives + Tonight-Gig pre-fetch + `/api/v1/upcoming-gigs` (FR-22, AR-25, AR-40)

As Sandy,
I want the app to survive being backgrounded mid-Performance (re-opening lands on the current Performance Card, not Home), and I want every iPhone foreground to silently pre-fetch tonight's Setlist if a Gig is within 24h,
So that going on stage doesn't depend on a fresh network round-trip, and a mid-set OS interruption doesn't lose my place.

**Acceptance Criteria:**

**Given** `api/src/routes/upcoming-gigs.ts`
**When** `GET /api/v1/upcoming-gigs` is called with a valid auth cookie
**Then** the handler queries GSI1 for the active Band, filtering to Setlists with `gigMeta.date` within the next 24h Europe/London
**And** the response is `{status: 'ok', data: [{setlistId, gigMeta: {venue, date, time}, songRefs: [{songId, titleSnapshot, perGigAnnotation?}]}]}` — minimum fields needed to drive prefetch (full Setlist record can be returned too; the contract is "enough to prefetch downstream")
**And** the response includes `x-server-now`

**Given** the `/api/v1/upcoming-gigs` endpoint
**When** invoked from the deploy blackout check (Story 1.6) OR from the foreground-prefetch logic below
**Then** both callers receive a consistent contract
**And** the deploy blackout check (which uses direct DDB access per Story 1.6) and this API endpoint share the same query semantics (24h Europe/London window)

**Given** `web/src/cache/prefetch.ts`
**When** the iPhone PWA enters the foreground (`visibilitychange` to `visible`)
**Then** the prefetch logic calls `useUpcomingGigs()` (TanStack Query reading `/api/v1/upcoming-gigs`)
**And** for each upcoming Gig within 24h, it calls `queryClient.prefetchQuery(['setlist', setlistId])` and `queryClient.prefetchQuery(['song', songId])` for every referenced Song
**And** prefetches are background / non-blocking — they do NOT block UI
**And** prefetches are scoped to iPhone only (`isIPhone() === true`); MacBook does not run this prefetch

**Given** the prefetch runs successfully
**When** Sandy later taps `Start performance ›` on the prefetched Setlist
**Then** the synchronous prefetch in `onStartPerformance` (Story 4.1) returns immediately from cache (cache hits)
**And** the cold-render-to-card-visible time is well within the 300ms budget (NFR-2)
**And** Performance Mode runs fully offline-capable for the duration (NFR-8)

**Given** the prefetch runs while offline
**When** the network call fails
**Then** the prefetch is silent — no toast, no banner, no log to the user (per FR-31 / EXPERIENCE.md State Patterns)
**And** if a Gig was already cached from a previous online prefetch, the cache remains usable

**Given** the iPhone OS backgrounds the PWA during Performance Mode
**When** `visibilitychange` to `hidden` fires
**Then** `performanceActive` REMAINS `true`
**And** the current Song index, Section position, and route state are preserved
**And** the OS may release Wake Lock automatically (Story 4.2 handles reacquire on foreground)

**Given** the iPhone OS foregrounds the PWA mid-Performance
**When** `visibilitychange` to `visible` fires AND `performanceActive === true`
**Then** the app re-renders the SAME Performance Card the user was on (no advance, no retreat, no reset — FR-22)
**And** no interstitial screen appears (no splash, no "Resuming...", no auth check redirect — per AR-28)
**And** the Wake Lock reacquisition from Story 4.2 fires
**And** the Tonight-Gig prefetch from this story ALSO fires (no harm — most queries are cache hits)

**Given** the iPhone OS-killed the PWA process and Sandy relaunches from the home-screen icon mid-Gig
**When** the SPA boots
**Then** the boot sequence calls `GET /api/v1/me` (NetworkOnly via SW)
**And** if the network returns 200, the app proceeds normally; the router restores `/performance/:setlistId/:songIndex` from the last-known URL state if available (e.g., URL-driven router state)
**And** if the network is unavailable, the cached app shell renders and the cached Setlist + Songs load (per FR-31 / NFR-8)
**And** `performanceActive` is RESTORED to true (e.g., via persisting the flag in IndexedDB or by URL signal `/performance/*`) so AR-28 invariants reactivate

**Given** the prefetch logic and the deploy blackout check both consume "upcoming gigs" semantics
**When** the implementations are reviewed
**Then** the time-window logic (24h Europe/London via the named IANA TZ) is shared OR replicated identically with self-tests in both places (per Story 1.6 self-test requirement extended to client side)

---

## Epic 5: Export & Verified Restore Ship-Gate

Deliver manual JSON export and the FR-34 verified-restore drill that gates V1 ship.

### Story 5.1: JSON export endpoint + Library footer affordance (FR-33, AR-38)

As Sandy,
I want a one-tap full data dump as human-readable JSON, reachable from a footer affordance on the MacBook Library page,
So that I can keep my own off-platform copy of every Song, Setlist, Section, per-gig annotation, and Gig record whenever I want, without going through a dedicated Settings surface.

**Acceptance Criteria:**

**Given** `api/src/routes/export.ts`
**When** `GET /api/v1/export` is called with a valid auth cookie
**Then** the handler scans the DDB `gigbuddy-data` table for all items belonging to the active Band (Query per partition: BAND + SONG + SETLIST_BY_DATE GSI)
**And** assembles the result in-Lambda (no streaming for V1 — Sandy's volume is ~MB-scale)
**And** the response is JSON with shape:
```
{
  "exportedAt": "<ISO-8601 UTC>",
  "schemaVersion": 1,
  "bands": [
    {
      "band": { "bandId": "...", "name": "...", ...metadata },
      "songs": [ <SongSchema>, ... ],
      "setlists": [ <SetlistSchema>, ... ]
    }
  ]
}
```
**And** the response headers include `Content-Type: application/json` and `Content-Disposition: attachment; filename="gigbuddy-YYYY-MM-DD.json"` (date in Europe/London)
**And** the response includes `x-server-now` per the standard envelope rules

**Given** the export endpoint
**When** invoked without a valid auth cookie
**Then** the response is 401 (auth middleware from Story 1.4 applies)

**Given** the export payload
**When** parsed by a human or by a `jq` script
**Then** every record in DDB at the time of export is represented — no record-class is omitted
**And** the structure is stable across exports (same shape for an empty Library and a populated one)

**Given** the schema-version field
**When** the export shape needs to evolve in V2+
**Then** `schemaVersion` is bumped and the V1 importer (if any) refuses unknown versions (forward-compat contract)

**Given** the Library page on MacBook (Story 2.5)
**When** the route renders
**Then** a footer affordance appears at the bottom of the page (below the song list / empty state)
**And** the affordance is a small, low-emphasis link or button with text like `Export all data` (no exclamation, no emoji, voice/tone-compliant per UX-DR7)
**And** the affordance satisfies `min-h-tap`

**Given** Sandy taps `Export all data` on MacBook
**When** the tap is registered
**Then** the browser initiates a download of the JSON archive (the `Content-Disposition: attachment` header drives the save dialog)
**And** the file is named `gigbuddy-YYYY-MM-DD.json` using today's date in Europe/London
**And** no UI confirmation, no progress bar, no toast — the download is the feedback (per PRD Voice & Tone)

**Given** the Library page on iPhone
**When** the route renders
**Then** NO export affordance appears (per FR-33 — MacBook only in V1)

**Given** the export endpoint runs while the DDB table has hundreds of items (well under Sandy's realistic volume)
**When** the response is built
**Then** the total response time is acceptable (<3s) without streaming
**And** Lambda memory is sufficient (the 512MB reserved is well above the ~MB-scale payload)

**Given** the export endpoint
**When** an integration test runs
**Then** it seeds 3 Songs and 2 Setlists (one with per-gig annotations, one with multiple Sections) into a dynamodb-local instance
**And** calls `GET /api/v1/export`
**And** asserts the resulting JSON contains all 3 Songs + 2 Setlists with full structure preserved (including `titleSnapshot` and `perGigAnnotation`)
**And** asserts `schemaVersion === 1` and `exportedAt` is a valid ISO-8601

---

### Story 5.2: Verified restore drill + runbook — V1 SHIP GATE (FR-34, AR-14)

As Sandy,
I want a documented restore runbook and an end-to-end executed drill against the live `gigbuddy-data` table, with sign-off,
So that before V1 ships I have proof — not theory — that PITR + AWS Backup actually return my data and the app reads from a restored table correctly.

**SHIP-BLOCKING:** V1 does not ship until this story passes.

**Acceptance Criteria:**

**Given** `infra/runbooks/restore-pitr.md`
**When** the runbook is read
**Then** it contains the following sections, in order:
  1. **Purpose** — what this runbook is for (FR-34 verified restore obligation)
  2. **Triggers** — when to execute (data loss event, scheduled drill, ship gate)
  3. **Prerequisites** — AWS SSO access, DDB read+restore IAM permissions, local AWS CLI configured to eu-west-2
  4. **RPO / RTO targets** — RPO ~5 min (PITR continuous), RTO ≤2 hours per FR-34 (target 15–60 min)
  5. **Step-by-step procedure** with explicit AWS CLI commands and expected outputs at each step
  6. **Validation checks** — what to verify at each step
  7. **Rollback** — how to revert if the drill misfires
  8. **Sign-off log** — table for date, executor, outcome, notes

**Given** the runbook's step-by-step procedure
**When** read
**Then** it covers exactly these phases:
  - **Phase 1 — Seed a canary record:** PUT a Song with `title: "RESTORE CANARY <timestamp>"` into `gigbuddy-data`
  - **Phase 2 — Wait 5 minutes:** PITR continuous backup needs to roll forward past the canary write
  - **Phase 3 — Initiate PITR restore:** `aws dynamodb restore-table-to-point-in-time --source-table-name gigbuddy-data --target-table-name gigbuddy-data-restore-<timestamp> --restore-date-time <ISO-8601>`
  - **Phase 4 — Wait for restore completion:** poll `aws dynamodb describe-table` until `TableStatus: ACTIVE`
  - **Phase 5 — Validate canary present in restored table:** `aws dynamodb get-item` against the restored table, confirm canary returned
  - **Phase 6 — Swap Lambda's `TABLE_NAME` env to point at the restored table:** via `aws lambda update-function-configuration`
  - **Phase 7 — Confirm app reads correctly:** open the deployed URL, navigate to Library, verify Songs render (including the canary). Optionally run the Playwright spec from `e2e/restore/verified-restore.spec.ts`
  - **Phase 8 — Swap `TABLE_NAME` back to the original `gigbuddy-data`:** restore normal operation
  - **Phase 9 — Delete the side table:** `aws dynamodb delete-table` against the restored table (or leave it briefly for further inspection — runbook specifies which)
  - **Phase 10 — Delete the canary record from `gigbuddy-data`:** clean up

**Given** each phase has expected timing
**When** the runbook is read
**Then** Phase 4 (restore wait) is the dominant time cost — typically 5–15 min for a small table
**And** the total drill time is documented as 15–60 min, comfortably under FR-34's ≤2h ceiling

**Given** `e2e/restore/verified-restore.spec.ts`
**When** the Playwright spec runs against the deployed app pointed at a restored table
**Then** the spec logs in via the auth gate
**And** verifies the Library lists at least one Song (the canary, or any pre-seeded Song)
**And** verifies that opening a Setlist overview renders Songs (data structure integrity check)
**And** the spec is parameterized so the drill executor can pass the test URL and credentials

**Given** the verified-restore drill is executed
**When** all 10 phases complete successfully
**Then** the runbook's Sign-off log table is updated with: date, executor name, total elapsed time, RPO observed, RTO observed, notes
**And** the row is committed to git as part of the drill's PR (the drill execution itself is recorded in the runbook)

**Given** the drill encountered any failure during execution
**When** the failure is reproduced or analyzed
**Then** the runbook's Rollback section is followed
**And** the failure cause is documented in the Sign-off log
**And** the story is NOT marked complete until a clean drill passes end-to-end

**Given** V1 readiness review before ship
**When** the team (Sandy) verifies the ship gates
**Then** this story has a passing Sign-off entry from a real execution against the live `gigbuddy-data` table (not a separate test account)
**And** the entry is dated within the last 90 days of the ship decision (older entries may not reflect current architecture state)

**Given** the AWS Backup vault is also in place (Story 1.3)
**When** the runbook is reviewed
**Then** it notes that PITR is the primary restore mechanism (RPO ~5 min)
**And** AWS Backup daily snapshots are the secondary mechanism (RPO ~24h) for restores older than PITR's 35-day window
**And** the runbook includes a brief secondary procedure for restoring from AWS Backup (referencing the same env-swap pattern from Phase 6)

**Given** the deletion guardrails from Story 1.3 (DDB `DeletionProtection: true` + CDK termination protection)
**When** the drill runs
**Then** the side table is created fresh by `restore-table-to-point-in-time` (not subject to the original table's deletion protection — restored tables are separate resources)
**And** the side table CAN be deleted after the drill (the deletion protection applies only to `gigbuddy-data` itself)
**And** the runbook explicitly notes that the original `gigbuddy-data` table's DeletionProtection must NEVER be disabled as part of the drill

**Given** Sandy completes the drill
**When** the Sign-off log is updated
**Then** this story is marked complete
**And** the V1 ship gate is cleared
**And** future drills (e.g., quarterly) re-execute the runbook and append new Sign-off entries

