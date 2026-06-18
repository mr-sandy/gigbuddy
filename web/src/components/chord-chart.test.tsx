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
});
