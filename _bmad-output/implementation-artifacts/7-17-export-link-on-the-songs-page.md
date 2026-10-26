---
baseline_commit: 8824dd6
---

# Story 7.17: Export link on the songs page

Status: done

<!-- Source: epics.md "Epic 7 / Story 7.17" and the 2026-10-26 decisions under Epic 7. -->

## Story

As Sandy,
I want an "Export all data" link back in the app,
so that I can save a copy of all my songs and gigs whenever I like.

## Acceptance Criteria

1. The songs page (`/songs`) ends with a quiet link, "Export all data", below the list. It
   shows whatever the list is doing (loaded, empty, loading or error).
2. It is a plain `<a href="/api/v1/export">`, not a router link, so the browser downloads
   `gigbuddy-<date>.json` from the existing endpoint.
3. Same link on phone and laptop: no device detection.
4. Body size, secondary text, at least 44px high, 32px section gap above it. `STYLE.md` notes it.
5. No change to `api/`, `shared/` or `infra/`. The service worker keeps its network-only rule for
   `/api/v1/export`.
6. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass. Tests cover: the link and
   its href on a loaded list, and that it shows when the list is empty or errored.
7. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] **Task 1: Copy** (AC 1)
  - [x] `web/src/lib/microcopy.ts`: append
    `/* Story 7.17 — export link on the songs page. */ export const EXPORT = { link: 'Export all data' } as const;`
    Append only; don't touch existing constants.
- [x] **Task 2: Link** (AC 1–4)
  - [x] `web/src/routes/songs.tsx`: after the list/status-line ternary (inside the fragment),
    add a `<footer>` with `mt-[var(--spacing-section-gap)]` holding:
    ```tsx
    <a
      href="/api/v1/export"
      className="inline-flex min-h-tap items-center text-[length:var(--text-body)] leading-[var(--text-body--line-height)] text-[color:var(--color-text-secondary)] underline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]"
    >
      {EXPORT.link}
    </a>
    ```
    It sits outside the ternary so it renders in every state.
  - [x] Must be `<a>`, not `Link`: the router would swallow the click and the
    `Content-Disposition: attachment` download would never fire. Say so in a one-line comment
    and extend the header comment ("Story 7.17: export link at the foot").
  - [x] No `download` attribute and no `target`: the server's `Content-Disposition` names the file,
    and a new tab in the installed iPhone app is worse than a same-page download.
- [x] **Task 3: Style note** (AC 4)
  - [x] `STYLE.md`, layout list after the "Screen may sleep" bullet: "Export link at the foot of
    the songs page: Body size, secondary text, underlined, 44px tap height, 32px section gap
    above. No token changes."
- [x] **Task 4: Tests** (AC 6) — `web/src/routes/songs.test.tsx`
  - [x] Loaded list: `getByRole('link', { name: EXPORT.link })` has `href` `/api/v1/export`.
  - [x] Empty (`data: []`) and error (`data: undefined, isPending: false`) each still render it.
  - [x] Check the existing first test still passes: it reads `listitem`s, not all links, so the
    extra link shouldn't affect it.
- [x] **Task 5: Verify, commit, deploy** (AC 6, 7)
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all green.
  - [x] After code review: commit `Implement story 7.17: Export link on the songs page`, push;
    the push to `main` deploys. Then Sandy's quick look on phone and laptop.

## Dev Notes

### What exists already

- `GET /api/v1/export` (`api/src/routes/export.ts`, Story 5.1) returns the whole archive with
  `Content-Disposition: attachment; filename="gigbuddy-<London date>.json"`. Auth is the session
  cookie via the global middleware, so a plain navigation is authenticated. Nothing to change.
- `web/vite.config.ts` already has a Workbox `NetworkOnly` rule for exactly `/api/v1/export`
  (Story 5.1), so the download never lands in the app-shell cache. Leave it.
- The 7.1 reset deleted the old link (`library.tsx`, MacBook only via `isIPhone()`). Don't
  restore that file or any device check; `lib/platform.ts` is gone on purpose.

### Guardrails

- Classes follow the existing link style in `songs.tsx` (Row size there; Body size here because
  this is low-emphasis). Use role tokens only (`STYLE.md`); no one-off sizes.
- British English. No exclamation marks or emoji in copy.
- On the installed iPhone app the download may open iOS's file preview/share sheet rather than
  a save dialog. That's acceptable; Sandy's live check will show what it does. Don't add
  platform-specific handling.

### Project Structure Notes

- Changed: `web/src/lib/microcopy.ts`, `web/src/routes/songs.tsx`,
  `web/src/routes/songs.test.tsx`, `STYLE.md`.

### References

- `_bmad-output/planning-artifacts/epics.md` — Epic 7 decisions (2026-10-26), Story 7.17
- `git show ccddb92 -- web/src/routes/library.tsx` — the original 5.1 link, for reference only

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5

### Debug Log References

### Completion Notes List

- Added `EXPORT.link` copy, a footer with a plain `<a href="/api/v1/export">` on the songs page (renders in every state), and a STYLE.md note.
- Two new tests (loaded href; empty and error states). lint, typecheck, test (web 304, api 130, shared 31) and build all pass.
- Commit and deploy remain, after code review.

### File List

- web/src/lib/microcopy.ts
- web/src/routes/songs.tsx
- web/src/routes/songs.test.tsx
- STYLE.md

### Change Log

- 2026-10-26: Story created; status → ready-for-dev.
- 2026-10-26: Implemented; status → review.
- 2026-10-26: Code review clean. Committed c694f9f; CI green, deploy run 40419475420 green.
- 2026-10-26: Sandy's live check on phone and laptop: link looks fine, export downloads OK.
  Status → done.
