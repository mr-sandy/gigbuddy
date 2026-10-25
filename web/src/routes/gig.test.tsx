import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { GIGS } from '../lib/microcopy.js';
import { Gig } from './gig.js';

const { useSetlistMock, useSetlistsMock } = vi.hoisted(() => ({
  useSetlistMock: vi.fn(),
  useSetlistsMock: vi.fn(),
}));
vi.mock('../hooks/use-setlist.js', () => ({ useSetlist: useSetlistMock }));
vi.mock('../hooks/use-setlists.js', () => ({ useSetlists: useSetlistsMock }));

const gig = (venue: string) => ({ setlistId: 'g1', gigMeta: { venue, date: '2026-11-07' } });

function renderGig() {
  return render(
    <MemoryRouter initialEntries={['/gigs/g1']}>
      <Routes>
        <Route path="/gigs/:setlistId" element={<Gig />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Gig', () => {
  it('shows the venue as h1 and the date beneath', () => {
    useSetlistMock.mockReturnValue({ data: gig('Venue A') });
    useSetlistsMock.mockReturnValue({ data: undefined, isPending: true });
    renderGig();
    expect(screen.getByRole('heading', { level: 1, name: 'Venue A' })).toBeInTheDocument();
    expect(screen.getByText('Sat 7 Nov 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: GIGS.backToGigs })).toHaveAttribute('href', '/gigs');
  });

  it('uses the date as the title when the venue is blank', () => {
    useSetlistMock.mockReturnValue({ data: gig(' ') });
    useSetlistsMock.mockReturnValue({ data: undefined, isPending: true });
    const { container } = renderGig();
    expect(screen.getByRole('heading', { level: 1, name: 'Sat 7 Nov 2026' })).toBeInTheDocument();
    expect(container.querySelectorAll('p').length).toBe(0);
  });

  it('falls back to the list cache', () => {
    useSetlistMock.mockReturnValue({ data: undefined, isPending: true });
    useSetlistsMock.mockReturnValue({ data: [gig('Cached Venue')], isPending: false });
    renderGig();
    expect(screen.getByRole('heading', { name: 'Cached Venue' })).toBeInTheDocument();
  });

  it('shows not found with the back link', () => {
    useSetlistMock.mockReturnValue({ data: null, isPending: false });
    useSetlistsMock.mockReturnValue({ data: [], isPending: false });
    renderGig();
    expect(screen.getByText(GIGS.notFound)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: GIGS.backToGigs })).toHaveAttribute('href', '/gigs');
  });

  it('shows loading', () => {
    useSetlistMock.mockReturnValue({ data: undefined, isPending: true });
    useSetlistsMock.mockReturnValue({ data: undefined, isPending: true });
    renderGig();
    expect(screen.getByText(GIGS.loading)).toBeInTheDocument();
  });
});
