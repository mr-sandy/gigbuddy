import { describe, expect, it } from 'vitest';
import { generateSongId, URL_SAFE_ALPHABET } from './song-id.js';

describe('generateSongId', () => {
  it('returns a 16-character string', () => {
    expect(generateSongId()).toHaveLength(16);
  });

  it('uses only URL-safe alphabet characters', () => {
    const id = generateSongId();
    for (const char of id) {
      expect(URL_SAFE_ALPHABET).toContain(char);
    }
  });

  it('returns a different id on each call', () => {
    expect(generateSongId()).not.toBe(generateSongId());
  });
});
