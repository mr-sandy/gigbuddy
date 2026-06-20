import { describe, expect, it } from 'vitest';
import { generateId, URL_SAFE_ALPHABET } from './id.js';

describe('generateId', () => {
  it('returns a 16-character string', () => {
    expect(generateId()).toHaveLength(16);
  });

  it('uses only URL-safe alphabet characters', () => {
    const id = generateId();
    for (const char of id) {
      expect(URL_SAFE_ALPHABET).toContain(char);
    }
  });

  it('returns a different id on each call', () => {
    expect(generateId()).not.toBe(generateId());
  });
});
