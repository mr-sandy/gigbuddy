---
baseline_commit: 6c73f8e
---

# Story 7.18: Adopt shadcn/ui foundations

Status: done

<!-- Source: epics.md "Epic 7 / Story 7.18" and the 2026-10-27 UI review decisions under Epic 7.
     Reference look: _bmad-output/planning-artifacts/mockups/ui-review-2026-10-27.html (brass accent).
     The mock-up shows the look; the acceptance criteria are the spec. -->

## Story

As Sandy,
I want GigBuddy's buttons and fields to share one clear style with a brass accent,
so that the app looks finished and I can tell at a glance what each control does.

## Acceptance Criteria

1. `architecture.md` records the adoption of shadcn/ui: components copied into
   `web/src/components/ui/`, the Radix packages they need, `lucide-react` for icons, and a
   `cn` helper in `web/src/lib/`. It also records how the generated code's `@/` imports fit
   the project's import style (decided below: rewritten to relative `.js` imports, no alias).
2. `web/src/styles/tokens.css` uses shadcn's role names for colour, with these values. The
   old colour token names are removed, so there is one set. Type, spacing and tap tokens stay.

   | Token | Light | Dark |
   |---|---|---|
   | `--background` | `#faf9f5` | `#1a1209` |
   | `--foreground` | `#1a1209` | `#f1e6cf` |
   | `--muted` | `#f0ebe0` | `#251a0e` |
   | `--muted-foreground` | `#5a4a35` | `#c9b486` |
   | `--primary` (brass) | `#8a6420` | `#e6b855` |
   | `--primary-foreground` | `#faf9f5` | `#1a1209` |
   | `--border` | `#e2dacb` | `#3a2e1f` |
   | `--input` | `#8f7f66` | `#7a6a4d` |
   | `--destructive` | `#a3341f` | `#f08a6e` |
   | `--destructive-foreground` | `#ffffff` | `#1a1209` |
   | `--ring` | brass at about 45% opacity | same |

3. Only these components are added: Button, Input, Textarea, Label. Each is sized for
   GigBuddy: at least 44px high, 18px button text, 22px input text, input borders in
   `--input` (at least 3:1 against the background).
4. Every button and button-like link in the routes goes through `Button`:
   - Edit, Add song, Add gig: ghost, brass text, Lucide pencil or plus icon.
   - Back links: ghost, muted text, Lucide chevron-left.
   - Save and Add (in forms): default (brass).
   - Cancel: ghost.
   - Delete song, Delete gig: destructive outline. In the confirm step, "Yes, delete" is
     destructive and "Keep" is outline.
   - Export all data: link variant, muted.
   - Previous and Next: outline, for now (7.19 replaces them).
   List rows stay rows, and gain a muted Lucide chevron-right.
5. Add and Save on the song and gig forms are disabled until the required fields are
   filled (song: title; gig: venue and date). This replaces the messages shown on submit
   ("A song needs a title." and "A gig needs a venue and a date.").
6. Page titles, layout, routes and navigation are unchanged. No change to `api/`, `shared/`
   or `infra/`.
7. `STYLE.md` is rewritten around the new tokens: the colour table, which Button variant does
   which job, form rules, and Lucide as the only icon set.
8. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass. Tests cover the
   disabled-until-valid behaviour on add song and add gig, and that Delete uses the
   destructive style. Existing tests are updated, not deleted.
9. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] **Task 1: Dependencies and `cn`** (AC 1, 3)
  - [x] From the repo root:
    `pnpm --filter web add @radix-ui/react-slot@1.4.0 @radix-ui/react-label@2.1.16 lucide-react@1.54.0 class-variance-authority@0.7.1 clsx@2.1.1 tailwind-merge@3.7.0`
    (versions chosen at least two weeks old; caret ranges in `package.json` as elsewhere).
    Use the two individual Radix packages, not the `radix-ui` umbrella package. Don't add
    `tw-animate-css`: none of these four components animate.
  - [x] Don't run the shadcn CLI and don't add `components.json`. Copy by hand (Task 3).
  - [x] `web/src/lib/utils.ts` (shadcn's file name, kept so future copies need only the import
    path rewritten):
    ```ts
    import { type ClassValue, clsx } from 'clsx';
    import { twMerge } from 'tailwind-merge';

    export function cn(...inputs: ClassValue[]) {
      return twMerge(clsx(inputs));
    }
    ```
  - [x] `web/src/lib/utils.test.ts`: `cn` joins classes, drops falsy ones, and a later
    conflicting class wins (`cn('px-4', 'px-2.5')` → `'px-2.5'`), including a GigBuddy case:
    `cn('text-[length:var(--text-body)] text-primary', 'text-muted-foreground')` keeps the
    font size and ends with `text-muted-foreground`.
- [x] **Task 2: Tokens** (AC 2)
  - [x] Rewrite the colour part of `web/src/styles/tokens.css` in shadcn's Tailwind v4 shape:
    ```css
    :root {
      --background: #faf9f5;
      --foreground: #1a1209;
      --muted: #f0ebe0;
      --muted-foreground: #5a4a35;
      --primary: #8a6420;
      --primary-foreground: #faf9f5;
      --border: #e2dacb;
      --input: #8f7f66;
      --destructive: #a3341f;
      --destructive-foreground: #ffffff;
      --ring: color-mix(in srgb, var(--primary) 45%, transparent);
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --background: #1a1209;
        /* …the dark column of the table… */
      }
    }

    @theme inline {
      --color-background: var(--background);
      --color-foreground: var(--foreground);
      /* …one line per token, including --color-ring… */
    }
    ```
    `--ring` is declared once: it follows `--primary`, so the dark block doesn't repeat it.
    The light `:root` block must come before the `@media` block (the contrast script relies on
    it, Task 6).
  - [x] Keep the existing `@theme { … }` block for type, spacing, tap and font tokens exactly as
    it is, minus the five old `--color-*` lines (`--color-bg`, `--color-text-primary`,
    `--color-text-secondary`, `--color-accent`, `--color-border-hairline`). Update the header
    comment to describe the new shape.
  - [x] `web/src/styles/globals.css`: `html` uses `var(--background)` and `var(--foreground)`.
    Nothing else there changes.
  - [x] `web/index.html` theme-color metas (`#faf9f5` / `#1a1209`) and the manifest in
    `vite.config.ts` already match `--background`; leave them.
- [x] **Task 3: Components** (AC 1, 3) — `web/src/components/ui/{button,input,textarea,label}.tsx`
  - [x] Start from shadcn's current Tailwind v4 ("new-york") source for each and adapt:
    - Imports: `@/lib/utils` → `'../../lib/utils.js'`; `import * as React from 'react'` →
      `import type { ComponentProps } from 'react'`; `import { Slot } from '@radix-ui/react-slot'`;
      `import * as LabelPrimitive from '@radix-ui/react-label'`. Type-only imports use `type`
      (`verbatimModuleSyntax`). Let Biome reformat quotes and semicolons.
    - Use only the tokens in AC 2. Stock classes that reference tokens we don't have
      (`accent`, `accent-foreground`, `secondary`, `text-white`) are replaced; stock `dark:`
      overrides (`dark:bg-input/30`, `dark:bg-destructive/60`, `dark:aria-invalid:…`) are
      removed. Dark mode comes from the tokens alone.
    - Remove stock size shrinking: `text-sm`, `text-base`, `md:text-sm`, `h-9`, `size-4` on
      svgs. `md:text-sm` in particular would shrink inputs on the laptop.
    - Focus: `outline-none focus-visible:ring-[3px] focus-visible:ring-ring` (the token is
      already 45%, so no `/50` modifier). Inputs also take `focus-visible:border-primary`.
  - [x] **Button** (`button.tsx`): export `Button` and `buttonVariants`. Keep shadcn's
    `asChild` (Slot) so router `Link`s and `<a>`s render as Buttons, and set
    `data-slot="button"`, `data-variant={variant}` and `data-size={size}` on the element
    (current shadcn does; the tests use `data-variant`). Base: `inline-flex items-center
    justify-center gap-2 whitespace-nowrap rounded-lg font-medium
    text-[length:var(--text-body)] leading-[var(--text-body--line-height)] shrink-0
    transition-colors disabled:pointer-events-none disabled:opacity-50
    [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5`
    plus the focus classes. Variants (only these):
    | Variant | Classes |
    |---|---|
    | `default` | `bg-primary text-primary-foreground shadow-xs hover:bg-primary/90` |
    | `destructive` | `bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90` |
    | `destructive-outline` | `border border-destructive bg-background text-destructive hover:bg-destructive/10` |
    | `outline` | `border border-input bg-background text-foreground hover:bg-muted` |
    | `ghost` | `text-foreground hover:bg-muted` (routes add `text-primary` or `text-muted-foreground`) |
    | `link` | `text-muted-foreground underline underline-offset-4` |

    Sizes: only `default`: `min-h-tap px-4`. Add `compoundVariants` so ghost gets `px-2.5`
    and link gets `px-0` — `compoundVariants` come after the size classes in cva's output, so
    `cn` lets them win; padding written in the variant itself would lose to `px-4`. Don't add
    `secondary`, `sm`, `lg` or `icon`: later stories add what they need.
  - [x] **Input** (`input.tsx`): `block w-full min-w-0 min-h-tap rounded-lg border
    border-input bg-background px-3 py-2 text-[length:var(--text-reading)]
    leading-[var(--text-reading--line-height)] text-foreground
    placeholder:text-muted-foreground shadow-xs transition-[color,box-shadow]
    disabled:cursor-not-allowed disabled:opacity-50` plus the focus classes. Keep
    `data-slot="input"`; drop the stock `file:` classes (no file inputs) and `aria-invalid:`
    classes (nothing sets `aria-invalid` after this story).
  - [x] **Textarea** (`textarea.tsx`): the same classes as Input (22px text, `--input`
    border, `w-full`, focus ring). Remove stock
    `field-sizing-content`: it would override `rows={12}` / `rows={16}` and change how the
    chord chart and setlist boxes size today. Routes keep passing `resize-y`.
  - [x] **Label** (`label.tsx`): Radix `LabelPrimitive.Root` with `block
    text-[length:var(--text-body)] leading-[var(--text-body--line-height)] font-medium
    text-foreground select-none`. It renders a real `<label>`, so `getByLabelText` keeps
    working.
  - [x] One short header comment per file: "shadcn/ui <Name> (Story 7.18), adapted to
    GigBuddy sizes and tokens." No other commentary needed.
- [x] **Task 4: Routes** (AC 4, 6)
  - [x] Mechanical token renames across `routes/*.tsx`, `components/page-title.tsx`:
    | Old | New utility |
    |---|---|
    | `text-[color:var(--color-text-primary)]` | `text-foreground` |
    | `text-[color:var(--color-text-secondary)]` | `text-muted-foreground` |
    | `bg-[var(--color-bg)]`, `bg-[color:var(--color-bg)]` | `bg-background` |
    | `border-[color:var(--color-border-hairline)]` | `border-border` |
    | `border-[color:var(--color-text-secondary)]` (bottom bar) | `border-muted-foreground` |
    | `focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]` | `outline-none focus-visible:ring-[3px] focus-visible:ring-ring` |
    After this, `grep -rn "color-bg\|color-text-\|color-accent\|color-border-hairline" web/`
    returns nothing.
  - [x] Header controls (wrap the existing `Link` with `<Button asChild …>`; the `to`, text and
    copy stay):
    - `songs.tsx` "Add song", `gigs.tsx` "Add gig": `variant="ghost" className="text-primary"`,
      `<Plus aria-hidden="true" />` before the text.
    - `song.tsx` "Edit", `gig.tsx` "Edit" and "Edit setlist": ghost, `text-primary`,
      `<Pencil aria-hidden="true" />`. (7.20 moves Edit setlist; leave it where it is.)
    - Back links — `songs.tsx`/`gigs.tsx` "Home", `song.tsx` "Back to songs"/"Back to gig",
      `gig.tsx` "Back to gigs", and the not-found fallbacks in `song-edit.tsx`,
      `gig-edit.tsx` and `setlist-edit.tsx`: ghost, `text-muted-foreground`,
      `<ChevronLeft aria-hidden="true" />` before the text. Back text is unchanged.
  - [x] Forms (`song-edit.tsx`, `gig-edit.tsx`, `setlist-edit.tsx`):
    - Replace `<label>`/`<input>`/`<textarea>` and `LABEL_CLASS`/`FIELD_CLASS`/`TAP_FIELD_CLASS`
      with `Label`, `Input`, `Textarea`. Keep `htmlFor`/`id`, refs, `rows`, `resize-y`, the
      setlist box's `spellCheck`/`autoCorrect`/`autoCapitalize`/`aria-describedby`, and the
      `mt-[var(--spacing-unit)]` gap between label and field.
    - Save: `<Button type="submit">` (default). Cancel: `<Button asChild variant="ghost">`
      around the existing `Link`, keeping its `replace`, `to` and step-back `onClick` exactly.
    - Delete flows: "Delete song"/"Delete gig" `variant="destructive-outline"`; "Yes, delete"
      `variant="destructive"`; "Keep" `variant="outline"` (also the lone Keep in the
      song-in-use case). Keep `type="button"`, `disabled={deleting}` and the step logic.
    - Remove the now-unused `BUTTON_CLASS`, `LINK_CLASS` etc. constants; keep `PAIR_GAP` and
      `BODY_*` where still used.
  - [x] Export (`songs.tsx`): `<Button asChild variant="link"><a href="/api/v1/export">…</a></Button>`.
    It must still be a plain `<a>` (Story 7.17: the router would swallow the download); keep
    the comment and the `<footer>` with its section gap.
  - [x] Bottom bar (`song.tsx` `GigPlayBar`): live steps are `<Button asChild
    variant="outline"><Link replace …>`; the unavailable end is a `<span aria-disabled="true">`
    styled with `cn(buttonVariants({ variant: 'outline' }), 'opacity-50')` — not a disabled
    button and never another action. Text only, no icons (7.19 redoes the bar). Keep the
    position line, `max-w-[40rem]`, the safe-area padding and the page's bottom padding.
  - [x] List rows (`songs.tsx`, `gigs.tsx`, `gig.tsx`): the row `Link` becomes `flex
    items-center justify-between gap-3` with the title in a `<span>` and
    `<ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />`
    after it. Rows keep `min-h-tap`, the 12px vertical padding, Row size and the hairline
    (now `border-border`). Rows are not Buttons.
  - [x] `login.tsx`: "Sign in" becomes `<Button type="submit">`; everything else on the
    login page is left as it is (no layout or field changes).
  - [x] `home.tsx`: token renames only. Its Songs/Gigs links are text links, and 7.20
    removes the page.
- [x] **Task 5: Disabled until valid** (AC 5)
  - [x] `song-edit.tsx`: `const canSave = title.trim() !== ''`; Save gets `disabled={!canSave}`.
    Remove `titleError`, the alert `<p>`, `aria-invalid` and the focus-on-error code;
    `onSubmit` keeps a silent `if (!canSave) return;` guard (Enter in a field must not save a
    blank title). `titleRef` goes if nothing else uses it.
  - [x] `gig-edit.tsx`: `const canSave = !venueBlank && !dateBlank`; Save gets
    `disabled={!canSave}`. Remove `showRequired`, the alert, `aria-invalid` and the refs used
    only for error focus; keep the silent guard.
  - [x] Mark the required inputs `required` (title; venue and date). The forms keep
    `noValidate`, so this only exposes "required" to VoiceOver; no browser bubbles.
  - [x] `microcopy.ts`: remove `SONG_FORM.titleRequired` and `GIG_FORM.required` (AC 5 retires
    them; the "append only" rule covers wording changes, not removals the spec asks for).
  - [x] Button labels stay `SONG_FORM.save` / `GIG_FORM.save` ("Save") on both add and edit.
    Labelling the add button "Add" belongs to the sheet header in 7.21.
- [x] **Task 6: Contrast report** (AC 2, 3) — `web/scripts/contrast-report.ts`
  - [x] Parse the new shape: light from the first `:root` block (outside `@media`), dark from
    the `:root` inside `@media (prefers-color-scheme: dark)`. Match declarations anchored to
    the start of a declaration, e.g. `new RegExp(`(?:^|[\\s;{])--${token}:\\s*([^;]+);`)`,
    or `--foreground` will match inside `--muted-foreground:` / `--primary-foreground:`.
  - [x] Tokens: `background`, `foreground`, `muted`, `muted-foreground`, `primary`,
    `primary-foreground`, `destructive`, `destructive-foreground`, `input`. (`--ring` is a
    `color-mix`, `--border` is decorative; neither is checked.)
  - [x] Pairs, both variants: foreground and muted-foreground on background and on muted
    (AA); primary on background (AA, brass text); primary-foreground on primary (AA);
    destructive on background (AA); destructive-foreground on destructive (AA); input on
    background with a new `'UI'` target at 3:1 (WCAG 1.4.11). Drop the old waivers: every pair
    passes outright (lowest text pair 5.08, input 3.52 dark / 3.69 light — computed for this
    spec).
  - [x] Regenerate `web/test-output/contrast-report.json` (it's tracked) via `pnpm test`.
- [x] **Task 7: Tests** (AC 8) — update, don't delete
  - [x] `song-edit.test.tsx`: replace "refuses a blank title" with: on `/songs/new` Save is
    disabled; typing `'   '` keeps it disabled; typing a title enables it and saving works.
    Add: on an edit, clearing the title disables Save. Delete: "Delete song" has
    `data-variant="destructive-outline"`; after it, "Yes, delete" has
    `data-variant="destructive"` and "Keep" `data-variant="outline"`.
  - [x] `gig-edit.test.tsx`: replace the two "refuses a blank …" tests with: Save disabled on
    `/gigs/new`; venue only (or venue of spaces plus date) → disabled; venue and date →
    enabled. Drop the `aria-invalid` assertion with the behaviour it tested. Delete variants
    as for songs.
  - [x] `songs.test.tsx`: the export link keeps `href="/api/v1/export"` and has
    `data-variant="link"`. Existing name-based link queries should pass unchanged (icons are
    `aria-hidden`, so names stay "Edit", "Add song", "Back to songs" …).
  - [x] `song.test.tsx`: Previous/Next queries keep working (`getByText` still finds the
    inert `span` with `aria-disabled`). The `whitespace-pre-wrap` class check stays.
  - [x] `web/src/components/ui/button.test.tsx`: renders a `<button>` with
    `data-variant="default"` by default; `asChild` renders the child `<a>` with the classes and
    `data-variant`; `disabled` is honoured.
  - [x] No snapshot tests. If any test breaks because of an icon or wrapper, fix the query,
    not the assertion's intent.
- [x] **Task 8: Docs** (AC 1, 7)
  - [x] `architecture.md`:
    - "Selected stack → Frontend": add "shadcn/ui components, copied in (not a dependency),
      with Radix primitives, `class-variance-authority`, `clsx` + `tailwind-merge` (`cn`) and
      `lucide-react` icons".
    - New subsection under "Implementation Patterns & Consistency Rules", after "Theme":
      "### UI components (shadcn/ui, adopted 2026-10-27)" covering: components live in
      `web/src/components/ui/` and are added one at a time, only when a story needs one;
      copied by hand, no shadcn CLI or `components.json`; `@/` imports rewritten to relative
      `.js` imports, no path alias (one import style; no tsconfig/Vite/Vitest alias to keep in
      step); `cn` in `web/src/lib/utils.ts`; colours are shadcn role tokens in `tokens.css`
      exposed via `@theme inline`; GigBuddy sizes override stock sizes (44px targets, 18px
      button text, 22px fields); Lucide is the only icon set, icons `aria-hidden` beside
      visible text; every button and button-like link uses `Button`.
    - "Theme": mention the role-token names and that `--ring` follows `--primary`.
    - Directory tree: add `components/ui/` and `lib/utils.ts` under `web/src/`.
  - [x] `STYLE.md` rewrite (keep the type roles, spacing and copy sections; keep the existing
    bottom-bar, "Screen may sleep" and export bullets, updated to the new names):
    - Colour: the AC 2 table plus the job of each token (text, quiet text, hover/fill, brass
      accent and default buttons, hairlines, field and outline borders, delete, focus ring).
      Brass text is now allowed (5.08:1 light) for header actions. Hairlines show in dark mode
      now (`--border` is no longer transparent).
    - Buttons: a table of job → variant from AC 4, ghost padding, 44px min height, 18px text,
      8px radius; disabled is 50% opacity.
    - Forms: `Label` above `Input`/`Textarea`, 22px text, `--input` border, 8px radius; Save
      stays disabled until required fields are filled, and there are no submit-time error
      messages for required fields.
    - Rows: muted chevron-right at the end of each list row.
    - Icons: Lucide only, `aria-hidden`, always beside text (no icon-only controls yet).
    - Focus: 3px `--ring` on every link, button and field.
- [x] **Task 9: Verify, commit, deploy** (AC 8, 9)
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all green.
  - [x] After code review: one commit, `Implement story 7.18: Adopt shadcn/ui foundations`,
    push; the push to `main` deploys. Then Sandy's quick look on phone and laptop.

## Dev Notes

### What exists today (read before editing)

- **Styling idiom:** route files use Tailwind arbitrary values on role tokens
  (`text-[length:var(--text-row)]`, `text-[color:var(--color-text-primary)]`), repeated as
  string constants (`LINK_CLASS`, `FIELD_CLASS`, `BUTTON_CLASS`) at the top of each form file.
  There are no shared button or field components yet; `PageTitle` is the only shared
  presentational component.
- **Tokens:** `tokens.css` holds everything in one `@theme` block (colours as `--color-*`,
  plus type/spacing/tap/font), with a dark override in `@media (prefers-color-scheme: dark)
  { :root { … } }`. `--color-border-hairline` is transparent in dark mode today; the new
  `--border` is visible in dark (`#3a2e1f`), which is intended.
- **Contrast script:** `web/scripts/contrast-report.ts` runs first in `web`'s `pnpm test` and
  fails the run if a pair misses its target. It hard-codes the old token names and the
  `@theme` light block, so it breaks the moment the tokens change. Task 6 is not optional.
- **Forms:** add/edit song and gig validate on submit and show a `role="alert"` message;
  setlist edit already disables Save until the song list loads (`disabled={!songs}`) — keep
  that. All forms mount once from cached data and step back in history on Save/Cancel; don't
  touch that logic.
- **Delete flows:** two-step, inline, inside the edit forms (7.11, 7.12). Only the styling
  changes here; 7.21 moves them into an AlertDialog.
- **Bottom bar:** `GigPlayBar` in `song.tsx` (7.14) uses `Link replace` for live steps and an
  `aria-disabled` span at the ends. 7.19 replaces it with split tap regions, so only restyle.

### Decisions made in this spec

- **Import style:** rewrite shadcn's `@/…` imports to relative `.js` imports. The codebase is
  all relative `.js` imports (`'../lib/microcopy.js'`) under `moduleResolution: bundler` and
  `verbatimModuleSyntax`; an alias would need matching `tsconfig` `paths`, Vite `resolve.alias`
  and Vitest config, and would give two import styles. Record this in `architecture.md`.
- **`cn` lives in `lib/utils.ts`**, shadcn's own name, so future component copies change only
  the import path.
- **No `secondary` variant or extra sizes yet.** 7.20's "small secondary button" adds them.
- **Login** gets `Button` for "Sign in" only; the page is otherwise unstyled and out of scope.
- **Confirmed with Sandy, 2026-10-27:** the add forms keep "Save" until 7.21; hairlines showing
  in dark mode is fine; the 45% brass focus ring is fine on light backgrounds.

### Guardrails and gotchas

- **tailwind-merge and custom names:** `cn` runs every Button/Input className through
  `twMerge`, which doesn't know GigBuddy's custom theme keys. A bare `text-body` or
  `text-row` would be read as a *colour* class and could silently delete `text-primary` (or
  vice versa). Always write sizes as `text-[length:var(--text-…)]`, which `twMerge`
  recognises as font size. The `cn` test in Task 1 pins this.
- **Padding override order:** in cva, variant classes come before size classes, so ghost or
  link padding written in the variant loses to `px-4`. Use `compoundVariants`.
- **`asChild` + router `Link`:** `<Button asChild><Link …>` keeps the element an `<a>` with
  role `link`, so existing `getByRole('link', { name })` tests keep working. Don't swap links
  for `<button onClick={navigate}>`.
- **Icons:** import named icons (`import { ChevronLeft } from 'lucide-react'`), set
  `aria-hidden="true"` explicitly (don't rely on the library default), and let Button's
  `[&_svg:not([class*='size-'])]:size-5` size them (20px beside 18px text).
- **Export link** must remain a plain `<a href="/api/v1/export">` (7.17); the service worker's
  `NetworkOnly` rule for that path stays as it is.
- **Performance-mode safety:** the inert end of the bottom bar stays inert (a span, no
  handler); never let it become another action.
- **Don't scaffold later stories:** no Sheet, AlertDialog, tab bar, header component or
  settings sheet. No icons in the bottom bar. Page titles and routes don't move.
- **British English** in any new copy and docs (colour, behaviour). No exclamation marks or
  emoji.

### Library notes (checked 2026-10-27)

- Tailwind in the repo is 4.3: `@theme inline` and `:root` variables are the shadcn v4 pattern
  and work with the existing `@tailwindcss/vite` plugin. Opacity modifiers on var colours
  (`bg-primary/90`) compile to `color-mix`, fine on current Safari.
- Current shadcn Button sets `data-slot`, `data-variant` and `data-size`; stock sizes are tiny
  (`h-9`, `text-sm`) and must be replaced as above.
- React 19.2 in the repo: shadcn's function components with `ComponentProps<'button'>` (no
  `forwardRef`) are the right shape; `ref` passes through as a prop.

### Project Structure Notes

- New: `web/src/components/ui/button.tsx`, `button.test.tsx`, `input.tsx`, `textarea.tsx`,
  `label.tsx`; `web/src/lib/utils.ts`, `utils.test.ts`.
- Changed: `web/package.json`, `pnpm-lock.yaml`, `web/src/styles/tokens.css`,
  `web/src/styles/globals.css`, `web/scripts/contrast-report.ts`,
  `web/test-output/contrast-report.json`, `web/src/components/page-title.tsx`,
  `web/src/lib/microcopy.ts`, `web/src/routes/{songs,song,song-edit,gigs,gig,gig-edit,setlist-edit,home,login}.tsx`
  and their tests as needed, `STYLE.md`, `_bmad-output/planning-artifacts/architecture.md`.
- Untouched: `api/`, `shared/`, `infra/`, `vite.config.ts`, `index.html`, routing.

### References

- `_bmad-output/planning-artifacts/epics.md` — Epic 7 decisions (2026-10-27), Story 7.18
- `_bmad-output/planning-artifacts/mockups/ui-review-2026-10-27.html` — `.btn-*`, `.inp`,
  `.lbl` and `.row` styles show the intended look
- `_bmad-output/planning-artifacts/architecture.md` — "Selected stack", "Theme",
  "Accessibility implementation primitives", directory tree
- `STYLE.md`, `web/src/styles/tokens.css`, `web/scripts/contrast-report.ts`
- `_bmad-output/implementation-artifacts/7-17-export-link-on-the-songs-page.md` — export link
  constraints

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5 (claude-sonnet-5-5)

### Debug Log References

- First pass of the mechanical token rename silently did nothing (zsh did not word-split a `$FILES` variable); re-run with explicit globs. The grep for old token names now returns nothing.

### Completion Notes List

- Added `@radix-ui/react-slot`, `@radix-ui/react-label`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge` at the pinned versions; `cn` in `web/src/lib/utils.ts` with tests, including the custom-font-size case.
- `tokens.css` now uses shadcn role tokens (`:root` light, dark in the media query, `@theme inline`); `--ring` follows `--primary`. Contrast script rewritten for the new shape: 18/18 pairs pass with no waivers, including the new 3:1 `input` check.
- Button, Input, Textarea, Label copied by hand with relative `.js` imports; GigBuddy sizes (44px, 18px, 22px) and tokens only.
- Every route button and button-like link goes through `Button`; list rows gain a muted chevron-right; export stays a plain `<a>`; the inert end of the bottom bar stays a non-interactive span.
- Add/edit song and gig: Save disabled until required fields are filled, silent submit guard, `required` on inputs; submit-time messages and their microcopy removed.
- Tests: new disabled-until-valid tests (song, gig), delete variant tests, export `data-variant`, Button tests, `cn` tests. `pnpm lint`, `typecheck`, `test` (310 tests) and `build` pass.
- `architecture.md` and `STYLE.md` updated. Task 9's commit and deploy wait for code review.

### File List

- STYLE.md
- _bmad-output/planning-artifacts/architecture.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- pnpm-lock.yaml
- web/package.json
- web/scripts/contrast-report.ts
- web/test-output/contrast-report.json
- web/src/styles/tokens.css
- web/src/styles/globals.css
- web/src/components/page-title.tsx
- web/src/components/ui/button.tsx (new)
- web/src/components/ui/button.test.tsx (new)
- web/src/components/ui/input.tsx (new)
- web/src/components/ui/textarea.tsx (new)
- web/src/components/ui/label.tsx (new)
- web/src/lib/utils.ts (new)
- web/src/lib/utils.test.ts (new)
- web/src/lib/microcopy.ts
- web/src/routes/{songs,song,song-edit,gigs,gig,gig-edit,setlist-edit,home,login}.tsx
- web/src/routes/{song-edit,gig-edit,songs}.test.tsx

### Change Log

- 2026-10-27: Story created; status → ready-for-dev.
- 2026-10-27: Implemented shadcn/ui foundations; status → review.
- 2026-10-27: Code review clean (two minor notes for the live check: back links sit 10px in from the title edge; row titles lack `min-w-0`).
- 2026-10-27: Committed 9d5c139; CI and deploy run 40544982312 green. Sandy's live check: looks good. Status → done.
