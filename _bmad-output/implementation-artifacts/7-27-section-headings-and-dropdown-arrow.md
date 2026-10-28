---
baseline_commit: e9b1637
---

# Story 7.27: Section headings from Check songs, and the dropdown arrow

Status: done

<!-- Source: Sandy, 2026-10-28, after the 7.26 live check with a test setlist. "Emergency
     Reserve List" isn't a recognised heading, so it came up as an unknown song. On the Mac the
     dropdown arrow sits hard against the right border. -->

## Story

As Sandy,
I want to turn an unrecognised line into a section heading from the Check songs step, and see
the dropdown arrow sitting comfortably inside its box,
so that lists like "Emergency Reserve List" become sections without retyping, and the dropdowns
look finished on the laptop.

## Acceptance Criteria

1. **"Use as a section heading" option.** Every Check songs dropdown has a "Use as a section
   heading" option directly after "Add as a new song: …" (before "Leave it out"). It is never
   the default.
2. **Choosing it makes a section.** On Save, each occurrence of that line ends the section it
   sits in and starts a new section named after the line; the songs after it (up to the next
   heading, `##`, or rule) go into the new section. The songs before it stay in their section
   under its old name. The name is the line tidied as a parsed heading would be: numbering
   and a trailing duration dropped (`stripLineNoise`), ALL CAPS title-cased (as `headingName`
   does). No song is created or referenced for that line.
3. A heading chosen for a line with nothing after it gives a named section with no songs (same
   as typing `## Name` with nothing under it today).
4. Back then Save keeps the heading choice (as other choices are kept today).
5. **Dropdown arrow inset.** `NativeSelect` draws its own chevron (lucide `ChevronDown`,
   `aria-hidden`, `pointer-events-none`), inset from the right edge by the same amount as the
   text's left padding (`px-3`), with right padding on the select so long option text never
   runs under it. The native arrow is hidden with `appearance-none`. It is still a native
   `<select>` (iPhone picker wheel, Mac menu). Focus ring, disabled look and Body size
   unchanged; the chevron uses `text-muted-foreground`.
6. Microcopy in `microcopy.ts`. `STYLE.md` Sheet section mentions the heading option.
7. No change to `api/`, `shared/` or `infra/`; no new package.
8. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass, with tests covering the
   section split, the heading name tidying, the option position, and the chevron.
9. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] Task 1: Heading choice in `web/src/lib/setlist-text.ts` (AC: 2, 3)
  - [x] `Choice` gains `| { kind: 'heading' }`.
  - [x] Export a small `headingFromLine(line)` = `stripLineNoise(line)` then title-case if all
        caps (reuse `isAllCaps` / `titleCase`; don't touch `HEADING_PATTERNS` or `headingName`).
  - [x] `resolveDraft`: walk lines as today, but a pending line whose choice is `heading` pushes
        the section built so far (same empty-unnamed skip rule) and starts a new one named
        `headingFromLine(p.line)`. `resolveDraft` needs the pending line text: look it up from
        `draft.pending` by key (build a `Map` once).
  - [x] `defaultChoice` unchanged (never `heading`).
- [x] Task 2: Check songs dropdown in `web/src/routes/setlist-edit.tsx` (AC: 1, 4)
  - [x] `<option value="heading">{SETLIST_TEXT.asHeading}</option>` after the "Add as a new
        song" option. `onChange` maps `'heading'` to `{ kind: 'heading' }`. `choiceValue`
        already returns `choice.kind` for non-song choices.
  - [x] The new-song loop already skips anything not `new`; no change to save order.
- [x] Task 3: `web/src/components/ui/native-select.tsx` (AC: 5)
  - [x] Wrap in a `relative` `div` (keep `w-full min-w-0` so the layout doesn't change; the
        `className` prop still goes on the `<select>`). Select gets `appearance-none pr-10`
        (keep `px-3` for the left); chevron absolutely placed `right-3`, vertically centred,
        `size-5`, `text-muted-foreground`, `pointer-events-none`, `aria-hidden="true"`.
  - [x] Update the file's header comment to say the chevron is drawn so it sits inside.
- [x] Task 4: Microcopy and docs (AC: 6)
  - [x] `SETLIST_TEXT.asHeading: 'Use as a section heading'`.
  - [x] `STYLE.md` Sheet section: extend the Check songs bullet with the heading option.
- [x] Task 5: Tests (AC: 8)
  - [x] `setlist-text.test.ts`: a heading choice mid-section splits it (songs before keep the
        old name, songs after go under the new name); a repeated line chosen as heading splits
        at each occurrence; heading on the last line gives an empty named section; an ALL CAPS
        numbered line (`3. EMERGENCY RESERVE LIST`) becomes `Emergency Reserve List`.
  - [x] `setlist-edit.test.tsx`: the option follows "Add as a new song: …" in the dropdown;
        choosing it and saving writes the expected sections and creates no song; Back then
        Save keeps it. Wait for the dialog to go before querying behind it.
  - [x] `native-select.test.tsx`: the select still has the combobox role and value; a hidden
        chevron `svg` is rendered.
- [x] Task 6: Verify and ship (AC: 7, 8, 9)
  - [x] `git diff --stat e9b1637 -- api shared infra` empty; no new dependency.
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
  - [x] Commit `Implement story 7.27: Section headings from Check songs, and the dropdown
        arrow` (after code review), push, deploy, then Sandy's quick look.

## Dev Notes

### Current state (read before editing)

- `setlist-text.ts`: `parseSetlistText` returns `{ sections, pending, autoMatched }`. Lines in
  a `DraftSection` are `{ ref }` or `{ pendingKey }`; one `PendingLine` per distinct key,
  `line` = first occurrence trimmed. `resolveDraft(draft, choices, newRefs)` turns the draft
  into `Section[]`, dropping an unnamed section with no songs. `headingName` applies
  `HEADING_PATTERNS` and title-cases ALL CAPS via `isAllCaps`/`titleCase`.
- `setlist-edit.tsx` `SetlistTextForm`: step `'text' | 'check'`; `choiceValue` maps a
  `Choice` to an option value; the `NativeSelect` `onChange` maps values back. Options today:
  shared-title candidates, Best guess / Other guesses (7.26), "Add as a new song: …", "Leave it
  out", "Whole library" group. On Save, songs for `new` choices are written first, then the
  setlist.
- `native-select.tsx`: a bare `<select>` with Input-like classes, `px-3`; only used in
  `setlist-edit.tsx`. lucide-react is already a dependency (`ChevronLeft` used in the same
  route).

### Preserve

- All 7.25 / 7.26 behaviour and tests: default choices, guesses, "Matched for you", save
  order, Back keeping choices, focus on the first `<select>` when the step opens.
- `setlistToText` and `HEADING_PATTERNS` unchanged (teaching the parser new heading words is
  out of scope).

### Out of scope (don't build)

- Recognising more heading patterns automatically; renaming sections in this step; any change
  to `api/`, `shared/`, `infra/`.

### Testing standards

- Vitest + Testing Library, co-located, no snapshots. `userEvent.selectOptions` for dropdowns.
  Use existing test songs and the "Emergency Reserve List" line from Sandy's test setlist.

### References

- `web/src/lib/setlist-text.ts`, `web/src/routes/setlist-edit.tsx`,
  `web/src/components/ui/native-select.tsx`, `web/src/lib/microcopy.ts`, `STYLE.md` (Sheet)
- `_bmad-output/planning-artifacts/epics.md` — Story 7.27
- `_bmad-output/implementation-artifacts/7-26-close-match-guesses.md`

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5

### Debug Log References

### Completion Notes List

- `Choice` gains `heading`; `headingFromLine` tidies the name; `resolveDraft` flushes the section at a heading line and starts a new one (same empty-unnamed skip rule).
- Check songs dropdown has "Use as a section heading" between "Add as a new song" and "Leave it out"; never the default.
- `NativeSelect` now draws a `ChevronDown` inset `right-3`, `appearance-none`, `pr-10`.
- Lint, typecheck, test (446) and build pass; `api/`, `shared/`, `infra/` untouched. Committed `61e8659`, deployed, Sandy's live check done.

### File List

- STYLE.md
- web/src/lib/setlist-text.ts
- web/src/lib/setlist-text.test.ts
- web/src/lib/microcopy.ts
- web/src/routes/setlist-edit.tsx
- web/src/routes/setlist-edit.test.tsx
- web/src/components/ui/native-select.tsx
- web/src/components/ui/native-select.test.tsx

### Change Log

- 2026-10-28: Story created (ready-for-dev).
- 2026-10-28: Implemented heading choice and inset chevron; status → review.
- 2026-10-28: Code review (lightweight, single pass): clean; two negligible nits left as is (chevron doesn't dim on a disabled select, which is never used; a number-only line tidies to an unnamed section). Committed `61e8659`.
- 2026-10-28: Deployed via deploy-force (blackout from the "Test" gig on 2026-10-29, Sandy approved).
- 2026-10-28: Sandy's live check: looks good; follow-up (a shortened line such as "Chitlins" not guessing "Chitlins con Carne") goes to 7.28. Status → done.
