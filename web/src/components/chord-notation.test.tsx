import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MAJOR_SEVENTH_SYMBOL, parseChordToken, renderChordToken } from './chord-notation.js';

function renderToken(token: string) {
  return render(<div data-testid="host">{renderChordToken(token, 'k')}</div>);
}

describe('parseChordToken', () => {
  it('parses Dbmaj7 into root Db and suffix maj7', () => {
    expect(parseChordToken('Dbmaj7')).toEqual({ root: 'Db', suffix: 'maj7', bass: undefined });
  });

  it('parses Gm7 into root G and suffix m7', () => {
    expect(parseChordToken('Gm7')).toEqual({ root: 'G', suffix: 'm7', bass: undefined });
  });

  it('parses Gb9 into root Gb and suffix 9', () => {
    expect(parseChordToken('Gb9')).toEqual({ root: 'Gb', suffix: '9', bass: undefined });
  });

  it('parses G7sus4 into root G and suffix 7sus4', () => {
    expect(parseChordToken('G7sus4')).toEqual({ root: 'G', suffix: '7sus4', bass: undefined });
  });

  it('parses a bare major triad into empty suffix', () => {
    expect(parseChordToken('G')).toEqual({ root: 'G', suffix: '', bass: undefined });
  });

  it('parses a slash chord Bm/D into root B, suffix m, bass D', () => {
    expect(parseChordToken('Bm/D')).toEqual({ root: 'B', suffix: 'm', bass: 'D' });
  });

  it('parses altered dominant G7♭9 into root G, suffix 7♭9', () => {
    expect(parseChordToken('G7♭9')).toEqual({ root: 'G', suffix: '7♭9', bass: undefined });
  });

  it('parses altered dominant G7#5 into root G, suffix 7#5', () => {
    expect(parseChordToken('G7#5')).toEqual({ root: 'G', suffix: '7#5', bass: undefined });
  });

  it('returns null when the first character is not A–G uppercase', () => {
    expect(parseChordToken('H7')).toBeNull();
    expect(parseChordToken('g')).toBeNull();
    expect(parseChordToken('turnaround')).toBeNull();
  });

  it('returns null when the slash-chord bass is not a single valid note', () => {
    expect(parseChordToken('G7/H9')).toBeNull();
  });
});

describe('renderChordToken', () => {
  it('renders Dbmaj7 as Db△ with the triangle at baseline (no <sup>)', () => {
    const { container } = renderToken('Dbmaj7');
    expect(container.querySelector('sup')).toBeNull();
    expect(container.textContent).toBe(`Db${MAJOR_SEVENTH_SYMBOL}`);
  });

  it('renders Gm7 as G plus <sup>m7</sup>', () => {
    const { container } = renderToken('Gm7');
    const sup = container.querySelector('sup');
    expect(sup).not.toBeNull();
    expect(sup?.textContent).toBe('m7');
    expect(container.textContent).toBe('Gm7');
  });

  it('renders Gb9 as Gb plus <sup>9</sup>', () => {
    const { container } = renderToken('Gb9');
    const sup = container.querySelector('sup');
    expect(sup?.textContent).toBe('9');
    expect(container.textContent).toBe('Gb9');
  });

  it('renders G7sus4 as G plus <sup>7sus4</sup>', () => {
    const { container } = renderToken('G7sus4');
    const sup = container.querySelector('sup');
    expect(sup?.textContent).toBe('7sus4');
    expect(container.textContent).toBe('G7sus4');
  });

  it('renders Bm/D as B plus <sup>m</sup> plus baseline /D', () => {
    const { container } = renderToken('Bm/D');
    const sups = container.querySelectorAll('sup');
    expect(sups).toHaveLength(1);
    expect(sups[0]?.textContent).toBe('m');
    expect(container.textContent).toBe('Bm/D');
  });

  it('renders G7♭9 as G plus <sup>7♭9</sup> (accidental unchanged)', () => {
    const { container } = renderToken('G7♭9');
    const sup = container.querySelector('sup');
    expect(sup?.textContent).toBe('7♭9');
    expect(container.textContent).toBe('G7♭9');
  });

  it('renders G7#5 as G plus <sup>7#5</sup> (accidental unchanged)', () => {
    const { container } = renderToken('G7#5');
    const sup = container.querySelector('sup');
    expect(sup?.textContent).toBe('7#5');
    expect(container.textContent).toBe('G7#5');
  });

  it('renders a bare major triad G as plain G with no <sup> and no triangle', () => {
    const { container } = renderToken('G');
    expect(container.querySelector('sup')).toBeNull();
    expect(container.textContent).toBe('G');
  });

  it('renders an unparseable token (first char not A–G) verbatim', () => {
    const { container } = renderToken('H7');
    expect(container.querySelector('sup')).toBeNull();
    expect(container.textContent).toBe('H7');
  });

  it('renders an unparseable slash-chord (invalid bass) verbatim', () => {
    const { container } = renderToken('G7/H9');
    expect(container.querySelector('sup')).toBeNull();
    expect(container.textContent).toBe('G7/H9');
  });
});
