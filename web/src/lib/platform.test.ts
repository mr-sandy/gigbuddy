import { afterEach, describe, expect, it, vi } from 'vitest';
import { isIPhone, isStandalone } from './platform.js';

function stubUserAgent(value: string): void {
  vi.stubGlobal('navigator', { ...navigator, userAgent: value });
}

function stubMatchMedia(matches: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

function stubLegacyStandalone(value: boolean | undefined): void {
  vi.stubGlobal('navigator', { ...navigator, standalone: value });
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

describe('isStandalone', () => {
  it('returns true when display-mode standalone matches', () => {
    stubMatchMedia(true);
    stubLegacyStandalone(undefined);
    expect(isStandalone()).toBe(true);
  });

  it('returns true via legacy navigator.standalone even when display-mode does not match', () => {
    stubMatchMedia(false);
    stubLegacyStandalone(true);
    expect(isStandalone()).toBe(true);
  });

  it('returns false when neither signal is truthy', () => {
    stubMatchMedia(false);
    stubLegacyStandalone(undefined);
    expect(isStandalone()).toBe(false);
  });

  it('returns false when navigator.standalone is explicitly false', () => {
    stubMatchMedia(false);
    stubLegacyStandalone(false);
    expect(isStandalone()).toBe(false);
  });
});
