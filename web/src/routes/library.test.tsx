import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { EMPTY_STATES } from '../lib/microcopy.js';
import { Library } from './library.js';

describe('Library (empty state)', () => {
  it('renders the locked empty-state copy from EMPTY_STATES', () => {
    render(
      <MemoryRouter>
        <Library />
      </MemoryRouter>,
    );
    expect(screen.getByText(EMPTY_STATES.noSongsInLibrary)).toBeInTheDocument();
  });

  it('renders no row affordances — no buttons, no links (AC-5)', () => {
    render(
      <MemoryRouter>
        <Library />
      </MemoryRouter>,
    );
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('exposes a Library h1 to the accessibility tree', () => {
    render(
      <MemoryRouter>
        <Library />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument();
  });
});
