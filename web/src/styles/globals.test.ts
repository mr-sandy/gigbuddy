import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

describe('globals.css bottom-bar scroll padding (Story 7.23)', () => {
  // jsdom can't scroll; this guards against the rules being dropped.
  it.each([
    ['tab', '--spacing-tab-bar'],
    ['play', '--spacing-play-bar'],
  ])('pads scrolling for the %s bar', (bar, token) => {
    const rule = css.match(
      new RegExp(`html:has\\(\\[data-bottom-bar="${bar}"\\]\\)\\s*\\{([^}]*)\\}`),
    );
    expect(rule).not.toBeNull();
    expect(rule?.[1]).toMatch(/scroll-padding-bottom:/);
    expect(rule?.[1]).toContain(`var(${token})`);
  });
});
