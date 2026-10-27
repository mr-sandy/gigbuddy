---
baseline_commit: b86a2b4
---

# Story 7.24: Sheets slide in

Status: done

<!-- Source: Sandy, 2026-10-27, after 7.23: "add the animations to the sheets loading; less
     concerned about a closing animation if that's going to be too complicated". 7.21 shipped
     sheets with no animation on purpose (no tw-animate-css); Sandy noted then that they appear
     rather than slide. Not in epics.md before this story; added there alongside it. -->

## Story

As Sandy,
I want sheets to slide in when they open,
so that opening a form feels connected to the page it came from instead of popping up.

## Acceptance Criteria

1. **Opening.** On a narrow window the sheet slides up from the bottom edge; on a wide window
   (`md`, 48rem and up) the panel slides in from the right edge. The dimmed scrim fades in at
   the same time. About 250ms, ease-out. Applies to every sheet (add/edit song, add/edit gig,
   edit setlist, settings), because it lives in `ui/sheet.tsx`.
2. **Closing is unchanged.** Sheets still disappear at once on Cancel, Save, Delete, Escape,
   Done and browser Back. No exit animation.
3. **Reduced motion.** With Reduce Motion on, the sheet appears at once (the existing global
   rule in `globals.css` zeroes animation durations; no new code for this).
4. Plain CSS only: no new package (`tw-animate-css`, `vaul`, motion libraries). No change to
   `api/`, `shared/` or `infra/`, and no change to the confirm dialog (`ui/alert-dialog.tsx`).
   `STYLE.md` Sheet section and `architecture.md` (line ~763) note the opening slide.
5. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass. Tests: the sheet content
   and overlay carry the animation classes; `globals.css` defines the keyframes and the
   `--animate-*` theme values.
6. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] Task 1: Keyframes (AC: 1, 3, 4)
  - [x] `web/src/styles/globals.css`, after the bottom-bar rules: an `@theme` block (Tailwind v4
        generates `animate-*` utilities from `--animate-*` theme values, with the keyframes
        nested inside `@theme`):
        ```css
        /* Story 7.24: sheets slide in when they open. No exit animation: route sheets unmount
           on navigation. The reduced-motion rule below zeroes these. */
        @theme {
          --animate-sheet-up: sheet-up 250ms ease-out;
          --animate-sheet-in: sheet-in 250ms ease-out;
          --animate-scrim-in: scrim-in 250ms ease-out;

          @keyframes sheet-up {
            from { transform: translateY(100%); }
          }
          @keyframes sheet-in {
            from { transform: translateX(100%); }
          }
          @keyframes scrim-in {
            from { opacity: 0; }
          }
        }
        ```
        Only `from` frames: the end state is the element's own style. Biome will reformat;
        let it.
- [x] Task 2: Apply in `web/src/components/ui/sheet.tsx` (AC: 1, 2)
  - [x] Overlay className: add `data-[state=open]:animate-scrim-in`.
  - [x] Content className: add `data-[state=open]:animate-sheet-up md:data-[state=open]:animate-sheet-in`.
  - [x] Scope to `data-[state=open]` on purpose: when a state-driven sheet (settings) closes,
        `animation-name` becomes `none`, so Radix `Presence` unmounts at once rather than
        waiting for an animation. Route sheets unmount with their route anyway.
  - [x] Update the file's header comment: "no animation library" stays true; replace any
        "no animation" wording with "slides in on open (CSS keyframes in globals.css), no exit
        animation".
- [x] Task 3: Tests (AC: 5)
  - [x] `web/src/components/ui/sheet.test.tsx`: the `[data-slot="sheet-content"]` element's
        class list contains `data-[state=open]:animate-sheet-up` and
        `md:data-[state=open]:animate-sheet-in`; the overlay's contains
        `data-[state=open]:animate-scrim-in`. Existing tests unchanged.
  - [x] `web/src/styles/globals.test.ts` (already reads `globals.css` via `process.cwd()`):
        add a `describe` for Story 7.24 checking `--animate-sheet-up`, `--animate-sheet-in`,
        `--animate-scrim-in` and the three `@keyframes` names are present. jsdom can't run
        animations; this guards against the rules being dropped.
  - [x] Run the whole web suite: the sheet tests in `app-bootstrap.test.tsx`,
        `song-edit.test.tsx`, `gig-edit.test.tsx` and `settings-sheet.test.tsx` must still
        pass (jsdom reports no animation, so Radix opens and closes as before).
- [x] Task 4: Docs (AC: 4)
  - [x] `STYLE.md` Sheet section, narrow/wide bullet: add "It slides in when it opens (up from
        the bottom, or in from the right on wide windows; 250ms, ease-out) while the scrim fades
        in. Closing is instant. Reduce Motion turns the slide off."
  - [x] `_bmad-output/planning-artifacts/architecture.md` ~line 763: after "no animation
        library", add "; slides in on open via CSS keyframes (Story 7.24), no exit animation".
- [x] Task 5: Verify and ship (AC: 4, 5, 6)
  - [x] `git diff --stat b86a2b4 -- api shared infra` is empty; no new dependency in any
        `package.json`.
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Check the built CSS in
        `web/dist/assets/*.css` contains `@keyframes sheet-up` (Tailwind only emits theme
        animations that are used, and sheet.tsx uses them).
  - [x] Commit `Implement story 7.24: Sheets slide in` (after code review), push, deploy, then
        Sandy's quick look.

## Dev Notes

### Current state (read before editing)

- `web/src/components/ui/sheet.tsx`: shadcn Sheet on Radix Dialog. `SheetContent` renders
  `SheetPrimitive.Overlay` (`fixed inset-0 z-50 bg-scrim`) and `SheetPrimitive.Content` with
  one responsive class string: bottom sheet below `md`
  (`inset-x-0 bottom-0 top-[…] rounded-t-2xl`), right panel from `md`
  (`md:inset-y-0 md:left-auto md:right-0 md:w-sheet`). Radix sets `data-state="open"` /
  `"closed"` on both. Keep the focus-return and no-outside-dismiss logic untouched.
- Route sheets (`SheetFrame` in `components/edit-sheet.tsx`) are always `open`; leaving the
  route unmounts them. The settings sheet (`components/settings-sheet.tsx`) is state-driven
  (`open={open}`).
- Radix's default open focus lands on the first focusable element, the Cancel button in the
  header, not an input, so no iOS keyboard opens mid-slide.
- `web/src/styles/globals.css` imports `tailwindcss` and `tokens.css`, holds the 7.23
  bottom-bar scroll padding and the reduced-motion rule (`animation-duration: 0ms !important`).

### Design decisions

- **Opening only** (Sandy, 2026-10-27). An exit animation would need Cancel, Save, Delete,
  Escape and Back to wait for it before navigating; not worth it.
- **Tailwind v4 `@theme` animations**, not hand-written classes: the utilities follow the
  project's Tailwind idiom and the `md:` variant handles the placement switch with no JS.
- **250ms ease-out**: quick enough not to feel slow before typing, long enough to read as a
  slide.

### Out of scope (don't build)

- Exit animations, swipe-to-close, drag handles, `vaul`.
- Animating the confirm dialog, pages or the tab bar.

### Testing standards

- Vitest + Testing Library, co-located, no snapshots. File-reading tests use `process.cwd()`
  (jsdom's `import.meta.url` isn't a file URL; 7.22 lesson).
- After an async action, wait for the dialog to go before querying the page behind it (the
  `3e197f4` lesson).

### Previous story intelligence (7.21–7.23)

- 7.21 chose no animation on purpose to avoid `tw-animate-css`; this story keeps that (no
  package) and adds only the opening slide.
- 7.23 added `globals.test.ts` with a regex over `globals.css`; extend it rather than adding a
  second file.

### References

- `web/src/components/ui/sheet.tsx`, `web/src/styles/globals.css`
- `STYLE.md` — Sheet
- `_bmad-output/planning-artifacts/architecture.md` — UI components (~line 763), reduced motion
  (~line 853)

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5

### Debug Log References

### Completion Notes List

- `@theme` block in `globals.css` defines `--animate-sheet-up`, `--animate-sheet-in`, `--animate-scrim-in` with `from`-only keyframes; `ui/sheet.tsx` applies them under `data-[state=open]` (content: up on narrow, in from the right at `md`; overlay fades in). No exit animation, no new package.
- Tests: class hooks in `sheet.test.tsx`; theme values and keyframes in `globals.test.ts`. Built CSS contains `@keyframes sheet-up`.
- lint, typecheck, test (web 383, api 130, shared 31, infra 55) and build pass; `api/`, `shared/`, `infra/` and every `package.json` unchanged.

### File List

- web/src/components/ui/sheet.tsx, web/src/components/ui/sheet.test.tsx
- web/src/styles/globals.css, web/src/styles/globals.test.ts
- STYLE.md
- _bmad-output/planning-artifacts/architecture.md
- _bmad-output/planning-artifacts/epics.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/7-24-sheets-slide-in.md

### Change Log

- 2026-10-27: Story created (ready-for-dev).
- 2026-10-27: Implemented; status → review.
- 2026-10-27: Code review (lightweight): clean.
- 2026-10-27: Committed a2ca6ec; CI and deploy run 40592519197 green. Sandy's live check (phone and laptop): OK. Status → done.
