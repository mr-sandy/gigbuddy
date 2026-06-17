import { describe, expect, it } from 'vitest';
import { SongPutInputSchema, SongSchema } from './song.js';

const validSong = {
  bandId: 'k0c5Db7zM2qF3vNa',
  songId: 'abcdef0123456789',
  title: 'Round Midnight',
  key: 'Eb minor',
  patch: 'Rhodes',
  chordChart: '| Cm7 | F7 | BbM7 |',
  performanceNotes: 'Slow ballad',
  practiceNotes: 'Watch the turnaround',
  clientWrittenAt: '2026-06-16T12:00:00.000Z',
  serverReceivedAt: '2026-06-16T12:00:01.000Z',
  version: 1 as const,
};

describe('SongSchema', () => {
  it('accepts a valid full Song record', () => {
    const result = SongSchema.safeParse(validSong);
    expect(result.success).toBe(true);
  });

  it('accepts a Song with only the required fields (all optional fields absent)', () => {
    const minimal = {
      bandId: 'k0c5Db7zM2qF3vNa',
      songId: 'abcdef0123456789',
      title: 'Untitled',
      clientWrittenAt: '2026-06-16T12:00:00.000Z',
      serverReceivedAt: '2026-06-16T12:00:01.000Z',
      version: 1 as const,
    };
    const result = SongSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('rejects a Song missing a required field (title)', () => {
    const { title: _t, ...without } = validSong;
    const result = SongSchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  it('rejects a Song missing clientWrittenAt', () => {
    const { clientWrittenAt: _w, ...without } = validSong;
    const result = SongSchema.safeParse(without);
    expect(result.success).toBe(false);
  });
});

describe('SongPutInputSchema', () => {
  it('accepts a body without serverReceivedAt', () => {
    const { serverReceivedAt: _s, ...input } = validSong;
    const result = SongPutInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects a body that includes serverReceivedAt (client never sends it)', () => {
    const result = SongPutInputSchema.safeParse(validSong);
    expect(result.success).toBe(false);
  });
});
