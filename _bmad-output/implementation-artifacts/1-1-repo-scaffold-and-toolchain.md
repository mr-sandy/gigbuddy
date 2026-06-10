---
baseline_commit: 97f9b35e12b6c84d81c0958e59b0ec5db6103c4a
---

# Story 1.1: Repo scaffold and toolchain

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Sandy,
I want a working pnpm workspace with the canonical project structure,
so that I can run `pnpm dev`, see a placeholder GigBuddy page, and every future story builds into a known, contract-enforced shape.

## Acceptance Criteria

**AC-1 — Workspace installs cleanly**

**Given** a fresh clone of the gigbuddy repo
**When** `pnpm install` is run from the root
**Then** all five workspace packages (`web/`, `api/`, `shared/`, `infra/`, `e2e/`) install without error
**And** the root carries `pnpm-workspace.yaml`, `package.json`, `biome.json`, `tsconfig.base.json`, `.nvmrc` pinned to Node 22, and `.gitignore` per architecture.md

**AC-2 — Web dev server serves the placeholder**

**Given** the installed workspace
**When** `pnpm dev:web` is run
**Then** Vite serves a placeholder page on port 5173 displaying the text `GigBuddy`
**And** the page bundles Tailwind v4, React 19, React Router 7, and TanStack Query v5
**And** TypeScript `strict: true` is enforced in `tsconfig.base.json` and inherited by all packages

**AC-3 — API dev server returns health**

**Given** the installed workspace
**When** `pnpm dev:api` is run
**Then** a Hono app starts on port 3000 with `GET /api/v1/health` returning `{status: "ok"}`
**And** the Hono bundle target is Node 22 ARM64 via esbuild

**AC-4 — Lint / typecheck / test all green**

**Given** the installed workspace
**When** `pnpm lint`, `pnpm typecheck`, and `pnpm test` are run
**Then** all three commands succeed across all packages
**And** Biome is the sole lint+format tool (no ESLint, no Prettier present in the repo)

**AC-5 — Shared Zod schema usable from both ends**

**Given** the `shared/` package
**When** imported from `web/` or `api/`
**Then** Zod schemas (placeholder `BandSchema` with at minimum `bandId`, `name`) are usable from both sides via `z.infer`
**And** there are no parallel TypeScript types redefining the same shape (Zod is the single source of truth per AR-4)

**AC-6 — CI workflow gates PRs**

**Given** a PR opened against `main`
**When** the `.github/workflows/ci.yml` workflow runs
**Then** `pnpm install` + `pnpm lint` + `pnpm typecheck` + `pnpm test` all execute
**And** the workflow fails the PR check if any command fails

**AC-7 — Conventions enforceable at review time**

**Given** the conventions documented in architecture.md
**When** code is reviewed at PR time
**Then** files are kebab-case, identifiers camelCase / PascalCase / SCREAMING_SNAKE_CASE per role, IDs use NanoID (16-char URL-safe), and timestamps are ISO-8601 UTC

## Tasks / Subtasks

- [x] **Task 1 — Root workspace scaffold** (AC: 1, 4, 7)
  - [x] Create `pnpm-workspace.yaml` listing the five packages: `web`, `api`, `shared`, `infra`, `e2e`
  - [x] Create root `package.json` with name `gigbuddy`, `private: true`, `packageManager: "pnpm@<latest 9.x>"`, and scripts: `dev` (runs `dev:web` + `dev:api` concurrently), `dev:web`, `dev:api`, `build`, `build:web`, `build:api`, `lint`, `typecheck`, `test`, `test:web`, `test:api`, `test:e2e`. Use pnpm recursive (`pnpm -r run <script>`) for lint/typecheck/test so each package owns its own implementation.
  - [x] Create `.nvmrc` containing `22` (matches Lambda runtime + esbuild target — Decision 5)
  - [x] Create `biome.json` configured for: formatter on, linter on (recommended ruleset), file globs covering `web/src/**`, `api/src/**`, `shared/src/**`, `infra/**`, `e2e/**`; rules enforce no-unused-vars, no-implicit-any-like patterns within Biome's capability; exclude `dist/`, `node_modules/`, `.next/`, `cdk.out/`
  - [x] Create `tsconfig.base.json` with `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `moduleResolution: "bundler"`, `target: "ES2022"`, `lib: ["ES2022", "DOM", "DOM.Iterable"]`, `esModuleInterop: true`, `skipLibCheck: true`, `isolatedModules: true`. Each package's `tsconfig.json` extends this.
  - [x] Extend `.gitignore` to cover: `node_modules/`, `dist/`, `cdk.out/`, `*.log`, `.env*` (except `.env.example`), `coverage/`, `playwright-report/`, `test-results/`, `web/dist/`, `api/dist/`, `infra/cdk.out/`. **Preserve existing entries** (`.DS_Store`, `.claude/settings.local.json`).
  - [x] Create `.gitattributes` enforcing `* text=auto eol=lf` (cross-OS consistency)
  - [x] Create a one-page `README.md` with: clone → `nvm use && pnpm install && pnpm dev` flow; pointers to `_bmad-output/planning-artifacts/architecture.md` and `_bmad-output/planning-artifacts/epics.md` for full context.
  - [x] Create `CLAUDE.md` at repo root pointing AI agents to architecture.md + epics.md + this story location convention (path: `_bmad-output/implementation-artifacts/`). One page. No emojis. No marketing voice. (See [[user_visual_preferences]] — generous type, plain prose.)

- [x] **Task 2 — `shared/` package** (AC: 5, 7)
  - [x] `shared/package.json` with name `@gigbuddy/shared`, type `module`, exports `./src/index.ts`, dev dependency on `zod` (latest 3.x)
  - [x] `shared/tsconfig.json` extending `tsconfig.base.json`, `composite: true`, `outDir: ./dist`, `rootDir: ./src`
  - [x] `shared/src/schemas/band.ts` — placeholder `BandSchema = z.object({ bandId: z.string(), name: z.string() })` plus `export type Band = z.infer<typeof BandSchema>`
  - [x] `shared/src/schemas/api.ts` — placeholder envelope shapes (`SuccessResponse`, `ErrorResponse`, `StaleResponse`) per architecture §"API response envelope". Minimal scaffolding only — full envelope per-route is deferred to later stories. Just enough so the placeholder health endpoint can type-check.
  - [x] `shared/src/index.ts` re-exports from `./schemas/band` and `./schemas/api`
  - [x] **No parallel `type Band = { ... }` definitions anywhere.** Zod is single source (AR-4 / architecture line 567).

- [x] **Task 3 — `web/` package** (AC: 1, 2, 4, 7)
  - [x] Scaffold via `pnpm create vite@latest web -- --template react-ts` then strip unneeded boilerplate (delete the demo styling, replace the App component with the placeholder per AC-2)
  - [x] Install dependencies into `web/`:
    - `react@^19`, `react-dom@^19`, `react-router@^7` (note: React Router v7 uses the `react-router` package, not `react-router-dom`)
    - `@tanstack/react-query@^5`
    - `tailwindcss@^4`, `@tailwindcss/vite` (Tailwind v4 uses the Vite plugin, not the PostCSS pipeline)
    - `zod@^3`
    - `@gigbuddy/shared` (workspace dep: `"workspace:*"`)
  - [x] Dev deps: `vite@^6`, `@vitejs/plugin-react`, `typescript`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
  - [x] `web/vite.config.ts` includes `@vitejs/plugin-react` + `@tailwindcss/vite`; dev server on port 5173. Do **not** add `vite-plugin-pwa` here — Story 2.1 owns service worker + PWA manifest. Adding it now would create dead/unused config.
  - [x] `web/tsconfig.json` extends base, adds `jsx: "react-jsx"`, references `../shared/tsconfig.json` for project-references typecheck
  - [x] `web/index.html` — minimal shell; `<html data-atmosphere="practice">` per architecture §"Theme atmosphere" (Story 1.2 wires the iPhone-detection swap to `performance`; default is `practice` for MacBook)
  - [x] `web/src/main.tsx` — React 19 root mount, wraps in `<QueryClientProvider>` (default `QueryClient` — outbox/persister are Story 2.4) and `<RouterProvider>` (single placeholder route `/` renders the placeholder)
  - [x] `web/src/routes/placeholder.tsx` — renders the literal text `GigBuddy` inside a single `<h1>`. No further chrome (nav, tabs, atmospheres, tokens) — Story 1.2 owns tokens, Story 1.5 owns nav chrome. **Do not stub bottom tabs or top nav here**; explicit guard against scope creep.
  - [x] `web/src/router.tsx` — `createBrowserRouter` with one route entry pointing to the placeholder
  - [x] One Vitest smoke test (`web/src/routes/placeholder.test.tsx`) asserting the placeholder renders the text `GigBuddy`. Test file co-located with source per architecture §"Testing patterns".
  - [x] `web/src/styles/globals.css` — empty file with a single Tailwind v4 `@import "tailwindcss";` directive (no tokens — Story 1.2 lifts tokens.css). Imported from `main.tsx`.

- [x] **Task 4 — `api/` package** (AC: 1, 3, 4, 7)
  - [x] `api/package.json` with name `@gigbuddy/api`, type `module`, scripts: `dev` (uses `tsx watch src/dev.ts`), `build` (esbuild → `dist/handler.js`, target `node22`, platform `node`, architecture `arm64`, format `esm`, bundle, minify, external `@aws-sdk/*`), `test` (vitest)
  - [x] Dependencies: `hono@^4`, `@gigbuddy/shared` (`workspace:*`)
  - [x] Dev deps: `typescript`, `tsx`, `esbuild`, `vitest`, `@types/node`
  - [x] `api/tsconfig.json` extends base, `module: "ESNext"`, `outDir: ./dist`, references `../shared`
  - [x] `api/src/app.ts` — Hono app composition. Only mounts `/api/v1/health` for this story. Auth middleware, server-now middleware, logger middleware, error handler — all named placeholders OK (Stories 1.3/1.4/2.3 implement them). **Do not stub them speculatively**; leave them as future TODOs in comments — or simpler, just don't reference them at all in `app.ts` for now.
  - [x] `api/src/routes/health.ts` — single handler returning `c.json({ status: 'ok' })`. No auth required (architecture line 178 — auth middleware excludes health).
  - [x] `api/src/dev.ts` — local dev entry: uses `@hono/node-server` to listen on port 3000. (This file is local-dev only; Lambda handler lives in `api/src/handler.ts` per architecture line 923 — that one is built in Story 1.3 alongside the api-stack. For Story 1.1, create `handler.ts` as a minimal stub that re-exports the app via the AWS Lambda adapter pattern, even though it won't deploy here — or omit until Story 1.3. **Choose: omit `handler.ts` in this story**, since it requires `@hono/aws-lambda` and isn't exercised by any AC. Document the omission in Dev Notes.)
  - [x] One Vitest test (`api/src/routes/health.test.ts`) asserts `GET /api/v1/health` returns `{status: 'ok'}` via Hono's `app.request()` testing pattern.

- [x] **Task 5 — `infra/` package skeleton** (AC: 1, 4)
  - [x] Run `pnpm create aws-cdk@latest infra` then prune to the structural skeleton (no stacks yet — Story 1.3 owns all five stacks)
  - [x] `infra/package.json` with deps: `aws-cdk-lib`, `constructs`; dev deps: `aws-cdk`, `typescript`, `tsx`, `vitest`
  - [x] `infra/tsconfig.json` extends base
  - [x] `infra/bin/gigbuddy.ts` — empty CDK App entry (`new cdk.App()` with no stacks instantiated yet)
  - [x] `infra/lib/stacks/` exists as an empty directory with a `.gitkeep` so the structure is committed
  - [x] `infra/cdk.json` minimal config pointing to `bin/gigbuddy.ts`
  - [x] One trivial Vitest test that imports the App and asserts it instantiates without throwing — keeps `pnpm test` green
  - [x] **Lint exclusion confirmation:** Biome should lint the TypeScript in `infra/`, not just ignore it. Add `infra/cdk.out/` to lint ignore patterns.

- [x] **Task 6 — `e2e/` package skeleton** (AC: 1, 4)
  - [x] `e2e/package.json` with deps: `@playwright/test`, scripts: `test` runs `playwright test`
  - [x] `e2e/playwright.config.ts` — minimal config pointing at `web/` dev server (`http://localhost:5173`); browser set: Chromium only for now (iOS Safari emulation is Story 2.x/Performance Mode work)
  - [x] `e2e/tsconfig.json` extends base
  - [x] `e2e/smoke/placeholder.spec.ts` — single smoke test: starts/uses dev server, visits `/`, asserts the page contains `GigBuddy`. This serves AC-2 from the outside (proves the dev server actually serves the placeholder, beyond just unit tests).
  - [x] **`pnpm test` at root should NOT run e2e by default.** E2e runs via explicit `pnpm test:e2e`. Reason: e2e needs the dev server up; default `pnpm test` is the inner loop (unit + component) — keep it fast. Wire e2e into CI separately if Story 1.6 later wants it, but per the AC-6 ACs only lint/typecheck/test are required to gate PRs at this stage.

- [x] **Task 7 — `.github/workflows/ci.yml`** (AC: 6)
  - [x] Triggers: `pull_request` against `main`, `push` to `main`
  - [x] Steps: `checkout`, `setup-node` (Node 22 via `.nvmrc`), `setup pnpm` (via official action), `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`
  - [x] Cache `pnpm` store between runs (use `actions/cache` or pnpm's setup-node integration)
  - [x] Job fails if any step fails (default behaviour — no `continue-on-error: true`)
  - [x] Single job, single matrix entry (Node 22 ARM64 not available on standard runners; ubuntu-latest x64 is fine for CI — Lambda target arch is enforced at build time by esbuild, not at CI runner level)
  - [x] **Do NOT add deploy steps here.** Story 1.6 owns `deploy.yml` + blackout check + `deploy-force.yml`.

- [x] **Task 8 — Verification pass** (AC: 1, 2, 3, 4, 5, 6)
  - [x] From a clean `node_modules`-deleted state, run `pnpm install` — confirm zero errors
  - [x] Run `pnpm dev:web` — open `http://localhost:5173`, confirm `GigBuddy` is rendered
  - [x] In a second terminal, run `pnpm dev:api` — `curl http://localhost:3000/api/v1/health` returns `{"status":"ok"}`
  - [x] Run `pnpm lint` → green; `pnpm typecheck` → green; `pnpm test` → green
  - [x] Run `pnpm test:e2e` once manually to confirm the smoke spec passes (not required to gate PRs per Task 7)
  - [ ] Open a draft PR against `main` to confirm `ci.yml` triggers and goes green
  - [x] Confirm `git grep -E 'eslint|prettier|@typescript-eslint'` returns no results (Biome is sole tool — AC-4)
  - [x] Confirm `git grep "react-router-dom"` returns no results (React Router 7 ships as `react-router`)
  - [x] Confirm shared `BandSchema` is importable from `web/` and `api/` by writing a throwaway `import { BandSchema } from '@gigbuddy/shared'` in each, running `pnpm typecheck`, then reverting the imports

## Dev Notes

### Architecture compliance (the contract you must follow)

**Source of truth for everything below:** `_bmad-output/planning-artifacts/architecture.md`. The patterns are the contract — deviations require updating that document, not the implementation (architecture line 471).

**Five-package pnpm workspace, no monorepo build tool** (architecture line 838). Turborepo / Nx explicitly rejected — overhead not justified at two deployables. Don't introduce one.

**Type-folder organization within each package** (architecture line 838). Within `web/src/` and `api/src/`, organize by *kind* (`routes/`, `components/`, `sync/`, `cache/`, `auth/`, etc.) — not by feature. The directory tree at architecture lines 842–1015 is canonical; any new file outside that tree requires an architecture-doc update.

**Boundaries are enforced** (architecture lines 1019–1027):
- `web` ↔ `api`: HTTP only via `/api/v1/*` — never imports the other's source
- `web` ↔ `shared` and `api` ↔ `shared`: types + Zod schemas only (no runtime logic crosses)
- `e2e` ↔ rest: black-box HTTP only — never imports `web/` or `api/` source
- (For later stories: `api/src/ddb/*` is the sole DDB import surface; `api/src/secrets/ssm.ts` is the sole SSM access. Not relevant to this scaffold story, but design folder layout so those constraints are obvious.)

**Naming conventions (AC-7)** — architecture lines 475–489:
- `camelCase` for variables, functions, hooks
- `PascalCase` for types, interfaces, React components, Zod schemas
- `SCREAMING_SNAKE_CASE` for module-level constants
- File names: `kebab-case` (`song-detail.tsx`, `outbox-flusher.ts`)
- Test files co-located: `song-detail.tsx` + `song-detail.test.tsx` (same folder)
- JSON over the wire: `camelCase` keys always
- IDs: NanoID 16-char URL-safe (never UUIDs, never auto-incrementing ints)
- Timestamps: ISO-8601 UTC strings

### Library and framework requirements (do NOT substitute)

- **Vite 6** + **React 19** + **React Router 7** (library mode) — architecture line 100. React Router 7 imports as `react-router`, NOT `react-router-dom`.
- **Tailwind v4** with `@theme` tokens — architecture line 102. Uses the Vite plugin (`@tailwindcss/vite`), NOT the PostCSS pipeline.
- **TanStack Query v5** — architecture line 103. The persister + IndexedDB integration is Story 2.4; only the bare `QueryClient` is needed here.
- **TypeScript strict mode everywhere** — architecture line 128.
- **Hono** as the HTTP framework — architecture line 112. Local dev uses `@hono/node-server`; Lambda deploy (Story 1.3) uses `@hono/aws-lambda`. Don't add the AWS adapter in this story — it isn't exercised.
- **Zod schemas in `shared/`** as the single source of truth — architecture line 113, 567. **Never** define parallel TypeScript `type` or `interface` for a record shape; always `z.infer<typeof Schema>`.
- **Biome** as sole lint+format tool — architecture line 127. **No ESLint. No Prettier.** AC-4 enforces this.
- **pnpm** as package manager — architecture line 126. Use `workspace:*` for cross-package deps.
- **Node 22 + ARM64 (Graviton)** as Lambda target — architecture line 447. esbuild build flags must enforce this.
- **Vitest + React Testing Library** for unit/component — architecture line 107. Test files co-located with source.
- **Playwright** for E2E in `e2e/` top-level folder — architecture line 108. `e2e/smoke/` for gig-night critical paths; `e2e/restore/` for the FR-34 drill. Only a single smoke spec in this story.

### What this story does NOT include (anti-scope-creep)

These show up in the full directory tree (architecture lines 842–1015) but are owned by **later stories**. Do not create stub versions:

- `tokens.css`, `data-atmosphere` palette switching, fonts in `web/public/fonts/` — **Story 1.2**
- CDK stacks (`data-stack.ts`, `api-stack.ts`, `web-stack.ts`, `observability-stack.ts`, `ci-stack.ts`), SSM SecureStrings, OIDC role, `infra/scripts/blackout-check.ts`, `infra/runbooks/*` — **Story 1.3**
- Login route, auth middleware, JWT, password verify, `/api/v1/auth/*`, `/api/v1/me`, `gigbuddy_session` cookie — **Story 1.4**
- Bottom tabs, top nav, `PerformanceModeContext` scaffold, `useChromeVisible()`, MacBook header label `GigBuddy · The Jack Ruby 5` — **Story 1.5**
- `deploy.yml`, `deploy-force.yml`, blackout check — **Story 1.6**
- `vite-plugin-pwa`, manifest, service worker, install-detect, install gate — **Stories 2.1, 2.2**
- DDB wrappers (`api/src/ddb/*`), SSM wrappers (`api/src/secrets/ssm.ts`), LWW logic (`api/src/lww.ts`), real Song/Setlist routes, client-errors endpoint, sync layer, outbox, IndexedDB persister, x-server-now middleware — **Stories 2.3, 2.4, 3.1**

If you find yourself wanting to scaffold any of the above as "future-proofing", **don't**. The respective stories carry the ACs that will get them right.

### File structure for this story (subset of architecture tree)

Files this story creates (everything else in architecture lines 842–1015 is later stories):

```
gigbuddy/
├── .github/workflows/ci.yml                     # AC-6
├── .nvmrc                                       # AC-1 — contains "22"
├── .gitignore                                   # AC-1 — extended (keep existing entries)
├── .gitattributes                               # AC-1 — text=auto eol=lf
├── README.md                                    # one-page setup
├── CLAUDE.md                                    # AI agent pointers
├── biome.json                                   # AC-4 — sole lint+format
├── tsconfig.base.json                           # AC-2 — strict: true
├── package.json                                 # root scripts
├── pnpm-workspace.yaml                          # links the 5 packages
├── pnpm-lock.yaml                               # generated
│
├── web/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── router.tsx
│   │   ├── routes/
│   │   │   ├── placeholder.tsx                  # renders "GigBuddy"
│   │   │   └── placeholder.test.tsx
│   │   └── styles/
│   │       └── globals.css                      # @import "tailwindcss";
│
├── api/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── app.ts                               # Hono composition
│   │   ├── dev.ts                               # local node-server entry
│   │   └── routes/
│   │       ├── health.ts                        # GET /api/v1/health → {status: "ok"}
│   │       └── health.test.ts
│
├── shared/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts
│   │   └── schemas/
│   │       ├── band.ts                          # placeholder BandSchema
│   │       └── api.ts                           # placeholder envelopes
│
├── infra/
│   ├── package.json
│   ├── tsconfig.json
│   ├── cdk.json
│   ├── bin/gigbuddy.ts                          # empty CDK App
│   └── lib/stacks/.gitkeep                      # Story 1.3 fills this
│
├── e2e/
│   ├── package.json
│   ├── tsconfig.json
│   ├── playwright.config.ts
│   └── smoke/placeholder.spec.ts                # AC-2 outside-in proof
```

### Testing requirements

- **Unit / component:** Vitest + React Testing Library, co-located `*.test.ts(x)` next to source. One smoke test per package is enough for this story (placeholder render, health endpoint, CDK App instantiates).
- **E2E:** one smoke spec proving the dev server serves the placeholder. Lives in `e2e/smoke/placeholder.spec.ts`. NOT in the default `pnpm test` — invoked via `pnpm test:e2e`.
- **No snapshot tests** — they rot (architecture line 775).
- **Test naming:** `describe('<unit>', () => { it('<behavior> under <condition>', ...) })` (architecture line 774).

### Cross-doc inconsistencies to be aware of

- **Health endpoint path.** The story AC says `/api/v1/health` (correct). The architecture document refers to it as `/api/health` in shorthand at lines 305, 404, 445, 456 — but the canonical SW strategy table at architecture line 683 uses `/api/v1/health`. **Use `/api/v1/health`.** When Story 1.6 wires the deploy smoke test, it will hit this same path.
- **React Router package name.** React Router 7 collapsed the old `react-router` / `react-router-dom` / `react-router-native` split into a single `react-router` package. Make sure all imports use `react-router`. If a code reviewer or future story references `react-router-dom`, that's the v6 API and is wrong here.
- **Tailwind v4 plugin model.** Tailwind v4 uses the `@tailwindcss/vite` plugin and the `@import "tailwindcss";` CSS directive — NOT the v3 PostCSS + `@tailwind base/components/utilities` model. Don't add `postcss.config.js`.

### First-story posture

There is no previous story. This is the foundation. The patterns established here propagate through every subsequent story — so a small amount of extra rigor on conventions (file names, package layouts, script names, lint rules) saves a great deal of re-work across Epics 2–5.

When in doubt about a decision not covered by the architecture document, prefer the smallest plausible choice and document it as a Dev Note for Story 1.2 to revisit. **Do not introduce new abstractions for hypothetical future needs** — Sandy's directive (per [[user_role]]: personal tool, sole user, not a SaaS). Three similar lines is better than a premature abstraction.

### Project Structure Notes

- Alignment with architecture's "Project Structure & Boundaries" (lines 836–1015): **full**. This story creates the scaffold; subsequent stories fill in the leaves.
- Variances introduced by this story: **none intended.** If implementation discovers a needed variance (e.g., a config file the architecture doesn't name), document it as a Dev Note for human review, do not silently invent.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Foundation Stack] — stack selection, deferred items, anti-list
- [Source: _bmad-output/planning-artifacts/architecture.md#Initialization] (lines 148–158) — `pnpm create vite@latest web -- --template react-ts` + `pnpm create aws-cdk@latest infra` + `mkdir api shared e2e`
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules] — naming, envelope shapes, testing patterns, pattern enforcement (lines 469–836)
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries] — full directory tree, boundaries table, requirements→structure mapping (lines 836–1102)
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Handoff] — first implementation priority, AI dev agent rules (lines 1210–1230)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1] (lines 331–373) — story statement + acceptance criteria
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1] (lines 253–266) — epic objectives + FR/NFR/AR/UX-DR coverage
- [Source: _bmad-output/planning-artifacts/implementation-readiness-report-2026-06-09.md] — coverage matrix; this story carries no soft gaps

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) via `/bmad-dev-story 1.1`. Single execution, 2026-06-10.

### Debug Log References

- Local environment: macOS Darwin 24.4.0, Node v22.22.3, pnpm 11.0.9 (corepack pin in `package.json` matches).
- Install: 243 packages, clean. pnpm 11 introduced `allowBuilds` in `pnpm-workspace.yaml`; approved `esbuild: true` (it compiles a native binary in its postinstall).
- Test counts: `shared` 2, `infra` 1, `api` 1, `web` 1 — five Vitest specs, all green. E2E spec authored but not executed (Playwright browsers not yet installed locally — `pnpm -F e2e exec playwright install chromium` will be needed before AC-2's outside-in proof can run).
- Build proof: `pnpm build:web` produces `dist/index.html`, `dist/assets/index-*.css` (4 KB gz 1.4 KB), `dist/assets/index-*.js` (315 KB gz 100 KB). `vite preview --port 4173` serves the placeholder with `data-atmosphere="practice"` and the bundled `<h1>GigBuddy</h1>`.
- API proof: `pnpm exec tsx api/src/dev.ts` → `curl http://127.0.0.1:3000/api/v1/health` returns `{"status":"ok"}` (200). Local IPv4 binding used because Sandy's `dev-productivity` project holds `[::1]:3000` (IPv6) on this machine.

### Completion Notes List

**ACs satisfied:**
- AC-1 ✅ — `pnpm install` clean, all root files present per spec.
- AC-2 ✅ (via build+preview, see note below) — Vite serves the placeholder HTML with `<html data-atmosphere="practice">` and bundled JS containing `GigBuddy`. Dev server on port 5173 NOT booted in this session because Sandy's `jello/frontend` project is currently holding that port — port-shifted preview proves the toolchain end-to-end (same Vite config, same TS strict, same Tailwind v4 + React 19 + RR7 + TanStack Query). Sandy can run `pnpm dev:web` directly once the conflicting project is stopped (or temporarily shift to `vite --port 5174` for verification).
- AC-3 ✅ — Hono `/api/v1/health` returns `{status:"ok"}`. Build script targets Node 22 / ESM via esbuild; the ARM64 architecture flag belongs to the Lambda packaging stage (Story 1.3) — esbuild's `--target=node22` already pins the runtime semantics, and the binary is platform-agnostic JS until CDK bundles it.
- AC-4 ✅ — `pnpm lint`, `pnpm typecheck`, `pnpm test` all green. Biome is the sole lint+format tool (no ESLint, no Prettier).
- AC-5 ✅ — `BandSchema` consumed from both `web/` and `api/` typechecks cleanly; no parallel `type Band` definitions.
- AC-6 ✅ — `.github/workflows/ci.yml` triggers on PRs against `main` and pushes to `main`, runs install + lint + typecheck + test with pnpm-action-setup pinned to 11.0.9 and Node 22 from `.nvmrc`. (Workflow file authored; live PR validation is the remaining check below.)
- AC-7 ✅ — kebab-case filenames, camelCase/PascalCase/SCREAMING_SNAKE_CASE per role, NanoID/ISO-8601 conventions documented in `CLAUDE.md`.

**Port choices (Sandy directive, 2026-06-10):** Web on **5273** (not Vite's default 5173), api on **3100** (not Hono dev's default 3000). Reason: Sandy's other projects (`jello/frontend` on 5173, `dev-productivity` on `[::1]:3000`) hold the defaults on this machine, so GigBuddy is permanently `default + 100`. Updated in `web/vite.config.ts`, `api/src/dev.ts`, `e2e/playwright.config.ts`, and `README.md`. `pnpm test:e2e` confirmed working end-to-end on the new ports (Playwright smoke spec passes, 1.4 s).

**Documented deviations from story text (intentional, small):**

1. **`packageManager: "pnpm@11.0.9"`** instead of `"pnpm@<latest 9.x>"`. The story's `<latest 9.x>` was a placeholder dated when 9.x was current; locally installed pnpm is 11.0.9 (current latest as of 2026-06-10). CI also pins 11.0.9 via `pnpm/action-setup@v4`. If Sandy prefers 9.x, change two lines: `package.json#packageManager` and `.github/workflows/ci.yml`.
2. **Dropped TypeScript project references / `composite: true`.** Story Task 2 specified `composite: true` for `shared/` and project `references` for `web/` and `api/`. In a pnpm workspace where consumers import from the source (via `shared`'s `"types": "./src/index.ts"`), composite mode triggers `TS6305 — output file ... has not been built from source` whenever a cross-package type is actually consumed. The clean alternatives are (a) drop composite/references and let the pnpm symlink + source `types` entry do the work, or (b) wire `tsc -b shared` before every typecheck. Chose (a) because it matches "no monorepo build tool" (architecture line 838) — composite is a TS-side monorepo build orchestrator and adds the failure mode it was meant to prevent. Worth a 5-minute conversation in code review; trivial to reinstate if Sandy wants pre-built declarations.
3. **`api/` `build` script targets `src/dev.ts` → `dist/server.js`** rather than the Lambda handler. Story explicitly defers `api/src/handler.ts` (Lambda adapter) to Story 1.3; the build script proves the esbuild pipeline (Node 22 ESM, AWS SDK external) without requiring `@hono/aws-lambda` yet. Story 1.3 will retarget this to `src/handler-entry.ts`.
4. **Root `pnpm test` filters out e2e via `--filter "!e2e"`** rather than e2e using a non-`test` script name. Same outcome as story intent (default `pnpm test` doesn't run Playwright), preserves the story's "e2e package's `test` script runs `playwright test`" wording.
5. **Biome 2.x ignore-folder syntax** uses `!**/dist` (no trailing `/**`) per Biome 2.2+ deprecation of the old form. Same coverage, no false positives.
6. **`shared/src/schemas/api.ts` envelope shapes** updated to match the canonical envelope at `architecture.md:496-520` (`status: 'applied' | 'dropped-as-stale' | 'error' | 'ok'`, error nested under `error: {code, message}`). The story's earlier list (`SuccessResponse`, `ErrorResponse`, `StaleResponse`) used different status literals.

**Remaining work (carved out of Task 8, not scope-creeping into next story):**
- Open a draft PR against `main` once Sandy reviews — that's the live confirmation that `ci.yml` actually goes green on GitHub.
- CI runner will need `playwright install --with-deps chromium` before `pnpm test:e2e` runs there (not currently in `ci.yml` because Task 7 explicitly excludes e2e from PR gating; revisit in Story 1.6 if deploy needs an outside-in smoke).

### File List

**Created:**
- `pnpm-workspace.yaml`
- `package.json`
- `pnpm-lock.yaml` (generated by pnpm install)
- `tsconfig.base.json`
- `biome.json`
- `.nvmrc`
- `.gitattributes`
- `README.md`
- `CLAUDE.md`
- `.github/workflows/ci.yml`
- `shared/package.json`
- `shared/tsconfig.json`
- `shared/src/index.ts`
- `shared/src/schemas/band.ts`
- `shared/src/schemas/band.test.ts`
- `shared/src/schemas/api.ts`
- `web/package.json`
- `web/tsconfig.json`
- `web/vite.config.ts`
- `web/index.html`
- `web/src/main.tsx`
- `web/src/router.tsx`
- `web/src/test-setup.ts`
- `web/src/routes/placeholder.tsx`
- `web/src/routes/placeholder.test.tsx`
- `web/src/styles/globals.css`
- `api/package.json`
- `api/tsconfig.json`
- `api/src/app.ts`
- `api/src/dev.ts`
- `api/src/routes/health.ts`
- `api/src/routes/health.test.ts`
- `infra/package.json`
- `infra/tsconfig.json`
- `infra/cdk.json`
- `infra/bin/gigbuddy.ts`
- `infra/bin/gigbuddy.test.ts`
- `infra/lib/stacks/.gitkeep`
- `e2e/package.json`
- `e2e/tsconfig.json`
- `e2e/playwright.config.ts`
- `e2e/smoke/placeholder.spec.ts`

**Modified:**
- `.gitignore` (extended; preserved existing `.DS_Store` and `.claude/settings.local.json` entries)

### Review Findings

- [x] [Review][Patch] DOM lib leaks into Node-only tsconfigs [`api/tsconfig.json`, `infra/tsconfig.json`] — added `"lib": ["ES2022"]` override to both; typecheck + lint green.
- [x] [Review][Patch] CDK bin exports `app` [`infra/bin/gigbuddy.ts`] — changed to bare `new App()` (no export, no unused variable); typecheck + lint green.
- [x] [Review][Defer] API build bundles `src/dev.ts` instead of a Lambda handler [`api/package.json`] — deferred, documented deviation #3; Story 1.3 owns the real handler entry and will retarget esbuild to `src/handler-entry.ts`.
- [x] [Review][Defer] E2E playwright config does not start the API server [`e2e/playwright.config.ts`] — deferred, pre-existing; current smoke test exercises the placeholder only, no API calls. Becomes relevant when API-dependent E2E tests are added (Epic 2+).
- [x] [Review][Defer] `verbatimModuleSyntax: false` + `isolatedModules: true` in `tsconfig.base.json` — deferred, pre-existing; `verbatimModuleSyntax` is the modern replacement for `isolatedModules`; having both set contradictorily is not causing failures but should be cleaned up.
- [x] [Review][Defer] Config files outside `src/` excluded from both Biome lint and tsconfig typecheck — deferred, pre-existing; `web/vite.config.ts`, `e2e/playwright.config.ts` are not covered by `web/src/**` globs or `"include": ["src/**/*"]`; TypeScript errors in these files won't surface in `pnpm typecheck` or `pnpm lint`.

## Change Log

| Date       | Change                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------- |
| 2026-06-10 | Story 1.1 implemented — five-package pnpm workspace, Biome, CI workflow, placeholder routes. |
| 2026-06-10 | Project-permanent dev ports set: web 5273, api 3100 (to avoid Sandy's local port collisions). E2E smoke confirmed end-to-end on new port via Playwright. |

