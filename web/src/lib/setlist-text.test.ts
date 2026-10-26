import type { Section, Song, SongRef } from '@gigbuddy/shared';
import { describe, expect, it } from 'vitest';
import { parseSetlistText, setlistToText } from './setlist-text.js';

const song = (songId: string, title: string) => ({ songId, title }) as Song;
const ref = (songId: string, titleSnapshot: string) => ({ songId, titleSnapshot });
const library = [song('s1', 'Tune A'), song('s2', 'Tune B'), song('s3', 'Tune C')];

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
    const result = parseSetlistText(setlistToText(sections), library, sections);
    expect(result).toEqual({ ok: true, sections });
  });

  it('forms a blank-named section from lines before the first heading', () => {
    const result = parseSetlistText('Tune A\n## Set 1\nTune B', library, []);
    expect(result).toEqual({
      ok: true,
      sections: [
        { name: '', songs: [ref('s1', 'Tune A')] },
        { name: 'Set 1', songs: [ref('s2', 'Tune B')] },
      ],
    });
  });

  it('adds no leading empty section when the text starts with a heading', () => {
    const result = parseSetlistText('## Set 1\nTune A', library, []);
    expect(result).toEqual({
      ok: true,
      sections: [{ name: 'Set 1', songs: [ref('s1', 'Tune A')] }],
    });
  });

  it('ignores blank lines and surrounding spaces and accepts CRLF', () => {
    const result = parseSetlistText('  ##  Set 1  \r\n\r\n  Tune A  \r\n\r\n', library, []);
    expect(result).toEqual({
      ok: true,
      sections: [{ name: 'Set 1', songs: [ref('s1', 'Tune A')] }],
    });
  });

  it('matches ignoring case and uses the library title; repeats give two refs', () => {
    const result = parseSetlistText('  tune a \nTUNE A', library, []);
    expect(result).toEqual({
      ok: true,
      sections: [{ name: '', songs: [ref('s1', 'Tune A'), ref('s1', 'Tune A')] }],
    });
  });

  it('treats curly quotes as straight, both ways', () => {
    const quoted = [song('q1', "Tune's A"), song('q2', '"Tune" B'), song('q3', 'Tune’s C')];
    const result = parseSetlistText("Tune’s A\n“Tune” B\nTune's C", quoted, []);
    expect(result).toEqual({
      ok: true,
      sections: [
        { name: '', songs: [ref('q1', "Tune's A"), ref('q2', '"Tune" B'), ref('q3', 'Tune’s C')] },
      ],
    });
  });

  it('reports unmatched and ambiguous titles, each once, and returns no sections', () => {
    const dupes = [song('d1', 'Tune A'), song('d2', 'tune a'), song('s2', 'Tune B')];
    const result = parseSetlistText('Nope\nTune A\nnope\nTUNE A\nTune B', dupes, []);
    expect(result).toEqual({ ok: false, notInLibrary: ['Nope'], ambiguous: ['Tune A'] });
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
    const result = parseSetlistText('Tune C\nTune B\nTune A', library, previous);
    if (!result.ok) throw new Error('expected ok');
    const songs = result.sections[0]?.songs ?? [];
    expect(songs).toEqual([ref('s3', 'Tune C'), ref('s2', 'Tune B'), ref('s1', 'Tune A')]);
  });

  it('resolves a renamed song by its stored title and saves the new title', () => {
    const previous: Section[] = [
      { name: '', songs: [ref('s1', 'Old Tune'), ref('gone', 'Lost Tune')] },
    ];
    expect(parseSetlistText('old tune', library, previous)).toEqual({
      ok: true,
      sections: [{ name: '', songs: [ref('s1', 'Tune A')] }],
    });
    // A song no longer in the library is still reported.
    expect(parseSetlistText('Lost Tune', library, previous)).toEqual({
      ok: false,
      notInLibrary: ['Lost Tune'],
      ambiguous: [],
    });
  });
});
