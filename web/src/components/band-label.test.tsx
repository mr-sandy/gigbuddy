import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BandLabel } from './band-label.js';

describe('BandLabel', () => {
  it('renders the brand-band text', () => {
    render(<BandLabel />);
    expect(screen.getByText(/GigBuddy · The Jack Ruby 5/)).toBeInTheDocument();
  });

  it('renders as a non-interactive <span> with no a11y/interaction attributes (AC-1)', () => {
    render(<BandLabel />);
    const node = screen.getByText(/GigBuddy · The Jack Ruby 5/);
    expect(node.tagName).toBe('SPAN');
    expect(node.getAttribute('tabindex')).toBeNull();
    expect(node.getAttribute('role')).toBeNull();
    expect(node.getAttribute('aria-label')).toBeNull();
    expect(node.getAttribute('onclick')).toBeNull();
  });
});
