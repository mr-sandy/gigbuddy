---
baseline_commit: fe2b144a0159fe8e08bae6def6b94da1001a39d9
---

# Story 7.4: Style guide clean-up

Status: review

<!-- Source: epics.md "Epic 7 / Story 7.4"; agreed with Sandy 2026-10-19 (28px page titles; song content moved to 7.5) -->

## Story

As Sandy,
I want one style guide that the code follows,
so that pages look consistent and old design leftovers stop accumulating.

## Acceptance Criteria

1. `STYLE.md` (repo root) is the style source of truth. Page titles are 28px Lora on every
   page; the song page title drops from 36px to 28px.
2. Every route's `<h1>` comes from one `PageTitle` component. No route file sets its own
   title size.
3. Tokens in `web/src/styles/tokens.css` are renamed by role and every token the app doesn't
   use is deleted.
4. `web/scripts/contrast-report.ts` no longer references deleted tokens and still passes.
5. `AGENTS.md` points agents to `STYLE.md`.
6. No visible change other than the song page title size. `pnpm lint`, `pnpm typecheck`,
   `pnpm test` and `pnpm build` pass. `api/`, `shared/` and `infra/` unchanged.
7. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] **Task 1: Rename tokens by role** (AC: 3)
  - [x] In `tokens.css` and every use in `web/src/routes/*.tsx`, rename:
    `--text-home-tonight` → `--text-page-title` (28px, line-height 1.15);
    `--text-perf-meta` → `--text-row` (22px; list rows and links);
    `--text-perf-body` → `--text-body` (18px). Keep each `--line-height` companion in step.
    Keep `--font-serif-editorial`, colours (except below), `--spacing-*` and `--spacing-tap`.
  - [x] Update the "Type roles" table in `STYLE.md` to the new names and merge "Link / meta"
    into the row role (`--text-row`).

- [x] **Task 2: Delete unused tokens** (AC: 3, 4)
  - [x] Delete from `tokens.css` (and the dark block where relevant): `--text-perf-title`
    (replaced by page-title), `--text-perf-chord`, `--text-perf-annotation`,
    `--text-practice-body`, `--text-section-heading`, `--spacing-card-pad`,
    `--spacing-card-stack-gap`, all four `--radius-*`, `--shadow-card`, `--font-mono-slab`,
    `--color-surface`, `--color-accent-strong`.
  - [x] Before deleting, grep `web/src`, `web/index.html` and `web/scripts` for each name;
    delete only if nothing but `tokens.css` and the contrast report uses it. If anything does,
    stop and ask Sandy.
  - [x] `web/scripts/contrast-report.ts`: remove `surface` and `accent-strong` from
    `COLOR_TOKEN_NAMES` and drop every pair or waiver that uses them. Keep the text-on-bg
    pairs and the accent focus-outline pair. `pnpm test` runs this script first and must pass.
  - [x] If `fonts.css` loads the mono font (Inconsolata) and nothing uses it, remove that too.

- [x] **Task 3: `PageTitle` component** (AC: 1, 2)
  - [x] New `web/src/components/page-title.tsx` (create the folder if absent; follow the
    existing layout). Renders `<h1>` with `--text-page-title`, its line-height,
    `--color-text-primary`, `--font-serif-editorial`, and `mt-[var(--spacing-unit)]` only
    when told it follows a back link (prop `afterBackLink`), so `/` keeps its current top.
  - [x] Use it in `home.tsx`, `songs.tsx` and `song.tsx`. The song page title is now 28px.
  - [x] Co-located `page-title.test.tsx`: renders a level-1 heading with the given text.
  - [x] Existing route tests stay green without edits (they query headings by role and name).

- [x] **Task 4: Docs** (AC: 1, 5)
  - [x] `STYLE.md`: remove "DRAFT" and the "Not in use" section; add a line that tokens
    are named by role. Keep the content otherwise.
  - [x] `AGENTS.md` Conventions: add one bullet, "UI styling follows `STYLE.md`: use role tokens
    and `PageTitle`; no one-off sizes in route files."

- [x] **Task 5: Verify, commit, deploy** (AC: 6, 7)
  - [x] `git diff --stat HEAD -- api shared infra` is empty.
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass.
  - [x] One commit: `Implement story 7.4: Style guide clean-up`. (Push/deploy pending Sandy's go-ahead.) Push to `main` with Sandy's
    go-ahead; watch `deploy.yml` with `gh run watch`. If the blackout check blocks, report it;
    don't use `deploy-force.yml`.
  - [x] Set the story to `review`. No screenshots and no manual checklist for Sandy.

## Dev Notes

### What this story is

A refactor with one visible change (song page title 36px → 28px). No behaviour, routes, data
or dependencies change.

### Facts verified when the story was written (2026-10-19)

- Page titles today: `home.tsx` and `songs.tsx` use `--text-home-tonight` (28px);
  `song.tsx` uses `--text-perf-title` (36px). `songs.tsx` and `song.tsx` add
  `mt-[var(--spacing-unit)]` below the back link; `home.tsx` does not.
- Tokens with no use outside `tokens.css`: `accent-strong`, `surface`, `shadow-card`, the four
  radii, card pad and stack gap, `font-mono-slab`, `perf-chord`, `perf-annotation`,
  `practice-body`, `section-heading`. `--spacing-tap` looks unused to grep but is used through the
  `min-h-tap` utility; keep it.
- `contrast-report.ts` lists `surface` and `accent-strong` in `COLOR_TOKEN_NAMES` and has
  pairs/waivers using them. That is why they're removed in Task 2.
- Tailwind v4 generates utilities from `@theme` names, so after renaming run the build and
  check the 7.3 classes (`min-h-tap` etc.) still work. Use arbitrary-value classes like the
  existing files.

### Guardrails

- Out of scope: new colours, new sizes, changes to song page content (Story 7.5), search, any
  `api/`, `shared/` or `infra/` change.
- Biome only; `kebab-case` files; tests co-located; no snapshot tests; `.js` import suffix.
- British English in any copy.
- Don't change `microcopy.ts`.

### References

- [Source: STYLE.md]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.4]
- [Source: _bmad-output/implementation-artifacts/7-3-song-list-at-songs.md]
- [Source: web/src/styles/tokens.css, web/scripts/contrast-report.ts]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created (2026-10-19).
- Grep confirmed every deleted token was used only in `tokens.css` / `contrast-report.ts`. Removed `surface` and `accent-strong` from the contrast report (4 surface pairs dropped); report still passes.
- Removed the unused Inconsolata `@font-face` rules from `fonts.css`. Left the font files in `web/public/fonts/inconsolata` and the `subset-fonts.ts` entry alone (outside the story's scope).
- `pnpm lint`, `typecheck`, `test` (166 web tests) and `build` pass; `api/`, `shared/`, `infra/` unchanged.
- Committed locally; not pushed. Push and deploy await Sandy's go-ahead.

### File List

- AGENTS.md
- STYLE.md
- web/scripts/contrast-report.ts
- web/src/components/page-title.tsx (new)
- web/src/components/page-title.test.tsx (new)
- web/src/routes/home.tsx
- web/src/routes/songs.tsx
- web/src/routes/song.tsx
- web/src/styles/tokens.css
- web/src/styles/fonts.css
- web/test-output/contrast-report.json (regenerated)
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-10-19: Tokens renamed by role and unused ones deleted; `PageTitle` component; STYLE.md finalised; AGENTS.md points to it. Song page title 36px → 28px.
