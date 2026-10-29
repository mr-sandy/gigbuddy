---
baseline_commit: 854b29c
---

# Story 7.33: Steady width on desktop

Status: done

<!-- Source: epics.md "Epic 7 / Story 7.33". Sandy noticed a sideways shift switching Songs ↔ Gigs on the laptop. -->

## Story

As Sandy,
I want the app to stay put when I switch between Songs and Gigs on the laptop,
so that a page being too short to scroll doesn't nudge everything sideways.

## Acceptance Criteria

1. The page always reserves the scrollbar's space (`scrollbar-gutter: stable` on `html`).
2. Opening a sheet or alert dialog doesn't shift the page: the Radix scroll-lock body margin is
   cancelled.
3. No change on overlay-scrollbar devices (iPhone). No change to `infra/`.
4. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.
5. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] **Task 1: Gutter** (AC 1, 3) — `web/src/styles/globals.css`: `html { scrollbar-gutter: stable; }`.
- [x] **Task 2: Scroll-lock margin** (AC 2) — react-remove-scroll-bar (via Radix Dialog) injects
  `body[data-scroll-locked] { margin-right: <gap>px !important }`, where gap is the scrollbar
  width, still measured as non-zero with a stable gutter. Override with
  `html body[data-scroll-locked] { margin-right: 0 !important; }` (higher specificity).
- [x] **Task 3: Test** — `globals.test.ts` guards both rules (jsdom has no scrollbars).
- [x] **Task 4: Verify, commit, deploy** (AC 4, 5)

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5

### Completion Notes List

- Lightweight review (presentational CSS only). Built CSS confirmed to keep both rules.
- lint, typecheck, build green; tests: shared 33, infra 32, api 133, web 456 passed.

### File List

- web/src/styles/globals.css
- web/src/styles/globals.test.ts
- _bmad-output/planning-artifacts/epics.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/7-33-steady-width-on-desktop.md (new)

### Change Log

- 2026-10-29: Story created and implemented; verification green; status → review.
- 2026-10-29: Committed 58047f4; deploy run 40838635301 and CI green; rules live. Awaiting Sandy's look.
- 2026-10-29: Sandy checked the live app: looks good; status → done.
