import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const inline = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';

function metas() {
  return [...document.querySelectorAll('meta[name="theme-color"]')];
}

describe('index.html pre-paint theme script', () => {
  beforeEach(() => {
    for (const content of ['#faf9f5', '#1a1209']) {
      const m = document.createElement('meta');
      m.setAttribute('name', 'theme-color');
      m.setAttribute('content', content);
      document.head.appendChild(m);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    for (const m of metas()) m.remove();
  });

  const run = () => new Function(inline)();
  const colours = () => metas().map((m) => m.getAttribute('content'));

  it('sits before the module entry script', () => {
    expect(inline).not.toBe('');
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('type="module"'));
  });

  it('applies a stored dark choice', () => {
    localStorage.setItem('gigbuddy-theme', 'dark');
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(colours()).toEqual(['#1a1209', '#1a1209']);
  });

  it('applies a stored light choice', () => {
    localStorage.setItem('gigbuddy-theme', 'light');
    run();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(colours()).toEqual(['#faf9f5', '#faf9f5']);
  });

  it('does nothing for nothing stored or junk', () => {
    run();
    localStorage.setItem('gigbuddy-theme', 'purple');
    run();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(colours()).toEqual(['#faf9f5', '#1a1209']);
  });

  it('survives unreadable storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(run).not.toThrow();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
