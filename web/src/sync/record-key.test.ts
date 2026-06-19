import { describe, expect, it } from 'vitest';
import { parseRecordKey, setlistRecordKey, songRecordKey } from './record-key.js';

describe('songRecordKey', () => {
  it('formats as song:<bandId>:<songId>', () => {
    expect(songRecordKey('k0c5Db7zM2qF3vNa', 'songABCDEF123456')).toBe(
      'song:k0c5Db7zM2qF3vNa:songABCDEF123456',
    );
  });
});

describe('setlistRecordKey', () => {
  it('formats as setlist:<bandId>:<setlistId>', () => {
    expect(setlistRecordKey('k0c5Db7zM2qF3vNa', 'setlistABCDEF123')).toBe(
      'setlist:k0c5Db7zM2qF3vNa:setlistABCDEF123',
    );
  });
});

describe('parseRecordKey', () => {
  it('parses a well-formed song recordKey into the discriminated union', () => {
    expect(parseRecordKey('song:k0c5Db7zM2qF3vNa:songABCDEF123456')).toEqual({
      kind: 'song',
      bandId: 'k0c5Db7zM2qF3vNa',
      songId: 'songABCDEF123456',
    });
  });

  it('parses a well-formed setlist recordKey into the discriminated union (roundtrip)', () => {
    const key = setlistRecordKey('k0c5Db7zM2qF3vNa', 'setlistABCDEF123');
    expect(parseRecordKey(key)).toEqual({
      kind: 'setlist',
      bandId: 'k0c5Db7zM2qF3vNa',
      setlistId: 'setlistABCDEF123',
    });
  });

  it('returns { kind: "unknown" } for an unrecognised prefix', () => {
    expect(parseRecordKey('gig:band:slot')).toEqual({ kind: 'unknown' });
  });

  it('returns { kind: "unknown" } for a malformed (too few segments) recordKey', () => {
    expect(parseRecordKey('song:abc')).toEqual({ kind: 'unknown' });
    expect(parseRecordKey('setlist:abc')).toEqual({ kind: 'unknown' });
  });

  it('returns { kind: "unknown" } for a song recordKey with empty segments', () => {
    expect(parseRecordKey('song::')).toEqual({ kind: 'unknown' });
    expect(parseRecordKey('song:band:')).toEqual({ kind: 'unknown' });
    expect(parseRecordKey('song::id')).toEqual({ kind: 'unknown' });
  });

  it('returns { kind: "unknown" } for a setlist recordKey with empty segments', () => {
    expect(parseRecordKey('setlist::')).toEqual({ kind: 'unknown' });
    expect(parseRecordKey('setlist:band:')).toEqual({ kind: 'unknown' });
    expect(parseRecordKey('setlist::id')).toEqual({ kind: 'unknown' });
  });
});
