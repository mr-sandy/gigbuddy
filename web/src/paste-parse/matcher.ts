/*
 * Library matcher for the paste-to-parse pipeline (Story 3.5, FR-8/9 /
 * AC-4).
 *
 * `matchRows` takes the parsed-row stream from `parser.ts` and the
 * active Band's Library, and tags each row Matched / Fuzzy / Unknown:
 *
 *   Step 1 — Normalize the row's title (already done by parser → reuses
 *            `row.normalized`).
 *   Step 2 — Build a normalized Library map once per call (per AC-4).
 *   Step 3 — Exact lookup against the map → Matched.
 *   Step 4 — Otherwise: Jaro-Winkler against every Library song, top-1.
 *   Step 5 — Threshold ≥ 0.92 → Fuzzy. Otherwise → Unknown.
 *
 * JW is implemented inline (~40 lines) so this story doesn't pull in
 * `natural` or any other dependency — `pnpm-lock.yaml` stays unchanged
 * (AC-4 / AC-21).
 *
 * `titleSnapshot` semantics (AR-11 / AC-4): when a row resolves Matched,
 * the SongRef's `titleSnapshot` is the Library's canonical title — the
 * matcher returns the matched Song verbatim so callers can read
 * `song.title` directly.
 */

import type { Song } from '@gigbuddy/shared';
import { normalizeTitle } from './normalize.js';
import type { ParsedRow } from './parser.js';

export type MatchResult =
  | { status: 'matched'; song: Song }
  | { status: 'fuzzy'; song: Song; score: number }
  | { status: 'unknown' };

export const FUZZY_THRESHOLD = 0.92;

export function matchRows(rows: ParsedRow[], library: Song[]): MatchResult[] {
  const index = buildLibraryIndex(library);
  return rows.map((row) => matchOne(row.normalized, library, index));
}

/*
 * Match a single normalized title against the Library. Exported so the
 * route can re-match after Sandy inline-edits a row title (AC-10).
 */
export function matchNormalizedTitle(normalized: string, library: Song[]): MatchResult {
  return matchOne(normalized, library, buildLibraryIndex(library));
}

function matchOne(
  normalized: string,
  library: Song[],
  index: ReadonlyMap<string, Song>,
): MatchResult {
  // Step 3 — Exact match against the precomputed normalized index.
  const exact = index.get(normalized);
  if (exact !== undefined) {
    return { status: 'matched', song: exact };
  }

  // Step 4 — Jaro-Winkler against every Library song's normalized title.
  // Walk the library directly so we can pair scores back to Songs;
  // computing normalized titles here is O(n) but acceptable at V1 scale.
  if (library.length === 0) return { status: 'unknown' };

  let bestScore = 0;
  let bestSong: Song | null = null;
  for (const song of library) {
    const score = jaroWinkler(normalized, normalizeTitle(song.title));
    if (score > bestScore) {
      bestScore = score;
      bestSong = song;
    }
  }

  // Step 5 — Threshold.
  if (bestSong !== null && bestScore >= FUZZY_THRESHOLD) {
    return { status: 'fuzzy', song: bestSong, score: bestScore };
  }

  return { status: 'unknown' };
}

/*
 * Pre-compute `normalizedTitle → Song` once per call. If the Library
 * has two songs that normalize to the same key, the more-recently
 * written one wins (mirrors the design-note tie-break rule).
 */
function buildLibraryIndex(library: Song[]): ReadonlyMap<string, Song> {
  const out = new Map<string, Song>();
  for (const song of library) {
    const key = normalizeTitle(song.title);
    const existing = out.get(key);
    if (existing === undefined) {
      out.set(key, song);
      continue;
    }
    // Tie-break: prefer the song with the later clientWrittenAt.
    if (song.clientWrittenAt > existing.clientWrittenAt) {
      out.set(key, song);
    }
  }
  return out;
}

/*
 * Jaro-Winkler similarity. Returns a number in [0, 1].
 *
 * Implementation notes:
 *   - Jaro match-window = floor(max(|s1|,|s2|)/2) - 1, clamped to ≥ 0.
 *   - Transpositions are pairs of matched chars that appear out of
 *     order; the transposition count is divided by 2 per JW spec.
 *   - Winkler prefix bonus: L = common prefix length capped at 4,
 *     scale p = 0.1.
 *
 * Edge cases:
 *   - Both strings empty → 1 (identical).
 *   - One empty → 0 (no match).
 *   - No matches found → 0 (avoids division-by-zero in jaro formula).
 */
export function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const matchWindow = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1);
  const matches1 = new Array<boolean>(len1).fill(false);
  const matches2 = new Array<boolean>(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i += 1) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);
    for (let j = start; j < end; j += 1) {
      if (matches2[j]) continue;
      if (s1[i] !== s2[j]) continue;
      matches1[i] = true;
      matches2[j] = true;
      matches += 1;
      break;
    }
  }

  if (matches === 0) return 0;

  // Transpositions: walk the matched chars in both strings in order and
  // count pairwise disagreements; JW divides by 2.
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i += 1) {
    if (!matches1[i]) continue;
    while (!matches2[k]) k += 1;
    if (s1[i] !== s2[k]) transpositions += 1;
    k += 1;
  }
  const t = transpositions / 2;

  const jaro = (matches / len1 + matches / len2 + (matches - t) / matches) / 3;

  // Winkler prefix bonus.
  const maxPrefix = Math.min(4, len1, len2);
  let prefix = 0;
  for (let i = 0; i < maxPrefix; i += 1) {
    if (s1[i] === s2[i]) prefix += 1;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}
