---
baseline_commit: 6a540d0
---

# Story 7.22: Settings sheet

Status: review

<!-- Source: epics.md "Epic 7 / Story 7.22" (amended 2026-10-27 to add Appearance) and the
     2026-10-27 UI review decisions under Epic 7. architecture.md "Theme" was amended the same
     day (uncommitted at spec time; commit it with this story).
     Reference look: _bmad-output/planning-artifacts/mockups/ui-review-2026-10-27.html
     (`.bandbtn`, `.optrow`, `.optlabel`, `.seg` CSS; `settingsSheet(false)`; the "band" set).
     The mock-up shows the look; the acceptance criteria are the spec. The mock-up has no
     Appearance section — this spec defines it. The three-band list is a later story. -->

## Story

As Sandy,
I want a settings sheet behind the band name,
so that Export has a proper home, I can choose light or dark regardless of the device's
setting, and there's a place for picking a band later.

## Acceptance Criteria

1. On `/songs` and `/gigs`, the band name in the header becomes a button with a Lucide
   chevron-down. It opens a sheet (as in 7.21) titled "GigBuddy" with Done on the right.
2. The sheet has a "Band" section showing the current band with a tick. V1 has one band, so
   there's nothing to switch to yet.
3. The sheet has a "Your data" section with "Export all data" (a plain
   `<a href="/api/v1/export">`, as in 7.17) and a help line: "Downloads every band's songs
   and gigs as one file."
4. The Export link is removed from the foot of the songs page.
5. The sheet has an "Appearance" section with a three-way segmented control: System, Light,
   Dark. System (the default) follows the device's setting, as the app does now; Light and
   Dark override it. The choice applies at once, without closing the sheet.
6. The choice is remembered on that device only (browser storage), so the laptop and the
   phone can differ. It doesn't sync and isn't sent to the API.
7. A saved Light or Dark choice applies before first paint (a small inline script in
   `index.html`), so there's no flash of the other theme on load, and the browser
   `theme-color` follows the chosen theme. If storage can't be read, the app falls back to
   System.
8. The sheet can't be reached from song, gig, gig song or form pages.
9. No change to `api/`, `shared/` or `infra/`. `STYLE.md` notes the settings sheet and the
   appearance override. `architecture.md` "Theme" was amended on 2026-10-27 to allow this.
10. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass. Tests cover opening and
    closing the sheet from both list pages, the export link's href, that the songs page no
    longer has the link, and that choosing Light, Dark or System sets the theme and is
    remembered.
11. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] Task 1: Theme tokens and base styles (AC: 5, 7, 9)
  - [x] `web/src/styles/tokens.css`: change the dark block's selector and add a forced-dark
        block, so the three states work:
        ```css
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) { /* dark values, unchanged */ }
        }

        :root[data-theme="dark"] { /* the same dark values */ }
        ```
        CSS can't share one rule between a media block and a plain selector, so the dark
        values are written twice. Keep the `:root[data-theme="dark"]` block **after** the
        `@media` block (the contrast report reads the first `:root` as light and the `:root`
        inside the `@media` as dark — `extractBlock` matches `:root:not(…)` fine; check
        `pnpm run report:contrast` still passes). Update the file's header comment
        ("no JS theme provider" stays true; mention the `data-theme` override, Story 7.22).
  - [x] New `web/src/styles/tokens.test.ts`: reads `tokens.css` and asserts the two dark
        blocks declare the same custom properties with the same values (guards drift
        between the copies).
  - [x] `web/src/styles/globals.css`: keep `color-scheme: light dark` on `html`, and add
        `:root[data-theme="light"] { color-scheme: light; }` and
        `:root[data-theme="dark"] { color-scheme: dark; }` so form controls, scrollbars and
        the caret follow a forced choice. Update the comment at the top of the file.
- [x] Task 2: `web/src/lib/theme.ts` (+ `theme.test.ts`) (AC: 5, 6, 7)
  - [x] Export:
        - `type ThemeChoice = 'system' | 'light' | 'dark'` (a local UI value, not a record
          shape, so no Zod schema in `shared/`).
        - `THEME_STORAGE_KEY = 'gigbuddy-theme'`.
        - `THEME_COLOR = { light: '#faf9f5', dark: '#1a1209' } as const` (the two
          `--background` values, as in `index.html`'s `theme-color` metas).
        - `readThemeChoice(): ThemeChoice` — `localStorage.getItem` inside try/catch; returns
          `'light'` / `'dark'` only for those exact strings, otherwise `'system'` (missing,
          junk or a throw).
        - `applyTheme(choice)` — `'light'`/`'dark'`: set `data-theme` on
          `document.documentElement` and set **every** `meta[name="theme-color"]`'s `content`
          to `THEME_COLOR[choice]`. `'system'`: remove `data-theme` and restore each meta to
          the colour its `media` attribute names (`(prefers-color-scheme: dark)` →
          `THEME_COLOR.dark`, otherwise `THEME_COLOR.light`).
        - `saveThemeChoice(choice)` — `applyTheme(choice)` first (always, so the screen
          changes even if storage fails), then in try/catch: `'system'` removes the key,
          otherwise sets it.
  - [x] Tests: read falls back to System for a missing key, an unknown value and a throwing
        `getItem` (`vi.spyOn(Storage.prototype, 'getItem')`); save + read round-trips
        Light and Dark; System removes the key; apply sets/removes `data-theme` and rewrites
        both metas (create the two metas in the test's `document.head`); a throwing
        `setItem` still applies the theme. `afterEach`: `localStorage.clear()`, remove
        `data-theme`, remove the test metas.
- [x] Task 3: Inline pre-paint script in `web/index.html` (AC: 7)
  - [x] In `<head>`, **after** the two `theme-color` metas (it rewrites them), add a plain
        classic `<script>` (not `type="module"`, which is deferred and would paint first):
        ```html
        <script>
          // Story 7.22: apply a saved Light or Dark choice before first paint.
          // Keep in step with web/src/lib/theme.ts.
          try {
            var t = localStorage.getItem('gigbuddy-theme');
            if (t === 'light' || t === 'dark') {
              document.documentElement.setAttribute('data-theme', t);
              var c = t === 'dark' ? '#1a1209' : '#faf9f5';
              document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
                m.setAttribute('content', c);
              });
            }
          } catch (e) {}
        </script>
        ```
        Vite leaves a classic inline script in place. There's no Content-Security-Policy on
        the site (checked `infra/` at spec time), so an inline script is allowed. Don't
        touch the PWA manifest's `theme_color` (static, `#1a1209`; `build-output.test.ts`
        asserts it).
  - [x] New `web/src/index-html.test.ts`: read `web/index.html`, pull out the inline script
        (the `<script>` without `src`), and run it (`new Function(code)()`) against jsdom
        with the two metas in `document.head`:
        stored `'dark'` → `data-theme="dark"` and both metas `#1a1209`; stored `'light'` →
        `"light"` and `#faf9f5`; nothing stored or junk → no attribute, metas untouched; a
        throwing `getItem` → no error, no attribute. Also assert the script sits before the
        `type="module"` entry script. This keeps the copy in step with `theme.ts`.
- [x] Task 4: Settings sheet component (AC: 1, 2, 3, 5, 6)
  - [x] New `web/src/components/settings-sheet.tsx` exporting `BandMenu`: the band button
        plus the sheet, with local `open` state (`useState(false)`). **No route**: the sheet
        is a menu, not an editing task, so there's no URL to deep-link and browser Back
        doesn't close it (unlike 7.21's edit sheets). Escape and Done close it.
  - [x] The button: `Button variant="ghost"`, `type="button"`, `aria-haspopup="dialog"`,
        `aria-expanded={open}`, text `ACTIVE_BAND_NAME` (from `@gigbuddy/shared`, as
        `BandName` does now) in Lora at `--text-nav` with foreground text, then a brass
        Lucide `ChevronDown` (`aria-hidden`, `text-primary`). Accessible name is the band
        name. Keep the classes in the component, not the route files.
  - [x] The sheet, from `ui/sheet.tsx` (no changes needed there):
        ```
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent aria-describedby={undefined}>
            <SheetHeader>
              <span aria-hidden="true" />            {/* empty left cell keeps the grid */}
              <SheetTitle>{SETTINGS.title}</SheetTitle>
              <Button type="button" variant="ghost" className="text-primary" onClick={() => setOpen(false)}>
                {SETTINGS.done}
              </Button>
            </SheetHeader>
            <SheetBody>…sections…</SheetBody>
          </SheetContent>
        </Sheet>
        ```
        `SheetContent` already restores focus to whatever had focus when it mounted (the
        band button on the laptop), blocks tap-outside close, and Radix closes on Escape
        via `onOpenChange(false)`.
  - [x] Sections, in this order (Sandy, 2026-10-27) — Band, Appearance, Your data. Each section heading is
        an `h2` (Body-adjacent label: `--text-small`, `font-normal`, `text-muted-foreground`,
        mock-up `.optlabel`), with `--spacing-section-gap` above every heading after the first.
        - **Band:** one row (not a link or button): band name at `--text-row`, foreground,
          `min-h-tap`, `border-b border-border`, `justify-between`, `aria-current="true"`,
          then a brass Lucide `Check` (`aria-hidden`, about 24px). A visually hidden
          "(current band)" isn't needed: the row is the only band.
        - **Your data:** `Button asChild variant="link"` around a plain
          `<a href="/api/v1/export">` with a Lucide `Download` icon before the text
          "Export all data" (keep the 7.17 comment about why it isn't a router `Link`).
          Then the help line, Body, `text-muted-foreground`.
        - **Appearance:** a segmented control: a `div role="group"` labelled by the
          section's `h2` (`aria-labelledby` with a `useId()` id), `grid grid-cols-3`,
          full width, 1px `--input` border, 8px radius, `overflow-hidden`. Three `Button`s,
          `type="button"`, `aria-pressed`, square corners, dividers between them
          (`border-l border-input` on the second and third): the chosen one is
          `variant="default"` (brass fill), the others `variant="ghost"` (foreground text).
          Order: System, Light, Dark. State: `useState(readThemeChoice)`; on click,
          `saveThemeChoice(choice)` and set state. The sheet stays open.
        No shadcn ToggleGroup / Radix toggle package: three `Button`s with `aria-pressed`
        need nothing new (the 7.18 rule: only the components a story needs).
  - [x] Read the choice when the sheet opens (the `SettingsBody` can be its own component
        that mounts with the sheet, so `useState(readThemeChoice)` picks up the stored value
        each time).
- [x] Task 5: Wire it into the list pages; remove the old link (AC: 1, 4, 8)
  - [x] `page-header.tsx`: remove `BandName` (and its `ACTIVE_BAND_NAME` import) — the band
        menu replaces it. Update `page-header.test.tsx`: drop the `BandName` describe.
  - [x] `songs.tsx` and `gigs.tsx`: `left={<BandMenu />}`. These are the only two callers,
        so the sheet can't be reached from song, gig, gig song or form pages (AC 8).
  - [x] `songs.tsx`: delete the `<footer>` export link and its imports (`EXPORT`). Update
        the component comment (7.17's link moved to the settings sheet in 7.22).
  - [x] `microcopy.ts`: replace `EXPORT` with
        ```ts
        /* Story 7.22 — settings sheet behind the band name. */
        export const SETTINGS = {
          title: 'GigBuddy',
          done: 'Done',
          band: 'Band',
          yourData: 'Your data',
          exportLink: 'Export all data',
          exportHelp: "Downloads every band's songs and gigs as one file.",
          appearance: 'Appearance',
          system: 'System',
          light: 'Light',
          dark: 'Dark',
        } as const;
        ```
        Remove `EXPORT` if nothing else uses it (grep).
- [x] Task 6: Tests (AC: 10)
  - [x] New `web/src/components/settings-sheet.test.tsx` (render `BandMenu` alone; it needs
        no router):
        - The band button is named "The Jack Ruby 5", has `aria-haspopup="dialog"`, and no
          dialog is open at first.
        - Click opens `dialog` named "GigBuddy"; Done closes it; Escape closes it; focus
          returns to the band button (`waitFor`, as in 7.21).
        - Band section: heading "Band", a row with the band name and `aria-current="true"`.
        - Your data: link "Export all data" with `href="/api/v1/export"` and
          `data-variant="link"`; the help line text.
        - Appearance: group named "Appearance" with three buttons; System pressed by
          default. Click Dark → `aria-pressed` moves, `document.documentElement` has
          `data-theme="dark"`, `localStorage['gigbuddy-theme'] === 'dark'`, the dialog is
          still open. Click Light → `"light"`. Click System → no attribute, key removed.
        - Remembered: choose Dark, close, reopen (and also unmount and render again) →
          Dark is pressed.
        - Storage unreadable (`getItem` throws) → System pressed, no crash.
        - `afterEach`: `localStorage.clear()`, remove `data-theme`, restore spies.
  - [x] `songs.test.tsx`: replace the two 7.17 export tests with one asserting the songs
        page has **no** "Export all data" link (loaded, empty and errored). Add: the header
        has a button named "The Jack Ruby 5" (the old `BandName` "not a button" assertion
        in `songs.test.tsx`, if any, is updated, not deleted). Same button check in
        `gigs.test.tsx`.
  - [x] `app-bootstrap.test.tsx` (real router): new `describe('settings sheet (Story 7.22)')`:
        from `/songs` and from `/gigs`, click the band button → dialog "GigBuddy" → Done →
        closed and still on the same list. On `/songs/a1`, `/gigs/g1` and
        `/gigs/g1/songs/a1` there is no button named "The Jack Ruby 5" (AC 8). The 7.21
        sheet tests that query `getByRole('dialog')` must still find exactly one dialog.
  - [x] Existing tests are updated, not deleted (except the 7.17 export-link assertions,
        which this story reverses).
- [x] Task 7: STYLE.md and architecture (AC: 9)
  - [x] "Spacing and tap targets" → Header entry: the band name is a ghost button (Lora
        20px, brass chevron-down) that opens the settings sheet; remove "plain text until the
        settings sheet". Remove the "Export link at the foot of the songs page" bullet.
  - [x] Buttons table: add "Band name (list header)" → `ghost`, Lora 20px, brass
        chevron-down; "Done (settings sheet)" → `ghost`, brass text; "Appearance segments" →
        `default` when chosen, `ghost` otherwise, `aria-pressed`; change "Export all data" to
        say it lives in the settings sheet with a Lucide download icon.
  - [x] New "Settings sheet" entry after "Sheet": opened only from the band name on
        `/songs` and `/gigs`; same sheet as editing, but the header is empty · "GigBuddy" ·
        Done, and it has no URL (Done and Escape close it); sections Band (current band with a
        brass tick), Appearance (System / Light / Dark), Your data (Export + help line).
  - [x] "Colour" section: add a line — System follows the device; Light or Dark sets
        `data-theme` on `<html>` and overrides it, remembered per device in browser storage
        (`gigbuddy-theme`), applied before first paint by the inline script in `index.html`,
        which also sets `theme-color`.
  - [x] `architecture.md` "Theme" and the constraints line are already amended (uncommitted
        on `main` at spec time) — check they match what was built and include them in the
        story commit. `epics.md`'s 7.22 amendment is also uncommitted; commit it too.
- [x] Task 8: Verify and ship (AC: 9, 10, 11)
  - [x] `git diff --stat 6a540d0 -- api shared infra` is empty.
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` (includes the contrast report) and
        `pnpm build` pass. Confirm `web/dist/index.html` still contains the inline script.
  - [x] Commit `Implement story 7.22: Settings sheet`, deploy via the normal pipeline, then
        Sandy's quick look on phone and laptop. (After code-review, per the story workflow.)

## Dev Notes

### Current state (read before editing)

- `components/page-header.tsx`: `PageHeader({ left, right })` and `BandName` (a `<p>` with
  `ACTIVE_BAND_NAME`, Lora `--text-nav`, `px-2.5` so it lines up like ghost-button text).
  `BandName` is used only by `routes/songs.tsx` and `routes/gigs.tsx`.
- `routes/songs.tsx`: header (BandName · Add song), title, list or status line, then a
  `<footer>` with `Button asChild variant="link"` → `<a href="/api/v1/export">` (`EXPORT.link`),
  then `<Outlet />` for the add sheet. `routes/gigs.tsx` is the same shape without the footer.
- `components/ui/sheet.tsx` (7.21): `Sheet`, `SheetContent` (portal + `bg-scrim` overlay;
  bottom sheet on narrow windows, 460px right panel from `md`; tap-outside blocked; restores
  focus to the element focused at mount), `SheetHeader` (3-column grid, first child left,
  last child right), `SheetTitle` (Lora 20px), `SheetDescription`, `SheetBody` (scrolls).
  No Trigger/Close exports; don't add them — controlled `open` is enough.
- `components/edit-sheet.tsx` is for forms (Cancel/Save, route-driven exit). Don't reuse it
  for settings: there's no form, no Cancel and no route.
- `styles/tokens.css`: light values on `:root`; dark values in
  `@media (prefers-color-scheme: dark) { :root { … } }`; `@theme inline` maps them for
  Tailwind. `styles/globals.css` sets `color-scheme: light dark` on `html`.
- `web/index.html`: two `theme-color` metas (`#faf9f5` for light media, `#1a1209` for dark),
  `apple-mobile-web-app-status-bar-style` `default`, module entry script in `<body>`.
- `scripts/contrast-report.ts` (runs first in `pnpm test`): reads the first `:root` as
  light and the `:root…` block inside `@media (prefers-color-scheme: dark)` as dark.
- `Button` variants: default, destructive, destructive-outline, outline, ghost, link,
  secondary; sizes default, sm. Ghost has 10px side padding; link none.
- No JS anywhere reads `matchMedia` or `localStorage` today. This story adds the only
  storage use; System needs no JS at all (CSS media query does it).

### Design decisions for this spec

- **`data-theme` on `<html>`, CSS does the rest.** No React theme context: the attribute is
  the state, and `theme.ts` is three small functions. Matches the amended architecture
  "Theme" section.
- **Storage key `gigbuddy-theme`; System = key absent.** Only `'light'` and `'dark'` are
  ever stored. Junk or unreadable storage means System (AC 7).
- **`theme-color`:** forcing a theme rewrites both metas to the chosen background so the
  iOS/Safari chrome matches whatever the system setting is; System restores the originals.
  The installed PWA's manifest `theme_color` is static and isn't touched.
- **No URL for the settings sheet.** 7.21 made edit sheets routes so deep links and Back
  work for real tasks. A menu doesn't need either, and a `/songs/settings` route would
  shadow nothing today but invites collisions with `:songId`. Local state is lighter.
- **Segmented control from `Button`s**, not a new Radix ToggleGroup — nothing to install,
  and STYLE.md's "every button goes through `Button`" holds. `aria-pressed` buttons in a
  labelled `group` (as the mock-up's `.seg`).
- **Section order: Band, Appearance, Your data.** Sandy chose (2026-10-27) to put
  Appearance above Your data, since it's changed more often than Export is used. The ACs
  don't fix an order.
- **Tick on the band row is decorative**; `aria-current="true"` carries the meaning.

### Out of scope (don't build)

- Switching bands, a band list, or any second band (later, larger work).
- Any API, sync or server-side preference; anything in `shared/` or `infra/`.
- Changing the PWA manifest, the status-bar style, the service worker or the export endpoint.
- A route or URL for the sheet; swipe-to-close; animations.
- Theme toggles anywhere other than this sheet; device detection of any kind.

### Library notes

- `@radix-ui/react-dialog` (via `ui/sheet.tsx`): controlled `open`/`onOpenChange`; Escape
  calls `onOpenChange(false)`. Content needs a `Title`; pass `aria-describedby={undefined}`
  when there's no `Description`. Modal: the page behind is `aria-hidden` while open.
- `lucide-react` 1.54: `ChevronDown`, `Check`, `Download` are available.
- Vite: classic (non-module) inline `<script>` in `index.html` is passed through untouched;
  module scripts are deferred, so the pre-paint script must be classic.
- jsdom provides `localStorage`; `vi.spyOn(Storage.prototype, 'getItem' | 'setItem')` to
  make it throw.

### Testing standards

- Vitest + Testing Library, co-located, no snapshots. Router-level checks in
  `app-bootstrap.test.tsx` (real `router`; resets location in `beforeEach`).
- Query by role: `getByRole('button', { name: 'The Jack Ruby 5' })`,
  `getByRole('dialog', { name: 'GigBuddy' })`, `getByRole('group', { name: 'Appearance' })`,
  `getByRole('button', { name: 'Dark', pressed: true })`.
- Focus restore runs in a timeout inside Radix: use `waitFor`.
- Reset `document.documentElement` and `localStorage` after every theme test so tests don't
  leak a forced theme into each other.

### Previous story intelligence (7.18–7.21)

- 7.21: `SheetContent` remembers the focused element at mount and refocuses it on close —
  works for a controlled sheet too, so no extra focus code. Content behind a modal is
  `aria-hidden`; use `{ hidden: true }` to assert the page is still there.
- 7.21: tests that do `getByRole('dialog')` assume one dialog; the settings sheet is closed
  by default, so they stay valid.
- 7.19/7.20: any new spacing token must be added to tailwind-merge in `lib/utils.ts`. This
  story shouldn't need a new token (use `min-h-tap`, `--spacing-section-gap`, `--text-*`).
- 7.18: remove dead microcopy (`EXPORT`) rather than leaving it. Routes don't set one-off
  sizes; put classes in the component.
- 7.17: the export link must be a plain `<a>`; the service worker's `NetworkOnly` rule for
  `/api/v1/export` stays.

### Project Structure Notes

- New: `web/src/lib/theme.ts`, `web/src/lib/theme.test.ts`,
  `web/src/components/settings-sheet.tsx`, `web/src/components/settings-sheet.test.tsx`,
  `web/src/styles/tokens.test.ts`, `web/src/index-html.test.ts`.
- Changed: `web/index.html`, `web/src/styles/tokens.css`, `web/src/styles/globals.css`,
  `web/src/components/page-header.tsx` (+ test), `web/src/routes/songs.tsx` (+ test),
  `web/src/routes/gigs.tsx` (+ test), `web/src/lib/microcopy.ts`,
  `web/src/app-bootstrap.test.tsx`, `STYLE.md`, `_bmad-output/planning-artifacts/architecture.md`,
  `_bmad-output/planning-artifacts/epics.md`.
- kebab-case file names, co-located tests, imports with `.js` suffix as elsewhere in `web/src`.

### References

- `_bmad-output/planning-artifacts/epics.md` — Story 7.22 and the 2026-10-27 decisions
- `_bmad-output/planning-artifacts/architecture.md` — "Theme (amended 2026-10-19)", amended 2026-10-27
- `_bmad-output/planning-artifacts/mockups/ui-review-2026-10-27.html` — `settingsSheet()`, `.bandbtn`, `.optrow`, `.seg`
- `_bmad-output/implementation-artifacts/7-21-edit-and-add-in-sheets.md` — sheet behaviour and lessons
- `STYLE.md` — Header, Buttons, Sheet, Colour
- `AGENTS.md` — boundaries, one commit per story, British English

### Review Findings

- [x] [Review][Defer] `SheetContent` captures its focus opener when it first renders, which for a controlled sheet is page load, not the moment it opens [web/src/components/ui/sheet.tsx:19] — deferred, pre-existing (7.21); `BandMenu`'s `onCloseAutoFocus` ref covers it here

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5

### Debug Log References

### Completion Notes List

- Implemented as specced. Appearance control is a `<fieldset aria-labelledby>` rather than `div role="group"` (Biome's `useSemanticElements` rule rejects the div); same `group` role, same accessible name.
- `BandMenu` also focuses the band button via a ref in `onCloseAutoFocus`: the opener captured by `SheetContent` wasn't the button in tests (focus fell to body), so the explicit ref makes return-focus reliable.
- File-reading tests (`tokens.test.ts`, `index-html.test.ts`) use `process.cwd()` because `import.meta.url` isn't a file URL under jsdom.
- `pnpm lint`, `typecheck`, `test` (api 130, shared 31, infra 55, web 365 incl. contrast report) and `build` pass; `web/dist/index.html` contains the inline script; `git diff 6a540d0 -- api shared infra` is empty.
- architecture.md "Theme" amendment checked against the build: matches.

- Ultimate context engine analysis completed - comprehensive developer guide created.

### File List

- web/index.html
- web/src/styles/tokens.css
- web/src/styles/tokens.test.ts (new)
- web/src/styles/globals.css
- web/src/lib/theme.ts (new)
- web/src/lib/theme.test.ts (new)
- web/src/index-html.test.ts (new)
- web/src/lib/microcopy.ts
- web/src/components/settings-sheet.tsx (new)
- web/src/components/settings-sheet.test.tsx (new)
- web/src/components/page-header.tsx
- web/src/components/page-header.test.tsx
- web/src/routes/songs.tsx
- web/src/routes/songs.test.tsx
- web/src/routes/gigs.tsx
- web/src/routes/gigs.test.tsx
- web/src/app-bootstrap.test.tsx
- STYLE.md
- _bmad-output/planning-artifacts/architecture.md
- _bmad-output/planning-artifacts/epics.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/7-22-settings-sheet.md

### Change Log

- 2026-10-27: Story created (ready-for-dev).
- 2026-10-27: Implemented; status → review.
- 2026-10-27: Code review (lightweight): clean; 1 deferred to deferred-work.md (stale `SheetContent` opener for controlled sheets).
