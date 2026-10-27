import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');

function declarations(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]?.trim()]),
  );
}

describe('tokens.css dark copies', () => {
  it('declares the same values for the media block and the forced-dark block', () => {
    const media = css.match(/:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/);
    const forced = css.match(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/);
    expect(media).not.toBeNull();
    expect(forced).not.toBeNull();
    const a = declarations(media?.[1] ?? '');
    expect(Object.keys(a).length).toBeGreaterThan(5);
    expect(declarations(forced?.[1] ?? '')).toEqual(a);
  });
});
