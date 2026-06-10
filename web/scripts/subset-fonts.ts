/*
 * Font subsetting pipeline.
 *
 * Downloads source variable TTFs from the canonical google/fonts repo, then
 * uses `pyftsubset` (fontTools — install via `brew install fonttools`) to
 * produce per-weight WOFF2 files restricted to the glyphs the app uses:
 *
 *   - Basic Latin           (U+0020-007E)
 *   - Latin-1 Supplement    (U+00A0-00FF) — for × ÷ § and friends
 *   - General Punctuation   (U+2000-206F) — en/em dashes, curly quotes, › ‹
 *
 * Output → web/public/fonts/<family>/<file>.woff2 (committed to git).
 * Sources cached under web/scripts/fonts-source/ (gitignored).
 *
 * Run via `pnpm -F web subset:fonts`. Re-run when the microcopy grows new
 * glyphs (rare).
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SOURCE_DIR = resolve(ROOT, 'scripts/fonts-source');
const INSTANCE_DIR = resolve(ROOT, 'scripts/fonts-source/instances');
const OUTPUT_ROOT = resolve(ROOT, 'public/fonts');

const UNICODES = ['U+0020-007E', 'U+00A0-00FF', 'U+2000-206F'].join(',');

interface Variant {
  filename: string;
  axes: string[];
  style: 'normal' | 'italic';
  weight: number;
}

interface FamilyManifest {
  family: string;
  slug: string;
  sources: { sourceUrl: string; sourceFile: string; variants: Variant[] }[];
}

const MANIFEST: FamilyManifest[] = [
  {
    family: 'Lora',
    slug: 'lora',
    sources: [
      {
        sourceUrl:
          'https://raw.githubusercontent.com/google/fonts/main/ofl/lora/Lora%5Bwght%5D.ttf',
        sourceFile: 'Lora[wght].ttf',
        variants: [
          { filename: 'lora-400.woff2', axes: ['wght=400'], style: 'normal', weight: 400 },
          { filename: 'lora-700.woff2', axes: ['wght=700'], style: 'normal', weight: 700 },
        ],
      },
      {
        sourceUrl:
          'https://raw.githubusercontent.com/google/fonts/main/ofl/lora/Lora-Italic%5Bwght%5D.ttf',
        sourceFile: 'Lora-Italic[wght].ttf',
        variants: [
          { filename: 'lora-400-italic.woff2', axes: ['wght=400'], style: 'italic', weight: 400 },
        ],
      },
    ],
  },
  {
    family: 'Inconsolata',
    slug: 'inconsolata',
    sources: [
      {
        sourceUrl:
          'https://raw.githubusercontent.com/google/fonts/main/ofl/inconsolata/Inconsolata%5Bwdth%2Cwght%5D.ttf',
        sourceFile: 'Inconsolata[wdth,wght].ttf',
        variants: [
          {
            filename: 'inconsolata-400.woff2',
            axes: ['wdth=100', 'wght=400'],
            style: 'normal',
            weight: 400,
          },
          {
            filename: 'inconsolata-700.woff2',
            axes: ['wdth=100', 'wght=700'],
            style: 'normal',
            weight: 700,
          },
        ],
      },
    ],
  },
];

function ensureFontToolsAvailable(): void {
  for (const cmd of ['pyftsubset', 'fonttools']) {
    const probe = spawnSync(cmd, ['--help'], { stdio: 'ignore' });
    if (probe.status !== 0) {
      console.error(
        `${cmd} not found. Install with \`brew install fonttools\` (macOS) or \`pip install fonttools[woff]\`.`,
      );
      process.exit(1);
    }
  }
}

async function downloadIfMissing(url: string, dest: string): Promise<void> {
  if (existsSync(dest)) return;
  mkdirSync(dirname(dest), { recursive: true });
  console.log(`download → ${dest}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  const fileStream = createWriteStream(dest);
  await finished(Readable.fromWeb(res.body as never).pipe(fileStream));
}

function instance(sourcePath: string, instancePath: string, axes: string[]): void {
  mkdirSync(dirname(instancePath), { recursive: true });
  execFileSync('fonttools', ['varLib.instancer', sourcePath, ...axes, '-o', instancePath, '--static'], {
    stdio: 'inherit',
  });
}

function subset(instancePath: string, outputPath: string): void {
  mkdirSync(dirname(outputPath), { recursive: true });
  execFileSync(
    'pyftsubset',
    [
      instancePath,
      `--unicodes=${UNICODES}`,
      `--output-file=${outputPath}`,
      '--flavor=woff2',
      '--layout-features=*',
      '--no-hinting',
      '--desubroutinize',
    ],
    { stdio: 'inherit' },
  );
}

async function main(): Promise<void> {
  ensureFontToolsAvailable();
  mkdirSync(SOURCE_DIR, { recursive: true });
  mkdirSync(INSTANCE_DIR, { recursive: true });

  for (const family of MANIFEST) {
    const outDir = resolve(OUTPUT_ROOT, family.slug);
    for (const source of family.sources) {
      const sourcePath = resolve(SOURCE_DIR, source.sourceFile);
      await downloadIfMissing(source.sourceUrl, sourcePath);
      for (const variant of source.variants) {
        const instancePath = resolve(INSTANCE_DIR, `${variant.filename.replace(/\.woff2$/, '')}.ttf`);
        const outputPath = resolve(outDir, variant.filename);
        instance(sourcePath, instancePath, variant.axes);
        subset(instancePath, outputPath);
        unlinkSync(instancePath);
        const size = statSync(outputPath).size;
        console.log(`  ${variant.filename} (${Math.round(size / 1024)} KB)`);
      }
    }
  }

  console.log('Subset complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
