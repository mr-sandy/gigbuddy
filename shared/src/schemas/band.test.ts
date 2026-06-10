import { describe, expect, it } from 'vitest';
import { BandSchema } from './band.js';

describe('BandSchema', () => {
  it('accepts a valid band record', () => {
    const result = BandSchema.safeParse({ bandId: 'abc123', name: 'The Jack Ruby 5' });
    expect(result.success).toBe(true);
  });

  it('rejects a record missing required fields', () => {
    const result = BandSchema.safeParse({ name: 'no id' });
    expect(result.success).toBe(false);
  });
});
