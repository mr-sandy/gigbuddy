import { describe, expect, it } from 'vitest';
import { shouldRedirectOn401 } from './redirect-on-401.js';

describe('shouldRedirectOn401', () => {
  it('redirects on a network-success 401', () => {
    expect(shouldRedirectOn401({ wasNetworkSuccess: true })).toBe(true);
  });

  it('does NOT redirect when the 401 came from cache (network failed)', () => {
    expect(shouldRedirectOn401({ wasNetworkSuccess: false })).toBe(false);
  });
});
