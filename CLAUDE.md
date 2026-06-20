# GigBuddy — Agent Notes

This file orients AI coding agents. For humans, start with [`README.md`](README.md).

## Authoritative documents

Read these before making non-trivial changes:

- **Architecture:** `_bmad-output/planning-artifacts/architecture.md` — the contract for stack, layout, naming, boundaries, and patterns. Deviations require updating that document, not the code.
- **Epics & stories:** `_bmad-output/planning-artifacts/epics.md` — scope, acceptance criteria, and ordering for every story.
- **Active story specs:** `_bmad-output/implementation-artifacts/<n>-<m>-<slug>.md` — current implementation work is driven from these.

## Conventions (short form — full version in architecture.md)

- TypeScript `strict: true` everywhere. Files: `kebab-case`. Identifiers: `camelCase` / `PascalCase` / `SCREAMING_SNAKE_CASE` per role.
- IDs: NanoID, 16-char URL-safe. Timestamps: ISO-8601 UTC strings. JSON keys: `camelCase`.
- Tests co-located with source (`thing.ts` + `thing.test.ts`). No snapshot tests.
- Biome is the sole lint + format tool. No ESLint, no Prettier.
- Zod schemas in `shared/` are the single source of truth. Never define a parallel TypeScript `type` or `interface` for the same record shape.
- React Router 7 imports from `react-router` (not `react-router-dom`).
- Tailwind v4 uses the Vite plugin and `@import "tailwindcss";` — not the v3 PostCSS pipeline.

## Boundaries

- `web` ↔ `api`: HTTP only via `/api/v1/*`. Never import the other's source.
- `web` ↔ `shared` and `api` ↔ `shared`: types + Zod schemas only.
- `e2e` ↔ rest: black-box HTTP only.
- `api/src/ddb/*` is the only DDB import surface; `api/src/secrets/ssm.ts` is the only SSM access.

## Story workflow

1. Read the story spec end-to-end before touching code.
2. Tasks/subtasks are the contract. Don't scaffold things owned by later stories.
3. Mark checkboxes only when tests pass and acceptance criteria are met.
4. Update the story's File List and Dev Agent Record as you go.

## Canonical status

`_bmad-output/implementation-artifacts/sprint-status.yaml` is the single source of truth for what's `backlog` / `ready-for-dev` / `in-progress` / `review` / `done`. Story-file `Status:` headers are advisory — they reflect what the dev-story workflow last wrote, not the canonical state. When the two disagree, sprint-status wins (Epic 3 retro action #3).

## Commit cadence

One commit per story. Subject must be `Implement story X.Y: <title>` (the epic-run workflow enforces this). Never bundle two stories into one commit — it destroys `git log` archaeology for that story (Epic 3 retro action #2). The project-snapshot `epic-run.js` carries a pre-flight clean-tree guard that halts if a story is about to start with uncommitted prior work.
