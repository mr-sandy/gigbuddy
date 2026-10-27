import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyTheme,
  readThemeChoice,
  saveThemeChoice,
  THEME_COLOR,
  THEME_STORAGE_KEY,
} from './theme.js';

function metas() {
  return [...document.querySelectorAll('meta[name="theme-color"]')];
}

describe('theme', () => {
  beforeEach(() => {
    for (const [content, media] of [
      ['#faf9f5', '(prefers-color-scheme: light)'],
      ['#1a1209', '(prefers-color-scheme: dark)'],
    ]) {
      const m = document.createElement('meta');
      m.setAttribute('name', 'theme-color');
      m.setAttribute('content', content as string);
      m.setAttribute('media', media as string);
      document.head.appendChild(m);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    for (const m of metas()) m.remove();
  });

  it('reads System for a missing key, an unknown value and a throwing getItem', () => {
    expect(readThemeChoice()).toBe('system');
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    expect(readThemeChoice()).toBe('system');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readThemeChoice()).toBe('system');
  });

  it('round-trips Light and Dark, and System removes the key', () => {
    saveThemeChoice('dark');
    expect(readThemeChoice()).toBe('dark');
    saveThemeChoice('light');
    expect(readThemeChoice()).toBe('light');
    saveThemeChoice('system');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(readThemeChoice()).toBe('system');
  });

  it('sets data-theme and both theme-color metas, then restores them for System', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(metas().map((m) => m.getAttribute('content'))).toEqual([
      THEME_COLOR.dark,
      THEME_COLOR.dark,
    ]);
    applyTheme('light');
    expect(metas().map((m) => m.getAttribute('content'))).toEqual([
      THEME_COLOR.light,
      THEME_COLOR.light,
    ]);
    applyTheme('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(metas().map((m) => m.getAttribute('content'))).toEqual([
      THEME_COLOR.light,
      THEME_COLOR.dark,
    ]);
  });

  it('still applies the theme when setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    saveThemeChoice('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
