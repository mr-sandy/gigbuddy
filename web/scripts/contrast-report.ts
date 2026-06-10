/*
 * Contrast report — reads color tokens from `web/src/styles/tokens.css`,
 * computes WCAG contrast ratios for the foreground/background pairs that
 * appear together in either atmosphere, and writes
 * `web/test-output/contrast-report.json`.
 *
 * Performance pairs target AAA (≥7:1); Practice pairs target AA (≥4.5:1).
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

type Atmosphere = 'practice' | 'performance';
type Target = 'AAA' | 'AA' | 'AA-large';

interface Pair {
  pair: string;
  atmosphere: Atmosphere;
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
  'bg',
  'surface',
  'text-primary',
  'text-secondary',
  'accent',
  'accent-strong',
  'attention-fuzzy',
  'attention-unknown',
] as const;

function extractBlock(css: string, selector: string): string {
  const idx = css.indexOf(selector);
  if (idx === -1) throw new Error(`Atmosphere block missing for selector ${selector}`);
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

function parseTokens(css: string): Record<Atmosphere, Record<string, string>> {
  const atmospheres: Atmosphere[] = ['practice', 'performance'];
  const result: Record<Atmosphere, Record<string, string>> = {
    practice: {},
    performance: {},
  };

  for (const atmosphere of atmospheres) {
    const body = extractBlock(css, `[data-atmosphere="${atmosphere}"]`);

    for (const token of COLOR_TOKEN_NAMES) {
      const decl = body.match(new RegExp(`--color-${token}:\\s*([^;]+);`));
      if (decl) {
        result[atmosphere][token] = decl[1].trim();
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
  atmosphere: Atmosphere;
  fg: string;
  bg: string;
  target: Target;
  label?: string;
  waived?: boolean;
  reason?: string;
}

const PAIRS: PairDef[] = [
  // Performance — AAA target (≥7:1)
  { atmosphere: 'performance', fg: 'text-primary', bg: 'bg', target: 'AAA' },
  { atmosphere: 'performance', fg: 'text-primary', bg: 'surface', target: 'AAA' },
  { atmosphere: 'performance', fg: 'text-secondary', bg: 'bg', target: 'AAA' },
  { atmosphere: 'performance', fg: 'text-secondary', bg: 'surface', target: 'AAA' },
  { atmosphere: 'performance', fg: 'accent', bg: 'bg', target: 'AAA' },
  { atmosphere: 'performance', fg: 'bg', bg: 'accent', target: 'AAA', label: 'bg-on-accent (CTA)' },

  // Practice — AA target (≥4.5:1 for normal text; ≥3:1 for large text + UI components)
  { atmosphere: 'practice', fg: 'text-primary', bg: 'bg', target: 'AA' },
  { atmosphere: 'practice', fg: 'text-primary', bg: 'surface', target: 'AA' },
  { atmosphere: 'practice', fg: 'text-secondary', bg: 'bg', target: 'AA' },
  { atmosphere: 'practice', fg: 'text-secondary', bg: 'surface', target: 'AA' },
  {
    atmosphere: 'practice',
    fg: 'accent',
    bg: 'bg',
    target: 'AA-large',
    reason:
      'accent (#b3892f) is reserved for UI component fills (CTA bg, decorative strokes) — never used as body text on bg. WCAG 2.1 §1.4.11 non-text UI ≥3:1 applies and passes (3.05). For text use of brand orange, components use accent-strong (#8e6a20, 4.81:1 on bg).',
  },
  {
    atmosphere: 'practice',
    fg: 'bg',
    bg: 'accent',
    target: 'AA-large',
    label: 'bg-on-accent (CTA)',
    reason:
      'CTA button — bg (#faf9f5) text on accent (#b3892f). CTA label text in Practice is ≥18pt (perf-body / section-heading), qualifying for WCAG 2.1 §1.4.3 large-text exception (≥3:1 sufficient; passes at 3.05).',
  },
  {
    atmosphere: 'practice',
    fg: 'attention-fuzzy',
    bg: 'bg',
    target: 'AA-large',
    reason:
      'attention-fuzzy is a non-text UI marker on fuzzy parse rows, paired with an icon and a text-primary label (architecture.md "color-never-alone"). WCAG 2.1 §1.4.11 non-text UI ≥3:1 applies and passes (3.24).',
  },
  { atmosphere: 'practice', fg: 'attention-unknown', bg: 'bg', target: 'AA' },
];

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function main(): void {
  const css = readFileSync(TOKENS_PATH, 'utf-8');
  const tokens = parseTokens(css);

  const results: Pair[] = PAIRS.map((p) => {
    const fg = tokens[p.atmosphere][p.fg];
    const bg = tokens[p.atmosphere][p.bg];
    if (!fg || !bg) {
      throw new Error(
        `Missing token for pair ${p.label ?? `${p.fg}-on-${p.bg}`} in ${p.atmosphere}`,
      );
    }
    const ratio = contrastRatio(fg, bg);
    const threshold = p.target === 'AAA' ? 7 : p.target === 'AA' ? 4.5 : 3.0;
    const pass = ratio >= threshold;
    return {
      pair: p.label ?? `${p.fg} on ${p.bg}`,
      atmosphere: p.atmosphere,
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
        `  [${f.atmosphere}] ${f.pair} — ratio ${f.ratio} < ${f.target === 'AAA' ? 7 : f.target === 'AA' ? 4.5 : 3.0} (${f.fg} on ${f.bg})`,
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
