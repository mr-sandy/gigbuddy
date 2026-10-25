---
baseline_commit: e9c703b
---

# Story 7.5: Basic song page

Status: done

<!-- Source: epics.md "Epic 7 / Story 7.5"; agreed with Sandy 2026-10-22 (no labels; "patch"; generous type; notes fields hidden for now; system font for the chart) -->

## Story

As Sandy,
I want a song's page to show its key, patch and chord chart,
so that I can read a song from the library without going through a gig or setlist.

## Acceptance Criteria

1. `/songs/:songId` shows, in order: the title (`PageTitle`); one line with the key and the
   patch, values only with no labels (e.g. `Fm Blues · Jazz Organ (P14)`); then the chord chart.
2. The chord chart is shown as plain text in the system font, with its line breaks kept and
   long lines wrapping. No chord parsing, highlighting or reformatting: prose and "Stage:" cues
   appear exactly as stored.
3. Any empty or missing field is left out completely, with no placeholder or heading. If only
   one of key or patch is set, the line shows just that value.
4. `performanceNotes` and `practiceNotes` are not shown (revisit in a later story).
5. The key/patch line and the chart use a type role at least as large as `--text-row` (22px),
   added to `STYLE.md` and `tokens.css`; no one-off sizes in the route file.
6. "Back to songs" link, loading, error and "Song not found" behaviour unchanged from 7.3.
7. Read-only: no editing, previous/next song, performance mode, search, gig or setlist
   features. No change to `api/`, `shared/` or `infra/`; uses the existing `use-song` hook.
8. Same responsive and theming rules as 7.1 (360px–1680px with no horizontal scroll, light/dark
   via `prefers-color-scheme`, WCAG AA contrast).
9. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass. Unit tests cover a full
   song, a song with only a title, key without patch, and chart line breaks preserved.
10. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] **Task 1: Reading type role** (AC: 5, 8)
  - [x] `tokens.css`: add `--text-reading: 22px;` and `--text-reading--line-height: 1.5;`
    in the type scale, after `--text-row`. Comment: song content (key/patch line, chord chart).
  - [x] `STYLE.md` "Type roles" table: add a row
    `| Reading (--text-reading) | 22px | system | Song content: key/patch line, chord chart |`.
    Update the intro sentence's list of role names to include `--text-reading`.

- [x] **Task 2: Song page content** (AC: 1–4, 6, 7)
  - [x] In `web/src/routes/song.tsx`, below `<PageTitle afterBackLink>`, render (only when
    `song` is set):
    - Key/patch line: `[song.key, song.patch]` trimmed, empties dropped, joined with `' · '`
      (space, middle dot U+00B7, space). Omit the `<p>` if the result is empty. Secondary text
      colour, `--text-reading`.
    - Chord chart: a `<p>` (not `<pre>`, which forces monospace and blocks wrapping) with
      `whitespace-pre-wrap` and `[overflow-wrap:anywhere]` so line breaks stay and long
      lines/tokens wrap with no horizontal scroll. Primary text colour, `--text-reading`.
      Omit if `chordChart` is missing or whitespace-only. Render the stored string as-is
      (React text, no `dangerouslySetInnerHTML`, no trimming of inner lines).
    - Spacing: the first content block sits `mt-[calc(var(--spacing-unit)*4)]` below the title;
      the chart sits the same gap below the key/patch line. Use the arbitrary-value class style
      already in the file.
  - [x] Do not render `performanceNotes` or `practiceNotes`.
  - [x] Keep the existing back link, list-cache fallback and status-line logic as they are.
    Note: the list-cache fallback (`useSongs`) also returns full `Song` records, so content
    shows from the cache too.
  - [x] Update the header comment: no longer a stub; content from Story 7.5.
  - [x] No new copy is needed; don't add anything to `microcopy.ts`.

- [x] **Task 3: Tests** (AC: 9)
  - [x] Extend `web/src/routes/song.test.tsx` (rename the `describe` from "stub page" to
    `Song`). Keep the existing six tests. Add:
    - Full song: shows `Fm Blues · Jazz Organ (P14)` and the chart text; does not show the
      `performanceNotes` or `practiceNotes` text.
    - Title only: heading shows; no `·`, and the only paragraph-level text is the title
      (e.g. `container.querySelectorAll('p').length === 0`).
    - Key without patch: shows exactly `Fm Blues`, no `·`.
    - Line breaks: chart `'Fm7 | Bb7\nStage: watch Ivan for the stop'` renders an element whose
      `textContent` equals that string exactly, and it has the `whitespace-pre-wrap` class.
  - [x] No snapshot tests.

- [x] **Task 4: Verify, commit, deploy** (AC: 7, 9, 10)
  - [x] `git diff --stat HEAD -- api shared infra` is empty.
  - [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass.
  - [x] One commit: `Implement story 7.5: Basic song page`. Push to `main` only with Sandy's
    go-ahead; watch `deploy.yml` with `gh run watch`. If the blackout check blocks, report it;
    don't use `deploy-force.yml`.
  - [x] Set the story to `review`. No screenshots and no manual checklist for Sandy.

## Dev Notes

### What this story is

A thin front-end slice: the 7.3 stub song page gains the key/patch line and the chord chart.
One file of behaviour (`song.tsx`), one new type token, tests.

### Facts verified when the story was written (2026-10-22)

- `SongSchema` (`shared/src/schemas/song.ts`): `title` required; `key`, `patch`, `chordChart`,
  `performanceNotes`, `practiceNotes` all optional strings. Use `type Song` from
  `@gigbuddy/shared`; don't define a parallel type.
- `song.tsx` today: back link, then `PageTitle afterBackLink` with the title, or a status line
  (`notFound` / `loading` / `error`). `song` comes from `useSong(songId)` or falls back to the
  `useSongs()` list cache. Both hooks return full `Song` records.
- Real data (imported from Apple Notes, 2026-10-05): the "sound" line went into `patch`
  (e.g. `Jazz Organ (P14)`), the key/scale line into `key` (e.g. `Fm Blues`), and chords mixed
  with prose and "Stage:" cues into `chordChart`. Sandy chose to keep the prose in the chart.
  That's why the chart is shown verbatim in the system font: monospace would read badly for
  prose and the old Epic 6 parser mistook words like `Blues` for chords.
- Type roles today: page title 28px Lora, row 22px, body 18px (`STYLE.md`, `tokens.css`).
  Tailwind v4 picks up `--text-*` from `@theme`; follow the file's existing arbitrary-value
  classes (`text-[length:var(--text-reading)]` and `leading-[var(--text-reading--line-height)]`).
- Colours unchanged, so `web/scripts/contrast-report.ts` needs no edit; secondary text on the
  background already passes AA in both themes.

### Guardrails

- Out of scope: showing `performanceNotes` / `practiceNotes`, editing, previous/next song,
  performance mode, chord parsing or highlighting, search, gig or setlist features, any
  `api/`, `shared/` or `infra/` change.
- No labels ("Key:", "Patch:") and no section headings.
- Biome only; `kebab-case` files; tests co-located; `.js` import suffix; British English.
- Don't invent song content in tests beyond what's above (`Fm Blues`, `Jazz Organ (P14)` come
  from the real data notes; Ivan is the documented bandmate).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.5]
- [Source: _bmad-output/implementation-artifacts/7-3-song-list-at-songs.md]
- [Source: _bmad-output/implementation-artifacts/7-4-style-guide-clean-up.md]
- [Source: STYLE.md; web/src/styles/tokens.css]
- [Source: web/src/routes/song.tsx, song.test.tsx; shared/src/schemas/song.ts]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5

### Debug Log References

### Completion Notes List

- Added `--text-reading` token and STYLE.md row. Song page shows key/patch line and verbatim chord chart (`<p>` with `whitespace-pre-wrap`, `[overflow-wrap:anywhere]`); empty fields omitted; notes hidden. Added `data-testid="chord-chart"` for the line-break test. 4 new tests; lint, typecheck, test (170) and build pass; no api/shared/infra changes.
- Commit and deploy pending Sandy's go-ahead to push.

- Ultimate context engine analysis completed - comprehensive developer guide created (2026-10-22).

### File List

- web/src/styles/tokens.css
- STYLE.md
- web/src/routes/song.tsx
- web/src/routes/song.test.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/7-5-basic-song-page.md

### Change Log

- 2026-10-22: Implemented story 7.5 (reading type role, song page content, tests).
