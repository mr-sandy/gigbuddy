import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyBootAtmosphere } from './atmosphere.js';

function stubUserAgent(value: string): void {
  vi.stubGlobal('navigator', { ...navigator, userAgent: value });
}

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const MACBOOK_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

describe('applyBootAtmosphere', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-atmosphere');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute('data-atmosphere');
  });

  it('writes "performance" to <html> on iPhone UA', () => {
    stubUserAgent(IPHONE_UA);
    applyBootAtmosphere();
    expect(document.documentElement.dataset.atmosphere).toBe('performance');
  });

  it('writes "practice" to <html> on MacBook UA', () => {
    stubUserAgent(MACBOOK_UA);
    applyBootAtmosphere();
    expect(document.documentElement.dataset.atmosphere).toBe('practice');
  });

  it('overwrites a previously set atmosphere on boot', () => {
    stubUserAgent(IPHONE_UA);
    document.documentElement.dataset.atmosphere = 'practice';
    applyBootAtmosphere();
    expect(document.documentElement.dataset.atmosphere).toBe('performance');
  });
});
