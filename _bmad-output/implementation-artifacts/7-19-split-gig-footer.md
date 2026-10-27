---
baseline_commit: 73a500a
---

# Story 7.19: Split gig footer

Status: done

<!-- Source: epics.md "Epic 7 / Story 7.19" and the 2026-10-27 UI review decisions under Epic 7.
     Reference look: _bmad-output/planning-artifacts/mockups/ui-review-2026-10-27.html
     ("Split gig footer" CSS, `footer()` helper, "Playing a gig" and "Laptop" sections).
     The mock-up shows the look; the acceptance criteria are the spec. -->

## Story

As Sandy,
I want the gig footer to be two big tap regions,
so that I can move between songs from the keyboard without aiming at small buttons.

## Acceptance Criteria

1. The gig song page's bottom bar becomes two equal tap regions with "3 of 12" in a narrow
   middle column that does nothing when tapped. The regions show only a brass Lucide
   chevron (left and right, about 30px). There is no Previous or Next text. The bar is at
   least 64px tall, with thin `--border` dividers between the regions.
2. Each region has an accessible name, "Previous song" or "Next song".
3. At the first song the left region is inert, and at the last song the right region is
   inert: a faded chevron, `aria-disabled`, and no action. Neither ever becomes another action.
4. A pressed region shows a brief brass tint.
5. On wide windows the regions keep a fixed width (about 18rem each), centred, instead of
   stretching across the screen.
6. Everything else in 7.14 is unchanged: positions, history replacement, the missing-song
   case, and no bar on `/songs/:songId`.
7. `STYLE.md`'s "Bottom bar" entry is updated. No change to `api/`, `shared/` or `infra/`.
8. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass. Tests cover the
   regions' names, the inert ends and stepping in both directions.
9. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] Task 1: Microcopy (AC: 1, 2)
  - [x] In `web/src/lib/microcopy.ts`, `GIG_PLAY` gains `previousSong: 'Previous song'` and
        `nextSong: 'Next song'`. Remove the now-unused `previous` / `next` keys (7.18 set the
        precedent of removing dead strings). Keep `position`.
- [x] Task 2: Bar height token (AC: 1)
  - [x] In `web/src/styles/tokens.css`, under the tap-target block in `@theme`, add
        `--spacing-play-bar: 64px;` (spacing namespace, so Tailwind generates `min-h-play-bar`
        and it can be used in `calc()` as `var(--spacing-play-bar)`). No colour token changes.
- [x] Task 3: Rewrite `GigPlayBar` in `web/src/routes/song.tsx` (AC: 1–6)
  - [x] Layout: `<nav>` stays `fixed inset-x-0 bottom-0`, page background,
        `pb-[env(safe-area-inset-bottom)]`. Top border changes to `border-border` (see Dev
        Notes). Inner row: `flex items-stretch justify-center` — no `max-w-[40rem]`, no
        gutter padding, no vertical padding (the regions supply the height).
  - [x] Left and right regions: `flex-1 max-w-[18rem] min-h-play-bar`, content centred. With
        `justify-center` on the row this gives equal halves on a phone and two centred 18rem
        regions on a wide window, with no breakpoint (AC 5).
  - [x] Middle column: the `GIG_PLAY.position(...)` text, Body size, `text-muted-foreground`,
        `tabular-nums`, `whitespace-nowrap`, horizontal padding about 14px
        (`px-3.5`), `border-x border-border`. Plain `<span>`, no handler, no role (AC 1).
  - [x] Live region: `<Button asChild variant="ghost">` wrapping
        `<Link replace to={gigSongPath(...)} aria-label={GIG_PLAY.previousSong | nextSong}>`,
        with className overrides: `h-auto rounded-none px-0` plus the region sizing above, and
        `active:bg-primary/15` for the pressed brass tint (AC 4). Child: Lucide
        `ChevronLeft` / `ChevronRight`, `aria-hidden="true"`, `className="size-7.5 text-primary"`
        (30px; the explicit `size-` class overrides Button's `[&_svg:not([class*='size-'])]:size-5`).
        Optionally `strokeWidth={2.25}` to match the mock-up.
  - [x] Inert region (index out of range): `<span role="link" aria-disabled="true"
        aria-label={…}>` with the same classes as a live region but no `active:` tint and no
        hover fill, chevron `text-muted-foreground opacity-30`. No `href`, no `tabIndex`, no
        handler. It must never render a link to anything else (AC 3).
  - [x] Keep `replace` on the links and the existing `window.scrollTo(0, 0)` effect —
        positions, history and scroll behaviour stay exactly as 7.14 (AC 6).
  - [x] Update the content padding on the page wrapper so the end of a long chart scrolls
        fully clear of the taller bar:
        `pb-[calc(var(--spacing-play-bar)+1px+var(--spacing-unit)*4+env(safe-area-inset-bottom))]`
        (bar + top border + 16px breathing room; previously 44+16).
  - [x] Update the header comment on `song.tsx` to say the bar is two chevron regions (7.19).
- [x] Task 4: Tests in `web/src/routes/song.test.tsx` (AC: 2, 3, 6, 8)
  - [x] Rewrite the `play bar` describe to the new names:
    - middle (`b`): `getByRole('link', { name: GIG_PLAY.previousSong })` has href
      `/gigs/g1/songs/a?at=1`; next has `/gigs/g1/songs/a?at=3`; `2 of 3` shown; no visible
      "Previous" / "Next" text (`queryByText('Previous')`, `queryByText('Next')` null).
    - first (`a?at=1`): the Previous region is `aria-disabled="true"` and has no `href`;
      Next is a live link to `/gigs/g1/songs/b?at=2`.
    - last (`a?at=3`): `3 of 3`; the Next region is `aria-disabled="true"` with no `href`;
      Previous is live.
    - Keep: repeated song with no `at` → `1 of 3`; missing song record still shows the bar;
      no bar when the setlist hasn't loaded, when the song isn't in the setlist, and on
      `/songs/:songId`. Assert absence via
      `queryByRole('link', { name: GIG_PLAY.nextSong })` (or `queryByText('… of …')`)
      instead of the removed `GIG_PLAY.next` text.
  - [x] New stepping test: render the gig song route at `/gigs/g1/songs/b?at=2` with the
        `gigWith()` setlist; click Next → `3 of 3`; click Previous → `2 of 3`; click Previous →
        `1 of 3`; click the inert Previous → still `1 of 3`. (`useSongMock` can return one
        record for any id; only the bar matters.)
  - [x] Update the wake-lock "kept across Next" test to click
        `getByRole('link', { name: GIG_PLAY.nextSong })`.
  - [x] Existing tests are updated, not deleted.
- [x] Task 5: `STYLE.md` (AC: 7)
  - [x] Replace the "Bottom bar" bullet under "Spacing and tap targets": fixed to the bottom,
        page background, 1px `--border` top line; two equal regions at least 64px tall
        (`--spacing-play-bar`), each capped at 18rem and centred on wide windows; brass
        30px Lucide chevrons only, accessible names "Previous song" / "Next song"; position
        in a narrow middle column (Body, quiet text, tabular figures) with `--border`
        dividers either side; pressed region gets a brief brass tint (`primary` at 15%); an
        unavailable end is an inert `aria-disabled` span with a faded chevron, never a
        disabled button or another action; content padded clear of the bar.
  - [x] In the Buttons table, replace the "Previous, Next | outline (for now)" row with the
        play-bar regions: `ghost`, full-height, square corners, brass chevron only.
  - [x] In "Icons", amend "always beside text (no icon-only controls yet)" to note the one
        exception: the play-bar regions are icon-only, named by `aria-label`.
- [x] Task 6: Verify and ship (AC: 8, 9)
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass.
  - [x] One commit, `Implement story 7.19: Split gig footer`; deploy via the normal pipeline;
        Sandy checks the live app on phone and laptop.

## Dev Notes

### Current state (read before editing)

- `web/src/routes/song.tsx:22-50` — `GigPlayBar({ setlist, place })`. Builds `order` with
  `playOrder`, and a `step(index, label)` helper: in range → `<Button asChild variant="outline">`
  around `<Link replace to={gigSongPath(...)}>{label}</Link>`; out of range → a `<span
  aria-disabled="true">` styled with `buttonVariants({ variant: 'outline' })` + `opacity-50`.
  The `<nav>` is `fixed inset-x-0 bottom-0 border-t border-muted-foreground bg-background
  pb-[env(safe-area-inset-bottom)]`, inner row `mx-auto max-w-[40rem] … justify-between …
  py-[calc(var(--spacing-unit)*2)]`.
- `song.tsx:58-60` — `place` comes from `resolvePlace(playOrder(setlist), songId, at)`; the bar
  shows only when the setlist is loaded and the song is in it. **Don't touch this logic or
  `web/src/lib/gig-position.ts`.**
- `song.tsx:63-66` — scroll-to-top effect on `[songId, at]`. Keep.
- `song.tsx:77-83` — wrapper padding for the bar: `pb-[calc(var(--spacing-tap)+var(--spacing-unit)*4+env(safe-area-inset-bottom))]`.
  Replace as in Task 3.
- `useWakeLock()` is called unconditionally in `Song`; the bar change must not remount the
  page (the "kept across Next" test guards this).
- `web/src/routes/authenticated-shell.tsx:10` — `<main>` is `max-w-[40rem]` with gutter and top
  padding, no bottom padding. The bar is `fixed`, so it escapes that column and can be wider
  than 40rem; that's what lets the two 18rem regions sit centred on a laptop.

### Design decisions for this spec

- **Region element.** Live regions use `Button asChild variant="ghost"` over the router `Link`,
  honouring 7.18's "every button-like link goes through `Button`" rule while overriding shape
  (`rounded-none h-auto px-0`). `cn` uses tailwind-merge, so later classes win. This keeps the
  focus ring (3px `--ring`) consistent with every other control.
- **Inert region.** `<span role="link" aria-disabled="true" aria-label="Previous song">`: a
  screen reader announces it as an unavailable "Previous song" link, it isn't focusable, and it
  has nothing to activate. Don't render a disabled `<button>` or an `<a>` with `href="#"`, and
  never swap in a different action (performance-mode safety, AGENTS.md).
- **Ghost hover.** Button's ghost variant adds `hover:bg-muted`, a fine cue on a laptop. Tailwind
  v4 wraps `hover:` in `@media (hover: hover)`, so it won't stick after a tap on the iPhone.
  Leave it.
- **Pressed tint.** `active:bg-primary/15` (brass at 15% over the background; the mock-up uses
  16%). iOS Safari only applies `:active` when a touch listener exists; React 19 attaches
  `touchstart` at the root, which is normally enough. If Sandy sees no tint on the phone, add
  `onTouchStart={() => {}}` to the live region — don't add JS state or timers for the tint.
  Also add `[-webkit-tap-highlight-color:transparent]` to the regions so iOS's grey flash
  doesn't fight the brass tint.
- **Top border colour.** 7.14 used `--muted-foreground` for the top line. The mock-up and this
  story's AC use `--border` for the dividers; use `--border` for the top line as well so the bar
  reads as one piece (it matches the coming 7.20 tab bar). Decorative lines are exempt from the
  3:1 rule; the brass chevrons themselves are above 3:1 in both modes (brass text is 5.08:1 on
  the light background).
- **Faded chevron.** `text-muted-foreground opacity-30` (mock-up). Disabled controls are exempt
  from contrast requirements; the contrast script needs no change.
- **No breakpoint for width.** `flex-1 max-w-[18rem]` + `justify-center` caps the regions on
  wide windows without media queries, honouring "one responsive app, no device detection".
  At 360px each region is roughly (360 − middle ≈ 80) / 2 ≈ 140px wide — plenty.
- **Reduced motion.** The tint is an instant `:active` state; `transition-colors` from Button is
  already zeroed by the global reduced-motion rule.

### Out of scope (don't build)

- No swipe, keyboard shortcuts, tap-on-content navigation, next-song preview, mid-set jump.
- No header or tab-bar changes (7.20), no sheets (7.21).
- No changes to `gig-position.ts`, `api/`, `shared/` or `infra/`.

### Library notes

- `lucide-react` 1.54.0 is already installed (7.18); `ChevronLeft` is already imported in
  `song.tsx`, add `ChevronRight`. No new packages.
- Tailwind v4: `size-7.5` = 30px from the default spacing scale; `bg-primary/15` works on the
  CSS-variable colour via `color-mix`. Custom spacing tokens declared in `@theme` as
  `--spacing-*` generate `min-h-*` utilities (as `--spacing-tap` → `min-h-tap` does today).

### Testing standards

- Vitest + Testing Library, co-located; no snapshot tests. Mock hooks as `song.test.tsx` does
  (`useSong`, `useSongs`, `useSetlist`, `useSetlists`, `useWakeLock`).
- `GIG_PLAY` strings come from `microcopy.ts` in tests, never hard-coded.
- `pnpm test` runs the contrast report first; it should still show all pairs passing.

### Previous story intelligence (7.18)

- Components live in `web/src/components/ui/` with relative `.js` imports, no `@/` alias.
- 7.18 kept the inert end as a non-interactive span and avoided disabled buttons in the bar —
  keep that principle.
- Review notes from 7.18 (back links sit 10px in from the title edge; row titles lack
  `min-w-0`) are not part of this story.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.19: Split gig footer]
- [Source: _bmad-output/planning-artifacts/epics.md — "Decisions, 2026-10-27 (UI review, after 7.17)"]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.14: Play a gig song by song]
- [Source: _bmad-output/planning-artifacts/mockups/ui-review-2026-10-27.html — `.ft`, `.zone`, `.mid`, `footer()`]
- [Source: STYLE.md — "Spacing and tap targets", "Buttons", "Icons"]
- [Source: AGENTS.md — "Performance-mode safety"]
- [Source: web/src/routes/song.tsx, web/src/routes/song.test.tsx, web/src/lib/gig-position.ts]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5

### Debug Log References

### Completion Notes List

- `GigPlayBar` is now two `flex-1 max-w-[18rem] min-h-play-bar` regions (ghost `Button asChild` over `Link replace`) with brass 30px chevrons, a narrow bordered middle position column, and `active:bg-primary/15` tint. Inert ends are `<span role="link" aria-disabled>` with a faded chevron; Biome's `useFocusableInteractive` / `useSemanticElements` rules are suppressed with explanatory comments (the spec forbids tabIndex/href).
- Page bottom padding uses `--spacing-play-bar` + 1px border + 16px.
- `GIG_PLAY.previous/next` removed; `app-bootstrap.test.tsx` updated to `GIG_PLAY.nextSong`.
- Tests: names, hrefs, inert ends, no Previous/Next text, new two-way stepping test. lint, typecheck, test (311) and build pass.
- Not yet committed or deployed.

### File List

- web/src/lib/microcopy.ts
- web/src/styles/tokens.css
- web/src/routes/song.tsx
- web/src/routes/song.test.tsx
- web/src/app-bootstrap.test.tsx
- web/src/lib/utils.ts
- web/src/lib/utils.test.ts
- STYLE.md
- _bmad-output/implementation-artifacts/7-19-split-gig-footer.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-10-27: Story created; status → ready-for-dev.
- 2026-10-27: Implemented; status → review.
- 2026-10-27: Code review clean; committed d709d29; CI and deploy run 40550103680 green.
- 2026-10-27: Sandy's live check found two faults. (1) The bar was 44px mid-set and 64px at either end: `cn` kept both Button's `min-h-tap` and the region's `min-h-play-bar`, and 44px won. Fixed by teaching tailwind-merge the custom spacing tokens (`web/src/lib/utils.ts`). (2) On the phone there was an empty strip below the bar. The home-indicator padding moved from the `<nav>` into each column, so the regions and dividers run to the screen edge.
- 2026-10-27: Fix committed 2c8f323; deploy run 40552806529 green. Sandy's live check: looks great. Status → done.
