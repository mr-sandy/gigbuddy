import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChordChart } from './chord-chart.js';

describe('ChordChart', () => {
  it('renders plain monospace lines as content lines', () => {
    const { container } = render(<ChordChart text="Dm  A7  Dm" urlsTappable />);
    const lines = container.querySelectorAll('[data-chord-chart-line]');
    expect(lines).toHaveLength(1);
    expect(lines[0]?.textContent).toBe('Dm  A7  Dm');
  });

  it('preserves consecutive blank lines (does not collapse them)', () => {
    // 'foo\n\n\nbar' → split('\n') = ['foo', '', '', 'bar'] = 1 content + 2 blanks + 1 content
    const { container } = render(<ChordChart text={'foo\n\n\nbar'} urlsTappable />);
    const blanks = container.querySelectorAll('[data-chord-chart-blank]');
    expect(blanks).toHaveLength(2);
    const contentLines = container.querySelectorAll('[data-chord-chart-line]');
    expect(contentLines).toHaveLength(2);
  });

  it('renders a {Section} line as a section element with the inner text (no braces)', () => {
    const { container } = render(<ChordChart text="{Verse 1}" urlsTappable />);
    const sections = container.querySelectorAll('[data-chord-chart-section]');
    expect(sections).toHaveLength(1);
    expect(sections[0]?.textContent).toBe('Verse 1');
  });

  it('renders a URL inside a content line as an <a> when urlsTappable=true', () => {
    render(<ChordChart text="See https://example.com" urlsTappable />);
    const link = screen.getByRole('link', { name: 'https://example.com' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders a URL inside a content line as plain text when urlsTappable=false', () => {
    const { container } = render(
      <ChordChart text="See https://example.com" urlsTappable={false} />,
    );
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('https://example.com');
  });

  it('renders nothing when text is empty', () => {
    const { container } = render(<ChordChart text="" urlsTappable />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when text is whitespace-only', () => {
    const { container } = render(<ChordChart text={'   \n\n   '} urlsTappable />);
    expect(container.firstChild).toBeNull();
  });

  it('renders mixed sections, blank lines, content, and URLs in order', () => {
    const text = ['{Verse}', 'Dm  A7  Dm', '', '{Chorus}', 'https://example.com'].join('\n');
    const { container } = render(<ChordChart text={text} urlsTappable />);
    const elements = container.querySelectorAll(
      '[data-chord-chart-section], [data-chord-chart-blank], [data-chord-chart-line]',
    );
    const kinds = Array.from(elements).map((el) => {
      if (el.hasAttribute('data-chord-chart-section')) return 'section';
      if (el.hasAttribute('data-chord-chart-blank')) return 'blank';
      return 'line';
    });
    expect(kinds).toEqual(['section', 'line', 'blank', 'section', 'line']);
  });

  // Story 6.1 — compact chord-glyph notation composition with existing pipeline.

  it('preserves multi-space chord alignment and superscripts each chord suffix', () => {
    const { container } = render(<ChordChart text="Dm    A7    Dm" urlsTappable={false} />);
    const line = container.querySelector('[data-chord-chart-line]');
    expect(line).not.toBeNull();
    // Whitespace runs preserved verbatim inside the <pre>.
    expect(line?.textContent).toBe('Dm    A7    Dm');
    // Each of the three tokens produces one <sup> (m, 7, m).
    const sups = line?.querySelectorAll('sup') ?? [];
    expect(sups).toHaveLength(3);
    expect(Array.from(sups).map((s) => s.textContent)).toEqual(['m', '7', 'm']);
  });

  it('does not superscript anything inside a {Section} heading line', () => {
    const { container } = render(<ChordChart text="{Verse 1}" urlsTappable={false} />);
    const section = container.querySelector('[data-chord-chart-section]');
    expect(section).not.toBeNull();
    expect(section?.textContent).toBe('Verse 1');
    // Section-heading branch is untouched by Story 6.1.
    expect(section?.querySelector('sup')).toBeNull();
  });

  it('never chord-tokenizes a URL segment (no <sup> appears inside the anchor text)', () => {
    render(<ChordChart text="See https://example.com" urlsTappable />);
    const link = screen.getByRole('link', { name: 'https://example.com' });
    expect(link.textContent).toBe('https://example.com');
    expect(link.querySelector('sup')).toBeNull();
  });

  it('never chord-tokenizes a URL segment when urlsTappable=false either (plain text URL, no <sup> inside it)', () => {
    const { container } = render(
      <ChordChart text="Dm https://example.com A7" urlsTappable={false} />,
    );
    const line = container.querySelector('[data-chord-chart-line]');
    expect(line?.textContent).toBe('Dm https://example.com A7');
    // The URL itself is not chord-tokenized — only Dm and A7 produce <sup>.
    const sups = line?.querySelectorAll('sup') ?? [];
    expect(Array.from(sups).map((s) => s.textContent)).toEqual(['m', '7']);
  });

  it('renders a line mixing malformed and valid tokens: malformed verbatim, valid transformed, order preserved', () => {
    const { container } = render(<ChordChart text="Dm H7 A7" urlsTappable={false} />);
    const line = container.querySelector('[data-chord-chart-line]');
    expect(line).not.toBeNull();
    // Textually the line is unchanged.
    expect(line?.textContent).toBe('Dm H7 A7');
    // Only Dm and A7 produce <sup> — H7 falls back verbatim.
    const sups = line?.querySelectorAll('sup') ?? [];
    expect(Array.from(sups).map((s) => s.textContent)).toEqual(['m', '7']);
  });

  it('renders Dbmaj7 with the △ symbol at baseline (no <sup> for maj7)', () => {
    const { container } = render(<ChordChart text="Dbmaj7" urlsTappable={false} />);
    const line = container.querySelector('[data-chord-chart-line]');
    expect(line?.textContent).toBe('Db△');
    expect(line?.querySelector('sup')).toBeNull();
  });
});
