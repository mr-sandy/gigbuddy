import { describe, expect, it } from 'vitest';
import { parseSetlist } from './parser.js';

/*
 * parseSetlist unit tests — covers Story 3.5 AC-14:
 *   - blank text → empty result
 *   - single-section no-header → one Section named `Set 1`
 *   - `Set 1` / `Set 2` headers split into two sections
 *   - `Encore` header detected
 *   - `{Set 1}` brace-wrapped header detected
 *   - `# Set 2` markdown header detected
 *   - `---` separator closes section and opens implicit next
 *   - Blank lines are skipped (do not split sections)
 *   - Each row's `raw` preserves the original line; `normalized` has been
 *     through `normalizeTitle`
 */

describe('parseSetlist — empty / no-header inputs', () => {
  it('returns empty sections for empty string', () => {
    expect(parseSetlist('')).toEqual({ sections: [] });
  });

  it('returns empty sections for whitespace-only', () => {
    expect(parseSetlist('   \n\n  \n')).toEqual({ sections: [] });
  });

  it('packs songs into default Set 1 when no header is present', () => {
    const result = parseSetlist(['Move on Up', 'Watermelon Man', 'Mas Que Nada'].join('\n'));
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.name).toBe('Set 1');
    expect(result.sections[0]?.rows.map((r) => r.raw)).toEqual([
      'Move on Up',
      'Watermelon Man',
      'Mas Que Nada',
    ]);
    expect(result.sections[0]?.rows.map((r) => r.normalized)).toEqual([
      'move on up',
      'watermelon man',
      'mas que nada',
    ]);
  });
});

describe('parseSetlist — explicit headers', () => {
  it('splits Set 1 / Set 2 headers into two sections', () => {
    const result = parseSetlist(
      ['Set 1', 'Move on Up', 'Watermelon Man', 'Set 2', 'Mas Que Nada', 'Cantaloupe Island'].join(
        '\n',
      ),
    );
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0]?.name).toBe('Set 1');
    expect(result.sections[0]?.rows).toHaveLength(2);
    expect(result.sections[1]?.name).toBe('Set 2');
    expect(result.sections[1]?.rows).toHaveLength(2);
  });

  it('title-cases lowercase set header', () => {
    const result = parseSetlist(['set 1', 'Move on Up'].join('\n'));
    expect(result.sections[0]?.name).toBe('Set 1');
  });

  it('title-cases SHOUT-CASE set header', () => {
    const result = parseSetlist(['SET 2', 'Mas Que Nada'].join('\n'));
    expect(result.sections[0]?.name).toBe('Set 2');
  });

  it('detects Encore header (case-insensitive)', () => {
    const result = parseSetlist(['Set 1', 'Move on Up', 'encore', 'Into the Mystic'].join('\n'));
    expect(result.sections).toHaveLength(2);
    expect(result.sections[1]?.name).toBe('Encore');
    expect(result.sections[1]?.rows).toHaveLength(1);
  });

  it('detects {Set 1} brace-wrapped header', () => {
    const result = parseSetlist(['{Set 1}', 'Move on Up'].join('\n'));
    expect(result.sections[0]?.name).toBe('Set 1');
    expect(result.sections[0]?.rows).toHaveLength(1);
  });

  it('detects {Encore} brace-wrapped header', () => {
    const result = parseSetlist(['Set 1', 'Move on Up', '{Encore}', 'Into the Mystic'].join('\n'));
    expect(result.sections[1]?.name).toBe('Encore');
  });

  it('detects # Set 2 markdown header', () => {
    const result = parseSetlist(['# Set 2', 'Mas Que Nada'].join('\n'));
    expect(result.sections[0]?.name).toBe('Set 2');
  });

  it('detects ###### Encore markdown header (1..6 hashes)', () => {
    const result = parseSetlist(['###### Encore', 'Into the Mystic'].join('\n'));
    expect(result.sections[0]?.name).toBe('Encore');
  });
});

describe('parseSetlist — separator + implicit sections', () => {
  it('--- closes the current section and opens an implicit Set 2', () => {
    const result = parseSetlist(
      ['Set 1', 'Move on Up', 'Watermelon Man', '---', 'Mas Que Nada', 'Cantaloupe Island'].join(
        '\n',
      ),
    );
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0]?.name).toBe('Set 1');
    expect(result.sections[0]?.rows).toHaveLength(2);
    expect(result.sections[1]?.name).toBe('Set 2');
    expect(result.sections[1]?.rows).toHaveLength(2);
  });

  it('--- with no preceding header opens implicit Set 1 then Set 2 only if songs exist', () => {
    const result = parseSetlist(['Move on Up', '---', 'Mas Que Nada'].join('\n'));
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0]?.name).toBe('Set 1');
    expect(result.sections[1]?.name).toBe('Set 2');
  });

  it('trailing --- does not emit an empty section', () => {
    const result = parseSetlist(['Set 1', 'Move on Up', '---'].join('\n'));
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.name).toBe('Set 1');
  });
});

describe('parseSetlist — blank lines and row fields', () => {
  it('blank lines between rows do NOT split sections', () => {
    const result = parseSetlist(['Set 1', 'Move on Up', '', '', 'Watermelon Man'].join('\n'));
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.rows).toHaveLength(2);
  });

  it('row.raw preserves original line; row.normalized has been normalized', () => {
    const result = parseSetlist(['Set 1', 'WATERMELON MAN – Ivan Ian John'].join('\n'));
    const row = result.sections[0]?.rows[0];
    expect(row?.raw).toBe('WATERMELON MAN – Ivan Ian John');
    expect(row?.normalized).toBe('watermelon man');
  });

  it('handles only-headers / no-songs input as sections with empty rows', () => {
    const result = parseSetlist(['Set 1', 'Set 2'].join('\n'));
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0]?.rows).toHaveLength(0);
    expect(result.sections[1]?.rows).toHaveLength(0);
  });
});
