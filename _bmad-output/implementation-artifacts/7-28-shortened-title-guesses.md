---
baseline_commit: a70076d
---

# Story 7.28: Guess the full title for a shortened setlist line

Status: done

<!-- Source: Sandy, 2026-10-28, at the 7.27 live check. "Chitlins" in a pasted setlist wasn't
     matched with "Chitlins con Carne"; Check songs defaulted to adding a new song. Sandy chose
     to guess either way round, reversing 7.26's "Strut must not guess Strut Around Town". -->

## Story

As Sandy,
I want a shortened line such as "Chitlins" to guess the full title ("Chitlins con Carne"),
so that setlists written in shorthand don't default to adding duplicate songs.

## Acceptance Criteria

1. A line whose words appear as whole words inside a song title (line key at least 4
   characters) gets that song as a guess, scored like a title contained in the line (0.9).
   It is pre-picked in Check songs as Best guess when it ranks first. It never auto-matches.
2. "Strut" now guesses "Strut Around Town" (reverses the 7.26 rule, Sandy's choice).
3. Part words ("Chit") and lines under 4 characters ("Up") don't guess this way.
4. Still at most three guesses.
5. No change to `api/`, `shared/` or `infra/`; no new package.
6. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass.
7. Deployed to gig.cormie.com via the normal pipeline.

## Tasks / Subtasks

- [x] Task 1: `guessSongs` in `web/src/lib/setlist-text.ts` also scores `CONTAINED_SCORE` when
      a line key (4+ characters) is found, word-bounded, inside the song key (AC: 1–4).
- [x] Task 2: Tests in `setlist-text.test.ts`: "Chitlins" defaults to Chitlins con Carne and
      isn't auto-matched; "Strut" guesses Strut Around Town (replaces the 7.26 test);
      "Chit" and "Up" give no guess; "Moon" across four titles gives three (AC: 1–4).
- [x] Task 3: Verify and ship (AC: 5–7): checks, commit `Implement story 7.28: Guess the full
      title for a shortened setlist line`, push, deploy, Sandy's quick look.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5

### Completion Notes List

- Built straight after Sandy's choice in the same session as the 7.27 review; story kept thin. Committed `d5f2461`, deployed, Sandy's live check done.

### File List

- web/src/lib/setlist-text.ts
- web/src/lib/setlist-text.test.ts

### Change Log

- 2026-10-28: Story created and implemented; status → review.
- 2026-10-28: Committed `d5f2461`; deployed via deploy-force (blackout from the "Test" gig on 2026-10-29, Sandy approved).
- 2026-10-28: Sandy's live check: looks good. Status → done.
