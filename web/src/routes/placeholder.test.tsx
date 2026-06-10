import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Placeholder } from './placeholder.js';

describe('Placeholder', () => {
  it('renders the GigBuddy heading on initial mount', () => {
    render(<Placeholder />);
    expect(screen.getByRole('heading', { name: 'GigBuddy' })).toBeInTheDocument();
  });
});
