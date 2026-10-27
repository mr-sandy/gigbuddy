import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BandName, PageHeader } from './page-header.js';

describe('PageHeader', () => {
  it('renders left and right content', () => {
    render(<PageHeader left={<span>Left</span>} right={<span>Right</span>} />);
    expect(screen.getByText('Left')).toBeInTheDocument();
    expect(screen.getByText('Right')).toBeInTheDocument();
  });

  it('keeps an empty left slot so the right content stays right', () => {
    const { container } = render(<PageHeader right={<span>Right</span>} />);
    const header = container.querySelector('header');
    expect(header?.children).toHaveLength(2);
    expect(header?.children[0]).toBeEmptyDOMElement();
  });
});

describe('BandName', () => {
  it('shows the band name as plain text, not a link, button or heading', () => {
    render(<BandName />);
    expect(screen.getByText('The Jack Ruby 5').tagName).toBe('P');
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
