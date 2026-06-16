import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const distDir = join(webRoot, 'dist');
const distSw = join(distDir, 'sw.js');
const distManifest = join(distDir, 'manifest.webmanifest');

describe('PWA build output', () => {
  beforeAll(() => {
    if (existsSync(distSw) && existsSync(distManifest)) return;
    execSync('pnpm --filter web run build', {
      cwd: resolve(webRoot, '..'),
      stdio: 'inherit',
      timeout: 90_000,
    });
  });

  it('emits sw.js with the expected runtime cache names', () => {
    const sw = readFileSync(distSw, 'utf-8');
    expect(sw).toContain('api-cache-v1');
    expect(sw).toContain('app-shell-v1');
  });

  it('does not call self.skipWaiting() unconditionally in the generated SW', () => {
    // Workbox 7.4.1's sw-template ALWAYS emits a conditional SKIP_WAITING message
    // handler (sw-template.ts lines 33-39) when skipWaiting: false, so the literal
    // text `self.skipWaiting()` appears inside that handler. That handler is dead
    // code in V1 because registerType: 'prompt' makes registerSW.js not post the
    // SKIP_WAITING message, and no UI code does either. The load-bearing assertion
    // is that there is NO UNCONDITIONAL skipWaiting() call (which Workbox emits as
    // a bare `self.skipWaiting();` statement at top level when skipWaiting: true).
    const sw = readFileSync(distSw, 'utf-8');
    // No unconditional `self.skipWaiting();` (trailing semicolon ≡ statement form).
    expect(sw).not.toMatch(/self\.skipWaiting\(\);/);
    // Conditional handler IS present — proves Workbox config produced the
    // skipWaiting: false branch of its template.
    expect(sw).toMatch(/SKIP_WAITING/);
    // No unconditional clients.claim() (Workbox only emits this when clientsClaim: true).
    expect(sw).not.toMatch(/clients\.claim\(\)/);
  });

  it('emits a manifest.webmanifest with the expected install metadata', () => {
    const raw = readFileSync(distManifest, 'utf-8');
    const manifest = JSON.parse(raw);
    expect(manifest.name).toBe('GigBuddy');
    expect(manifest.short_name).toBe('GigBuddy');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.theme_color).toBe('#1a1209');
    expect(manifest.background_color).toBe('#1a1209');
    expect(manifest.orientation).toBe('portrait');
    expect(manifest.icons).toHaveLength(3);
    const purposes = manifest.icons.map((i: { purpose?: string }) => i.purpose ?? 'any');
    expect(purposes).toContain('maskable');
  });

  it('every manifest icon path resolves to a real file in dist', () => {
    const manifest = JSON.parse(readFileSync(distManifest, 'utf-8'));
    for (const icon of manifest.icons as Array<{ src: string }>) {
      const rel = icon.src.replace(/^\//, '');
      expect(existsSync(join(distDir, rel)), `icon missing: ${icon.src}`).toBe(true);
    }
  });

  it('emits apple-touch-icon-180x180.png referenced by index.html', () => {
    expect(existsSync(join(distDir, 'icons', 'apple-touch-icon-180x180.png'))).toBe(true);
  });

  it('emits a <link rel="manifest"> tag in the built index.html', () => {
    const indexHtml = readFileSync(join(distDir, 'index.html'), 'utf-8');
    expect(indexHtml).toMatch(/<link\s+rel="manifest"\s+href="\/manifest\.webmanifest"/);
  });
});
