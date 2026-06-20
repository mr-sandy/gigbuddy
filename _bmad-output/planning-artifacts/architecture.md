---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-06-09'
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-gigbuddy-2026-06-09/prd.md
  - _bmad-output/planning-artifacts/prds/prd-gigbuddy-2026-06-09/.decision-log.md
  - _bmad-output/planning-artifacts/prds/prd-gigbuddy-2026-06-09/reconcile-brief.md
  - _bmad-output/planning-artifacts/prds/prd-gigbuddy-2026-06-09/reconcile-design.md
  - _bmad-output/planning-artifacts/prds/prd-gigbuddy-2026-06-09/reconcile-experience.md
  - _bmad-output/planning-artifacts/prds/prd-gigbuddy-2026-06-09/review-rubric.md
  - _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-gigbuddy-2026-06-08/DESIGN.md
  - _bmad-output/planning-artifacts/briefs/brief-gigbuddy-2026-05-31/brief.md
workflowType: 'architecture'
project_name: 'gigbuddy'
user_name: 'Sandy'
date: '2026-06-09'
---

# Architecture Decision Document — GigBuddy

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

GigBuddy is a single-user, two-surface PWA with one canonical AWS-hosted store. 34 FRs across 8 feature areas; 5 NFR groups. Modest surface area; the difficulty is concentrated in one place: Performance Mode reliability on gig nights.

**Functional surface:**
- Song Library + Setlist Management (prep surface on MacBook)
- Performance Mode (iPhone-only, sacred state)
- Persistence & Sync across two devices
- Access gate (FR-27), Backup (FR-34) — both architecturally open
- Multi-Band data model (V1 ships one Band; V2-ready without migration)

**Non-functional drivers:**
- §A.1 Performance: 150ms transitions, 300ms cold render, 500ms paste-to-parse — all in Performance Mode, all defect-class misses
- §A.2 Reliability: must be available during gig windows; deploy automation enforces a 24h pre-gig blackout (queries upcoming Gigs from the live store), with weekend evenings as static fallback
- §A.3 Security: HTTPS, encryption at rest, secrets via AWS-managed mechanisms, single access gate
- §A.4 Observability: CloudWatch only; no user analytics
- §A.5 Accessibility: WCAG AAA in Performance, AA in Practice; 18pt body floor

### Scale & Complexity

- Primary domain: PWA + small backend on AWS
- Complexity level: **low–medium** by code volume, **medium-high** by reliability floor (gig-night defect class)
- Single region, single tenant, single user — no horizontal scale concerns

### Load-bearing architectural drivers (priority order)

1. Performance Mode is sacred — nothing in the hot path that can fail at 9 PM
2. Two devices, one store, LWW conflict resolution (concurrent edits expected to be rare)
3. V2-mineable history preserved from day one — Setlists are not soft-deleted out of analytics range
4. Single user on personal AWS — cost-discipline rule: non-obvious spend requires justification
5. ≤24h data loss / ≤2h restore — backup mechanism + verified restore runbook is a release gate
6. PWA constraints — Wake Lock requires HTTPS + install; offline cache pre-loaded on `Start performance ›`
7. Access gate must keep deployment off the open internet, no account-management UI

### Technical Constraints & Dependencies (non-negotiable from PRD)

- AWS only, personal account, single region
- Single user, single tenant — no accounts, no sharing
- LWW per record, not per field
- ≤24h data loss / ≤2h restore-to-operational
- MacBook web (current Safari/Chrome/Firefox) + iPhone 13 PWA only
- No theme toggle, no Settings surface
- No user analytics; CloudWatch only

### Cross-Cutting Concerns

- Optimistic local writes + offline outbox + LWW sync (FR-30–32)
- Performance Mode toast suppression — sync error UI gated on a "performance active" flag (FR-30)
- Service worker pre-cache of Setlist + Songs on entry to Performance Mode (FR-31)
- Setlist history first-class — denormalize Song fields onto played Setlist rows OR snapshot at play time (to be decided Step 4) so Song mutations don't rewrite history
- Backup restore runbook is a ship-gate (FR-34)
- Deploy blackout enforcement: CI reads upcoming Gig dates from the live store at deploy time (§A.2)
- Secrets via Secrets Manager / Parameter Store (§A.3)

### Decisions Deferred to Step 4

- Access gate mechanism (FR-27)
- Data store choice (FR-29)
- Backup strategy + retention (FR-34)
- Sync/offline implementation pattern (FR-30–32)
- AWS hosting shape with cost-justification per choice
- Deploy automation + gig-window blackout (§A.2)

## Foundation Stack

### Primary technology domain

PWA (static SPA + small REST API + IaC), TypeScript end-to-end. Two deployables: web (static, CDN) and api (serverless or single instance — Step 4). One repo, top-level `web/`, `api/`, `infra/`, `shared/`.

### Selected stack

**Frontend (`web/`):**
- Vite 6 + React 19 + React Router 7 (library mode)
- TypeScript strict
- Tailwind CSS v4 with `@theme` tokens lifted from `DESIGN.md`
- TanStack Query v5 for server-state + sync cache
- IndexedDB-backed outbox for offline writes (protocol in Step 4)
- vite-plugin-pwa (Workbox) for service worker, manifest, install
- Native `navigator.wakeLock` (no wrapper library)
- Vitest + React Testing Library
- Playwright for E2E (gig-night smoke + FR-34 restore verification)

**Backend (`api/`):**
- TypeScript on Node 22
- Hono as the HTTP framework (subject to Step 4 hosting confirmation)
- Zod schemas in `shared/` for record validation
- Same Zod schemas inferred to TypeScript types on both ends

**Shared (`shared/`):**
- Record schemas (Band, Song, Setlist, Section, PerGigAnnotation, Gig)
- API request/response types
- Single Zod source of truth

**Infrastructure (`infra/`):**
- AWS CDK v2 in TypeScript
- Stacks: `web` (S3 + CloudFront), `api` (decided Step 4), `data` (decided Step 4), `deploy-blackout` (§A.2)

**Tooling:**
- pnpm
- Biome for lint + format (single tool, solo-friendly)
- TypeScript strict mode everywhere

### Decisions deferred to later steps

- Backend hosting shape (Lambda+APIGW vs ECS Fargate vs single small EC2): **Step 4**
- Data store (DynamoDB vs RDS Postgres vs SQLite-on-EFS): **Step 4**
- Backup mechanism (DDB PITR vs RDS snapshots vs S3 dump): **Step 4**
- Sync protocol details (request shape, conflict timestamp source): **Step 4 / Step 5**
- Specific token values from DESIGN.md → tokens.css: first implementation story

### What this stack does NOT include (deliberate)

- No SSR / no Next.js (no SEO need; gated app; Vercel off-limits per AWS-only constraint)
- No native mobile app (PWA delivers Wake Lock, install, full-screen)
- No monorepo build tool (Turborepo / Nx not justified for two deployables)
- No state management library beyond TanStack Query (no Redux, no Zustand)
- No CSS-in-JS (Tailwind handles styling)
- No form library (inline edit is too simple to need one)
- No analytics SDK (per §A.4)

### Initialization (first implementation story)

```bash
pnpm create vite@latest web -- --template react-ts
pnpm create aws-cdk@latest infra
mkdir api shared
```

Then add: Tailwind v4, vite-plugin-pwa, TanStack Query v5, React Router 7, Zod, Hono, Biome.

**Note:** Project initialization using this command set should be the first implementation story.

## Core Architectural Decisions

**Region:** eu-west-2 (London). **Timezone:** Europe/London. **Domain:** Sandy's subdomain (specific name finalized at Story 1).

### Decision Priority Analysis

**Critical (block implementation):** Access Gate, Data Store, Hosting Shape, Sync model.
**Important (shape architecture):** Backup/Recovery, Deploy Automation.
**Deferred:** None — all six PRD-deferred decisions resolved here.

---

### 1. Access Gate (FR-27)

**Decision:** App-level single-password gate with a long-lived signed-JWT cookie.

- One password, argon2-hashed, stored in SSM Parameter Store SecureString
- `POST /api/auth/login` verifies and sets `gigbuddy_session` cookie: HTTP-only, Secure, SameSite=Strict, 365-day expiry, signed JWT (HS256 with key from SSM)
- Hono middleware enforces cookie on all `/api/*` routes; returns 401 otherwise
- SPA bundle is publicly readable (carries no data); on load it calls `/api/me`; 401 routes to `/login` **only when reached via successful network response** (offline-cached 401 must not trigger login navigation — see Decision 4)
- No account-management UI; recovery is SSM rotation by Sandy
- Cookie expiry within 30 days triggers a foreground-on-MacBook reminder ("re-auth within N days")

**Why not Passkey/WebAuthn:** slicker UX but adds machinery and complicates recovery story. V2 candidate.
**Why not Cognito:** wildly overpowered for one user.
**Why not CloudFront basic-auth:** iOS PWA UX is poor; doesn't survive sessions cleanly.

**JWT key handling (hard rules):**
- Lambda fetches the JWT signing key from SSM Parameter Store at cold-start, caches in module-scope memory for the warm lifetime
- **Never** in Lambda environment variables, **never** logged, **never** returned in API responses
- Manual rotation: write new key to SSM, redeploy Lambda; all sessions invalidate, Sandy re-logs in once. Acceptable at single-user scale.
- Same handling rules apply to the SSM-stored password hash.

**Password requirement:** Sandy generates a ≥20-char random password. Document in onboarding runbook.

---

### 2. Data Store (FR-29)

**Decision:** DynamoDB single-table, on-demand billing, PITR enabled, eu-west-2. **Setlist content (sections + song refs + annotations) embedded in the Setlist record.**

**Table:** `gigbuddy-data`

**Item shapes:**

```
pk = BAND#<bandId>, sk = META
  { name, createdAt, ... }                                                 (band metadata)

pk = BAND#<bandId>, sk = SONG#<songId>
  { title, key, patch, chordChart, performanceNotes, practiceNotes,
    clientWrittenAt, serverReceivedAt, version }                            (song record)

pk = BAND#<bandId>, sk = SETLIST#<isoDate>#<setlistId>
  { gigMeta: { venue, date, time },
    sections: [
      { name, songs: [{ songId, titleSnapshot, perGigAnnotation? }, ...] },
      ...
    ],
    clientWrittenAt, serverReceivedAt, version }                            (setlist — embedded)
```

**Indexes:**

- **GSI1 — setlists by date:** `gsi1pk = BAND#<bandId>#SETLIST_BY_DATE`, `gsi1sk = <isoDate>#<setlistId>` — drives Home surface sectioning (Tonight / Upcoming / Past) and all V2 analytics queries

**Why embedded Setlists (rather than separate per-row items):**

- **V1 read perf:** Setlist overview surface (FR-13) is one item read, not N+1
- **V2 analytics:** Q1 ("Songs not played in N months"), Q2 ("most-played"), Q4 ("balance"), Q5 ("over-reliance") all collapse to one GSI Query + in-app aggregation — no per-Setlist fan-out
- **LWW-per-record fits cleanly:** whole-Setlist PUT replaces a single item. Per-gig annotation edit, row reorder, section rename — all rewrite the same item. Atomic by default. No multi-item DDB transactions needed.
- **Size:** ~5KB for a 30-song annotated Setlist. DDB 400KB item limit gives ~80× headroom.

**Per-record sync metadata:**
- `clientWrittenAt` (client-stamped at edit) + `serverReceivedAt` (server-stamped on write)
- LWW comparison on `clientWrittenAt`

**Setlist history first-class:** every Setlist persists with its songs and annotations as authored at gig time. Each song ref carries `titleSnapshot` — renaming a Song does not rewrite historical Setlists. V2 analytics aggregate on `songId`; display uses `titleSnapshot`. **No migration needed for V2.**

**Access:** IAM-scoped Lambda access; public AWS endpoint (no VPC).

**Deletion guardrails:**
- DynamoDB **`DeletionProtection: true`** on `gigbuddy-data` (CDK flag; blocks `DeleteTable` API call until explicitly disabled)
- CDK **termination protection** on the data stack (blocks `cdk destroy`)
- No "delete all records" admin endpoint in the API; no admin endpoints at all in V1

**Cost:** ~$0.20/mo at single-user volume.

**Why not RDS Postgres:** $13+/mo idle minimum; operational tax (patching, snapshots, version upgrades) not earned at this scale.

**Escape hatch for V2 analytics:** if in-app aggregation gets unwieldy, DDB → S3 export → Athena. Pay for it when we need it.

**Rejected:** Aurora Serverless v2 (~$40/mo minimum); SQLite-on-EFS (cold-start tax, single-writer concurrency); S3 JSON blobs (no indexed reads).

#### V2 evolution paths (additive, no migration)

- **Multi-Band listing:** when V2 populates Middle Aged Dad Band + Fram, add a registry item (`pk = REGISTRY`, `sk = BAND#<bandId>`) maintained on Band creation, OR a GSI keyed across all Bands. Either is additive.
- **Song/Setlist delete (no V1 FR):** when V2 needs delete (cancel upcoming gig, retire a Song), add `deletedAt` field; Library list filters by `deletedAt == null`; historical Setlist rows continue rendering via `titleSnapshot`.
- **Last-played-per-song denormalization:** if V2's Q3 ("when was Song X last played?") gets hot, add `pk = BAND#<bandId>`, `sk = SONG_LASTPLAYED#<songId>` items maintained on Setlist write. Not needed for V1; not needed if V2 stays under ~hundreds of setlists.
- **"Open to other musicians" (V2-distant):** the brief asks the architecture not foreclose this path but not design for it either. Per-Band partitioning naturally accommodates a future `pk = TENANT#<id>#BAND#<id>` migration. Migration cost accepted explicitly if that path ever arrives.

---

### 3. Backup & Recovery (FR-34)

**Decision:** DynamoDB PITR (35-day continuous) + AWS Backup daily plan (365-day retention with cold-storage transition at 30 days) + restore-runbook release gate.

- PITR enabled on `gigbuddy-data`; RPO ~5 min, far inside FR-34's ≤24h ceiling
- AWS Backup daily snapshot to a Backup Vault (eu-west-2, KMS-managed); cold-storage transition at 30 days; retain 365 days
- Restore runbook: `infra/runbooks/restore-pitr.md` — explicit steps, expected timings, validation checks
- **Verified-restore release gate:** as part of V1 acceptance, the runbook is executed end-to-end. Drill: seed canary record → restore via PITR to side table → validate canary present → swap app's `TABLE_NAME` env to restored table → confirm app reads correctly → swap back. **Ship-blocking story.**

**RTO:** 15–60 min for a small table (restore + env swap + smoke test) — well inside FR-34's ≤2h ceiling.
**Cost:** <$1/mo. **No spend flagged per §8.10.**

---

### 4. Sync & Offline (FR-30–32)

**Decision:** TanStack Query v5 for read cache (persisted to IndexedDB), custom IndexedDB outbox for optimistic writes with per-record coalescing, LWW-by-`clientWrittenAt` enforced at the API.

**Client-side architecture:**
- TanStack Query keyed by record id; cache persisted to IndexedDB; survives reload + offline
- **`navigator.storage.persist()` requested on app boot** — marks storage as persistent so iOS Safari does not evict outbox or cache under storage pressure
- **iPhone install-detection gate:** on iPhone, if `display-mode: standalone` / `navigator.standalone` is false, the SPA routes to install-instructions before Performance Mode is reachable. PWA install is a hard precondition (per PRD §B).
- **Mutation outbox** in a separate IndexedDB store: `{id, op, recordKey, payload, clientWrittenAt, status}`
  - **Coalesces by `recordKey`**: on enqueue, if a non-in-flight entry exists for the same recordKey, replace it. At most 2 entries per recordKey at any time (in-flight + next-up). Outbox is "current best state per record," not an edit log.
  - Flusher attempts PUT immediately on enqueue; retries on `online` event, app foreground, and 30s background timer
- **Performance Mode pre-fetch:** `Start performance ›` triggers explicit `prefetchQuery` for Setlist + every referenced Song
- **Proactive Tonight-Gig pre-fetch:** every iPhone foreground checks if a Gig falls within 24h; if so, pre-fetches its Setlist + Songs in background. Combined with persistent storage, the cache reliably contains gig content well before the user goes on stage.
- **Performance Mode renders from cache regardless of auth status.** If `/api/me` fails (network, cold-start timeout, expired cookie), Performance Mode still reads the cached Setlist. Auth failure during gig window surfaces only as a quiet MacBook-only banner — never blocks playback.
- **Performance-active flag** is an app-state primitive read by sync, error, and toast subsystems. While true: no banners, no toasts, no auth redirects. Held-toast queue surfaces on exit (per FR-30).
- `navigator.onLine` monitored; no "you are offline" banner (per FR-31). MacBook-only quiet banner on persistent sync failure (>3 retries over >5 min).

**Server-side LWW:**
- Every record carries `clientWrittenAt` (client-stamped) and `serverReceivedAt` (server-stamped)
- Incoming write: compare incoming `clientWrittenAt` to stored `clientWrittenAt`
  - Incoming ≥ stored → **persist**; response: `{status: 'applied', record}`
  - Incoming < stored → **drop silently**; response: `{status: 'dropped-as-stale', currentState: record}`
- Client on `dropped-as-stale`: invalidate cache for that record, re-fetch, surface a brief "your earlier edit was superseded" banner on MacBook (silent on iPhone Performance Mode per FR-30)
- **Whole-record PUT semantics.** Clients always send the complete record on write; LWW is per-record, not per-field, per FR-32. For Setlists this means PUT replaces the entire embedded structure (sections + songs + annotations) atomically — reorders, section renames, and annotation edits are all whole-Setlist PUTs against the single embedded item. Refresh-on-foreground (above) shrinks the cross-device clobber window to "edits since last foreground."
- **Server includes `serverNow` ISO-8601 in every response header.** Client logs/warns on `|serverNow - Date.now()| > 30s` — diagnostic for clock-skew scenarios that would otherwise corrupt LWW ordering.

**Service worker (Workbox, via vite-plugin-pwa):**
- API GET (most routes): **`NetworkFirst`** with cache fallback
- API GET `/api/me`, `/api/auth/*`, `/api/health`: **`NetworkOnly`** (never cache auth state)
- API POST/PUT/DELETE: **`NetworkOnly`** (outbox is the offline-write authority; SW must not double-queue)
- Static assets: **`CacheFirst`** with revalidate
- SW update strategy: **`skipWaiting: false`, `clientsClaim: false`** — new SW installs but waits for clean cold-start to activate. Combined with §A.2 deploy blackout, no mid-gig SW activation possible.

---

### 5. AWS Hosting Shape

**Decision:** S3 + CloudFront (static SPA) + Lambda Function URL behind same CloudFront (API) + DynamoDB. No VPC.

```
                  ┌────────────────────────────────┐
                  │   CloudFront distribution      │
                  │   (one cert, one origin set)   │
                  └──┬─────────────────────────┬───┘
       /api/* ───────┘                         └─────── default
              │                                              │
              ▼                                              ▼
   ┌──────────────────────┐                        ┌─────────────────┐
   │  Lambda Function URL │                        │   S3 (private)  │
   │  Hono app (Node 22,  │                        │   SPA bundle    │
   │  ARM64, esbuild)     │                        └─────────────────┘
   └──────────┬───────────┘
              │ IAM auth
              ▼
   ┌──────────────────────┐
   │   DynamoDB           │
   │   gigbuddy-data      │
   │   PITR + Backup      │
   └──────────────────────┘
```

**Components:**
- **CloudFront** (single distribution) — ACM cert in us-east-1 for the subdomain; Route 53 hosted zone in eu-west-2. Two behaviors: `/api/*` → Lambda Function URL origin (custom origin); default → S3 origin via OAC.
- **S3** (private bucket, OAC) — SPA bundle, manifest, icons, service worker, fonts.
- **Lambda** (ARM64 Graviton, Node 22, 512MB) — single Hono app handling all API routes. esbuild-bundled, target <1MB zip, target sub-200ms cold start. **No VPC** — DDB reachable via public AWS endpoint with IAM auth; VPC would add cold-start tax and either NAT-Gateway or VPC-endpoint cost.
- **DynamoDB** — public endpoint, IAM-auth from Lambda.
- **SSM Parameter Store** — SecureString for password hash and JWT signing key.
- **CloudWatch Logs** — Lambda logs (14-day retention), CloudFront access logs (S3-backed, 30-day retention).
- **Route 53** — hosted zone for Sandy's domain, A/AAAA alias records to CloudFront.

**Estimated steady-state cost:** ~$1.55/mo.

| Item | Monthly |
|---|---|
| Route 53 hosted zone | $0.50 |
| CloudFront (minimal traffic) | ~$0.50 |
| S3 storage + requests | ~$0.05 |
| Lambda (within free tier) | $0.00 |
| DynamoDB on-demand + PITR | ~$0.20 |
| AWS Backup vault | ~$0.10 |
| CloudWatch Logs (with retention) | ~$0.20 |
| ACM cert | $0.00 |
| SSM Parameter Store SecureString | $0.00 |
| **Total** | **~$1.55/mo** |

**Cost-justified non-obvious choices (per PRD §8.10):**
- **Lambda over App Runner / Fargate / EC2:** $0 vs $15–30/mo idle; cold-start outside Performance Mode hot path (Decision 4 makes Performance Mode cache-independent of auth/API)
- **DynamoDB over RDS:** ~$0.20 vs ~$13/mo idle; eliminates patching/snapshot operational tax
- **No VPC:** saves $35/mo NAT Gateway or ~$8/mo per VPC endpoint
- **SSM Parameter Store over Secrets Manager:** free vs $0.40/secret/mo; no rotation requirement
- **CloudFront WAF rate-limit rule (added):** ~$1/mo + per-request — bounds opportunistic scanning damage. Justified against C1.2.

**Nothing in this shape is materially more expensive than the cheapest viable alternative.**

#### Cost guardrails (against runaway-bill scenarios)

- **AWS Budgets alarms:** email Sandy at $5/mo and $20/mo thresholds. Free.
- **Lambda reserved concurrency = 50:** caps blast radius if a bug or attack spikes invocations
- **CloudFront WAF rate-limit rule:** 100 requests per IP per 5 min, returning 429. Defeats opportunistic scanning of the subdomain.
- **CloudWatch Logs retention explicit:** Lambda logs 14 days, CloudFront access logs 30 days. Prevents indefinite log growth.
- **AWS Backup vault retention capped** at 365 days with cold-storage transition (already in Decision 3).
- **DynamoDB on-demand billing** scales linearly with usage; combined with reserved Lambda concurrency, the upper bound is bounded.

#### Account & DNS hygiene

- **No long-lived AWS IAM access keys anywhere.** GitHub Actions uses OIDC (see Decision 6). Human access is via AWS SSO.
- **CloudTrail enabled** with S3 destination in eu-west-2. Forensic-grade audit log of all AWS API calls; 90-day retention in S3, then lifecycle to Glacier.
- **All DNS in CDK / Route 53** via IaC — no manual Route 53 changes
- **CAA record** for the subdomain restricting cert issuance to `amazon.com` (ACM) — defeats some MITM scenarios
- **CloudFront cache policy explicit:** `CachingDisabled` for `/api/*` behavior (forwards Cookie + Authorization headers; never caches); `CachingOptimized` for default (static) behavior. Codified in CDK so drift requires a code review.

---

### 6. Deploy Automation + Gig-Window Blackout (§A.2)

**Decision:** GitHub Actions pipeline with two-stage blackout check (fail-closed on infra errors); static Fri–Sun 18:00–24:00 Europe/London fallback only when DDB returns zero records cleanly.

**Pipeline (`.github/workflows/deploy.yml`):**

1. checkout, setup-node, pnpm install
2. lint, typecheck, unit tests
3. **Blackout check** — see below
4. `cdk diff` (informational)
5. `cdk deploy` (api + data + web stacks)
6. Upload SPA bundle to S3
7. CloudFront invalidation
8. **Smoke test both CloudFront origins:**
   - `GET /api/health` → 200 (Lambda origin reachable, cache bypass works)
   - `GET /index.html` → 200 with `cache-control` indicating CDN cache (S3 origin reachable, caching applied)

**Blackout check (two-stage, fail-closed):**

- Assume `deploy-role` IAM via GitHub OIDC (no long-lived keys). **OIDC trust policy scoped** so the role is assumable only from `token.actions.githubusercontent.com:sub` matching `repo:<owner>/gigbuddy:ref:refs/heads/main` — PR runners cannot assume the role.
- **Stage 1 — probe:** `DescribeTable` on `gigbuddy-data`. Any failure (IAM, network, throttling) → **fail the deploy** with message: "blackout check could not run reliably; use `deploy-force.yml` after confirming no Gig in 24h."
- **Stage 2 — query:** scan/query upcoming Gigs within 24h Europe/London. Any exception → **fail the deploy** (same message).
- **Decision:**
  - Stage 2 returns any Gig → **fail** with venue/date in message
  - Stage 2 returns zero records → fall back to static check: if current Europe/London time is Fri/Sat/Sun 18:00–24:00 → **fail**, else proceed
- Script: `infra/scripts/blackout-check.ts`, shared with the CDK package. Uses named TZ `Europe/London` (not UTC offset). Self-test covers GMT and BST.

**Manual override (`deploy-force.yml`):**
- `workflow_dispatch` with required `reason` text input
- **Before allowing override:** the workflow enumerates blocking Gigs in next 24h and requires Sandy to type the venue name of the nearest blocking Gig as a second confirmation input
- Skips blackout check; runs the rest of the pipeline
- Reason text + venue confirmation logged to workflow history and CloudWatch
- For emergencies only

**Branch protection:**
- `main` is protected; PRs must pass lint + test before merge
- Blackout check is a deploy-time guard, not a PR-time guard (gig times change)

---

### Pre-mortem outcomes (gig-night failure modes addressed)

The six decisions above incorporate findings from a pre-mortem against gig-night failure modes. The architecture-level changes folded in:

| Risk | Mitigation in architecture |
|---|---|
| iOS Safari evicts outbox under storage pressure → lost writes | `navigator.storage.persist()` on boot; iPhone install-detection gate (PWA install is hard precondition) |
| Lambda cold-start + expired cookie strands user on /login at 8:55 PM | Performance Mode renders from cache regardless of auth status; auth failure is MacBook-banner-only during gig window |
| SW cache evicted between prep and gig → no setlist when iPhone goes offline | Pre-fetch broadened from `Start performance ›` to every iPhone foreground when Gig within 24h |
| Blackout check fails-open on IAM/network errors | Two-stage check; any infra error fails the deploy |
| Manual `--force` override misused as path of least resistance | Workflow enumerates blocking Gigs and requires typing venue name as second confirmation |
| Offline outbox grows unboundedly with repeated edits | Outbox coalesces by recordKey; max 2 entries per record |
| Stale write silently dropped server-side; client cache drifts | Server returns `{status: 'dropped-as-stale', currentState}`; client invalidates and refreshes; quiet MacBook banner |
| iOS clock skew corrupts LWW ordering | Server includes `serverNow` header; client warns on >30s drift (diagnostic, no algorithm change) |
| SW auto-updates mid-gig | `skipWaiting: false` + §A.2 deploy blackout (belt and braces) |
| SW caches 401 from `/api/me`; cached 401 strands user offline | `NetworkOnly` for `/api/me`, `/api/auth/*`, `/api/health`; SPA distinguishes "offline → cache" from "online + 401 → login" |
| Whole-record PUT clobbers cross-device field edits | Documented as accepted trade-off (FR-32 LWW per-record); refresh-on-foreground shrinks the window |

### Decision Impact Analysis

**Implementation sequence (story-level):**

1. **Story 1 — Project init.** Repo scaffold per Foundation Stack (Vite + React + TS + Tailwind v4 + pnpm + Biome; CDK skeleton; api skeleton with Hono; shared package with Zod schemas).
2. **Story 2 — CDK infra stacks.** Data stack (DDB + PITR + AWS Backup vault), web stack (S3 + CloudFront + ACM + Route 53), api stack (Lambda Function URL + IAM), SSM SecureStrings, OIDC role for GitHub Actions.
3. **Story 3 — Auth flow end-to-end.** `/api/auth/login`, `/api/me`, JWT cookie, Hono middleware, login screen, SPA boot routing distinguishing offline-cache from online-401.
4. **Story 4 — Sync layer.** TanStack Query, IndexedDB persistence, outbox with per-record coalescing, `navigator.storage.persist()`, LWW server logic with stale-write response, `serverNow` clock-skew header.
5. **Story 5 — Service worker.** vite-plugin-pwa with Workbox; the four strategy classes (NetworkFirst, NetworkOnly per auth/health/mutations, CacheFirst static); skipWaiting false.
6. **Story 6 — iPhone install gate + tokens.css.** Install-detection routing; DESIGN.md tokens lifted to tokens.css; theme atmospheres wired per surface.
7. **Stories 7–N — Feature stories** (Library, Setlist Management, Performance Mode, Home, Multi-Band, Export). All depend on Stories 3–5.
8. **Story N+1 — Deploy pipeline + blackout check.** GitHub Actions workflow, two-stage check, manual-override workflow with venue confirmation.
9. **Story N+2 — Pre-fetch & cache strategy.** Tonight-Gig pre-fetch on foreground; explicit prefetch on `Start performance ›`.
10. **Story N+3 — Restore runbook + verified drill.** Author runbook; execute drill end-to-end. **Ship gate.**

**Cross-component dependencies:**
- Sync layer (4) depends on auth (3) and data stack (2)
- All feature stories (7–N) depend on sync layer (4) + tokens (6)
- Deploy pipeline (N+1) depends on at least one Gig record in DDB for end-to-end blackout-check testing (use a seed "test gig" record or accept the static fallback for the first few deploys)
- Restore drill (N+3) depends on everything else; it validates the operational floor

## Implementation Patterns & Consistency Rules

These patterns lock the choices AI dev agents would otherwise re-invent per story. They are the contract; deviations require updating this document, not the implementation.

### Naming conventions

**TypeScript code:**
- `camelCase` for variables, functions, hooks
- `PascalCase` for types, interfaces, React components, Zod schemas
- `SCREAMING_SNAKE_CASE` for module-level constants
- File names: `kebab-case` (`song-detail.tsx`, `outbox-flusher.ts`)
- Test files co-located: `song-detail.tsx` + `song-detail.test.tsx` (same folder)

**JSON over the wire:**
- `camelCase` keys throughout (`clientWrittenAt`, `perGigAnnotation`, `titleSnapshot`)
- Never `snake_case` in API request/response bodies

**DynamoDB partition/sort keys:**
- `SCREAMING_SNAKE_CASE` type prefix with `#` separator
- `BAND#<bandId>`, `SONG#<songId>`, `SETLIST#<isoDate>#<setlistId>`, `SETLIST_BY_DATE`, `REGISTRY`
- IDs use NanoID (16-char URL-safe), never UUIDs or auto-incrementing ints

**API routes:**
- `/api/v1/<resource>` plural noun (`/api/v1/songs`, `/api/v1/setlists`)
- Path params: `/api/v1/songs/:songId` (camelCase)
- Single canonical version `/api/v1/` from day one; future breaking changes go to `/api/v2/`

### API response envelope

**Success / applied write:**
```json
{ "status": "applied", "data": { "...record": "..." } }
```

**Stale write dropped (per LWW):**
```json
{ "status": "dropped-as-stale", "currentState": { "...record": "..." } }
```
HTTP 200 (write was processed, just not persisted; client invalidates and shows MacBook banner).

**Error (validation, unauth, infra):**
```json
{ "status": "error", "error": { "code": "VALIDATION_FAILED", "message": "..." } }
```
HTTP 400 / 401 / 5xx as appropriate.

**Read (GET):**
```json
{ "status": "ok", "data": "..." }
```

**Every response includes header `x-server-now: <ISO-8601>`** for client clock-skew detection (Decision 4 / F1.1).

### Record shapes (canonical Zod schemas in `shared/`)

```ts
// shared/schemas/song.ts
const SongSchema = z.object({
  bandId: z.string(),
  songId: z.string(),
  title: z.string(),
  key: z.string().optional(),
  patch: z.string().optional(),
  chordChart: z.string().optional(),
  performanceNotes: z.string().optional(),
  practiceNotes: z.string().optional(),
  clientWrittenAt: z.string().datetime(),
  serverReceivedAt: z.string().datetime(),
  version: z.literal(1),
})

// shared/schemas/setlist.ts
const SongRefSchema = z.object({
  songId: z.string(),
  titleSnapshot: z.string(),
  perGigAnnotation: z.string().optional(),
})

const SectionSchema = z.object({
  name: z.string(),
  songs: z.array(SongRefSchema),
})

const SetlistSchema = z.object({
  bandId: z.string(),
  setlistId: z.string(),
  gigMeta: z.object({
    venue: z.string(),
    date: z.string().date(),       // ISO date only
    time: z.string().optional(),    // HH:MM 24h
  }),
  sections: z.array(SectionSchema),
  clientWrittenAt: z.string().datetime(),
  serverReceivedAt: z.string().datetime(),
  version: z.literal(1),
})
```

**Schemas are the contract.** API handlers parse incoming as `SongSchema.omit({ serverReceivedAt: true }).parse(body)`; responses serialize via the full schema. Client uses `z.infer<typeof SongSchema>` for types.

**Schema evolution:** add new fields as optional first. When required, bump the `version` literal and write a client-side upgrade function (`upgradeSong(v1) → v2`).

### LWW server logic (implement once, exactly once)

```ts
// api/src/routes/songs.ts
async function putSong(input: PutSongInput): Promise<PutSongResponse> {
  const existing = await ddb.getSong(input.bandId, input.songId)

  if (existing && input.clientWrittenAt < existing.clientWrittenAt) {
    return { status: 'dropped-as-stale', currentState: existing }
  }

  const record = { ...input, serverReceivedAt: new Date().toISOString() }
  await ddb.putSong(record)
  return { status: 'applied', data: record }
}
```

**Hard rule:** every write path uses this pattern. No "this one is special" overrides. Same pattern for Setlists (whole-Setlist PUT replaces embedded sections + songs + annotations atomically).

### Outbox state machine (client side)

```ts
// web/src/sync/outbox.ts
type OutboxEntry = {
  id: string                  // NanoID
  recordKey: string           // e.g., "song:<bandId>:<songId>"
  op: 'PUT'                   // PUT only in V1
  payload: unknown            // whole-record body
  clientWrittenAt: string     // ISO-8601, set at enqueue
  status: 'pending' | 'in-flight'
  attempts: number
}
```

**Enqueue rules:**
1. If existing entry for `recordKey` with `status='pending'` → **replace it** (coalesce)
2. If existing entry for `recordKey` with `status='in-flight'` → add new entry; **max 2 per recordKey**
3. Otherwise → add new entry

**Flush rules:**
1. Pick oldest entry with `status='pending'`; mark `in-flight`
2. POST to `/api/v1/<resource>`; await response
3. On `200 applied` → remove entry; invalidate TanStack Query cache for `recordKey`
4. On `200 dropped-as-stale` → remove entry; replace TanStack cache with `currentState`; surface MacBook banner if NOT in Performance Mode
5. On 4xx → remove entry; log error (do not retry — likely a schema bug)
6. On 5xx / network error → mark back to `pending`; increment `attempts`; schedule retry

**Retry triggers:**
- `online` event
- App foreground (`visibilitychange` to `visible`)
- 30s timer if any pending entries exist

**Exponential backoff:** attempt 1 → 0s, 2 → 5s, 3 → 30s, 4+ → 60s (cap).

### Pre-fetch rules

```ts
// web/src/cache/prefetch.ts

// On every iPhone app foreground:
function onForeground() {
  if (!isIPhone()) return
  const tonightGig = getTonightGig()
  if (tonightGig && hoursUntil(tonightGig.date, tonightGig.time) <= 24) {
    queryClient.prefetchQuery(['setlist', tonightGig.setlistId])
    tonightGig.songRefs.forEach(ref =>
      queryClient.prefetchQuery(['song', ref.songId])
    )
  }
}

// On Start performance › tap (synchronous, awaits completion):
async function onStartPerformance(setlistId: string) {
  await queryClient.prefetchQuery(['setlist', setlistId])
  const setlist = queryClient.getQueryData(['setlist', setlistId])
  await Promise.all(
    setlist.songRefs.map(ref => queryClient.prefetchQuery(['song', ref.songId]))
  )
}
```

### Performance Mode invariants

Single source of truth: `performanceActive` boolean in a `PerformanceModeContext`.

**While `performanceActive === true`:**
- No toasts shown (held in queue, surfaced on exit)
- No banners shown
- No auth-failure redirects to `/login`
- No automatic SW activation (SW config `skipWaiting: false` + this invariant = belt-and-braces)
- All reads come from cache; network failure is invisible
- Wake Lock is held; on release/loss, the FR-18 persistent indicator appears (NOT a toast)

**Entering Performance Mode** (`Start performance ›` tap):
1. Synchronous prefetch of Setlist + every referenced Song
2. Acquire Wake Lock (best-effort; if fails, show indicator)
3. Set `performanceActive = true`
4. Hide tab bar

**Exiting Performance Mode** (×, navigate-away):
1. Set `performanceActive = false`
2. Release Wake Lock only if state-ended via navigate-away (per FR-21); preserved on × (per FR-19)
3. Flush held-toast queue (if any)
4. Show tab bar
5. Show `Currently performing` strip (× exit) or remove (navigate-away)

### Service worker strategy table

| Route pattern | Workbox strategy | Cache name | Notes |
|---|---|---|---|
| `/api/v1/auth/*` | `NetworkOnly` | — | Never cache auth state |
| `/api/v1/me` | `NetworkOnly` | — | Cached 401 would strand user offline |
| `/api/v1/health` | `NetworkOnly` | — | Health checks don't cache |
| `GET /api/v1/songs/*` | `NetworkFirst` | `api-cache-v1` | Fresh when online, fallback when offline |
| `GET /api/v1/setlists/*` | `NetworkFirst` | `api-cache-v1` | Same |
| `POST/PUT/DELETE /api/v1/*` | `NetworkOnly` | — | Outbox owns offline-write semantics |
| `*.js`, `*.css`, `*.woff2` | `CacheFirst` | `static-cache-v1` | With revalidate |
| `/index.html` | `NetworkFirst` | `app-shell-v1` | App-shell pattern |

**SW config:** `skipWaiting: false`, `clientsClaim: false`. New SW installs but waits for cold-start to activate.

### Auth flow (canonical sequence)

**App boot (`web/src/app-bootstrap.ts`):**
1. Render app shell (no data)
2. Call `GET /api/v1/me` (NetworkOnly via SW)
   - On 200: set `authenticated=true`; render normal app
   - On 401 (with network success): route to `/login`
   - On network failure (offline): render normal app from cache; `authenticated=unknown`
3. App proceeds; subsequent API calls either succeed or 401
4. On any 401 from a successful network call (not from cache) **while `!performanceActive`**: route to `/login`
5. On 401 **while `performanceActive`**: hold; surface only on exit

**Login flow:**
1. `POST /api/v1/auth/login { password }`
2. On 200: server sets `gigbuddy_session` cookie; client navigates to `/`
3. On 401: show "wrong password"
4. On 5xx: show "service unavailable"

**Cookie attributes (set server-side):**
- `HttpOnly: true`
- `Secure: true`
- `SameSite: Strict`
- `Max-Age: 31536000` (365 days)
- `Path: /`
- Value: signed JWT (HS256, key from SSM Parameter Store)

### State management taxonomy

| What | Where | Why |
|---|---|---|
| Server data (Songs, Setlists, Gigs) | TanStack Query | Built-in caching, retry, dedup, IndexedDB persistence |
| Form state (in-progress edits before commit) | React `useState` local to component | Form lifecycle is component-scoped |
| Performance-active flag | React Context (`PerformanceModeContext`) | Read by sync, error, UI subsystems |
| Outbox state | IndexedDB (read via custom hook `useOutboxStatus()`) | Persisted across reloads |
| Route state | React Router | URL is the truth |
| Modal / sheet open state | Component-local `useState` or URL search param | Avoid global modal manager |

**No Redux. No Zustand. No Jotai.** If you reach for one, the problem is already solved by the above.

### Theme atmosphere

- Tailwind v4 `@theme` block per atmosphere in `web/src/styles/tokens.css`
- Selector: `<html data-atmosphere="practice">` or `<html data-atmosphere="performance">`
- Default on MacBook: `practice`. Default on iPhone outside Performance Mode: `performance`. Inside Performance Mode: `performance` (already).
- **No user toggle** (per PRD §5)
- Practice tokens lifted from `DESIGN.md` Practice palette; Performance tokens from Club Warm palette
- Both atmospheres ship in every bundle; switched via CSS variable scope, no JS theme provider

### Error handling

**Server errors (5xx, network failure):**
- TanStack Query auto-retries: 3 attempts with exponential backoff
- After 3 failures on a query: cached data displayed; error surfaced as MacBook quiet banner; iPhone silent
- After 3 failures on a mutation: outbox retains entry per its own retry rules (not TanStack's)
- Never: a full-screen error page (the app always renders something useful from cache)

**Validation errors (4xx):**
- Client-side Zod validation before submit (prevents most 400s)
- 400 from server is a bug — log it and show generic error toast
- Never: surface raw server error messages to the user

**Performance Mode rules apply on top:** held in queue, surfaced on exit, iPhone silent.

### Logging

**Server (Lambda):**
- `console.log(JSON.stringify({ level, msg, ...context }))` — structured JSON one-liners
- CloudWatch Logs Insights parses these
- Levels: `error`, `warn`, `info`, `debug`
- Never log: password, JWT key, cookie value, full record payloads (just IDs)

**Client:**
- `console.error()` for unexpected errors during development
- **No analytics SDK.** No `gtag`, no Segment, no Mixpanel.
- **Minimal remote error reporting** (per PRD §A.4): `POST /api/v1/client-errors` with `{ where, message, stack?, performanceActive, timestamp }`. Fire-and-forget; failure of the post is itself silent (never blocks UI). Posted on `window.onerror`, `unhandledrejection`, and React `ErrorBoundary` catches. Server writes the payload as a structured CloudWatch log line. No batching for V1.

### Testing patterns

- **Unit / component:** Vitest + React Testing Library, co-located `*.test.ts(x)` next to source
- **E2E:** Playwright in `e2e/` top-level folder
  - `e2e/smoke/` — gig-night critical paths (auth, open Setlist, enter Performance Mode, advance Songs)
  - `e2e/restore/` — FR-34 verified restore drill
- **Test naming:** `describe('<unit>', () => { it('<behavior> under <condition>', ...) })`
- **No snapshot tests for UI** — they rot. Assert on visible content.
- **API contract tests** — Hono routes tested with mock DDB; full Zod parse on both sides
- **Sync engine tests** — outbox + flusher tested with simulated network failures, race conditions, and offline/online toggles

### Pattern enforcement

- **Biome** enforces formatting + lint rules (naming via lint rules where possible)
- **TypeScript strict** enforces type contracts
- **Zod schemas** in `shared/` enforce wire contracts
- **CI fails on:** lint, typecheck, test, build
- **Stories reference patterns explicitly:** e.g., "implements per Outbox State Machine (Step 5)"

### Export endpoint (FR-33)

`GET /api/v1/export` returns a single JSON archive of all data:

```
Content-Type: application/json
Content-Disposition: attachment; filename="gigbuddy-YYYY-MM-DD.json"

Body:
{
  "exportedAt": "<ISO-8601>",
  "schemaVersion": 1,
  "bands": [
    {
      "band": { "bandId", "name", ... },
      "songs": [ {SongSchema}, ... ],
      "setlists": [ {SetlistSchema}, ... ]
    }
  ]
}
```

- Authenticated via the same `gigbuddy_session` cookie
- Triggered from the Library page footer on MacBook (`web/src/routes/library.tsx`)
- Server scans the DDB table once (Query per partition); body assembled in-Lambda
- For Sandy's volume the response is ~MB-scale; no streaming needed
- Schema versioned via `schemaVersion` for forward compatibility

### Accessibility implementation primitives

PRD §A.5 + EXPERIENCE.md §Accessibility Floor define the *contract* (WCAG levels, type floors, color-never-alone, tap-target size, VoiceOver coverage, reduced-motion). These rules lock the *implementation primitives*:

- **`aria-label`** on icon-only controls: `×` exit (`aria-label="Exit performance mode"`), `‹` back (`aria-label="Previous song"`), `NEXT ›` (`aria-label="Next song"`), position indicator (`aria-label="Song 3 of 19"`)
- **`aria-labelledby`** preferred over `aria-label` when descriptive text is already visible (don't duplicate)
- **`aria-live="polite"`** on Paste-to-parse status rows so VoiceOver announces state transitions (matched → fuzzy → unknown resolution)
- **`aria-live="assertive"`** reserved for the Wake-Lock-not-held indicator (per FR-18)
- **Focus management:** on Performance Mode entry, move focus to the `NEXT ›` button (primary action). On exit-via-×, restore focus to the row that was being performed. Use the `focus-visible` polyfill behavior baked into modern browsers; no library needed.
- **`prefers-reduced-motion`** via CSS in `globals.css`:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { transition-duration: 0ms !important; animation-duration: 0ms !important; }
  }
  ```
- **Tap-target enforcement** via Tailwind utility tokens defined in `tokens.css`: `--size-tap: 44pt` (= 11 × 4pt base unit). Components use `min-w-tap min-h-tap` on every tappable element.
- **Color-never-alone** enforced by component contract: ParseRowStatus pairs icon (`✓ ? +`) + label + color; per-gig annotation pairs italic weight + position + accent color. Code review catches violations; no automated check.
- **Focus order = reading order:** rely on DOM order. No `tabindex` other than `0` (focusable) or `-1` (removed from order). Programmatic focus only via the focus-management rule above.

### Pattern enforcement

## Project Structure & Boundaries

Five packages in a pnpm workspace; no monorepo build tool. Type-folder organization within each package.

### Directory tree

The tree below is **illustrative**, not prescriptive — it shows the canonical shape but small adjustments during implementation (a planned file split that collapsed into one, an extension change for a JSX-bearing module, an additional helper that earned its keep) don't require an amendment here. Material deviations (a new top-level module, a renamed package, a boundary change) still do. Reconciled 2026-06-19 (Epic 3 retro action #8) for the sync/ subtree.

```
gigbuddy/
├── .github/
│   └── workflows/
│       ├── ci.yml                          # lint + typecheck + test on PR
│       ├── deploy.yml                      # main → blackout check + deploy
│       └── deploy-force.yml                # manual override workflow
├── _bmad/                                  # BMad config (existing)
├── _bmad-output/                           # BMad planning artifacts (existing)
│
├── web/                                    # Vite + React + TS SPA
│   ├── public/
│   │   ├── icons/                          # PWA icons (192, 512, maskable)
│   │   └── manifest.webmanifest
│   ├── src/
│   │   ├── app-bootstrap.tsx               # boot sequence (Auth flow pattern)
│   │   ├── main.tsx                        # Vite entry
│   │   ├── router.tsx                      # React Router v7
│   │   ├── routes/                         # route components
│   │   │   ├── home.tsx                    # Setlists home (FR-14, FR-23)
│   │   │   ├── login.tsx                   # auth gate
│   │   │   ├── library.tsx                 # Library list (FR-4)
│   │   │   ├── new-setlist.tsx             # Setlist creation (FR-6, FR-7)
│   │   │   ├── setlist-overview.tsx        # Setlist overview (FR-13)
│   │   │   ├── song-detail.tsx             # Song detail (FR-3)
│   │   │   ├── performance-card.tsx        # Performance card (FR-15–FR-22)
│   │   │   └── install-prompt.tsx          # iPhone non-installed gate
│   │   ├── components/                     # reusable components
│   │   │   ├── gig-card.tsx
│   │   │   ├── song-row.tsx
│   │   │   ├── section-heading.tsx
│   │   │   ├── inline-edit.tsx
│   │   │   ├── parse-row-status.tsx
│   │   │   ├── bottom-tabs.tsx
│   │   │   └── currently-performing-strip.tsx
│   │   ├── sync/                           # sync layer (Step 5 patterns)
│   │   │   ├── outbox.ts                   # outbox state machine
│   │   │   ├── flusher.ts                  # outbox flusher (incl. inline LWW handling)
│   │   │   ├── query-client.tsx            # TanStack Query setup + PersistQueryClientProvider
│   │   │   ├── persist.ts                  # IDB-backed query-cache persister
│   │   │   ├── record-key.ts               # recordKey ↔ {kind, ids} mapping
│   │   │   └── prefetch.ts                 # pre-fetch rules (Epic 4)
│   │   ├── cache/                          # IndexedDB persistence
│   │   │   └── idb.ts                      # IDB primitives
│   │   ├── auth/
│   │   │   ├── auth-context.tsx
│   │   │   └── auth-api.ts
│   │   ├── performance/                    # Performance Mode invariants
│   │   │   ├── performance-context.tsx     # performanceActive flag
│   │   │   ├── wake-lock.ts                # acquire + re-acquire on foreground
│   │   │   ├── toast-queue.ts              # held toasts surfaced on exit
│   │   │   └── install-detect.ts           # iPhone PWA install gate
│   │   ├── paste-parse/                    # FR-7
│   │   │   ├── parser.ts
│   │   │   └── matcher.ts
│   │   ├── api/                            # API client
│   │   │   ├── client.ts                   # fetch wrapper + x-server-now handling
│   │   │   ├── songs.ts
│   │   │   ├── setlists.ts
│   │   │   └── auth.ts
│   │   ├── hooks/
│   │   │   ├── use-song.ts
│   │   │   ├── use-setlist.ts
│   │   │   ├── use-tonight-gig.ts
│   │   │   ├── use-outbox-status.ts
│   │   │   └── use-performance-active.ts
│   │   ├── styles/
│   │   │   ├── tokens.css                  # @theme blocks (Practice + Performance)
│   │   │   └── globals.css
│   │   └── lib/
│   │       ├── nanoid.ts
│   │       ├── iso-date.ts
│   │       └── platform.ts                 # isIPhone(), isStandalone()
│   ├── index.html
│   ├── vite.config.ts                      # incl vite-plugin-pwa
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── package.json
│
├── api/                                    # Hono on Lambda
│   ├── src/
│   │   ├── handler.ts                      # Lambda entry (Hono → AWS adapter)
│   │   ├── app.ts                          # Hono app composition
│   │   ├── middleware/
│   │   │   ├── auth.ts                     # cookie verify
│   │   │   ├── logger.ts                   # structured JSON logs
│   │   │   ├── server-now.ts               # x-server-now header
│   │   │   └── error-handler.ts
│   │   ├── routes/
│   │   │   ├── auth.ts                     # POST /login, GET /me
│   │   │   ├── songs.ts                    # GET/PUT /songs
│   │   │   ├── setlists.ts                 # GET/PUT /setlists
│   │   │   ├── export.ts                   # GET /export (FR-33)
│   │   │   ├── client-errors.ts            # POST /client-errors (§A.4)
│   │   │   ├── upcoming-gigs.ts            # used by deploy blackout check
│   │   │   └── health.ts
│   │   ├── lww.ts                          # canonical LWW server logic
│   │   ├── ddb/
│   │   │   ├── client.ts                   # DDB DocClient setup
│   │   │   ├── songs.ts                    # getSong, putSong
│   │   │   ├── setlists.ts                 # getSetlist, putSetlist
│   │   │   └── gigs.ts                     # upcoming-gigs query
│   │   ├── secrets/
│   │   │   └── ssm.ts                      # JWT key + password hash fetch + cache
│   │   ├── auth/
│   │   │   ├── jwt.ts                      # JWT sign/verify (HS256)
│   │   │   └── password.ts                 # argon2id verify
│   │   └── lib/
│   │       └── iso-date.ts                 # mirror web/
│   ├── tsconfig.json
│   ├── package.json
│   └── README.md
│
├── shared/                                 # cross-deployable types + schemas
│   ├── src/
│   │   ├── schemas/
│   │   │   ├── song.ts                     # Zod SongSchema
│   │   │   ├── setlist.ts                  # Zod SetlistSchema + nested
│   │   │   ├── auth.ts
│   │   │   └── api.ts                      # response envelopes
│   │   ├── types/
│   │   │   └── inferred.ts                 # z.infer re-exports
│   │   └── index.ts
│   ├── tsconfig.json
│   └── package.json
│
├── infra/                                  # AWS CDK v2 (TypeScript)
│   ├── bin/
│   │   └── gigbuddy.ts                     # CDK app entry
│   ├── lib/
│   │   ├── stacks/
│   │   │   ├── data-stack.ts               # DDB + PITR + AWS Backup + DeletionProtection
│   │   │   ├── api-stack.ts                # Lambda Function URL + IAM + SSM params
│   │   │   ├── web-stack.ts                # S3 + CloudFront + ACM + Route 53 + CAA + WAF
│   │   │   ├── observability-stack.ts      # CloudTrail + Budgets alarms
│   │   │   └── ci-stack.ts                 # OIDC role for GitHub Actions
│   │   └── constructs/
│   │       └── rate-limit-waf.ts
│   ├── scripts/
│   │   └── blackout-check.ts               # two-stage blackout check (used by CI)
│   ├── runbooks/
│   │   ├── restore-pitr.md                 # FR-34 verified-restore procedure
│   │   ├── rotate-jwt-key.md
│   │   ├── rotate-password.md
│   │   ├── teardown.md
│   │   └── deploy-force.md
│   ├── cdk.json
│   ├── tsconfig.json
│   └── package.json
│
├── e2e/                                    # Playwright
│   ├── smoke/                              # gig-night critical paths
│   │   ├── auth.spec.ts
│   │   ├── library.spec.ts
│   │   ├── setlist-create.spec.ts
│   │   ├── performance-mode.spec.ts
│   │   └── offline.spec.ts
│   ├── restore/                            # FR-34 drill
│   │   └── verified-restore.spec.ts
│   ├── fixtures/
│   ├── playwright.config.ts
│   └── package.json
│
├── pnpm-workspace.yaml                     # links the 5 packages
├── package.json                            # root scripts (dev, build, test, deploy)
├── pnpm-lock.yaml
├── biome.json                              # lint + format config
├── tsconfig.base.json                      # shared TS config
├── .nvmrc                                  # Node 22
├── .gitignore
├── .gitattributes
├── README.md                               # one-page setup
└── CLAUDE.md                               # AI agent context (architecture pointers)
```

### Architectural boundaries

| Boundary | Contract | Enforcement |
|---|---|---|
| `web` ↔ `api` | HTTP only via `/api/v1/*`; envelope shapes in `shared/schemas/api.ts` | Zod validates both ends; CI typecheck catches drift |
| `api` ↔ DynamoDB | All DDB access via `api/src/ddb/*` wrappers; routes never use raw DDB client | Lint rule disallows `@aws-sdk/client-dynamodb` import outside `api/src/ddb/` |
| `api` ↔ SSM | Fetched at cold-start in `api/src/secrets/ssm.ts`; module-scope cache; never logged | Logger middleware redacts known secret param names |
| `infra` ↔ runtime | Env vars passed from CDK (`TABLE_NAME`, `JWT_KEY_PARAM`, `PASSWORD_HASH_PARAM`); runtime never constructs ARNs | Env var registry documented in `api-stack.ts` |
| `web` ↔ `shared` | Types + Zod schemas only; no runtime logic | TypeScript imports from `@gigbuddy/shared` |
| `api` ↔ `shared` | Same as web | Same |
| `e2e` ↔ rest | Black-box against deployed URL or local stack; never imports source from `web/` or `api/` | E2E runs against HTTP only |

### Internal communication patterns

**Within `web/`:**
- React Context for cross-cutting state: `AuthContext`, `PerformanceModeContext`
- TanStack Query for all server state (one `queryClient` instance)
- URL (React Router) for navigation state and modal-open state where reasonable
- No global state library

**Sync layer ↔ UI:** UI consumes hooks (`useSong()`, `useSetlist()`); mutations go through `useSongMutation()` which enqueues to outbox. UI never imports `sync/outbox.ts` directly.

**Outbox ↔ flusher:** Outbox is a passive IndexedDB-backed store. Flusher is the orchestrator (started once at app boot). Flusher reads `performanceActive` context to decide whether to surface failures.

**Service worker ↔ outbox:** Independent. SW caches GETs (Workbox); outbox owns writes. Zero shared state; SW configured `NetworkOnly` for mutations.

### External integrations

| External | Purpose | Where |
|---|---|---|
| AWS DynamoDB | Canonical store | `api/src/ddb/*` |
| AWS SSM Parameter Store | JWT key + password hash | `api/src/secrets/ssm.ts` |
| AWS CloudWatch Logs | Structured JSON logs | Implicit via `console.log` in Lambda |
| AWS Backup | Daily snapshots | `infra/lib/stacks/data-stack.ts` |
| AWS CloudTrail | Forensic audit log | `infra/lib/stacks/observability-stack.ts` |
| Route 53 / ACM | DNS + cert | `infra/lib/stacks/web-stack.ts` |
| GitHub Actions OIDC | Deploy role | `infra/lib/stacks/ci-stack.ts` |

**No third-party SaaS dependencies.** No Sentry, no analytics, no email provider.

### Data flow (canonical)

**User edit (whole-record PUT):**

```
React component
  └─→ useSongMutation hook (TanStack Query mutation)
        ├─→ optimistic cache update (immediate UI)
        └─→ outbox.enqueue({ recordKey, payload, clientWrittenAt })
              └─→ flusher.tryFlush()
                    └─→ api/client.ts → POST /api/v1/songs/:id
                          └─→ Hono route songs.ts
                                └─→ lww.ts (compare clientWrittenAt)
                                      └─→ ddb.putSong()
                                            └─→ DynamoDB
                          ← response
                    ← {status: 'applied' | 'dropped-as-stale'}
              ← remove outbox entry; invalidate TanStack cache; banner if stale (MacBook only)
```

**Performance Mode entry:**

```
User taps "Start performance ›"
  └─→ onStartPerformance(setlistId)
        ├─→ await queryClient.prefetchQuery(['setlist', setlistId])
        ├─→ await Promise.all(setlist.songRefs.map(r => prefetch(['song', r.songId])))
        ├─→ wakeLock.acquire()
        ├─→ performanceContext.setActive(true)
        └─→ navigate to /performance/:setlistId/0
```

### Requirements → structure mapping

| Feature area | PRD FRs | Lives in |
|---|---|---|
| Song Library | FR-1 to FR-5 | `web/src/routes/library.tsx`, `song-detail.tsx`; `api/src/routes/songs.ts`; `shared/src/schemas/song.ts` |
| Setlist Management | FR-6 to FR-14 | `web/src/routes/new-setlist.tsx`, `setlist-overview.tsx`; `web/src/paste-parse/*`; `api/src/routes/setlists.ts`; `shared/src/schemas/setlist.ts` |
| Performance Mode | FR-15 to FR-22 | `web/src/routes/performance-card.tsx`; `web/src/performance/*` |
| Home & Gig surfaces | FR-23 to FR-24 | `web/src/routes/home.tsx`; `web/src/components/gig-card.tsx`, `bottom-tabs.tsx` |
| Multi-Band data model | FR-25 to FR-26 | `shared/src/schemas/*` (bandId scoping); `web/src/components/band-label.tsx` |
| Access Control | FR-27 to FR-28 | `web/src/auth/*`, `web/src/routes/login.tsx`; `api/src/middleware/auth.ts`, `api/src/auth/*`, `api/src/routes/auth.ts` |
| Persistence & Sync | FR-29 to FR-32 | `web/src/sync/*`, `web/src/cache/*`; `api/src/lww.ts`, `api/src/ddb/*`; `infra/lib/stacks/data-stack.ts` |
| Backup & Export | FR-33 to FR-34 | `web/src/routes/library.tsx` footer; `api/src/routes/export.ts`; `infra/lib/stacks/data-stack.ts`; `infra/runbooks/restore-pitr.md` |
| Client error reporting | §A.4 | `web/src/lib/error-reporter.ts` (window.onerror, unhandledrejection, ErrorBoundary); `api/src/routes/client-errors.ts` |
| Deploy blackout | §A.2 | `.github/workflows/deploy.yml`, `deploy-force.yml`; `infra/scripts/blackout-check.ts`; `api/src/routes/upcoming-gigs.ts` |

### Development workflow

**Local dev:**
- `pnpm install` once
- `pnpm dev:web` runs Vite dev server (port 5173) with HMR
- `pnpm dev:api` runs Hono locally via `tsx watch` (port 3000) against dynamodb-local OR a deployed dev table
- `pnpm dev` runs both concurrently
- `pnpm test:web` / `pnpm test:api` / `pnpm test:e2e`
- `pnpm typecheck` runs across all packages
- `pnpm lint` runs Biome across all packages

**Build:**
- `pnpm build:web` → Vite production build → `web/dist/`
- `pnpm build:api` → esbuild Lambda bundle → `api/dist/handler.js` (target < 1MB)
- `pnpm build` runs all

**Deploy:**
- Local: `pnpm deploy` runs the workflow via `act` for sanity-check
- Actual deploy is CI-driven; no local `cdk deploy` against prod

## Architecture Validation Results

Comprehensive walk of every PRD FR + NFR against the architecture; internal coherence checks; gap analysis. Findings applied inline above; this section is the audit record.

### Coherence validation ✅

- **Decision compatibility:** Lambda + DynamoDB + CloudFront + S3 all interoperate via standard AWS patterns. Tailwind v4 + Vite + React 19 are compatible. Hono runs on Lambda Function URL via standard adapter. No version conflicts.
- **Pattern consistency:** Naming (camelCase JS, SCREAMING_SNAKE_CASE DDB keys, kebab-case files, plural REST resources) consistent across web, api, shared. Whole-record PUT contract honored by both client outbox and server LWW. Zod schemas in `shared/` are the single source of truth for both ends.
- **Structure alignment:** Type-folder organization within each package; clear boundaries (web ↔ api via HTTP only; api ↔ DDB via wrappers; api ↔ SSM at cold-start; infra ↔ runtime via env vars). Every architectural decision has a corresponding location in the tree.

### Requirements coverage validation ✅

- **34/34 FRs** mapped to specific architectural mechanisms (see Requirements → Structure mapping in Project Structure section)
- **All cross-cutting NFRs (§A.1–A.5)** addressed:
  - §A.1 Performance: Performance Mode invariants + pre-fetch + reduced-motion CSS
  - §A.2 Reliability: deploy blackout (two-stage) + cache-independent Performance Mode + verified restore drill
  - §A.3 Security: HTTPS, encryption at rest, SSM secrets, single access gate, OIDC for CI, CloudTrail, CAA
  - §A.4 Observability: structured CloudWatch logs + minimal client-error endpoint (added per Gap #2)
  - §A.5 Accessibility: contract + implementation primitives (added per Gap #3)

### Implementation readiness validation ✅

- **Decision completeness:** All six PRD-deferred decisions resolved (access gate, data store, backup, sync, hosting, deploy blackout). Versions specified for all dependencies.
- **Pattern completeness:** Sync, auth, error handling, logging, testing, accessibility — all locked with concrete examples or pseudocode.
- **Structure completeness:** Complete directory tree; all routes, components, stacks, runbooks named. Requirements → location mapping for every feature area.

### Gap analysis — resolutions applied

| Gap | Severity | Resolution |
|---|---|---|
| #1 — FR-33 export endpoint underspecified | Important | Added `GET /api/v1/export` spec to Step 5 patterns; added `api/src/routes/export.ts` to project structure; updated requirements-to-structure mapping |
| #2 — Client-error logging contradicted §A.4 | Important | Removed "no remote error reporting" from Step 5 logging; added `POST /api/v1/client-errors` spec + `api/src/routes/client-errors.ts`; added client-side `error-reporter.ts` reference |
| #3 — Accessibility implementation primitives unlocked | Important | Added Accessibility Implementation Primitives subsection to Step 5: aria-label/labelledby/live placement rules, focus management on Performance Mode entry/exit, prefers-reduced-motion CSS strategy, tap-target Tailwind tokens, color-never-alone enforcement |
| #4 — Local dev DDB strategy not picked | Minor | Architecture recommends dynamodb-local in Docker; final pick is a Story-1 decision |
| #5 — AWS account bootstrap chicken/egg | Minor | Bootstrap sequence (manual first OIDC role creation → CI takes over) documented in Story 1; runbook in `infra/runbooks/bootstrap.md` to be authored |

### Architecture completeness checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

**16/16 ticked.**

### Architecture readiness assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High. The architecture has been through three adversarial passes (pre-mortem on gig-night failure modes; V2-backwards review of the data model; broadened failure-mode brainstorm covering cost, account compromise, accidental deletion). 17+ concrete improvements folded in. Every FR maps to specific code locations; every NFR maps to a mechanism. Three Step-7 gaps resolved inline.

**Key strengths:**
- Performance Mode invariants make gig-night reliability architecturally enforceable, not just a UX prayer
- Cost shape bounded by design (~$1.55/mo with explicit guardrails: Budgets, Lambda reserved concurrency, WAF rate-limit, log retention)
- LWW sync model + outbox specified to pseudocode level — AI agents can implement consistently
- V2 evolution paths documented (multi-Band registry, soft-delete, last-played denorm, distant multi-user); no migration debt
- Embedded-Setlist data model serves both V1 reads and V2 analytics without re-shaping
- Deletion guardrails (DDB DeletionProtection + CDK termination protection + restore-runbook release gate) defend against the single-keystroke catastrophe class
- Three adversarial passes documented in the architecture itself (pre-mortem outcomes table) so future maintainers see what was considered

**Areas for future enhancement (post-V1):**
- Passkey/WebAuthn auth (replaces single password — V2 candidate)
- Multi-Band registry pattern (lights up when V2 populates additional Bands)
- Setlist analytics queries (V2 horizon: repertoire balance, frequency, recency)
- Soft-delete pattern (when V2 needs delete features)
- Athena/S3-export pipeline (if V2 analytics outgrow in-app aggregation)

### Implementation Handoff

**For AI dev agents implementing stories:**
- Follow the Implementation Patterns (Step 5) exactly. The patterns are the contract, not suggestions.
- Use the Project Structure (Step 6) for file locations. New files outside the tree require an architecture-doc update.
- Respect the Boundaries table — no `@aws-sdk/client-dynamodb` outside `api/src/ddb/*`; no raw SSM access outside `api/src/secrets/ssm.ts`; no analytics SDK; no Redux/Zustand.
- Stories that touch sync, auth, or Performance Mode must reference the relevant Step 5 pattern by name.
- The Pre-mortem Outcomes table in Decision section captures *why* certain mechanisms exist — read it before deviating.

**First implementation priority (Story 1):**

```bash
pnpm create vite@latest web -- --template react-ts
pnpm create aws-cdk@latest infra
mkdir api shared e2e
# initialize pnpm-workspace.yaml, biome.json, tsconfig.base.json, package.json root scripts
# add: Tailwind v4, vite-plugin-pwa, TanStack Query v5, React Router 7, Zod, Hono, Biome
```

Story 1 produces a deployable empty shell on Sandy's AWS account. Story 2 lays the CDK infra. Stories 3–N implement features per the sequence in Decision Impact Analysis.
