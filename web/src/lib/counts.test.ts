import { describe, expect, it } from 'vitest';
import { formatCounts } from './counts.js';

describe('formatCounts', () => {
  it('pluralises both nouns for counts greater than one', () => {
    expect(formatCounts(52, 7)).toBe('52 songs · 7 gigs');
  });

  it('singularises both nouns for a count of exactly one', () => {
    expect(formatCounts(1, 1)).toBe('1 song · 1 gig');
  });

  it('pluralises a count of zero', () => {
    expect(formatCounts(0, 0)).toBe('0 songs · 0 gigs');
  });
});
