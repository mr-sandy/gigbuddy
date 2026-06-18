import type { JSX, ReactNode } from 'react';

/*
 * Chord chart V1 floor (UX-DR5, EXPERIENCE.md "Chord chart").
 *
 * Parsing rules:
 *   - A line matching `^\s*\{[^}]*\}\s*$` is a section break. The inner
 *     content (between the braces) renders centered in mono-slab caps via
 *     CSS `text-transform: uppercase`. The underlying text is unchanged.
 *   - Blank lines (whitespace-only) render as a one-line vertical gap.
 *     Consecutive blanks are NOT collapsed — the architecture's "blank
 *     lines preserved" rule applies literally.
 *   - Every other line renders as monospaced text at perf-chord size.
 *
 * URL handling — `urlsTappable` is set by the route from
 * `document.documentElement.dataset.atmosphere` (Practice → true,
 * Performance → false). Performance is silent: URLs render as plain
 * inert text (no anchor, no color shift). Practice wraps each URL in an
 * `<a target="_blank" rel="noopener noreferrer">`. The regex is the V1
 * floor (`https?:\/\/\S+`) — not RFC-compliant; pragmatically sufficient.
 *
 * Honest-empty: a text of zero non-whitespace characters renders nothing
 * (no empty box, no placeholder — EXPERIENCE.md State Patterns).
 */

const SECTION_REGEX = /^\s*\{([^}]*)\}\s*$/;
const URL_REGEX = /(https?:\/\/\S+)/g;

type Props = {
  text: string;
  urlsTappable: boolean;
};

export function ChordChart({ text, urlsTappable }: Props): JSX.Element | null {
  if (text.trim() === '') return null;

  const lines = text.split('\n');

  return (
    <div data-testid="chord-chart" className="flex flex-col">
      {lines.map((line, idx) => {
        const sectionMatch = line.match(SECTION_REGEX);
        if (sectionMatch) {
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: line ordering is the identity here
              key={idx}
              data-chord-chart-section=""
              className="mt-[calc(var(--spacing-unit)*4)] mb-[calc(var(--spacing-unit)*2)] text-center uppercase tracking-[0.08em] text-[length:var(--text-perf-meta)] leading-[var(--text-perf-meta--line-height)] text-[color:var(--color-text-secondary)] [font-family:var(--font-mono-slab)]"
            >
              {sectionMatch[1]?.trim() ?? ''}
            </div>
          );
        }
        if (line.trim() === '') {
          return (
            <pre
              // biome-ignore lint/suspicious/noArrayIndexKey: line ordering is the identity here
              key={idx}
              data-chord-chart-blank=""
              aria-hidden="true"
              className="text-[length:var(--text-perf-chord)] leading-[var(--text-perf-chord--line-height)] [font-family:var(--font-mono-slab)]"
            >
              {' '}
            </pre>
          );
        }
        return (
          <pre
            // biome-ignore lint/suspicious/noArrayIndexKey: line ordering is the identity here
            key={idx}
            data-chord-chart-line=""
            className="text-[length:var(--text-perf-chord)] leading-[var(--text-perf-chord--line-height)] text-[color:var(--color-text-primary)] [font-family:var(--font-mono-slab)]"
          >
            {renderLineContent(line, urlsTappable)}
          </pre>
        );
      })}
    </div>
  );
}

function renderLineContent(line: string, urlsTappable: boolean): ReactNode {
  if (!urlsTappable) return line;
  const parts = line.split(URL_REGEX);
  return parts.map((part, idx) => {
    if (/^https?:\/\/\S+$/.test(part)) {
      return (
        <a
          // biome-ignore lint/suspicious/noArrayIndexKey: split-index is the identity here
          key={idx}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[color:var(--color-accent)] underline hover:text-[color:var(--color-accent-strong)]"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}
