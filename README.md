# GigBuddy

A personal tool for managing band setlists and song books on stage. Built for one user (Sandy), three bands.

## Setup

```bash
nvm use            # Node 22
corepack enable    # if not already
pnpm install
pnpm dev           # runs web (5273) + api (3100) concurrently
```

Open <http://localhost:5273> — you should see `GigBuddy`.

## Scripts

| Command            | What it does                                          |
| ------------------ | ----------------------------------------------------- |
| `pnpm dev`         | Run web + api dev servers concurrently                |
| `pnpm dev:web`     | Vite dev server on `:5273`                            |
| `pnpm dev:api`     | Hono dev server on `:3100`                            |
| `pnpm build`       | Build web + api                                       |
| `pnpm lint`        | Biome lint + format check (sole tool — no ESLint)    |
| `pnpm lint:fix`    | Biome auto-fix                                        |
| `pnpm typecheck`   | `tsc --noEmit` across all packages                    |
| `pnpm test`        | Vitest across all packages (excludes e2e)             |
| `pnpm test:e2e`    | Playwright smoke specs (needs dev server up)          |

## Workspace layout

```
web/      React 19 + Vite + Tailwind v4 + TanStack Query + React Router 7
api/      Hono on Node 22 ARM64 (Lambda target)
shared/   Zod schemas — single source of truth for record shapes
infra/    AWS CDK (TypeScript)
e2e/      Playwright black-box tests
```

## Documentation

- Architecture: [`_bmad-output/planning-artifacts/architecture.md`](_bmad-output/planning-artifacts/architecture.md)
- Epics & stories: [`_bmad-output/planning-artifacts/epics.md`](_bmad-output/planning-artifacts/epics.md)
- Story spec files: [`_bmad-output/implementation-artifacts/`](_bmad-output/implementation-artifacts/)
