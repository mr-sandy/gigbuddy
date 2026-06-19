import { ACTIVE_BAND_ID, type Setlist } from '@gigbuddy/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { GigCard } from './gig-card.js';

function makeSetlist(
  overrides: Partial<Setlist['gigMeta']> & { setlistId?: string } = {},
): Setlist {
  const { setlistId = 'setlist000000001', ...gigOverrides } = overrides;
  return {
    bandId: ACTIVE_BAND_ID,
    setlistId,
    gigMeta: {
      venue: 'The Jazz Cafe',
      date: '2026-06-21',
      time: '20:00',
      ...gigOverrides,
    },
    sections: [],
    clientWrittenAt: '2026-06-19T10:00:00.000Z',
    serverReceivedAt: '2026-06-19T10:00:01.000Z',
    version: 1 as const,
  };
}

function renderCard(setlist: Setlist, showBadge = false) {
  // Two routes so we can assert navigation happens on click.
  const router = createMemoryRouter(
    createRoutesFromElements(
      <>
        <Route path="/" element={<GigCard setlist={setlist} showBadge={showBadge} />} />
        <Route path="/setlists/:setlistId" element={<p>setlist destination</p>} />
      </>,
    ),
    { initialEntries: ['/'] },
  );
  return { ...render(<RouterProvider router={router} />), router };
}

describe('GigCard', () => {
  it('renders the venue text', () => {
    renderCard(makeSetlist({ venue: 'The Blue Note' }));
    expect(screen.getByText('The Blue Note')).toBeInTheDocument();
  });

  it('renders the date in a human-readable format', () => {
    renderCard(makeSetlist({ date: '2026-06-21', time: undefined }));
    // Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    // → "21 Jun 2026"
    expect(screen.getByText(/21 Jun 2026/)).toBeInTheDocument();
  });

  it('renders the time alongside the date when present', () => {
    renderCard(makeSetlist({ date: '2026-06-21', time: '20:00' }));
    expect(screen.getByText(/21 Jun 2026.*20:00/)).toBeInTheDocument();
  });

  it('omits the time when absent', () => {
    renderCard(makeSetlist({ date: '2026-06-21', time: undefined }));
    const button = screen.getByRole('button');
    expect(button.textContent).toContain('21 Jun 2026');
    expect(button.textContent).not.toContain('·');
  });

  it('renders the TONIGHT badge when showBadge is true', () => {
    renderCard(makeSetlist(), true);
    expect(screen.getByText('TONIGHT')).toBeInTheDocument();
  });

  it('does NOT render the TONIGHT badge when showBadge is false (default)', () => {
    renderCard(makeSetlist());
    expect(screen.queryByText('TONIGHT')).toBeNull();
  });

  it('composes the aria-label from venue + date + time + Tonight when badged', () => {
    renderCard(makeSetlist({ venue: 'The Jazz Cafe', date: '2026-06-21', time: '20:00' }), true);
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-label')).toBe('The Jazz Cafe, 21 Jun 2026, 20:00, Tonight');
  });

  it('omits the Tonight suffix from aria-label when no badge is shown', () => {
    renderCard(makeSetlist({ venue: 'The Jazz Cafe', date: '2026-06-21', time: '20:00' }));
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-label')).toBe('The Jazz Cafe, 21 Jun 2026, 20:00');
  });

  it('omits time from aria-label when absent', () => {
    renderCard(makeSetlist({ venue: 'The Jazz Cafe', date: '2026-06-21', time: undefined }));
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-label')).toBe('The Jazz Cafe, 21 Jun 2026');
  });

  it('navigates to /setlists/:setlistId when clicked', async () => {
    const user = userEvent.setup();
    const { router } = renderCard(makeSetlist({ setlistId: 'abc123def456ghij' }));
    expect(router.state.location.pathname).toBe('/');
    await user.click(screen.getByRole('button'));
    expect(router.state.location.pathname).toBe('/setlists/abc123def456ghij');
  });

  it('renders as a <button> with type="button" (not an <a>)', () => {
    renderCard(makeSetlist());
    const button = screen.getByRole('button');
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('applies the min-h-tap utility on the card', () => {
    renderCard(makeSetlist());
    const button = screen.getByRole('button');
    expect(button.className).toContain('min-h-tap');
  });
});
