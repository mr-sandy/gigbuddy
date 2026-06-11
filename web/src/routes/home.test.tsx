import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { EMPTY_STATES } from '../lib/microcopy.js';
import { Home } from './home.js';

describe('Home (Setlists empty state)', () => {
  it('renders the locked empty-state copy from EMPTY_STATES', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText(EMPTY_STATES.noUpcomingGigs)).toBeInTheDocument();
  });

  it('renders no buttons and no links — no CTA in the empty state (AC-4)', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('exposes a Setlists h1 to the accessibility tree (sr-only but discoverable)', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    const heading = screen.getByRole('heading', { level: 1, name: 'Setlists' });
    expect(heading).toBeInTheDocument();
  });
});
