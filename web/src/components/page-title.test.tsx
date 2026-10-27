import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageTitle } from './page-title.js';

describe('PageTitle', () => {
  it('renders a level-1 heading with the given text', () => {
    render(<PageTitle>Songs</PageTitle>);
    expect(screen.getByRole('heading', { level: 1, name: 'Songs' })).toBeInTheDocument();
  });
});
