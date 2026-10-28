---
baseline_commit: 01a68e8
---

# Story 7.26: Close-match guesses for setlist lines

Status: review

<!-- Source: Sandy, 2026-10-27, as a follow-on to 7.25. Very close matches (typos, OCR slips) go
     ahead without confirmation; less certain lines get a "Best guess" in the Check songs
     dropdown. Remembering past choices (aliases) was declined. Mockup
     https://claude.ai/artifact/58WYNgCTKzEVeX67hdCxnr already shows "Best guess" and
     "Matched for you". -->

## Story

As Sandy,
I want lines that nearly match a song to be matched for me, and less certain ones offered as a
best guess,
so that typos and OCR mistakes don't need fixing by hand.

## Acceptance Criteria

1. **Auto-match very close lines.** After 7.25's exact matching (full key, previous snapshot,
   bracket-free key) finds nothing for a line, the line is compared with every library title.
   If exactly one song is very close and no other song is nearly as close (see Dev Notes for
   the numbers), the line is matched to it without asking, with the library title as
   `titleSnapshot`. Covers single-letter typos and common OCR slips (`rn`/`m`, `l`/`1`/`I`,
   `0`/`o`, `vv`/`w`). A near-tie between two songs is not auto-matched.
2. **"Matched for you" list.** When the Check songs step is showing, a "Matched for you" list
   sits at its foot, one row per distinct auto-matched line: `“C1ssy Strut” → Cissy Strut`.
   Lines that matched exactly after tidying (7.25) aren't listed. If nothing was auto-matched,
   no heading. The list is information only (no controls). When every line matches and Save
   saves straight away, nothing is shown, as today.
3. **Best guess for less certain lines.** An unmatched line (no exact match, not auto-matched)
   gets up to three ranked guesses. In its dropdown, after any shared-title candidates (7.25
   AC 4), an `<optgroup label="Best guess">` holds the top guess, chosen by default; an
   `<optgroup label="Other guesses">` holds up to two more. "Add as a new song: …", "Leave it
   out" and "Whole library" follow as in 7.25. With no guesses the dropdown is as in 7.25
   ("Add as a new song" by default). A shared-title line (more than one exact match) gets no
   guesses; its candidates stay first and the first is the default.
4. **Extra words and brackets count towards a guess, not against.** A line like
   `Cissy Strut (Herbie) live version` still guesses "Cissy Strut": a library title that
   appears as whole words inside the line's key (title key at least 4 characters) scores as a
   strong guess. The bracket-free form of the line is scored too; the better score wins.
5. **No separate library picker.** The "Whole library" group (7.25) is it. No change to
   `api/`, `shared/` or `infra/`.
6. **No new package.** Edit distance is a short function in `web/src/lib/`. (If that proves
   impractical, `architecture.md` must record why before a package is added.)
7. Microcopy in `microcopy.ts`. `STYLE.md` Sheet section notes the guess groups and the list.
8. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass, with tests covering the
   auto-match threshold, near-ties staying unmatched, the guess order, containment guesses,
   and the default choice.
9. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] Task 1: Fuzzy matching in `web/src/lib/setlist-text.ts` (AC: 1, 3, 4, 6)
  - [x] `ocrFold(key)`: on a `matchKey` result, map `rn`→`m`, `vv`→`w`, and the characters
        `1`, `l`, `i`, `|`→`l`, `0`→`o` (note `matchKey` already turns `|` into a space, so
        only digits/letters matter in practice). Used only for distance, never for titles.
  - [x] `editDistance(a, b)`: plain Levenshtein, two-row DP, no dependency. Titles are short.
  - [x] `closeness(lineKey, songKey)`: `d = editDistance(ocrFold(lineKey), ocrFold(songKey))`;
        return `{ d, similarity: 1 - d / max(len)}` using the folded lengths.
  - [x] `isVeryClose`: `d <= 1` when the folded song key has at least 5 characters; `d <= 2`
        when it has at least 12. Shorter titles never auto-match (too easy to hit another
        real song). Both lines are compared after `matchKey`, so case, accents, punctuation
        and a leading "The" are already gone.
  - [x] `autoMatch(keys, songs)`: for the line key and its bracket-free key, compute `d` to
        every song (use the smaller `d` per song). Best song = smallest `d`. Auto-match only if
        best is very close **and** the runner-up (a different song, a different key) has
        `d >= best.d + 2`. Equal-key songs (a shared title) can't reach here: exact matching
        would already have found them.
  - [x] `guessSongs(keys, songs)`: score each song as the max of
        (a) edit-distance similarity on the line key and the bracket-free key,
        (b) 0.9 when the song key is at least 4 characters and appears as whole words inside
            the line key or bracket-free key (pad with spaces and test `includes`),
        keep scores `>= 0.6`, sort by score descending then title A to Z, take three.
        De-duplicate by `songId`. Return `Song[]` (best first).
  - [x] Extend types: `PendingLine` gains `guesses: Song[]`; `SetlistDraft` gains
        `autoMatched: { line: string; title: string }[]` (distinct by line key, first-seen
        order, `line` = trimmed text as typed, tidied of numbering so it reads cleanly:
        use `stripLineNoise(line)`).
  - [x] In `parseSetlistText`, after the existing exact steps leave `matches.length === 0`:
        try `autoMatch`; on a hit push the ref (and record in `autoMatched` once per key);
        otherwise build the pending line with `guesses`. Do not run fuzzy matching when
        `matches.length > 1` (shared title).
  - [x] `defaultChoice(p)`: first candidate, else first guess, else `new`.
- [x] Task 2: Microcopy `SETLIST_TEXT` (AC: 2, 3, 7)
  - [x] `matchedHeading: 'Matched for you'`, `matchedItem: (line, title) => \`“${line}” → ${title}\``,
        `bestGuess: 'Best guess'`, `otherGuesses: 'Other guesses'`.
- [x] Task 3: Check songs step in `web/src/routes/setlist-edit.tsx` (AC: 2, 3)
  - [x] Dropdown: after candidates, render the two optgroups when `guesses` is non-empty
        (`guesses[0]` in "Best guess", the rest in "Other guesses", the latter omitted if
        empty). Option values are `song:<id>` as before; a song that is also in the whole
        library group keeps working (the browser selects the first matching option; the
        default `choiceValue` is `song:<id>` so the Best guess option shows selected).
  - [x] "Matched for you" at the foot of the step body: a heading at the Row role, a plain
        `<ul>` at Body size in `text-muted-foreground`, one `<li>` per `autoMatched` entry.
        Hidden when empty. No new one-off sizes (STYLE.md).
  - [x] Existing 7.25 behaviour is unchanged: Back keeps choices, Save order, shared-title
        default, focus handling.
- [x] Task 4: Tests (AC: 8)
  - [x] `web/src/lib/setlist-text.test.ts`: single-letter typo ("Cisy Strut", "Cissy Strutt")
        auto-matches; `C1ssy Strut` and `Cissy Strut` with `rn`→`m` ("Sumrner" for "Summer"
        style, using test songs only) auto-match; two library songs equally close → pending
        with both as guesses, not auto-matched; a short title (under 5 characters) one letter
        off → pending, not auto-matched; a line two letters off a 6-letter title → pending
        with a guess; containment ("Cissy Strut (Herbie) live version" → guess "Cissy Strut",
        first); guess order and cap of three; guesses empty for a nonsense line; shared-title
        line gets no guesses; exact matches not in `autoMatched`; repeated typo line → one
        `autoMatched` entry; `defaultChoice` with candidates, with guesses, with neither.
        Add `editDistance` cases (0, 1 substitution, insertion, empty string).
  - [x] `web/src/routes/setlist-edit.test.tsx`: all-typo-lines text saves in one step with the
        library ref; a mix of one auto-matched and one unknown line shows Check songs with
        "Matched for you" and `“…” → …`; a less certain line's combobox defaults to the best
        guess and the setlist saved uses that song; choosing "Add as a new song" still
        creates it; no "Matched for you" heading when nothing was auto-matched. Wait for the
        dialog to go before querying behind it.
  - [x] Run the whole web suite.
- [x] Task 5: Docs (AC: 7)
  - [x] `STYLE.md` Sheet section: one sentence on the "Best guess" / "Other guesses" groups
        and the "Matched for you" list at the foot of Check songs.
- [ ] Task 6: Verify and ship (AC: 5, 8, 9)
  - [x] `git diff --stat 01a68e8 -- api shared infra` is empty; no new dependency in any
        `package.json`.
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
  - [ ] Commit `Implement story 7.26: Close-match guesses for setlist lines` (after code
        review), push, deploy, then Sandy's quick look.

## Dev Notes

### Current state (read before editing)

- `web/src/lib/setlist-text.ts` (Story 7.25): `matchKey` = tidy + NFD accent strip + lower
  case + punctuation to space + collapse + drop a leading "the". `parseSetlistText` builds
  `byKey` from library titles and `previousIds` from old snapshots of songs still in the
  library. Per line: `find(key)` then, if empty, `find(matchKey(withoutBrackets(line)))`. One
  match → ref; otherwise a `PendingLine { key, line, newTitle, candidates }`, once per key. It
  returns `{ sections, pending }`. `resolveDraft` and `defaultChoice` live there too.
- `web/src/routes/setlist-edit.tsx`: `SetlistTextForm` has `step: 'text' | 'check'`. The step-1
  submit parses; no pending → save; else fills `choices` with `defaultChoice` (keeping earlier
  choices for keys still pending) and shows Check songs. The step renders one `NativeSelect`
  per pending line with options: shared-title candidates, "Add as a new song: …", "Leave it
  out", then `<optgroup>` "Whole library" (plain titles). `matched` for the intro counts `ref`
  lines in the draft (auto-matched lines are `ref` lines, so they count as matched: right).
- `web/src/lib/microcopy.ts` `SETLIST_TEXT` holds the step's strings.

### What changes / what must be preserved

- Changes: `parseSetlistText` gets a fuzzy stage between the exact steps and "pending"; the
  draft and pending types grow; the dropdown gets two optgroups; the step gets a footer list.
- Preserve: every 7.25 behaviour and test. Exact and previous-snapshot matching always win over
  fuzzy matching. Shared-title handling. `setlistToText` output. Save order (songs then
  setlist). `matchKey` itself must not change (it is used for library keys and snapshots).

### Tuning (starting values; adjust if tests on real titles say so, and record in the Dev Agent Record)

- Auto-match: `d <= 1` for titles of 5+ characters, `d <= 2` for 12+; runner-up must be at least
  2 further away. This errs towards asking: a wrongly auto-matched song is silent, a wrongly
  asked line costs one tap.
- Guesses: score >= 0.6, max three. "Strut" alone must not guess every title containing "strut":
  containment needs the *song* title inside the *line*, not the other way round.
- Distance is on `matchKey`s, so "The" and punctuation never count.
- Do not use the song's `key` (musical key) or `previous` titles in fuzzy scoring.

### Behaviour worth flagging at the live check (not discussed with Sandy)

- An auto-matched line is silent when the whole text matches (no Check songs step), so the
  "Matched for you" list only appears when something else needs a decision. Sandy can see the
  saved result by reopening the text, which shows library titles (7.25 AC 7).
- The Best guess is the default even when it is weak (score 0.6). Sandy can switch to "Add as
  a new song". If that feels too eager at the live check, raise the 0.6 floor.

### Out of scope (don't build)

- Aliases or remembering choices; a separate library picker or search; fuzzy matching of set
  headings; any change to `api/`, `shared/` or `infra/`; a new package (see AC 6).

### Testing standards

- Vitest + Testing Library, co-located, no snapshots. `userEvent.selectOptions` for dropdowns.
  Use existing test songs (`Tune A`…) plus a couple of realistic titles already in the real
  example ("Cissy Strut", "Into the Mystic") as fixtures; don't invent repertoire.

### Previous story intelligence (7.25)

- `EditSheet` swaps steps inside the open sheet; focus moves to the first `<select>` on entry.
- Code review caught `5:15` being stripped as numbering; fuzzy keys build on `stripLineNoise`,
  so keep its regexes untouched.
- 7.25's live check led to plain titles in the whole-library group (`2c01a93`): keep the guess
  options as plain titles too (no key), except shared-title candidates which show their key.
- After an async action wait for the dialog to go before querying behind it (7.23).

### Git intelligence

- Last commits: `1675c6d` (7.25: `setlist-text.ts`, `setlist-edit.tsx`, `native-select.tsx`,
  microcopy, tests, STYLE.md), `2c01a93` (plain library titles). Same files again here.

### References

- `web/src/lib/setlist-text.ts`, `web/src/routes/setlist-edit.tsx`,
  `web/src/lib/microcopy.ts`, `web/src/components/ui/native-select.tsx`, `STYLE.md` (Sheet)
- `_bmad-output/planning-artifacts/epics.md` — Story 7.26
- `_bmad-output/implementation-artifacts/7-25-sort-out-unmatched-songs.md`
- Mockup: https://claude.ai/artifact/58WYNgCTKzEVeX67hdCxnr

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5

### Debug Log References

### Completion Notes List

- Fuzzy stage added to `parseSetlistText` (after exact/previous/bracket-free matching): `autoMatch` (d<=1 for 5+ char titles, d<=2 for 12+, runner-up at least 2 further) and `guessSongs` (similarity or 0.9 containment, floor 0.6, top three). Thresholds left at the story's starting values; no tuning needed by the tests.
- `ocrFold` and `editDistance` (exported) live in `setlist-text.ts`; no new package.
- Check songs: "Best guess" / "Other guesses" optgroups after shared-title candidates; "Matched for you" list at the foot (only when something else needs a decision).
- Tests: 12 new lib tests, 5 new route tests. lint, typecheck, test, build all pass; api/shared/infra untouched.
- Commit, push, deploy and Sandy's live check still to do (after code review).

### File List

- STYLE.md
- web/src/lib/microcopy.ts
- web/src/lib/setlist-text.ts
- web/src/lib/setlist-text.test.ts
- web/src/routes/setlist-edit.tsx
- web/src/routes/setlist-edit.test.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-10-28: Story created (ready-for-dev).
- 2026-10-28: Implemented; status → review.
- 2026-10-28: Code review (lightweight, inline): match condition simplified to `matches.length <= 1`; shared-title typos deliberately never auto-match. Committed and pushed to deploy.
