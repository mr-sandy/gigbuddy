import type { Section, Song, SongRef } from '@gigbuddy/shared';
import { describe, expect, it } from 'vitest';
import {
  type Choice,
  defaultChoice,
  parseSetlistText,
  resolveDraft,
  type SetlistDraft,
  setlistToText,
  tidyTitle,
} from './setlist-text.js';

const song = (songId: string, title: string, key?: string) =>
  ({ songId, title, ...(key ? { key } : {}) }) as Song;
const ref = (songId: string, titleSnapshot: string) => ({ songId, titleSnapshot });
const library = [song('s1', 'Tune A'), song('s2', 'Tune B'), song('s3', 'Tune C')];

/** Parses, expects nothing pending, and returns the sections as refs. */
function parseResolved(text: string, songs: Song[], previous: Section[] = []): Section[] {
  const draft = parseSetlistText(text, songs, previous);
  expect(draft.pending).toEqual([]);
  return resolveDraft(draft, new Map(), new Map());
}

describe('setlistToText', () => {
  it('writes headings, songs and a blank line between sections', () => {
    const sections: Section[] = [
      { name: 'Set 1', songs: [ref('s1', 'Tune A'), ref('s2', 'Tune B')] },
      { name: 'Set 2', songs: [ref('s3', 'Tune C')] },
    ];
    expect(setlistToText(sections)).toBe('## Set 1\nTune A\nTune B\n\n## Set 2\nTune C');
  });
});

describe('parseSetlistText', () => {
  it('round-trips sections, including unnamed and empty ones', () => {
    const sections: Section[] = [
      { name: '', songs: [ref('s1', 'Tune A')] },
      { name: 'Set 1', songs: [ref('s2', 'Tune B')] },
      { name: '', songs: [ref('s3', 'Tune C')] },
      { name: 'Set 2', songs: [] },
    ];
    expect(parseResolved(setlistToText(sections), library, sections)).toEqual(sections);
  });

  it('forms a blank-named section from lines before the first heading', () => {
    expect(parseResolved('Tune A\n## Set 1\nTune B', library)).toEqual([
      { name: '', songs: [ref('s1', 'Tune A')] },
      { name: 'Set 1', songs: [ref('s2', 'Tune B')] },
    ]);
  });

  it('adds no leading empty section when the text starts with a heading', () => {
    expect(parseResolved('## Set 1\nTune A', library)).toEqual([
      { name: 'Set 1', songs: [ref('s1', 'Tune A')] },
    ]);
  });

  it('ignores blank lines and surrounding spaces and accepts CRLF', () => {
    expect(parseResolved('  ##  Set 1  \r\n\r\n  Tune A  \r\n\r\n', library)).toEqual([
      { name: 'Set 1', songs: [ref('s1', 'Tune A')] },
    ]);
  });

  it('matches ignoring case and uses the library title; repeats give two refs', () => {
    expect(parseResolved('  tune a \nTUNE A', library)).toEqual([
      { name: '', songs: [ref('s1', 'Tune A'), ref('s1', 'Tune A')] },
    ]);
  });

  it('treats curly quotes as straight, both ways', () => {
    const quoted = [song('q1', "Tune's A"), song('q2', '"Tune" B'), song('q3', 'Tune’s C')];
    expect(parseResolved("Tune’s A\n“Tune” B\nTune's C", quoted)).toEqual([
      { name: '', songs: [ref('q1', "Tune's A"), ref('q2', '"Tune" B'), ref('q3', 'Tune’s C')] },
    ]);
  });

  it('ignores numbering, bullets and a trailing duration', () => {
    const text = '1. Tune A\n3) Tune B 4:30\n12 - Tune C\n- tune a\n• Tune B\n* Tune C - (5:02)';
    const [section] = parseResolved(text, library);
    expect(section?.songs.map((s) => s.songId)).toEqual(['s1', 's2', 's3', 's1', 's2', 's3']);
  });

  it('ignores accents, punctuation, repeated spaces and a leading "The"', () => {
    const songs = [song('a', 'Café Blues'), song('b', 'The Chicken'), song('c', 'In & Out')];
    const [section] = parseResolved('cafe  blues!\nChicken\nthe chicken\nIn & Out', songs);
    expect(section?.songs.map((s) => s.songId)).toEqual(['a', 'b', 'b', 'c']);
  });

  it('keeps a leading digit that has no punctuation after it', () => {
    const songs = [song('x', '7 Steps to Heaven')];
    expect(parseResolved('7 Steps to Heaven', songs)[0]?.songs).toEqual([
      ref('x', '7 Steps to Heaven'),
    ]);
  });

  it('matches with bracketed text removed when nothing else matches', () => {
    const [section] = parseResolved('Tune A [first dance]\nTune B (Herbie)\nTune C {x}', library);
    expect(section?.songs.map((s) => s.songId)).toEqual(['s1', 's2', 's3']);
  });

  it('prefers the full line over the bracket fallback', () => {
    const songs = [song('a', 'Tune A'), song('b', 'Tune A (Live)')];
    expect(parseResolved('Tune A (Live)', songs)[0]?.songs).toEqual([ref('b', 'Tune A (Live)')]);
  });

  it('offers candidates when the bracket fallback matches two songs', () => {
    const songs = [song('a', 'Tune A', 'C'), song('b', 'Tune A', 'F')];
    const draft = parseSetlistText('Tune A [slow]', songs, []);
    expect(draft.pending).toHaveLength(1);
    expect(draft.pending[0]?.candidates.map((s) => s.songId)).toEqual(['a', 'b']);
  });

  it('reports an unmatched line once, in first-seen order, with a tidied title', () => {
    const draft = parseSetlistText('1. NOPE ONE 3:00\nTune A\nnope one\nMystery', library, []);
    expect(draft.pending.map((p) => [p.line, p.newTitle, p.candidates.length])).toEqual([
      ['1. NOPE ONE 3:00', 'Nope One', 0],
      ['Mystery', 'Mystery', 0],
    ]);
    expect(draft.sections[0]?.lines).toHaveLength(4);
  });

  it('puts a shared title in pending with its songs as candidates', () => {
    const dupes = [song('d1', 'Tune A'), song('d2', 'tune a'), song('s2', 'Tune B')];
    const draft = parseSetlistText('Tune A\nTUNE A\nTune B', dupes, []);
    expect(draft.pending).toHaveLength(1);
    expect(draft.pending[0]?.candidates.map((s) => s.songId)).toEqual(['d1', 'd2']);
  });

  it('drops a stored note on save', () => {
    const previous: Section[] = [
      {
        name: '',
        songs: [
          { ...ref('s1', 'Tune A'), perGigAnnotation: 'slow' } as SongRef,
          ref('s2', 'Tune B'),
        ],
      },
    ];
    const [section] = parseResolved('Tune C\nTune B\nTune A', library, previous);
    expect(section?.songs).toEqual([ref('s3', 'Tune C'), ref('s2', 'Tune B'), ref('s1', 'Tune A')]);
  });

  it('resolves a renamed song by its stored title and saves the new title', () => {
    const previous: Section[] = [
      { name: '', songs: [ref('s1', 'Old Tune'), ref('gone', 'Lost Tune')] },
    ];
    expect(parseResolved('old tune', library, previous)).toEqual([
      { name: '', songs: [ref('s1', 'Tune A')] },
    ]);
    // A song no longer in the library is still pending.
    expect(parseSetlistText('Lost Tune', library, previous).pending).toHaveLength(1);
  });

  describe('set headings', () => {
    it.each([
      ['Set 1', 'Set 1'],
      ['set 2', 'set 2'],
      ['SET ONE', 'Set One'],
      ['1st set', '1st set'],
      ['First Set', 'First Set'],
      ['3RD SET', '3rd Set'],
      ['Encore', 'Encore'],
      ['ENCORE', 'Encore'],
    ])('treats %s as a heading', (line, name) => {
      expect(parseResolved(`${line}\nTune A`, library)).toEqual([
        { name, songs: [ref('s1', 'Tune A')] },
      ]);
    });

    it('does not treat "Set 10" or "Set Me Free" as a heading', () => {
      const draft = parseSetlistText('Set 10\nSet Me Free', library, []);
      expect(draft.pending).toHaveLength(2);
    });

    it('starts a new unnamed section after a dash rule', () => {
      expect(parseResolved('Set 1\nTune A\n------\nTune B', library)).toEqual([
        { name: 'Set 1', songs: [ref('s1', 'Tune A')] },
        { name: '', songs: [ref('s2', 'Tune B')] },
      ]);
    });

    it('leaves no empty section between a rule and a heading', () => {
      expect(parseResolved('Tune A\n—————\nSet 2\nTune B', library)).toEqual([
        { name: '', songs: [ref('s1', 'Tune A')] },
        { name: 'Set 2', songs: [ref('s2', 'Tune B')] },
      ]);
    });
  });
});

describe('tidyTitle', () => {
  it.each([
    ['INTO THE MYSTIC [first dance]', 'Into the Mystic'],
    ["COMIN' HOME BABY", "Comin' Home Baby"],
    ['3) Cissy Strut 4:30', 'Cissy Strut'],
    ['5:15', '5:15'],
    ['Mixed CASE (live)', 'Mixed CASE'],
    ['THE END OF THE', 'The End of The'],
    ['[just a note]', '[just a note]'],
  ])('%s → %s', (line, title) => {
    expect(tidyTitle(line)).toBe(title);
  });
});

describe('defaultChoice and resolveDraft', () => {
  const dupes = [song('d1', 'Tune A', 'C'), song('d2', 'Tune A', 'F')];
  const draft: SetlistDraft = parseSetlistText(
    '## Set 1\nTune B\nNew One\nSkip Me\nTune A\n------\nSkip Me',
    [...dupes, song('s2', 'Tune B')],
    [],
  );

  it('defaults to the first candidate, else a new song', () => {
    const byLine = new Map(draft.pending.map((p) => [p.line, p]));
    expect(defaultChoice(byLine.get('Tune A') as never)).toEqual({
      kind: 'song',
      songId: 'd1',
      title: 'Tune A',
    });
    expect(defaultChoice(byLine.get('New One') as never)).toEqual({ kind: 'new' });
  });

  it('applies song, new and out choices and drops an emptied unnamed section', () => {
    const choices = new Map<string, Choice>([
      ['new one', { kind: 'new' }],
      ['skip me', { kind: 'out' }],
      ['tune a', { kind: 'song', songId: 'd2', title: 'Tune A' }],
    ]);
    const newRefs = new Map([['new one', ref('n1', 'New One')]]);
    expect(resolveDraft(draft, choices, newRefs)).toEqual([
      {
        name: 'Set 1',
        songs: [ref('s2', 'Tune B'), ref('n1', 'New One'), ref('d2', 'Tune A')],
      },
    ]);
  });
});
