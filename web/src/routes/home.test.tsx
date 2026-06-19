import { ACTIVE_BAND_ID, type Setlist } from '@gigbuddy/shared';
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_STATES } from '../lib/microcopy.js';
import { Home } from './home.js';

const { useSetlistsMock } = vi.hoisted(() => ({ useSetlistsMock: vi.fn() }));
vi.mock('../hooks/use-setlists.js', () => ({ useSetlists: useSetlistsMock }));

function makeSetlist(setlistId: string, date: string, venue = 'Venue'): Setlist {
  return {
    bandId: ACTIVE_BAND_ID,
    setlistId,
    gigMeta: { venue, date, time: '20:00' },
    sections: [],
    clientWrittenAt: '2026-06-19T10:00:00.000Z',
    serverReceivedAt: '2026-06-19T10:00:01.000Z',
    version: 1 as const,
  };
}

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useSetlistsMock.mockReset();
  vi.useFakeTimers({ toFake: ['Date'] });
  // 12:00 UTC ≡ mid-day London → "2026-06-21" in Europe/London.
  vi.setSystemTime(new Date('2026-06-21T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Home (Setlists home)', () => {
  it('exposes a Setlists h1 to the accessibility tree (sr-only but discoverable)', () => {
    useSetlistsMock.mockReturnValue({ data: [], isPending: false });
    renderHome();
    expect(screen.getByRole('heading', { level: 1, name: 'Setlists' })).toBeInTheDocument();
  });

  it('always renders the Tonight heading', () => {
    useSetlistsMock.mockReturnValue({ data: [], isPending: false });
    renderHome();
    expect(screen.getByRole('heading', { level: 2, name: 'Tonight' })).toBeInTheDocument();
  });

  it('renders the locked empty-state copy when there is no today gig and no upcoming', () => {
    useSetlistsMock.mockReturnValue({
      data: [makeSetlist('past', '2026-05-01')],
      isPending: false,
    });
    renderHome();
    expect(screen.getByText(EMPTY_STATES.noUpcomingGigs)).toBeInTheDocument();
  });

  it('renders no create-new-setlist CTA in the empty state (AC-4)', () => {
    useSetlistsMock.mockReturnValue({ data: [], isPending: false });
    renderHome();
    // No new-setlist links/buttons should appear in the empty state.
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('promotes the today-dated setlist to Tonight with the TONIGHT badge', () => {
    const today = makeSetlist('today1', '2026-06-21', 'The Jazz Cafe');
    useSetlistsMock.mockReturnValue({ data: [today], isPending: false });
    renderHome();
    const tonightSection = screen
      .getByRole('heading', { level: 2, name: 'Tonight' })
      .closest('section');
    expect(tonightSection).not.toBeNull();
    expect(within(tonightSection as HTMLElement).getByText('TONIGHT')).toBeInTheDocument();
    expect(within(tonightSection as HTMLElement).getByText('The Jazz Cafe')).toBeInTheDocument();
  });

  it('promotes the soonest upcoming setlist to Tonight WITHOUT the TONIGHT badge when no today gig', () => {
    const soon = makeSetlist('soon', '2026-06-22', 'Tomorrow Venue');
    const later = makeSetlist('later', '2026-07-01', 'Later Venue');
    useSetlistsMock.mockReturnValue({ data: [soon, later], isPending: false });
    renderHome();
    const tonightSection = screen
      .getByRole('heading', { level: 2, name: 'Tonight' })
      .closest('section');
    expect(tonightSection).not.toBeNull();
    expect(within(tonightSection as HTMLElement).queryByText('TONIGHT')).toBeNull();
    expect(within(tonightSection as HTMLElement).getByText('Tomorrow Venue')).toBeInTheDocument();
    // The promoted setlist must NOT also appear in Upcoming.
    const upcomingHeading = screen.getByRole('heading', { level: 2, name: 'Upcoming' });
    const upcomingSection = upcomingHeading.closest('section') as HTMLElement;
    expect(within(upcomingSection).queryByText('Tomorrow Venue')).toBeNull();
    expect(within(upcomingSection).getByText('Later Venue')).toBeInTheDocument();
  });

  it('omits the Upcoming heading when there are no upcoming setlists', () => {
    const today = makeSetlist('today', '2026-06-21');
    useSetlistsMock.mockReturnValue({ data: [today], isPending: false });
    renderHome();
    expect(screen.queryByRole('heading', { level: 2, name: 'Upcoming' })).toBeNull();
  });

  it('omits the Past heading when there are no past setlists', () => {
    const today = makeSetlist('today', '2026-06-21');
    useSetlistsMock.mockReturnValue({ data: [today], isPending: false });
    renderHome();
    expect(screen.queryByRole('heading', { level: 2, name: 'Past' })).toBeNull();
  });

  it('renders Past setlists in reverse chronological order (most recent first)', () => {
    const older = makeSetlist('older', '2026-05-01', 'Older Venue');
    const newer = makeSetlist('newer', '2026-06-01', 'Newer Venue');
    useSetlistsMock.mockReturnValue({ data: [older, newer], isPending: false });
    renderHome();
    const pastSection = screen
      .getByRole('heading', { level: 2, name: 'Past' })
      .closest('section') as HTMLElement;
    const buttons = within(pastSection).getAllByRole('button');
    expect(buttons[0]?.textContent).toContain('Newer Venue');
    expect(buttons[1]?.textContent).toContain('Older Venue');
  });

  it('renders the three sections in the order Tonight → Upcoming → Past', () => {
    const past = makeSetlist('past', '2026-05-01', 'Past Venue');
    const today = makeSetlist('today', '2026-06-21', 'Today Venue');
    const future = makeSetlist('future', '2026-07-01', 'Future Venue');
    useSetlistsMock.mockReturnValue({ data: [past, today, future], isPending: false });
    renderHome();
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(['Tonight', 'Upcoming', 'Past']);
  });

  it('renders quietly while loading — no cards, no spinner, no toast', () => {
    useSetlistsMock.mockReturnValue({ data: undefined, isPending: true });
    renderHome();
    // Tonight heading is present (always), empty state copy is shown,
    // nothing else.
    expect(screen.getByRole('heading', { level: 2, name: 'Tonight' })).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('renders quietly on error — Tonight slot shows the empty-state copy (no toast)', () => {
    useSetlistsMock.mockReturnValue({ data: undefined, isPending: false, isError: true });
    renderHome();
    expect(screen.getByText(EMPTY_STATES.noUpcomingGigs)).toBeInTheDocument();
  });

  it('re-evaluates sectioning on visibilitychange when the clock has rolled past midnight', () => {
    // On 2026-06-21 the future-dated gig (2026-06-22) is promoted to
    // Tonight (no today gig).
    const next = makeSetlist('next', '2026-06-22', 'Tomorrow Venue');
    useSetlistsMock.mockReturnValue({ data: [next], isPending: false });
    renderHome();
    const tonightSection = screen
      .getByRole('heading', { level: 2, name: 'Tonight' })
      .closest('section') as HTMLElement;
    expect(within(tonightSection).queryByText('TONIGHT')).toBeNull();
    expect(within(tonightSection).getByText('Tomorrow Venue')).toBeInTheDocument();

    // Roll the clock to the next day; 12:00 UTC on the 22nd is still
    // 13:00 BST in London → "2026-06-22" today.
    vi.setSystemTime(new Date('2026-06-22T12:00:00Z'));
    // Fire visibilitychange → triggers tick → re-render → sectioning
    // recomputes with the new today.
    act(() => {
      // jsdom defaults to 'visible'; just dispatch the event.
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Now the same gig IS today — it should be badged.
    const tonightSection2 = screen
      .getByRole('heading', { level: 2, name: 'Tonight' })
      .closest('section') as HTMLElement;
    expect(within(tonightSection2).getByText('TONIGHT')).toBeInTheDocument();
    expect(within(tonightSection2).getByText('Tomorrow Venue')).toBeInTheDocument();
  });
});
