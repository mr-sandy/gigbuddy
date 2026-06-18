---
title: Paste-to-parse — design note for Story 3.5
purpose: Pin the algorithm + UX decisions that the Story 3.5 spec will reference. Calibrated against Sandy's actual Apple Notes paste material (real-example.md, real-example-2.md).
status: approved — feeds Story 3.5 spec
created: 2026-06-19
approved: 2026-06-19
---

# Paste-to-parse — design note

## Framing

The paste source is Sandy's iPhone-on-the-Nord Apple Notes document, or an
equivalent plain-text fragment from email / WhatsApp / a PDF copy-paste.
What he pastes is almost always the **top-of-document setlist block** — titles
only, one per line, with `Set 1` / `Set 2` headers and an occasional `----`
separator. The longer per-song notes block lives below; it is **not** the
paste source. The parser's job is to turn that top block into `Section[]` of
`SongRef[]` with each row labelled Matched / Fuzzy / Unknown against The Jack
Ruby 5 Library.

Two unbendable facts from `real-example*.md`:

- **Case is not semantic.** `Move on Up`, `MOVE ON UP`, and `move on up` are
  the same song. Earlier annotations claimed ALL CAPS meant something —
  corrected 2026-06-08. The matcher must ignore case entirely.
- **Title noise is normal.** `WATERMELON MAN – Ivan Ian John`,
  `INTO THE MYSTIC [first dance]`, `KELVINGROVESTREET – solos – Ivan Ian
  Clare SANDY John [GUITAR CHANGE]` all reduce to a single Library song. The
  matcher must strip inline annotations before scoring.

---

## 1. Section detection

`web/src/paste-parse/parser.ts` scans line-by-line, classifying each line as
**header**, **separator**, **song**, or **skip**. The first header (or first
non-skip non-blank line) opens the first Section; subsequent headers close
the previous Section and open the next.

| Pattern | Treatment | Reliability |
|---|---|---|
| `^\s*set\s+\d+\b` (case-insensitive) | Header, name = matched text Title-cased (`set 1` → `Set 1`) | High — present in both real examples |
| `^\s*encore\b` (case-insensitive) | Header, name = `Encore` | High |
| `^\s*\{([^}]+)\}\s*$` (`{Set 1}`, `{Encore}`) | Header, name = inside braces | High — brief explicitly cites |
| `^#{1,6}\s+(.+)` (markdown `# Set 2`) | Header, name = right-hand side | High |
| `^\s*-{3,}\s*$` (3+ dashes) | Separator — closes current Section. Next non-blank line that doesn't match a header pattern becomes the first row of an **implicit** next Section named `Set N+1` | Medium — present in `real-example.md` |
| Blank line | Skipped (does not close a Section on its own) | — |
| ALL-CAPS line surrounded by blanks | **Not** treated as a header | Low — case is not semantic |
| Any other non-blank line | Song row in the current Section | — |

If no header pattern is detected anywhere, the parser emits a single
default Section named `Set 1` (per FR-7 / EXPERIENCE.md Flow 3) and packs
every song row into it.

**Document-title lines** (e.g., `BIG ED & his partner's WEDDING SET IN ORDER`,
`Howlin Wolf - 2nd May`, `[Highlighted tunes are optional TBA…]`) are not
specially detected in V1. They fall through as Song rows in the implicit
`Set 1`, land as Unknown, and Sandy discards them via the per-row Discard
affordance (see §3). V2 may add heuristics.

---

## 2. Fuzzy matching

`web/src/paste-parse/matcher.ts` runs each parsed song row through the same
pipeline:

**Step 1 — Normalize both sides.** Lowercase, NFKD-normalize then strip
combining marks (diacritics), strip ASCII + curly apostrophes, collapse
whitespace, strip leading enumerator (`1. `, `1) `, `- `), strip everything
from the first ` – ` (em-dash with surrounding whitespace) onward, strip
trailing `[...]` brackets, strip trailing `(...)` parens.

Worked normalizations on real paste material:
- `COMIN' HOME BABY` → `comin home baby`
- `Move on Up – The Rhythm is like Steely Dan 'Do it Again'` → `move on up`
- `INTO THE MYSTIC [first dance]` → `into the mystic`
- `WATERMELON MAN – Ivan Ian John` → `watermelon man`
- `KELVINGROVESTREET – solos – Ivan Ian Clare SANDY John [GUITAR CHANGE]` → `kelvingrovestreet`
- `MAS QUE NADA ` → `mas que nada`

**Step 2 — Exact normalized match** against every Library title's normalized
form. Hit → **Matched**.

**Step 3 — Jaro-Winkler similarity** against every remaining Library title's
normalized form. Take top-1.

**Step 4 — Threshold.** `score ≥ 0.92` → **Fuzzy** (single suggestion).
Otherwise → **Unknown**.

**Why Jaro-Winkler and not Levenshtein or trigram?** Jaro-Winkler weights
common prefixes and tolerates transpositions, which matches the actual
failure modes in Sandy's data. Worked scores against his library shape (after
normalization):

| Paste | Library | JW score | Verdict |
|---|---|---|---|
| `comin home baby` | `coming home baby` | ~0.98 | Fuzzy → 1-tap accept |
| `cantaloupe island` | `canteloupe island` | ~0.96 | Fuzzy → 1-tap accept |
| `kelvingrovestreet` | `kelvingrove street` | ~0.96 | Fuzzy → 1-tap accept |
| `mas que nada` | `mas que nada` | 1.00 | Matched |
| `move on up` | `move it on over` | ~0.82 | Unknown (correctly) |
| `trouble` | `trouble man` | ~0.93 | Fuzzy (correct — Sandy decides) |
| `cantaloupe island` | `watermelon man` | ~0.43 | Unknown (correctly) |

The threshold deliberately sits above shared-prefix false positives
(`Move on Up` vs `Move it on Over` ~0.82) and below tolerable noise like
the apostrophe/case/whitespace variants above. Lib `string-similarity` or
`fast-levenshtein` are not Jaro-Winkler implementations; either implement
inline (~30 lines) or use `natural`'s `JaroWinklerDistance`.

**`titleSnapshot` on commit.** When a row resolves to Matched (via auto-match
or `Yes, that one`), the SongRef's `titleSnapshot` is the **Library's
canonical title**, not the pasted form. Per AR-11, the snapshot freezes the
title at gig time — but the "title at gig time" should be the library
record, not Sandy's pasted typo.

---

## 3. Resolution UX

**One inline surface, no separate review screen.** The Paste-to-parse field
sits at the top of `/setlists/new`; the parsed result region renders directly
below it. Each row is a `ParseRowStatus` in one of three states.

**Matched row** — glyph + label + canonical Library title, no buttons:

> `✓ Matched` `Cantaloupe Island` *(was: `cantaloupe Island`)*

The "was" caption appears only when the canonical title differs from what
Sandy pasted (case / whitespace / apostrophe / etc.). Quiet `text-secondary`
treatment per UX-DR4.

**Fuzzy row** — `?` glyph + label + suggested title + two single-tap actions
inline on the row:

> `? Fuzzy` `Coming Home Baby` `[Yes, that one]` `[No — new song]`

`Yes, that one` → row becomes Matched (commits to that Library Song's
`songId` and canonical title).
`No — new song` → row converts to Unknown.

**Unknown row** — `+` glyph + label + the (normalized-but-not-canonical)
pasted title + three single-tap actions:

> `+ Unknown` `Big Ed's Wedding Set In Order` `[+ Add to library]` `[Pick from library]` `[Discard]`

`+ Add to library` → mints a new minimal Song via the Epic 2 mutation path
(title only), row becomes Matched.
`Pick from library` → opens a type-ahead picker (reuses the Story 3.4
type-ahead component) — covers the case where Sandy knows the right Library
song but JW didn't find it (e.g., abbreviation, alternate name).
`Discard` → removes the row from the parsed result entirely. Required to
unblock Save when the row is e.g. a document-title fragment or a header that
got misclassified.

**Inline editing.** All three states allow Sandy to tap into the row title to
override the parsed string before resolving (e.g., to strip noise the parser
missed). This re-triggers matching against the edited string.

**Save gating.** Save is enabled only when zero Fuzzy or Unknown rows
remain. This is already the AC; the Discard affordance is what makes it
attainable without forcing Sandy to add junk to the Library.

---

## 4. Edge cases

| Input shape | Behavior |
|---|---|
| Empty paste | Parsed region renders nothing (empty state copy: `Paste a setlist above.`) |
| Only headers, no songs | Sections render with `0 / 0` counts. Save is allowed (empty Setlist is valid per FR-6) |
| Only songs, no headers | All rows land in implicit `Set 1` |
| Document-title line above headers | Treated as Song row in implicit `Set 1`, lands Unknown, Sandy discards |
| Duplicate title in Library (e.g., two songs both titled `Trouble`) | Top-1 by JW; ties broken by the more-recently-edited Song. Sandy can override via `No — new song` → `Pick from library` |
| Same paste title appears twice (legitimately — same song twice in a set) | Each occurrence resolves independently. Both Matched rows reference the same `songId` |
| Mid-title line continuation (`SUMMER FIELDS OF JOY – Theme x2 – coda – solos Ivan Ian.<newline>Appendix – Ivan Ian`) | V1: each line is its own row. Sandy edits the second row inline or discards it |
| Pasted line with key/tempo on it (`Cantaloupe Island - Fm Blues`) | Em-dash splits the title; `Cantaloupe Island` is matched. Trailing metadata is dropped. (Per-gig key/tempo capture is V2.) |
| Trailing whitespace, smart quotes, mixed quotes | Stripped during normalization |
| Diacritics (`Más Que Nada`) | NFKD-normalized; matches `Mas Que Nada` |

---

## 5. V1 vs V2 cut

**V1 (Story 3.5 ships):**

- Section detection: `Set N`, `Encore`, `{...}`, `# ...`, `----` separator, implicit `Set 1`
- Normalization: lowercase + diacritics + apostrophes + whitespace + leading enumerator + trailing `– ...` / `[...]` / `(...)`
- Exact normalized match, then Jaro-Winkler top-1 ≥ 0.92 fuzzy, else Unknown
- Per-row resolution: `Yes, that one`, `No — new song`, `+ Add to library`, `Pick from library`, `Discard`
- Inline-edit any row title to re-trigger matching
- 500ms parse budget for ~20-song input (NFR-3)
- "(was: …)" caption on Matched when canonical differs from paste

**V2 (deferred):**

- Smart inline-annotation extraction (`WATERMELON MAN – Ivan Ian John` → title `Watermelon Man` + per-gig annotation `Ivan Ian John` auto-populated). V1: annotation stays out; Sandy adds it later on Setlist overview via Story 3.3 inline edit.
- Multi-candidate fuzzy (top-3 picker instead of top-1 + "No — new song" fallback)
- Document-title detection heuristics (recognize `<venue> - <date>` and `… SET IN ORDER` patterns and auto-skip)
- Key / tempo / patch extraction from pasted lines
- Bracket-wrapped headers like `[Highlighted tunes are optional…]` auto-skipped
- Multi-line title joining (continuation lines)
- "Suggest splitting" UX when a paste row matches two Library songs at very close scores

---

## 6. Locked decisions (2026-06-19)

1. **Jaro-Winkler threshold = 0.92** for V1. Re-tune post-ship only if Sandy
   sees false-positive Fuzzy suggestions or missed real variants against
   the populated Jack Ruby 5 library.
2. **`Discard` affordance on Unknown rows ships in V1.** Required to unblock
   Save when paste includes document-title junk.
3. **`Pick from library` affordance on Unknown rows ships in V1.** Reuses
   the Story 3.4 type-ahead; prevents duplicate-Library traps when JW
   fails on a known title.

These three lock the Story 3.5 acceptance-criteria deltas vs. the current
`epics.md` text. The story spec should reference this doc and extend the
Unknown-row AC to include both `Pick from library` and `Discard` actions.

---

## File layout (per Story 3.5 AC)

- `web/src/paste-parse/parser.ts` — section detection, line classification
- `web/src/paste-parse/matcher.ts` — normalize + exact + Jaro-Winkler + threshold
- `web/src/paste-parse/normalize.ts` — pure helpers (shared with matcher tests)
- `web/src/paste-parse/parser.test.ts` — table-driven tests including the
  full `real-example.md` and `real-example-2.md` setlist blocks
- `web/src/paste-parse/matcher.test.ts` — table-driven tests for the worked
  scores in §2 (each row in the table becomes a test case)
