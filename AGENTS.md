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
5. Since 2026-10-19 (`_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-19.md`): work one story at a time — create-story → dev-story → code-review → commit → deploy → Sandy's quick look at the live app (gig.cormie.com, phone and laptop) → `done`. No screenshot capture by agents (Story 7.2 dropped to save tokens). Do not use `epic-run`. One responsive app: no device detection or device-specific behaviour.

## Canonical status

`_bmad-output/implementation-artifacts/sprint-status.yaml` is the single source of truth for what's `backlog` / `ready-for-dev` / `in-progress` / `review` / `done`. Story-file `Status:` headers are advisory — they reflect what the dev-story workflow last wrote, not the canonical state. When the two disagree, sprint-status wins (Epic 3 retro action #3).

## Commit cadence

One commit per story. Subject must be `Implement story X.Y: <title>` (convention; previously enforced by the epic-run workflow, which is no longer used). Never bundle two stories into one commit — it destroys `git log` archaeology for that story (Epic 3 retro action #2). The project-snapshot `epic-run.js` carries a pre-flight clean-tree guard that halts if a story is about to start with uncommitted prior work.

## Working with Sandy

Sandy is the developer and only user: a jazz pianist who prepares on a MacBook and performs from an iPhone resting on a Nord keyboard. V1 serves one band, The Jack Ruby 5.

- **Language:** British English in prose and UI copy (colour, organise, behaviour). No American sports metaphors.
- **Readability:** generous type everywhere; fit less content rather than shrink it. Light mode suits daytime prep, dark mode suits dim gigs.
- **Keep stories thin.** Short iterations that Sandy can see working soon after deploy. Verify with automated tests; don't hand Sandy long manual test checklists. Keep token use lean: no screenshot capture or visual-review tooling.
- **Don't invent personal details.** People, venues, songs and gigs must come from the repo or the conversation. Ivan is the only documented Jack Ruby 5 bandmate; otherwise use "a bandmate" or ask.
- **Treat source documents carefully.** When reality seems to contradict a brief or spec, ask whether your reading is wrong before proposing edits. Specific values in examples (section names, status labels) are illustrations, not a closed schema. Notes of the form "X means Y" in source docs are inferences; verify them with Sandy before designing around them.
- **Performance-mode safety:**
  - Never let a routine "advance" control turn into a destructive or state-ending action at a boundary; prefer inert or disabled.
  - Don't use tap-to-advance over content that can scroll; put navigation in fixed chrome.
  - Sandy improvises. A mid-set jump to any song, whether in the setlist or only in the library, must keep performance state and leave the planned setlist unchanged.
