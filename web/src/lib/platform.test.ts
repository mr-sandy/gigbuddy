import { afterEach, describe, expect, it, vi } from 'vitest';
import { isIPhone } from './platform.js';

function stubUserAgent(value: string): void {
  vi.stubGlobal('navigator', { ...navigator, userAgent: value });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isIPhone', () => {
  it('returns true for iPhone Safari UA', () => {
    stubUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    );
    expect(isIPhone()).toBe(true);
  });

  it('returns true for iPhone PWA standalone UA', () => {
    stubUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    );
    expect(isIPhone()).toBe(true);
  });

  it('returns true for iPod', () => {
    stubUserAgent(
      'Mozilla/5.0 (iPod touch; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    );
    expect(isIPhone()).toBe(true);
  });

  it('returns false for Safari on macOS', () => {
    stubUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    );
    expect(isIPhone()).toBe(false);
  });

  it('returns false for Chrome on macOS', () => {
    stubUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    expect(isIPhone()).toBe(false);
  });

  it('returns false for Firefox on macOS', () => {
    stubUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
    );
    expect(isIPhone()).toBe(false);
  });

  it('returns false for iPad (out of scope per NFR-26)', () => {
    stubUserAgent(
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    );
    expect(isIPhone()).toBe(false);
  });
});
