import { describe, expect, it } from 'vitest';
import { normalizeTitle } from './normalize.js';

/*
 * normalizeTitle unit tests — covers all eight worked examples from Story
 * 3.5 AC-3 plus a few extra guard cases that pin the pipeline order
 * (enumerator before em-dash, em-dash before NFKD, brackets/parens before
 * apostrophes, etc.).
 */

describe('normalizeTitle — worked examples from AC-3', () => {
  it("strips trailing apostrophe and lowercases: COMIN' HOME BABY", () => {
    expect(normalizeTitle("COMIN' HOME BABY")).toBe('comin home baby');
  });

  it('strips em-dash annotation: Move on Up – The Rhythm is like Steely Dan ...', () => {
    expect(normalizeTitle('Move on Up – The Rhythm is like Steely Dan ‘Do it Again’')).toBe(
      'move on up',
    );
  });

  it('strips trailing bracket annotation: INTO THE MYSTIC [first dance]', () => {
    expect(normalizeTitle('INTO THE MYSTIC [first dance]')).toBe('into the mystic');
  });

  it('strips em-dash annotation: WATERMELON MAN – Ivan Ian John', () => {
    expect(normalizeTitle('WATERMELON MAN – Ivan Ian John')).toBe('watermelon man');
  });

  it('strips first-occurrence em-dash and trailing brackets: KELVINGROVESTREET – solos – ... [GUITAR CHANGE]', () => {
    expect(
      normalizeTitle('KELVINGROVESTREET – solos – Ivan Ian Clare SANDY John [GUITAR CHANGE]'),
    ).toBe('kelvingrovestreet');
  });

  it('trims trailing whitespace: MAS QUE NADA ', () => {
    expect(normalizeTitle('MAS QUE NADA ')).toBe('mas que nada');
  });

  it('NFKD-normalizes diacritics: Más Que Nada', () => {
    expect(normalizeTitle('Más Que Nada')).toBe('mas que nada');
  });

  it('strips numeric enumerator: 1. Some Song', () => {
    expect(normalizeTitle('1. Some Song')).toBe('some song');
  });
});

describe('normalizeTitle — pipeline order and edge cases', () => {
  it('strips numeric enumerator with closing paren: 1) Some Song', () => {
    expect(normalizeTitle('1) Some Song')).toBe('some song');
  });

  it('strips leading hyphen bullet: - Some Song', () => {
    expect(normalizeTitle('- Some Song')).toBe('some song');
  });

  it('strips leading round-bullet: • Some Song', () => {
    expect(normalizeTitle('• Some Song')).toBe('some song');
  });

  it('strips spaced hyphen annotation: Cantaloupe Island - Fm Blues', () => {
    expect(normalizeTitle('Cantaloupe Island - Fm Blues')).toBe('cantaloupe island');
  });

  it('strips trailing parens annotation: Trouble (Sandy lead vocal)', () => {
    expect(normalizeTitle('Trouble (Sandy lead vocal)')).toBe('trouble');
  });

  it("strips ASCII apostrophe: Don't Stop", () => {
    expect(normalizeTitle("Don't Stop")).toBe('dont stop');
  });

  it('collapses internal whitespace runs: Big   Yellow   Taxi', () => {
    expect(normalizeTitle('Big   Yellow   Taxi')).toBe('big yellow taxi');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeTitle('   ')).toBe('');
  });

  it('em-dash split takes precedence over hyphen split when both present', () => {
    // The em-dash appears first → first split point wins.
    expect(normalizeTitle('Song A – part 1 - Fm')).toBe('song a');
  });
});
