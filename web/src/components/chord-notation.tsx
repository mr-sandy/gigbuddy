import type { ReactNode } from 'react';
import { Fragment } from 'react';

/*
 * Compact chord-glyph notation (Story 6.1).
 *
 * Pure parse + render helpers for chord tokens. Owned by this module rather
 * than inlined in <ChordChart> so the transformation rules are independently
 * unit-testable without mounting the chart component.
 *
 * Transformation rules (final, per Story 6.1 Dev Notes):
 *   1. Root (letter + optional accidental) always renders at baseline.
 *   2. Bare major triad (no suffix) → root only, no extra element.
 *   3. Suffix `maj7` (case-insensitive exact match on the suffix as a whole)
 *      → the WHITE UP-POINTING TRIANGLE (U+25B3) at baseline, immediately
 *      after the root. This is the ONLY symbol substitution in scope —
 *      do NOT invent glyphs for dim/ø/aug/etc.
 *   4. Any other non-empty suffix → <sup>{suffix}</sup>, verbatim.
 *   5. Bass (slash chord) → `/` + bass at baseline, after the suffix render.
 *   6. Tokens failing to parse render as verbatim text (no throw, no blank).
 *
 * No side effects, no DOM access, no atmosphere dependency — pure UI helpers.
 */

export const CHORD_TOKEN_REGEX = /^([A-G])(#|b|♯|♭)?(.*)$/;
export const BASS_NOTE_REGEX = /^[A-G](#|b|♯|♭)?$/;
export const MAJOR_SEVENTH_SYMBOL = '△'; // U+25B3 WHITE UP-POINTING TRIANGLE

export type ParsedChordToken = { root: string; suffix: string; bass?: string };

export function parseChordToken(token: string): ParsedChordToken | null {
  let main = token;
  let bass: string | undefined;
  const slashIndex = token.indexOf('/');
  if (slashIndex !== -1) {
    main = token.slice(0, slashIndex);
    const candidateBass = token.slice(slashIndex + 1);
    if (!BASS_NOTE_REGEX.test(candidateBass)) return null;
    bass = candidateBass;
  }
  const match = main.match(CHORD_TOKEN_REGEX);
  if (!match) return null;
  const [, letter, accidental = '', suffix = ''] = match;
  const root = `${letter}${accidental}`;
  return bass === undefined ? { root, suffix } : { root, suffix, bass };
}

export function renderChordToken(token: string, key: number | string): ReactNode {
  const parsed = parseChordToken(token);
  if (!parsed) return <Fragment key={key}>{token}</Fragment>;
  const { root, suffix, bass } = parsed;
  const isMajorSeventh = suffix.toLowerCase() === 'maj7';
  return (
    <Fragment key={key}>
      {root}
      {suffix === '' ? null : isMajorSeventh ? MAJOR_SEVENTH_SYMBOL : <sup>{suffix}</sup>}
      {bass === undefined ? null : `/${bass}`}
    </Fragment>
  );
}
