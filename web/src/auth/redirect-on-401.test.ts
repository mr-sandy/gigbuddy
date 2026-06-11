import { describe, expect, it } from 'vitest';
import { shouldRedirectOn401 } from './redirect-on-401.js';

describe('shouldRedirectOn401', () => {
  it('redirects on a network-success 401 while performance is inactive', () => {
    expect(shouldRedirectOn401({ performanceActive: false, wasNetworkSuccess: true })).toBe(true);
  });

  it('does NOT redirect when the 401 came from cache (network failed)', () => {
    expect(shouldRedirectOn401({ performanceActive: false, wasNetworkSuccess: false })).toBe(false);
  });

  it('does NOT redirect while performance is active (AR-28)', () => {
    expect(shouldRedirectOn401({ performanceActive: true, wasNetworkSuccess: true })).toBe(false);
  });

  it('does NOT redirect when both gates fail', () => {
    expect(shouldRedirectOn401({ performanceActive: true, wasNetworkSuccess: false })).toBe(false);
  });
});
