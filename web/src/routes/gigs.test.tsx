import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GIGS } from '../lib/microcopy.js';
import { Gigs } from './gigs.js';

const { useSetlistsMock } = vi.hoisted(() => ({ useSetlistsMock: vi.fn() }));
vi.mock('../hooks/use-setlists.js', () => ({ useSetlists: useSetlistsMock }));

const gig = (setlistId: string, venue: string, date: string) => ({
  setlistId,
  gigMeta: { venue, date },
});

function renderGigs() {
  return render(
    <MemoryRouter>
      <Gigs />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-07T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Gigs (list)', () => {
  it('lists upcoming (incl. today) first, then Past, most recent first', () => {
    useSetlistsMock.mockReturnValue({
      data: [
        gig('a', 'Venue A', '2026-10-31'),
        gig('b', 'Venue B', '2026-11-07'),
        gig('c', 'Venue C', '2026-12-05'),
        gig('d', 'Venue D', '2026-09-12'),
      ],
      isPending: false,
    });
    renderGigs();
    expect(screen.getAllByRole('listitem').map((r) => r.textContent)).toEqual([
      'Sat 7 Nov 2026 · Venue B',
      'Sat 5 Dec 2026 · Venue C',
      'Sat 31 Oct 2026 · Venue A',
      'Sat 12 Sep 2026 · Venue D',
    ]);
    const past = screen.getByRole('heading', { level: 2, name: GIGS.past });
    expect(past.nextElementSibling?.textContent).toBe(
      'Sat 31 Oct 2026 · Venue ASat 12 Sep 2026 · Venue D',
    );
    expect(past.previousElementSibling?.textContent).toBe(
      'Sat 7 Nov 2026 · Venue BSat 5 Dec 2026 · Venue C',
    );
    expect(screen.getByRole('link', { name: /Venue B/ })).toHaveAttribute('href', '/gigs/b');
  });

  it('starts at Past when there are no upcoming gigs', () => {
    useSetlistsMock.mockReturnValue({
      data: [gig('a', 'Venue A', '2026-10-31')],
      isPending: false,
    });
    renderGigs();
    expect(screen.getByRole('heading', { level: 2, name: GIGS.past })).toBeInTheDocument();
    expect(screen.getAllByRole('list')).toHaveLength(1);
  });

  it('has no Past heading when there are no past gigs', () => {
    useSetlistsMock.mockReturnValue({
      data: [gig('a', 'Venue A', '2026-12-05')],
      isPending: false,
    });
    renderGigs();
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });

  it('shows the date alone when the venue is blank', () => {
    useSetlistsMock.mockReturnValue({ data: [gig('a', '  ', '2026-12-05')], isPending: false });
    renderGigs();
    expect(screen.getByRole('listitem').textContent).toBe('Sat 5 Dec 2026');
  });

  it('shows loading, error and empty lines', () => {
    useSetlistsMock.mockReturnValue({ data: undefined, isPending: true });
    const { unmount } = renderGigs();
    expect(screen.getByText(GIGS.loading)).toBeInTheDocument();
    unmount();
    useSetlistsMock.mockReturnValue({ data: undefined, isPending: false, isError: true });
    const second = renderGigs();
    expect(screen.getByText(GIGS.error)).toBeInTheDocument();
    second.unmount();
    useSetlistsMock.mockReturnValue({ data: [], isPending: false });
    renderGigs();
    expect(screen.getByText(GIGS.empty)).toBeInTheDocument();
  });

  it('shows cached data despite a background error', () => {
    useSetlistsMock.mockReturnValue({
      data: [gig('a', 'Venue A', '2026-12-05')],
      isPending: false,
      isError: true,
    });
    renderGigs();
    expect(screen.getByRole('link', { name: /Venue A/ })).toBeInTheDocument();
    expect(screen.queryByText(GIGS.error)).not.toBeInTheDocument();
  });

  it('links Home to /', () => {
    useSetlistsMock.mockReturnValue({ data: [], isPending: false });
    renderGigs();
    expect(screen.getByRole('link', { name: GIGS.backToHome })).toHaveAttribute('href', '/');
  });
});
