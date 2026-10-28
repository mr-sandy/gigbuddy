---
baseline_commit: ea17777
---

# Story 7.32: New app icon

Status: done

<!-- Source: epics.md "Epic 7 / Story 7.32". Design from a Claude desktop draft (indigo/amber piano keys), recoloured to the app palette. -->

## Story

As Sandy,
I want an app icon that looks like a keyboard and matches the app's colours,
so that GigBuddy is easy to spot in a browser tab and on my phone's home screen.

## Acceptance Criteria

1. `web/public/icon-source.svg` is three piano keys with two black keys, the middle white key
   gold: background `#1a1209`, keys `#f1e6cf`, accent `#e6b855`. The black keys share the
   background colour.
2. The favicon, PWA icons, Apple touch icon and maskable icon are regenerated from it with
   `pnpm assets:pwa`. The Apple touch and maskable icons are full squares with no transparency;
   the maskable icon keeps the keys inside Android's safe zone.
3. No other UI change. No change to `infra/`.
4. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.
5. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] **Task 1: Source icon** (AC 1) — replace the "GB" monogram SVG with the keys design
  (512 viewBox, rounded square, black keys extend above the white keys so their tops vanish
  into the background).
- [x] **Task 2: Generator config** (AC 2) — `web/pwa-assets.config.ts`: transparent icons
  padding 0; Apple padding 0 on a `#1a1209` background (iOS shows transparency as black);
  maskable padding 0.2 on `#1a1209` (keys' furthest corner sits at ~36% radius, inside 40%).
  Regenerate.
- [x] **Task 3: Verify, commit, deploy** (AC 4, 5)

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5

### Completion Notes List

- Lightweight review (presentational change, no code paths touched).
- lint, typecheck, build green; tests: shared 33, infra 32, api 133, web 454 passed.

### File List

- web/public/icon-source.svg
- web/public/favicon.ico
- web/public/icons/apple-touch-icon-180x180.png
- web/public/icons/maskable-icon-512x512.png
- web/public/icons/pwa-192x192.png
- web/public/icons/pwa-512x512.png
- web/public/icons/pwa-64x64.png
- web/pwa-assets.config.ts
- _bmad-output/planning-artifacts/epics.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/7-32-new-app-icon.md (new)

### Change Log

- 2026-10-28: Story created and implemented; verification green; status → review.
- 2026-10-28: Committed 2854e8e; deploy run 40701353545 and CI green; new icons live. Awaiting Sandy's look.
- 2026-10-28: Sandy checked the new icon on laptop (Chrome) and iPhone: looks fine; status → done.
