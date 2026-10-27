---
baseline_commit: 28f127b
---

# Story 7.21: Edit and add in sheets

Status: review

<!-- Source: epics.md "Epic 7 / Story 7.21" and the 2026-10-27 UI review decisions under Epic 7.
     Reference look: _bmad-output/planning-artifacts/mockups/ui-review-2026-10-27.html
     (`.scrim`, `.sheet`, `.sheet-head`, `.sheet-title`, `.sheet-body`, `.sheet-desc`, `.alert`,
     `.lap .sheet`, `.lap .alert` CSS; `sheetHead()`, `overSheet()`, `alertBox()`, `songForm()`,
     `gigForm()`, `setlistForm()` helpers; the Songs, Gigs and Laptop sections).
     The mock-up shows the look; the acceptance criteria are the spec. Its settings sheet is
     Story 7.22, not this one. -->

## Story

As Sandy,
I want editing and adding to open over the page I'm on,
so that I can see I'm in the middle of a task and get straight back to where I was.

## Acceptance Criteria

1. Adds shadcn/ui Sheet and AlertDialog (with their Radix packages). Nothing else.
2. Add song, Edit song, Add gig, Edit gig and Edit setlist open as a sheet over the page they
   were opened from. The sheet's header has Cancel (ghost) on the left, the title in Lora in
   the middle, and Save or Add (default) on the right.
3. On narrow windows the sheet comes up from the bottom, leaving the page visible behind it,
   dimmed. On wide windows it is a panel about 460px wide from the right. The choice is made
   by window width, never by device.
4. There is no swipe-to-close. Cancel and Escape close the sheet and discard changes. Focus
   moves into the sheet when it opens, and returns to the control that opened it when it closes.
5. The existing edit URLs (`/songs/new`, `/songs/:songId/edit`, `/gigs/new`,
   `/gigs/:setlistId/edit`, `/gigs/:setlistId/setlist`) keep working: opened directly, they
   show the sheet over the right page. Browser Back closes the sheet.
6. Delete song and Delete gig confirm in an AlertDialog with a title, a line of explanation,
   "Keep" (outline) and "Yes, delete" (destructive). When a song is in a gig's setlist, the
   dialog lists those gigs and offers only "OK", as the app does now.
7. No change to `api/`, `shared/` or `infra/`. `STYLE.md` gains "Sheet" and "Confirm dialog" entries.
8. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass. Tests cover opening and
   cancelling each sheet, saving from the sheet header, deep links to edit URLs, focus
   return, and both delete dialogs.
9. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] Task 1: Packages, tokens, architecture (AC: 1, 3)
  - [x] `pnpm --filter web add @radix-ui/react-dialog@1.3.1 @radix-ui/react-alert-dialog@1.2.1`
        — exact pins, as 7.18 pinned `react-slot` / `react-label` (current latest when this
        spec was written; use the then-latest exact versions if newer). No `radix-ui` umbrella,
        no `vaul`, no `tw-animate-css`.
  - [x] `tokens.css`: add `--scrim` to `:root` (`rgba(26, 18, 9, 0.45)`) and the dark block
        (`rgba(0, 0, 0, 0.62)`) — values from the mock-up — and `--color-scrim: var(--scrim);`
        in `@theme inline`. Not a text colour, so the contrast report doesn't list it.
  - [x] `tokens.css` `@theme` spacing: add `--spacing-sheet: 460px;` (wide-window panel width).
        Add `'sheet'` to the tailwind-merge spacing list in `lib/utils.ts` and a case to
        `utils.test.ts` (7.19 lesson).
  - [x] `architecture.md` "UI components" section: list Sheet and AlertDialog and their two
        Radix packages; note the project tree comment at `ui/` (button, input, textarea,
        label, sheet, alert-dialog); note that edit/add routes are nested children of the page
        they open over (Task 3).
- [x] Task 2: `ui/sheet.tsx` and `ui/alert-dialog.tsx` (AC: 1, 2, 3, 4, 6)
  - [x] Copy shadcn's `sheet.tsx` by hand (no CLI), rewrite `@/` imports to relative `.js`
        imports, header comment like `button.tsx` ("shadcn/ui Sheet (Story 7.21), adapted…").
        Adapt:
        - **No `side` prop.** One responsive placement, by width (Tailwind `md:` = 48rem
          window width, never device detection):
          narrow `fixed inset-x-0 bottom-0 top-[calc(var(--spacing-unit)*11+env(safe-area-inset-top))] rounded-t-2xl`;
          `md:inset-y-0 md:left-auto md:right-0 md:top-0 md:w-sheet md:rounded-none md:border-l md:border-border`.
          `flex flex-col bg-background shadow-lg z-50 outline-none`.
        - **Overlay:** `fixed inset-0 z-50 bg-scrim`.
        - **Drop the built-in X close button** (Cancel in the header replaces it) and the
          `data-[state=…]:animate-*` classes (no animation library; no animation needed).
        - **No outside dismiss:** `SheetContent` sets `onInteractOutside={(e) => e.preventDefault()}`
          so tapping the dimmed page doesn't discard typing. Only Cancel and Escape close
          (AC 4). Let callers' own handler still run (compose, don't overwrite).
        - `SheetHeader`: `grid grid-cols-[1fr_auto_1fr] items-center gap-2 min-h-header px-2 border-b border-border shrink-0`,
          last child `justify-self-end` (mock-up `.sheet-head`).
        - `SheetTitle`: Lora (`[font-family:var(--font-serif-editorial)]`), `--text-nav` (20px),
          `font-medium`, `text-foreground`, centred, no wrapping surprises (`text-center`).
        - `SheetDescription`: `--text-body`, `text-muted-foreground`.
        - Add a `SheetBody` (not in shadcn; keep it in this file):
          `flex-1 overflow-y-auto px-[var(--spacing-gutter)] pt-[var(--spacing-unit)] pb-[calc(var(--spacing-unit)*4+env(safe-area-inset-bottom))]`.
        - Export only what's used: `Sheet`, `SheetContent` (portal + overlay inside),
          `SheetHeader`, `SheetTitle`, `SheetDescription`, `SheetBody`. No Trigger/Close/Footer.
  - [x] Copy shadcn's `alert-dialog.tsx` the same way. Adapt:
        - Overlay `bg-scrim`, `z-50`; no animate classes.
        - Content: `fixed z-50 left-5 right-5 top-1/2 -translate-y-1/2 md:left-1/2 md:right-auto md:w-sheet md:-translate-x-1/2 rounded-xl border border-border bg-background p-5 shadow-lg`
          (mock-up `.alert` / `.lap .alert`).
        - `AlertDialogTitle`: `--text-row` (22px, line-height 1.2), `font-semibold`,
          `text-foreground`. `AlertDialogDescription`:
          `--text-body`, `text-muted-foreground`, 8px above.
        - `AlertDialogFooter`: `mt-5 flex flex-col-reverse gap-2.5 md:flex-row md:justify-end`
          (phone: stacked, "Yes, delete" on top, Keep below; wide: Keep then Yes, delete).
          On the phone buttons are full width (`w-full md:w-auto` on the buttons).
        - `AlertDialogAction` / `AlertDialogCancel` render through our `Button` via `asChild`
          (`<AlertDialogPrimitive.Cancel asChild><Button variant="outline">…`), not
          `buttonVariants()` strings, so STYLE.md's "every button goes through Button" holds.
        - Export only what's used (Root, Trigger, Content, Title, Description, Footer, Cancel,
          Action as needed).
  - [x] Co-located `sheet.test.tsx`: renders title in a `dialog` named by the title; Escape
        calls `onOpenChange(false)`; pointer-down on the overlay does **not**.
- [x] Task 3: Routes — sheets as nested children of their page (AC: 2, 5)
  - [x] `router.tsx`:
        ```
        { element: <ListLayout />, children: [
            { path: 'songs', element: <Songs />, children: [{ path: 'new', element: <SongEdit /> }] },
            { path: 'gigs',  element: <Gigs />,  children: [{ path: 'new', element: <GigEdit /> }] },
        ]},
        { path: 'songs/:songId', element: <Song />, children: [{ path: 'edit', element: <SongEdit /> }] },
        { path: 'gigs/:setlistId', element: <Gig />, children: [
            { path: 'edit', element: <GigEdit /> },
            { path: 'setlist', element: <SetlistEdit /> },
        ]},
        { path: 'gigs/:setlistId/songs/:songId', element: <Song /> },
        ```
        Remove the old flat `songs/new`, `songs/:songId/edit`, `gigs/new`, `gigs/:setlistId/edit`,
        `gigs/:setlistId/setlist` entries. React Router ranks the static `new` above
        `:songId`, so `/songs/new` stays the add sheet.
  - [x] `Songs`, `Gigs`, `Song` and `Gig` render `<Outlet />` at the end of their fragment
        (after the export footer on Songs; inside the padded wrapper on Song — the sheet
        portals out anyway). On the gig song route `Outlet` renders nothing.
  - [x] `TabBar`: drop `end` from the `NavLink`s so the Songs/Gigs tab stays lit behind the
        add sheet. Update the comment in `tab-bar.tsx` and the 7.20 STYLE.md note if it mentions `end`.
  - [x] Because the page stays mounted under the sheet, the opener link stays in the DOM and
        Radix returns focus to it on close (FocusScope restores the element focused before
        open). No manual focus code. (On iOS Safari a tapped link doesn't take focus, so focus
        goes to the body there — harmless; keyboard users on the laptop get it back.)
- [x] Task 4: `SongEdit` in a sheet (AC: 2, 4, 6)
  - [x] Replace the page layout with:
        ```
        <Sheet open onOpenChange={(open) => { if (!open) leave(); }}>
          <SheetContent aria-describedby={undefined}>
            <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
              <SheetHeader>
                <Button type="button" variant="ghost" onClick={leave}>{SONG_FORM.cancel}</Button>
                <SheetTitle>{initial ? SONG_FORM.editHeading : SONG_FORM.addHeading}</SheetTitle>
                <Button type="submit" disabled={!canSave}>{initial ? SONG_FORM.save : SONG_FORM.add}</Button>
              </SheetHeader>
              <SheetBody>…fields as today…{initial ? <DeleteSong song={initial} /> : null}</SheetBody>
            </form>
          </SheetContent>
        </Sheet>
        ```
        The form wraps header and body so Save is a real submit and Enter in a field submits.
        `aria-describedby={undefined}` silences Radix's missing-description warning.
  - [x] Remove the form's `PageHeader` back link, the `PageTitle` and the foot Save/Cancel row
        (7.20's back link was a stop-gap for this story). Drop the now-unused imports.
  - [x] `leave` becomes a plain function (no event):
        `hasHistory ? navigate(-1) : navigate(exitTo, { replace: true })`. Keep `exitTo`,
        `hasHistory`, `canStepBack` and the save navigation exactly as today (edit steps back;
        add replaces `/songs/new` with `/songs/<id>`). Keep the 7.20 review fix: add uses
        `navigate(-1)` when there's history.
  - [x] Add `SONG_FORM.add: 'Add'` in `microcopy.ts`.
  - [x] Not-found/loading (`EditExisting` without a song): render the same sheet shell —
        Cancel, title "Edit song", Save disabled — with the existing `statusLine` paragraph
        (`aria-live="polite"`) in the body. Cancel goes to `/songs/:songId` (history or
        replace, as above). The page behind shows its own not-found line.
  - [x] Field order and widths stay as today (the mock-up's Key/Patch side-by-side pair is
        not in the ACs — leave it).
- [x] Task 5: `GigEdit` in a sheet (AC: 2, 4, 6) — as Task 4: title "Add gig"/"Edit gig",
      button "Add"/"Save" (`GIG_FORM.add: 'Add'`), Save disabled until venue and date, Delete
      gig at the foot of the body, not-found shell with Cancel to `/gigs/:setlistId`.
- [x] Task 6: `SetlistEdit` in a sheet (AC: 2, 4)
  - [x] Title "Edit setlist" (add `SETLIST_TEXT.heading: 'Edit setlist'`), button "Save".
        The gig line moves from `PageTitle` into a `SheetDescription` at the top of the body:
        `venue · date`, or the date alone when the venue is blank (mock-up `.sheet-desc`).
        Don't pass `aria-describedby={undefined}` here — the description is real.
  - [x] Label, hint, textarea, songs-loading line and problem list unchanged. On a parse
        problem the textarea still takes focus (inside the sheet). Save stays disabled until
        songs load.
  - [x] Not-found shell: Cancel to `/gigs/:setlistId`, title "Edit setlist", Save disabled,
        status line in the body.
- [x] Task 7: Delete confirmations in AlertDialog (AC: 6)
  - [x] `DeleteSong`: the "Delete song" button (destructive-outline, Lucide `Trash2` icon, as
        in the mock-up) is the `AlertDialogTrigger asChild`, at the foot of the sheet body
        after a hairline (`border-t border-border`, 32px gap). Controlled `open` state.
    - Song not in any cached setlist: title `Delete ${song.title}?`
      (`SONG_DELETE.title(name)`), description "This can't be undone."
      (`SONG_DELETE.explain`), footer Keep (Cancel, outline) and Yes, delete (destructive).
    - Song in cached setlists: title `${song.title} is in a setlist`
      (`SONG_DELETE.inUseTitle(name)`), description "Take it out of these gigs first:"
      (replace `SONG_DELETE.inUse`), the `<ul>` of gigs (`venue, date` or date, as today)
      under it, and only "OK" (`SONG_DELETE.ok`, outline, `AlertDialogCancel`).
    - "Yes, delete" is a plain `Button variant="destructive"` (not `AlertDialogAction`, which
      closes immediately): disabled while deleting; on `'deleted'` navigate to `/songs`
      (replace) as today; on 409 (`inUseUnknown`) or a throw (`failed`), close the dialog and
      show the existing `role="alert"` message under the Delete button. Clear the message
      when the dialog is opened again.
  - [x] `DeleteGig`: same shape. Title `Delete ${label}?` where label is `venue, date` or the
        date (the saved record, as today; `GIG_DELETE.title(label)`). Description "This can't
        be undone. The songs stay in your library." (`GIG_DELETE.explain`, from the mock-up).
        Keep / Yes, delete; on failure close and show `GIG_DELETE.failed` as today.
  - [x] Remove `SONG_DELETE.confirm` / `GIG_DELETE.confirm` if nothing uses them any more.
  - [x] Escape on the AlertDialog closes only the dialog, not the sheet (Radix layers do this;
        test it). Radix AlertDialog focuses Cancel ("Keep"/"OK") on open — keep that default,
        the safe choice — and returns focus to "Delete song"/"Delete gig" on close.
- [x] Task 8: Tests (AC: 8)
  - [x] `song-edit.test.tsx`, `gig-edit.test.tsx`, `setlist-edit.test.tsx`: update `renderAt`
        to the nested shape (parent route element renders its marker text plus `<Outlet />`),
        so tests prove the page stays behind the sheet. Cover per sheet: the `dialog` is named
        by its title; Cancel steps back with history and replaces to the parent without
        (deep link, single history entry); Escape does the same; Save/Add in the header
        submits (mock called with the record) and is disabled until valid (add song: title;
        add gig: venue and date); add lands on the new record's page; the old foot Cancel/Save
        and form back link are gone.
  - [x] Focus return: in a test with the parent rendering a real opener `Link`, focus and
        click it (userEvent), then Cancel; `await waitFor(() => expect(link).toHaveFocus())`
        (Radix restores focus in a timeout).
  - [x] Delete dialogs: open → `alertdialog` with title and explanation; Keep closes it and
        nothing is deleted; Yes, delete calls the mock and navigates; failure shows the alert
        line; in-use song → dialog lists the gigs and offers only OK. Escape on the dialog
        leaves the sheet open.
  - [x] `app-bootstrap.test.tsx` (real router): deep links `/songs/new`, `/songs/a1/edit`,
        `/gigs/new`, `/gigs/g1/edit`, `/gigs/g1/setlist` show the sheet (`dialog` by name) with
        the right page behind it (e.g. the page's heading present via
        `getByRole('heading', { name, hidden: true })` — Radix aria-hides the page). Rework the
        7.20 "no tab bar" table: remove the five form rows from it (the list page is behind
        the add sheets now); keep song, gig and gig song rows. Add: browser Back
        (`router.navigate(-1)`) from an opened sheet closes it and leaves the page.
  - [x] Existing tests are updated, not deleted. If jsdom lacks something Radix needs
        (e.g. `PointerEvent`, `hasPointerCapture`), polyfill in `test-setup.ts`, minimally.
- [x] Task 9: STYLE.md (AC: 7)
  - [x] New "Sheet" entry: all add/edit happens in one; header Cancel (ghost) · title (Lora
        20px) · Save/Add (default, disabled until required fields are filled); narrow windows:
        from the bottom, 44px of page visible above, rounded top, page dimmed by `--scrim`;
        wide (≥48rem window): 460px panel from the right; no swipe-to-close, no tap-outside
        close; Cancel and Escape discard; body scrolls, header doesn't; delete sits at the foot
        of the body after a hairline; URLs stay real (deep links and Back work).
  - [x] New "Confirm dialog" entry: for destructive actions only; title, one line of
        explanation; Keep (outline) and Yes, delete (destructive), stacked with Yes on top on a
        phone, side by side on the right on wide windows; when the action is blocked, list why
        and offer only OK; focus starts on the safe button.
  - [x] Colour table: add `--scrim`. Forms: remove anything describing foot Save/Cancel rows
        or the form back link. Buttons table: Cancel (sheet header) ghost; Save/Add (sheet
        header) default; "Yes, delete" destructive / "Keep", "OK" outline in the dialog.
- [x] Task 10: Verify and ship (AC: 7, 8, 9)
  - [x] `git diff --stat 28f127b -- api shared infra` is empty.
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass.
  - [ ] Commit `Implement story 7.21: Edit and add in sheets`, deploy via the normal pipeline,
        then Sandy's quick look on phone and laptop. (After code-review, per the story workflow.)

### Review Findings

- [x] [Review][Patch] Double submit: Save stays enabled while saving, so a double-tap runs `navigate(-1)` twice and queues the PUT twice. Add a `saving` guard [web/src/routes/song-edit.tsx:110, gig-edit.tsx:96, setlist-edit.tsx:86]
- [x] [Review][Patch] The delete confirm can be dismissed with Escape mid-delete. Ignore `onOpenChange(false)` while `deleting` [web/src/routes/song-edit.tsx:205, gig-edit.tsx]
- [x] [Review][Patch] The loading sheet and the form sheet are different elements, so the Dialog remounts when an uncached record arrives and focus can't return to the opener. Keep one sheet instance across loading and loaded [web/src/routes/song-edit.tsx:49, gig-edit.tsx, setlist-edit.tsx]
- [x] [Review][Patch] One-off `mt-2` in a route file. Use `mt-[var(--spacing-unit)]` [web/src/routes/song-edit.tsx:222]
- [x] [Review][Patch] Missing tests: focus returns to the Edit opener, and where Escape lands with and without history (Task 8) [web/src/routes/*-edit.test.tsx]
- [x] [Review][Defer] After a delete, Back returns to the deleted record's page [web/src/routes/song-edit.tsx:186, gig-edit.tsx:166]. Deferred: pre-existing
- [x] [Review][Defer] Edit from a gig's song page opens over `/songs/:id`, so the page behind the sheet changes [web/src/routes/song.tsx:107, router.tsx]. Deferred: pre-existing link target

## Dev Notes

### Current state (read before editing)

- `router.tsx`: everything signed-in sits under `RequireAuth` → `AuthenticatedShell` (a
  `<main>` 40rem column). `songs` and `gigs` are under the pathless `ListLayout` (tab bar).
  The five form routes are flat siblings, so today a form *replaces* the page.
- `song-edit.tsx` / `gig-edit.tsx`: `EditExisting` (waits for the record via
  `use…OrCached`, else a page with a back link and status line) → `SongForm` / `GigForm`
  (`key` by id; reads `initial` once; `PageHeader` back link + `PageTitle` + fields + foot
  Save/Cancel row + `DeleteSong`/`DeleteGig`). Save builds the PUT record field by field
  (strict API schema; carry `performanceNotes`/`practiceNotes` on songs and `sections` on gigs —
  don't break this). `leave(e)` prevents the Link and calls `navigate(-1)` when
  `location.key !== 'default'`. Delete is an inline two-step (`idle` → `confirm`) with Keep.
- `setlist-edit.tsx`: same pattern; `PageTitle` is venue or date; Save disabled until songs
  load; parse errors render in a `role="alert"` block and refocus the textarea.
- `songs.tsx`, `gigs.tsx`, `song.tsx`, `gig.tsx`: render a `PageHeader` and content. The
  openers already exist (Add song / Add gig in list headers; Edit in song and gig headers;
  Edit setlist beside the first set) and their hrefs don't change.
- `song.tsx` holds the wake lock while mounted; with the edit sheet nested, it now stays on
  while editing a song. Accepted — harmless, and it's released when Sandy leaves the page.
- `Button` variants: default, destructive, destructive-outline, outline, ghost, link,
  secondary; sizes default, sm. `cn` merges custom spacing tokens listed in `utils.ts`.

### Design decisions for this spec

- **Nested routes, not modal state.** Each edit URL is a child of the page it opens over, so
  "over the right page" on a deep link, browser Back closing the sheet, and focus return all
  come from the router keeping the parent mounted. No `location.state.background` trick.
- **The sheet is always `open`; the route is the state.** Closing = navigating. Radix's
  `onOpenChange(false)` (Escape) calls the same `leave` as Cancel.
- **No tap-outside close.** AC 4 names Cancel and Escape; a stray tap on the dimmed page
  shouldn't throw away a half-typed chart. (If Sandy wants tap-outside, it's one line.)
- **Breakpoint `md` (48rem window width).** Content is a 40rem column; at 48rem+ a 460px
  side panel still leaves room. Media query only — no user-agent checks.
- **No open/close animation.** shadcn's animations need `tw-animate-css`; AC 1 says nothing
  else. The sheet just appears; route unmount removes it.
- **Not-found inside the sheet.** The sheet shell (Cancel, title, disabled Save, status line)
  keeps Cancel reachable and the page behind shows its own state.
- **Dialog copy** comes from the mock-up (titles, "This can't be undone.", "The songs stay in
  your library.", "Take it out of these gigs first:") with existing labels (Keep, Yes,
  delete). Gig label stays `venue, date` / date, as today.
- **Sheet header 56px** (`min-h-header`), not the mock-up's 60px — one fewer token, same feel.

### Out of scope (don't build)

- Settings sheet and the band button (7.22). Export link stays at the foot of `/songs`.
- Swipe gestures, `vaul`/Drawer, animations, autosave, unsaved-changes prompts.
- Key/Patch side by side, chord-chart polish, any new fields.
- Any change to `api/`, `shared/`, `infra/`, the play bar, the tab bar's look, or the service worker.

### Library notes

- `@radix-ui/react-dialog`: `Root` (`open`, `onOpenChange`), `Portal`, `Overlay`, `Content`
  (`onInteractOutside`, `onEscapeKeyDown`, `onOpenAutoFocus`, `onCloseAutoFocus`), `Title`,
  `Description`. Content needs a `Title` (console error otherwise) and either a `Description`
  or `aria-describedby={undefined}`. Modal by default: focus trap, `aria-hidden` on the rest
  of the page, body scroll lock (react-remove-scroll).
- `@radix-ui/react-alert-dialog`: same plus `Action` / `Cancel`; outside clicks never close
  it; opens with focus on `Cancel`. Nested inside a Dialog's content it stacks correctly;
  Escape closes the top layer only.
- React Router 7 (`react-router`): parent routes render children through `<Outlet />`.
  Static segments outrank dynamic ones. `navigate(-1)` / `navigate(path, { replace: true })`.
- Tailwind v4: `md:` is `min-width: 48rem`. `w-sheet`, `bg-scrim` come from the new tokens.

### Testing standards

- Vitest + Testing Library, co-located, no snapshots. Router-level checks in
  `app-bootstrap.test.tsx` (real `router`; resets location in `beforeEach`).
- Query by role: `getByRole('dialog', { name: 'Edit song' })`,
  `getByRole('alertdialog', { name: /Delete/ })`. Content behind a modal is `aria-hidden`, so
  use `{ hidden: true }` to assert the page is still there.
- Focus restore runs in a `setTimeout` inside Radix: use `waitFor`.
- `userEvent.keyboard('{Escape}')` for Escape.

### Previous story intelligence (7.18–7.20)

- 7.19/7.20: every new spacing token must be added to tailwind-merge in `utils.ts`, or `cn`
  keeps both classes. Done up front for `sheet`.
- 7.20 review: add forms must `navigate(-1)` when there's history (no duplicate entries);
  login lands on `/songs`. Keep both.
- 7.18 removed dead microcopy rather than leaving it; do the same for the form back-link
  labels (`SONGS.backToSong`) if nothing else uses them after this story.
- Routes don't set one-off sizes; sizes live in tokens and components (`ui/sheet.tsx`,
  `ui/alert-dialog.tsx`).

### References

- `_bmad-output/planning-artifacts/epics.md` — Story 7.21 (and 7.22 for what not to build)
- `_bmad-output/planning-artifacts/mockups/ui-review-2026-10-27.html` — sheets, dialogs, laptop panel
- `_bmad-output/planning-artifacts/architecture.md` — "UI components (shadcn/ui)" section
- `STYLE.md` — tokens, Buttons, Forms
- `web/src/components/ui/button.tsx` — how a shadcn copy is adapted here
- `AGENTS.md` — boundaries, one commit per story, British English

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Sheet and AlertDialog added (`@radix-ui/react-dialog@1.3.1`, `@radix-ui/react-alert-dialog@1.2.1`), tokens `--scrim` and `--spacing-sheet` added, `sheet` registered in tailwind-merge.
- Routes nested under the page they open over; `Songs`, `Gigs`, `Song`, `Gig` render `<Outlet />`; tab bar `end` dropped.
- Added a small shared `components/edit-sheet.tsx` (`EditSheet` shell + `useSheetExit`) so the five sheets and three not-found shells share one header/form/exit implementation instead of copies.
- Deviation from the spec's "no manual focus code": Radix Dialog only restores focus to a `Trigger` (`context.triggerRef`), and a route-driven sheet has none, so focus did not return in a test. `SheetContent` now remembers `document.activeElement` at mount and refocuses it on close. AlertDialog keeps Radix's own trigger behaviour.
- Removed dead copy: `SONGS.backToSong`, `SONG_DELETE.confirm`, `GIG_DELETE.confirm`. `SONGS.backToSongs`, `GIGS.backToGigs`, `GIG_SETLIST.backToGig` are still used by the song and gig pages.
- Tests: lint, typecheck, build clean; web 339 tests pass (shared 31, infra 55, api 130 unchanged). No changes to `api/`, `shared/`, `infra/`.
- Not done yet: commit, deploy and Sandy's live check (after code-review).

### File List

- `STYLE.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/implementation-artifacts/7-21-edit-and-add-in-sheets.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `pnpm-lock.yaml`
- `web/package.json`
- `web/src/app-bootstrap.test.tsx`
- `web/src/components/edit-sheet.tsx` (new)
- `web/src/components/tab-bar.tsx`
- `web/src/components/ui/alert-dialog.tsx` (new)
- `web/src/components/ui/sheet.tsx` (new)
- `web/src/components/ui/sheet.test.tsx` (new)
- `web/src/lib/microcopy.ts`
- `web/src/lib/utils.ts`
- `web/src/lib/utils.test.ts`
- `web/src/router.tsx`
- `web/src/routes/gig.tsx`
- `web/src/routes/gig-edit.tsx`
- `web/src/routes/gig-edit.test.tsx`
- `web/src/routes/gigs.tsx`
- `web/src/routes/setlist-edit.tsx`
- `web/src/routes/setlist-edit.test.tsx`
- `web/src/routes/song.tsx`
- `web/src/routes/song-edit.tsx`
- `web/src/routes/song-edit.test.tsx`
- `web/src/routes/songs.tsx`
- `web/src/styles/tokens.css`

### Change Log

- 2026-10-27: Story created (ready-for-dev).
- 2026-10-27: Implemented; status → review.
- 2026-10-27: Code review: 5 patches applied (Save can't run twice while saving; delete confirm can't be dismissed mid-delete; one `SheetFrame` kept across loading and form so focus returns to the opener; spacing token instead of `mt-2`; Edit-opener focus, Escape-destination and double-tap tests). 2 deferred to deferred-work.md.
