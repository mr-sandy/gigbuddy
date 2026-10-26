import type { Setlist } from '@gigbuddy/shared';
import { describe, expect, it } from 'vitest';
import { gigSongPath, playOrder, resolvePlace } from './gig-position.js';

const ref = (songId: string) => ({ songId, titleSnapshot: `Title ${songId}` });
const setlist = (sections: string[][]) =>
  ({
    setlistId: 'g1',
    sections: sections.map((songs, i) => ({ name: `Set ${i + 1}`, songs: songs.map(ref) })),
  }) as unknown as Setlist;

describe('playOrder', () => {
  it('flattens sections in stored order', () => {
    const order = playOrder(setlist([['a', 'b'], ['c']]));
    expect(order.map((r) => r.songId)).toEqual(['a', 'b', 'c']);
  });
});

describe('resolvePlace', () => {
  const order = playOrder(
    setlist([
      ['a', 'b'],
      ['c', 'a'],
    ]),
  );

  it('resolves a repeated song to the at given, for both occurrences', () => {
    expect(resolvePlace(order, 'a', '1')).toBe(0);
    expect(resolvePlace(order, 'a', '4')).toBe(3);
  });

  it('uses the first appearance when at points at a different song', () => {
    expect(resolvePlace(order, 'a', '2')).toBe(0);
  });

  it.each(['0', '-1', '2.5', 'abc', '', '99', null])('falls back for at=%s', (at) => {
    expect(resolvePlace(order, 'b', at)).toBe(1);
  });

  it('is null when the song is not in the setlist', () => {
    expect(resolvePlace(order, 'zzz', '1')).toBeNull();
  });

  it('is null for an empty setlist', () => {
    expect(resolvePlace([], 'a', '1')).toBeNull();
  });
});

describe('gigSongPath', () => {
  it('builds a 1-based at link', () => {
    const order = playOrder(setlist([['a', 'b']]));
    expect(gigSongPath('g1', order, 1)).toBe('/gigs/g1/songs/b?at=2');
  });
});
