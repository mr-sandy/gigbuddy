import { ACTIVE_BAND_ID, type Song } from '@gigbuddy/shared';
import { describe, expect, it } from 'vitest';
import { FUZZY_THRESHOLD, jaroWinkler, matchNormalizedTitle, matchRows } from './matcher.js';
import type { ParsedRow } from './parser.js';

/*
 * matchRows / matchNormalizedTitle / jaroWinkler unit tests — covers
 * Story 3.5 AC-15:
 *   - Five worked-score table rows from AC-4 (Matched / Fuzzy / Unknown)
 *   - Empty library → all Unknown
 *   - Duplicate Library titles → tie-break by latest clientWrittenAt
 *   - Library normalization is pre-computed (smoke-test via large library
 *     timing)
 */

function makeSong(
  songId: string,
  title: string,
  clientWrittenAt = '2026-06-19T12:00:00.000Z',
): Song {
  return {
    bandId: ACTIVE_BAND_ID,
    songId,
    title,
    clientWrittenAt,
    serverReceivedAt: '2026-06-19T12:00:01.000Z',
    version: 1 as const,
  };
}

function row(normalized: string): ParsedRow {
  return { raw: normalized, normalized };
}

describe('jaroWinkler — sanity', () => {
  it('returns 1 for identical strings', () => {
    expect(jaroWinkler('abc', 'abc')).toBe(1);
  });

  it('returns 0 when either string is empty', () => {
    expect(jaroWinkler('', 'abc')).toBe(0);
    expect(jaroWinkler('abc', '')).toBe(0);
  });

  it('returns 1 when both strings are empty', () => {
    expect(jaroWinkler('', '')).toBe(1);
  });

  it('returns 0 for completely disjoint inputs', () => {
    expect(jaroWinkler('abc', 'xyz')).toBe(0);
  });
});

describe('jaroWinkler — worked scores from AC-4', () => {
  it('"comin home baby" ↔ "coming home baby" ≥ 0.92 (≈ 0.98)', () => {
    const score = jaroWinkler('comin home baby', 'coming home baby');
    expect(score).toBeGreaterThanOrEqual(0.92);
    expect(score).toBeLessThan(1);
  });

  it('"cantaloupe island" ↔ "canteloupe island" ≥ 0.92 (≈ 0.96)', () => {
    const score = jaroWinkler('cantaloupe island', 'canteloupe island');
    expect(score).toBeGreaterThanOrEqual(0.92);
    expect(score).toBeLessThan(1);
  });

  it('"kelvingrovestreet" ↔ "kelvingrove street" ≥ 0.92 (≈ 0.96)', () => {
    const score = jaroWinkler('kelvingrovestreet', 'kelvingrove street');
    expect(score).toBeGreaterThanOrEqual(0.92);
    expect(score).toBeLessThan(1);
  });

  it('"mas que nada" ↔ "mas que nada" = 1.0 (exact)', () => {
    expect(jaroWinkler('mas que nada', 'mas que nada')).toBe(1);
  });

  it('"move on up" ↔ "move it on over" < 0.92 (≈ 0.82)', () => {
    const score = jaroWinkler('move on up', 'move it on over');
    expect(score).toBeLessThan(0.92);
  });
});

describe('matchRows — five worked rows from AC-4', () => {
  it('exact normalized match → matched', () => {
    const library = [makeSong('s00000000000mqn1', 'Mas Que Nada')];
    const results = matchRows([row('mas que nada')], library);
    expect(results[0]).toEqual({ status: 'matched', song: library[0] });
  });

  it('JW above threshold → fuzzy ("comin home baby" → "Coming Home Baby")', () => {
    const library = [makeSong('s0000000000chb1', 'Coming Home Baby')];
    const results = matchRows([row('comin home baby')], library);
    expect(results[0]?.status).toBe('fuzzy');
    if (results[0]?.status === 'fuzzy') {
      expect(results[0].song).toBe(library[0]);
      expect(results[0].score).toBeGreaterThanOrEqual(FUZZY_THRESHOLD);
    }
  });

  it('JW above threshold → fuzzy ("cantaloupe island" → "Canteloupe Island")', () => {
    const library = [makeSong('s0000000000ci01', 'Canteloupe Island')];
    const results = matchRows([row('cantaloupe island')], library);
    expect(results[0]?.status).toBe('fuzzy');
  });

  it('JW above threshold → fuzzy ("kelvingrovestreet" → "Kelvingrove Street")', () => {
    const library = [makeSong('s0000000000kg01', 'Kelvingrove Street')];
    const results = matchRows([row('kelvingrovestreet')], library);
    expect(results[0]?.status).toBe('fuzzy');
  });

  it('JW below threshold → unknown ("move on up" vs "Move It on Over")', () => {
    const library = [makeSong('s0000000000mio1', 'Move It on Over')];
    const results = matchRows([row('move on up')], library);
    expect(results[0]).toEqual({ status: 'unknown' });
  });
});

describe('matchRows — degenerate / edge inputs', () => {
  it('empty library → every row is Unknown', () => {
    const results = matchRows([row('move on up'), row('watermelon man'), row('mas que nada')], []);
    expect(results).toEqual([{ status: 'unknown' }, { status: 'unknown' }, { status: 'unknown' }]);
  });

  it('empty input rows → empty results', () => {
    const library = [makeSong('s0000000000abc1', 'Some Song')];
    expect(matchRows([], library)).toEqual([]);
  });

  it('duplicate Library titles — most-recently-written wins on exact match', () => {
    const older = makeSong('s0000000000old1', 'Mas Que Nada', '2026-01-01T00:00:00.000Z');
    const newer = makeSong('s0000000000new1', 'Mas Que Nada', '2026-06-19T12:00:00.000Z');
    const results = matchRows([row('mas que nada')], [older, newer]);
    expect(results[0]?.status).toBe('matched');
    if (results[0]?.status === 'matched') {
      expect(results[0].song).toBe(newer);
    }
  });

  it('JW top-1 picks the closest among multiple candidates', () => {
    const library = [
      makeSong('s0000000000oth1', 'Some Other Song'),
      makeSong('s0000000000chb1', 'Coming Home Baby'),
    ];
    const results = matchRows([row('comin home baby')], library);
    expect(results[0]?.status).toBe('fuzzy');
    if (results[0]?.status === 'fuzzy') {
      expect(results[0].song).toBe(library[1]);
    }
  });

  it('library titles are normalized via the same pipeline (handles diacritics on Library side)', () => {
    // The Library carries the unsanitized version; pasted is unmarked.
    const library = [makeSong('s0000000000mqn1', 'Más Que Nada')];
    const results = matchRows([row('mas que nada')], library);
    expect(results[0]?.status).toBe('matched');
  });

  it('completes well under the 500ms budget for ~20 rows × 100-song library', () => {
    const library: Song[] = Array.from({ length: 100 }, (_, i) =>
      makeSong(
        `s${String(i).padStart(15, '0')}`,
        `Song Title Number ${i}`,
        '2026-06-19T12:00:00.000Z',
      ),
    );
    const rows: ParsedRow[] = Array.from({ length: 20 }, (_, i) => row(`song title number ${i}`));
    const start = performance.now();
    const results = matchRows(rows, library);
    const elapsed = performance.now() - start;
    expect(results).toHaveLength(20);
    expect(elapsed).toBeLessThan(500);
  });
});

describe('matchNormalizedTitle — re-match after inline edit', () => {
  it('re-match flips a row from Unknown to Matched when title is edited to the canonical form', () => {
    const library = [makeSong('s0000000000mqn1', 'Mas Que Nada')];
    expect(matchNormalizedTitle('some garbage line', library)).toEqual({ status: 'unknown' });
    expect(matchNormalizedTitle('mas que nada', library).status).toBe('matched');
  });
});
