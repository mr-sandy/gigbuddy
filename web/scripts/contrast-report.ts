/*
 * Contrast report — reads color tokens from `web/src/styles/tokens.css`,
 * computes WCAG contrast ratios for the foreground/background pairs that
 * appear together in either variant (light / dark), and writes
 * `web/test-output/contrast-report.json`.
 *
 * All text pairs target AA (≥4.5:1) in both variants; field borders target
 * 3:1 (WCAG 1.4.11 non-text contrast).
 *
 * Exits non-zero if any pair fails its target unless that pair is explicitly
 * waived inside this file. CI wires this into `pnpm test` so a token edit
 * cannot land without a fresh, passing (or waived) report.
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKENS_PATH = resolve(__dirname, '../src/styles/tokens.css');
const OUTPUT_PATH = resolve(__dirname, '../test-output/contrast-report.json');

type Variant = 'light' | 'dark';
type Target = 'AAA' | 'AA' | 'AA-large' | 'UI';

interface Pair {
  pair: string;
  variant: Variant;
  fgToken: string;
  bgToken: string;
  fg: string;
  bg: string;
  ratio: number;
  target: Target;
  pass: boolean;
  waived?: boolean;
  reason?: string;
}

const COLOR_TOKEN_NAMES = [
  'background',
  'foreground',
  'muted',
  'muted-foreground',
  'primary',
  'primary-foreground',
  'destructive',
  'destructive-foreground',
  'input',
] as const;

function extractBlock(css: string, selector: string): string {
  const idx = css.indexOf(selector);
  if (idx === -1) throw new Error(`Block missing for selector ${selector}`);
  const open = css.indexOf('{', idx);
  if (open === -1) throw new Error(`No opening brace for ${selector}`);
  let depth = 0;
  let close = -1;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) { close = i; break; }
    }
  }
  if (close === -1) throw new Error(`Unclosed block for ${selector}`);
  return css.slice(open + 1, close);
}

function parseTokens(css: string): Record<Variant, Record<string, string>> {
  const result: Record<Variant, Record<string, string>> = {
    light: {},
    dark: {},
  };

  // Strip comments first so prose in the header comment can't match a selector.
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // The light palette is the first `:root` block, which must precede the
  // dark `@media` block.
  const lightBody = extractBlock(code, ':root');
  const mediaBody = extractBlock(code, '@media (prefers-color-scheme: dark)');
  const darkBody = extractBlock(mediaBody, ':root');

  const bodies: Record<Variant, string> = { light: lightBody, dark: darkBody };
  for (const variant of ['light', 'dark'] as const) {
    for (const token of COLOR_TOKEN_NAMES) {
      const decl = bodies[variant].match(new RegExp(`(?:^|[\\s;{])--${token}:\\s*([^;]+);`));
      if (decl) {
        result[variant][token] = decl[1].trim();
      }
    }
  }

  return result;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(fg: string, bg: string): number {
  const lFg = relativeLuminance(fg);
  const lBg = relativeLuminance(bg);
  const [lighter, darker] = lFg > lBg ? [lFg, lBg] : [lBg, lFg];
  return (lighter + 0.05) / (darker + 0.05);
}

interface PairDef {
  variant: Variant;
  fg: string;
  bg: string;
  target: Target;
  label?: string;
  waived?: boolean;
  reason?: string;
}

const TEXT_PAIRS: [string, string][] = [
  ['foreground', 'background'],
  ['muted-foreground', 'background'],
  ['foreground', 'muted'],
  ['muted-foreground', 'muted'],
  ['primary', 'background'],
  ['primary-foreground', 'primary'],
  ['destructive', 'background'],
  ['destructive-foreground', 'destructive'],
];

const PAIRS: PairDef[] = (['light', 'dark'] as const).flatMap((variant) => [
  ...TEXT_PAIRS.map(
    ([fg, bg]): PairDef => ({ variant, fg, bg, target: 'AA' }),
  ),
  // Field borders: non-text UI, WCAG 1.4.11.
  { variant, fg: 'input', bg: 'background', target: 'UI' },
]);

function thresholdFor(target: Target): number {
  return target === 'AAA' ? 7 : target === 'AA' ? 4.5 : 3.0;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function main(): void {
  const css = readFileSync(TOKENS_PATH, 'utf-8');
  const tokens = parseTokens(css);

  const results: Pair[] = PAIRS.map((p) => {
    const fg = tokens[p.variant][p.fg];
    const bg = tokens[p.variant][p.bg];
    if (!fg || !bg) {
      throw new Error(`Missing token for pair ${p.label ?? `${p.fg}-on-${p.bg}`} in ${p.variant}`);
    }
    const ratio = contrastRatio(fg, bg);
    const threshold = thresholdFor(p.target);
    const pass = ratio >= threshold;
    return {
      pair: p.label ?? `${p.fg} on ${p.bg}`,
      variant: p.variant,
      fgToken: p.fg,
      bgToken: p.bg,
      fg,
      bg,
      ratio: round(ratio),
      target: p.target,
      pass,
      ...(p.waived ? { waived: true, reason: p.reason } : {}),
    };
  });

  const failing = results.filter((r) => !r.pass && !r.waived);

  const report = {
    tokensSource: 'web/src/styles/tokens.css',
    summary: {
      total: results.length,
      passing: results.filter((r) => r.pass).length,
      failing: failing.length,
      waived: results.filter((r) => r.waived).length,
    },
    pairs: results,
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  if (failing.length > 0) {
    console.error('Contrast report: pairs failing their target:');
    for (const f of failing) {
      console.error(
        `  [${f.variant}] ${f.pair} — ratio ${f.ratio} < ${thresholdFor(f.target)} (${f.fg} on ${f.bg})`,
      );
    }
    process.exit(1);
  }

  console.log(
    `Contrast report: ${report.summary.passing}/${report.summary.total} pairs pass (${report.summary.waived} waived).`,
  );
  console.log(`Written: ${OUTPUT_PATH}`);
}

main();
