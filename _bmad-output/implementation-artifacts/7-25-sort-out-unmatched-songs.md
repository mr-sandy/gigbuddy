---
baseline_commit: 52b4be8
---

# Story 7.25: Sort out unmatched songs when saving a setlist

Status: review

<!-- Source: Sandy, 2026-10-27. Pasting a setlist (from a text message, or OCR'd from a photo of
     a written note) then renaming lines and adding songs in another tab, pressing Save until the
     errors went, was tedious. Agreed in conversation: one sheet, two steps; dropdowns, not radio
     buttons; "Add as a new song" by default; tidied titles for new songs; simple set headings.
     Mockup: https://claude.ai/artifact/58WYNgCTKzEVeX67hdCxnr — screen 2b (dropdowns) is the
     chosen design. Its "Best guess" option and "Matched for you" list belong to Story 7.26, not
     here. Remembering past choices (aliases) was declined. -->

## Story

As Sandy,
I want Save to list the lines that don't match a song and let me add each as a new song, leave
it out or pick a song,
so that a pasted setlist can be saved without renaming lines and adding songs in another tab.

## Acceptance Criteria

1. **Tidying before matching.** Each song line is tidied before it's compared with the library:
   leading numbering and bullets (`1.`, `3)`, `12 -`, `-`, `•`, `*`), a trailing duration
   (`4:30`), accents, punctuation, repeated spaces, case and a leading "The" are ignored. A line
   whose tidied form matches exactly one song is matched without asking. If it matches none,
   the same comparison is tried with bracketed text removed (`[first dance]`, `(Herbie)`,
   `{x}`); one match there also counts. Matching by a renamed song's old title (today's
   `previous` logic) still works.
2. **Simple set headings.** Besides `## Name`, a line that is only a set heading starts a
   section: "Set 1", "set 2", "SET ONE", "1st set", "First Set", "Encore" (any case, numbers
   1–9 or one–nine / first–ninth). The section name is the line as typed, put into title case
   if it's all capitals ("SET ONE" → "Set One"). A line of three or more dashes, en/em dashes or
   underscores ends the current section; the next song starts a new unnamed one, and a heading
   straight after the rule doesn't leave an empty section behind.
3. **Second step, same sheet.** If, after matching, any line is unmatched or matches more than
   one song, Save turns the same sheet into a "Check songs" step (not a sheet on a sheet, no
   URL of its own). Header: "‹ Back" (left), title "Check songs", Save (right). Cancel exists
   only on the first step. Back returns to the text exactly as it was. Escape and browser Back
   close the sheet without saving, as on any sheet. If every line matches, Save saves and closes
   as today, with no second step.
4. **One dropdown per distinct line.** The step starts with a quiet line saying how many lines
   need a decision and how many songs matched. Then each distinct unresolved line (a line
   repeated in the text appears once) shows in full, in quotes, as the label of a native
   `<select>` beneath it. Options, in order:
   - For a title shared by several songs: each of those songs, with its key when it has one
     ("Sunny · E♭"), the first chosen by default.
   - "Add as a new song: <tidied title>" (chosen by default when the line matched nothing).
   - "Leave it out".
   - An `<optgroup label="Whole library">` with every song A to Z.
5. **Tidied titles for new songs.** The new song's title is the line with numbering, bullets, a
   trailing duration and bracketed text removed, spaces collapsed; a line in all capitals is put
   into title case with small words lower case except first and last ("INTO THE MYSTIC [first
   dance]" → "Into the Mystic"; "COMIN' HOME BABY" → "Comin' Home Baby"). Mixed-case lines keep
   their case. If tidying leaves nothing, the trimmed line is used.
6. **Saving the second step.** Choices take effect only on its Save: new songs (title only) are
   saved first through `useSongMutation().saveSong`, then the setlist through `saveSetlist`.
   Lines whose tidied new titles are the same create one song, used by every such line. "Leave
   it out" lines are dropped; an unnamed section left with no songs is dropped too. Cancel or
   Escape at any point creates nothing. Save can't be pressed twice.
7. **Round trip.** Saved lines show the library title (or new song title) the next time the
   setlist text is opened (true already via `titleSnapshot`; keep it so).
8. Works the same on phone and laptop. Microcopy in `microcopy.ts`; the old "Not in the
   library:" / "More than one song is called:" messages and their alert go. No change to
   `api/`, `shared/` or `infra/`; no new package. `STYLE.md` Sheet section notes the two-step
   setlist sheet.
9. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass, with tests for the tidying,
   headings, title case, choices and save order.
10. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] Task 1: Parsing and tidying in `web/src/lib/setlist-text.ts` (AC: 1, 2, 5)
  - [x] Keep `setlistToText` unchanged (it writes `##` headings; text written by the app must
        still round-trip).
  - [x] Add `stripLineNoise(line)`: trim; remove leading `^\s*(\d+\s*[.)\-:]|[-•*·])\s*` and a
        trailing `\s*[-–—]?\s*\(?\d{1,2}:\d{2}\)?\s*$`. Used by both matching and new titles.
        Careful: a leading `-` bullet must not eat a title that starts with a digit
        ("7 Steps to Heaven" has no punctuation after the 7, so it survives).
  - [x] Extend `matchKey`: after `stripLineNoise`, `normalize('NFD')` and drop combining marks,
        lower case, curly quotes to straight, then replace every run of characters that aren't
        letters, digits or spaces with a space, collapse spaces, trim, and drop a leading
        `the `. Apply the same key to library titles and `titleSnapshot`s (it's symmetric, so
        "In & Out" still matches "In & Out").
  - [x] Add `withoutBrackets(s)`: removes `[…]`, `(…)`, `{…}` groups.
  - [x] Add `tidyTitle(line)` for new songs (AC 5): `stripLineNoise`, `withoutBrackets`,
        collapse spaces, trim trailing ` -`/`–`; if the result has letters and no lower-case
        letters, title-case it: split on spaces, each word = first letter upper + rest lower,
        except `a an and as at but by for in nor of on or the to` (lower unless first or
        last). Empty → trimmed original line.
  - [x] Heading detection (AC 2), case-insensitive, on the trimmed line:
        `^set\s+(\d|one|two|three|four|five|six|seven|eight|nine)$`,
        `^(\d(st|nd|rd|th)|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)\s+set$`,
        `^encore$`. Name = trimmed line, title-cased if all capitals (reuse the `tidyTitle`
        casing helper). Rule line: `^[-–—_]{3,}$` sets `current = undefined` so the next song
        opens a new unnamed section and a heading opens its own.
  - [x] Change `parseSetlistText(text, songs, previous)` to always return a draft rather than
        `ok/notInLibrary/ambiguous`. Suggested shape (keep it close to this; types are local
        to the web lib, not Zod records, so the "no parallel types" rule isn't touched):
        ```ts
        export type DraftLine = { ref: SongRef } | { pendingKey: string };
        export type DraftSection = { name: string; lines: DraftLine[] };
        export type PendingLine = {
          key: string;          // matchKey of the line, as typed (brackets kept)
          line: string;         // the first occurrence, trimmed, for the label
          newTitle: string;     // tidyTitle(line)
          candidates: Song[];   // >1: shared title; 0: nothing matched
        };
        export type SetlistDraft = { sections: DraftSection[]; pending: PendingLine[] };
        ```
        Matching order per line: full key → previous-snapshot key (existing logic) → key
        without brackets. Exactly one song at a step = matched; more than one at the first
        step that finds any = pending with those candidates; none at all = pending, no
        candidates. Pending lines are listed once per key, in first-seen order.
  - [x] Add `resolveDraft(draft, choices, newRefs): Section[]` where
        `choices: Map<string, Choice>`, `type Choice = { kind: 'song'; songId: string } |
        { kind: 'new' } | { kind: 'out' }`, and `newRefs: Map<string, SongRef>` maps a
        pending key to the ref of the song created for it. Library refs use the library title
        as `titleSnapshot`. Drop `out` lines, then drop sections with an empty name and no
        songs. Named empty sections stay (today's behaviour, covered by the round-trip test).
  - [x] Add `defaultChoice(p: PendingLine): Choice`: first candidate if any, else `new`.
- [x] Task 2: Microcopy in `web/src/lib/microcopy.ts`, `SETLIST_TEXT` (AC: 3, 4, 8)
  - [x] Remove `notInLibrary` and `ambiguous`. Add: `checkHeading: 'Check songs'`,
        `back: 'Back'`, `checkIntro: (pending: number, matched: number) => string` →
        "1 line needs a decision." / "3 lines need a decision." followed by " The other 6 songs
        are matched." (" The other song is matched." for 1; omit the sentence for 0),
        `addNew: (title: string) => \`Add as a new song: ${title}\``, `leaveOut: 'Leave it
        out'`, `wholeLibrary: 'Whole library'`, `songWithKey: (title: string, key?: string) =>
        key ? \`${title} · ${key}\` : title`.
- [x] Task 3: The two-step form in `web/src/routes/setlist-edit.tsx` (AC: 3, 4, 6)
  - [x] In `SetlistTextForm`, add state `step: 'text' | 'check'`, `draft: SetlistDraft |
        undefined`, `choices: Map<string, Choice>`. Remove `problems` and the alert block.
  - [x] Step-1 submit: `parseSetlistText`; if `pending` is empty, save as today (same record
        building, same navigation). Otherwise store the draft, fill `choices` with
        `defaultChoice` for each pending key not already chosen (keep earlier choices for keys
        still pending, so Back → Save doesn't lose them), set `step = 'check'`.
  - [x] Step 2 renders the same `EditSheet` with `title={SETLIST_TEXT.checkHeading}`,
        `submitLabel={SETLIST_TEXT.save}`, `onCancel` = back to step 1, and a back-styled
        left button: extend `EditSheet` with an optional `cancelIcon?: ReactNode` (or
        `cancelVariant: 'back'`) rendered before the label, using Lucide `ChevronLeft`
        (`lucide-react` is already a dependency). Keep the gig description line. Every other
        sheet must look exactly as before; check with their tests.
  - [x] Body: the `checkIntro` line (`BODY_SECONDARY` style), then per pending line a block:
        `<Label htmlFor=…>` with the line in curly quotes at the Row role
        (`--text-row`), and a native `<select>` styled like `ui/input.tsx` (border-input,
        rounded-lg, min-h-tap, bg-background, focus ring) but at the Body role size so long
        options fit. Make it a small `ui/select-native.tsx` component (`NativeSelect`) rather
        than inline class strings, per STYLE.md's "no one-off sizes in route files". Option
        values: `song:<id>`, `new`, `out`. Library group sorted with
        `localeCompare(…, 'en', { sensitivity: 'base' })` like the API.
  - [x] Focus: entering step 2, focus the first `<select>`; Back, focus the textarea. Scroll
        the sheet body to the top on each switch.
  - [x] Step-2 submit (guarded by `saving`): for each pending key with choice `new`, group by
        `matchKey(newTitle)`, `generateId()` once per group (`web/src/lib/id.ts`), and
        `await saveSong({ bandId: ACTIVE_BAND_ID, songId, title: newTitle, clientWrittenAt:
        new Date().toISOString(), version: 1 })` (build field by field; the schema is strict).
        A new title that already matches a library song by `matchKey` can't happen after AC 1's
        bracket fallback, but if it does, use that song instead of creating a duplicate. Then
        `resolveDraft`, build the setlist record as step 1 does with a fresh `clientWrittenAt`
        (taken after the songs, so the outbox sends the songs first), `saveSetlist`, and
        navigate as today.
- [x] Task 4: Tests (AC: 9)
  - [x] `web/src/lib/setlist-text.test.ts`: update tests that expect `ok/notInLibrary/
        ambiguous` to the new draft shape; keep the round-trip, CRLF, case, repeat and renamed-
        song cases. Add: numbering/bullets/duration ignored; accents and punctuation ignored;
        leading "The" ignored; "7 Steps to Heaven" style leading digit kept; bracket fallback
        matches; bracket fallback with two matches → candidates; each heading form, title-casing
        "SET ONE"; dash rule followed by songs → new unnamed section; dash rule then "Set 2" →
        no empty section; repeated unmatched line → one pending; `tidyTitle` examples from AC 5
        including small words and an empty-after-tidy line; `resolveDraft` with song / new /
        out choices and empty unnamed section dropped; `defaultChoice`.
  - [x] `web/src/routes/setlist-edit.test.tsx`: mock `../hooks/use-song-mutation.js` like the
        setlist mutation. Replace "lists unmatched lines…" with: Save with an unknown line shows
        "Check songs" with a combobox labelled by the line, defaulting to "Add as a new song:
        …", and nothing saved; Back shows the text unchanged; choosing "Leave it out" saves the
        setlist without it and creates no song; default save calls `saveSong` (tidied title)
        before `saveSetlist` and the setlist ref uses the new song's id; picking a library song
        from the group saves that ref; a shared title defaults to the first candidate; all lines
        matching still saves in one step; Escape on step 2 closes without saving. Wait for the
        dialog to go before querying the page behind it (the `3e197f4` lesson).
  - [x] `NativeSelect` gets a small co-located test (renders a labelled combobox, passes props).
  - [x] Run the whole web suite: `song-edit`, `gig-edit`, `settings-sheet` and `sheet` tests
        must still pass after the `EditSheet` change.
- [x] Task 5: Docs (AC: 8)
  - [x] `STYLE.md` Sheet section: "Edit setlist has a second step, Check songs, shown only when
        lines don't match: the same sheet, header ‹ Back · Check songs · Save, one native
        dropdown per line (`NativeSelect`, Body size). Cancel is on the first step only." Add
        `NativeSelect` to the components where STYLE.md lists fields if it has such a list.
- [x] Task 6: Verify and ship (AC: 8, 9, 10)
  - [x] `git diff --stat 52b4be8 -- api shared infra` is empty; no new dependency in any
        `package.json`.
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
  - [ ] Commit `Implement story 7.25: Sort out unmatched songs when saving a setlist` (after
        code review), push, deploy, then Sandy's quick look.

## Dev Notes

### Current state (read before editing)

- `web/src/lib/setlist-text.ts` (Story 7.10): `setlistToText` writes `## Name` headings, `##`
  for an unnamed section after the first, one title per line. `parseSetlistText` matches by
  `matchKey` (trim, lower case, curly quotes) against the library, then falls back to old
  `titleSnapshot`s of songs still in the library (a renamed song still resolves). It returns
  `{ ok: true, sections }` or `{ ok: false, notInLibrary, ambiguous }`, reporting each key once.
- `web/src/routes/setlist-edit.tsx`: `SetlistEdit` wraps the form in `SheetFrame` so the dialog
  isn't rebuilt when the record arrives. `SetlistTextForm` reads the gig once (`key` on
  `setlistId`), parses on Save, shows problems in a `role="alert"` block and refocuses the
  textarea, else builds a `SetlistPutInput` field by field (the API schema is strict) and
  navigates back (`navigate(-1)` with history, else `replace` to `/gigs/:id`). Keep that save and
  navigation code; step 2 reuses it.
- `web/src/components/edit-sheet.tsx`: `EditSheet` = form wrapping header (ghost Cancel ·
  `SheetTitle` · submit Save) and `SheetBody`. Inside a `SheetFrame` it renders only the form,
  so switching steps is re-rendering `EditSheet` with different props; no new dialog. The
  `SheetFrame`'s `onCancel` (Escape, browser Back) stays `leave`, which discards: that's the
  STYLE.md rule for sheets and is what we want on step 2 too.
- `web/src/hooks/use-song-mutation.ts`: `saveSong` writes both song caches optimistically
  (sorted list), enqueues a PUT, kicks the flusher. Works offline. `song-edit.tsx` creates songs
  the same way with `generateId()`.
- `web/src/sync/outbox.ts` sends oldest `clientWrittenAt` first. The API doesn't check that a
  setlist's `songId`s exist, so order matters only for tidiness; still save songs first.
- Song schema (`shared/src/schemas/song.ts`): only `title` is required besides ids and
  timestamps; `key` is optional (use it to tell same-titled songs apart).
- Native `<select>`: on the iPhone it opens the system picker wheel, on the Mac a menu. There's
  no shadcn Select in `components/ui/`, and adding Radix Select would be a new package: don't.

### Design decisions (Sandy, 2026-10-27)

- One sheet, two steps; Back on step 2, Cancel only on step 1. No sheet on a sheet.
- Dropdowns, not radio buttons (compact; the library group replaces a separate picker).
- "Add as a new song" is the default for unmatched lines, even for title lines like "BIG ED &
  his partner's WEDDING SET IN ORDER"; Sandy changes those to "Leave it out".
- A shared title defaults to its first candidate, not "Add as a new song" (a third copy would
  be wrong more often than right). Not discussed with Sandy; flag at the live check.
- New songs get tidied titles; the casing rule only touches all-capitals lines.
- Remembering choices (aliases) is out.

### Out of scope (don't build)

- Close-match guesses, "Best guess", "Matched for you", OCR-slip handling: Story 7.26.
- Search or filter in the library list; aliases; parsing keys from lines; detecting duplicate
  songs in one setlist; any change to `setlistToText` output (it keeps writing `##`).

### Real input to test against

From `_bmad-output/planning-artifacts/ux/design-handoff/real-example.md` (Sandy's Big Ed's
wedding notes): a title line, "Set 1", ALL-CAPS titles with notes ("INTO THE MYSTIC [first
dance]"), a lower-case title ("Cissy Strut"), a long `------` rule, "Set 2". The 2026-06
`paste-to-parse-design.md` is the old Story 3.5 design for this problem; useful background,
but this story's ACs win where they differ.

### Testing standards

- Vitest + Testing Library, co-located, no snapshots. `userEvent.selectOptions` for the
  dropdowns. Use test songs like the existing ones (`Tune A`…); don't invent repertoire.

### Previous story intelligence (7.21–7.24)

- 7.21 built `EditSheet`/`SheetFrame`; 7.24 added the opening slide in `ui/sheet.tsx`. The step
  switch happens inside the open sheet, so no animation replays; good.
- 7.23: after an async action, wait for the dialog to go before querying behind it.

### References

- `web/src/lib/setlist-text.ts`, `web/src/routes/setlist-edit.tsx`,
  `web/src/components/edit-sheet.tsx`, `web/src/hooks/use-song-mutation.ts`,
  `web/src/lib/id.ts`, `web/src/lib/microcopy.ts`, `web/src/components/ui/input.tsx`
- `STYLE.md` — Type roles, Sheet, Buttons
- `_bmad-output/planning-artifacts/epics.md` — Stories 7.25, 7.26
- Mockup: https://claude.ai/artifact/58WYNgCTKzEVeX67hdCxnr (screen 2b)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5

### Debug Log References

### Completion Notes List

- `setlist-text.ts`: `parseSetlistText` now always returns a draft (`sections` of lines that are either refs or pending keys, plus `pending`). Added `stripLineNoise`, `withoutBrackets`, `tidyTitle`, heading and rule detection, `defaultChoice`, `resolveDraft`. `matchKey` now also strips accents, punctuation and a leading "The".
- Deviation: `Choice` of kind `song` carries the library `title` as well as `songId`, so `resolveDraft` needs no song list for the snapshot.
- Lines that tidy to nothing (a bare bullet) are skipped rather than made pending.
- `setlist-edit.tsx`: two-step `SetlistTextForm` in the same sheet; Back keeps text and earlier choices; new songs are saved (one per tidied title, reusing a library song if the tidied title already matches) before the setlist. `EditSheet` gained optional `cancelIcon`. New `ui/native-select.tsx`.
- A shared title's song appears twice in its dropdown (as a candidate and in the whole-library group), as AC 4 specifies.
- Lint, typecheck, test (web 418) and build pass; `api/`, `shared/`, `infra/` untouched; no new package. Commit, deploy and live check still to do.

### File List

- STYLE.md
- web/src/components/edit-sheet.tsx
- web/src/components/ui/native-select.tsx (new)
- web/src/components/ui/native-select.test.tsx (new)
- web/src/lib/microcopy.ts
- web/src/lib/setlist-text.ts
- web/src/lib/setlist-text.test.ts
- web/src/routes/setlist-edit.tsx
- web/src/routes/setlist-edit.test.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-10-27: Story created (ready-for-dev).
- 2026-10-27: Implemented; status → review.
