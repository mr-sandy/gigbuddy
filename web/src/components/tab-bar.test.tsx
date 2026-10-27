import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { TabBar } from './tab-bar.js';

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <TabBar />
    </MemoryRouter>,
  );
}

describe('TabBar', () => {
  it('links to Songs and Gigs and marks Songs current at /songs', () => {
    renderAt('/songs');
    expect(screen.getByRole('navigation', { name: 'Lists' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Songs' })).toHaveAttribute('href', '/songs');
    expect(screen.getByRole('link', { name: 'Gigs' })).toHaveAttribute('href', '/gigs');
    expect(screen.getByRole('link', { name: 'Songs' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Gigs' })).not.toHaveAttribute('aria-current');
  });

  it('marks Gigs current at /gigs', () => {
    renderAt('/gigs');
    expect(screen.getByRole('link', { name: 'Gigs' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Songs' })).not.toHaveAttribute('aria-current');
  });
});
