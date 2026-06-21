import { ACTIVE_BAND_ID, type Setlist, type Song } from '@gigbuddy/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERFORMANCE_CARD } from '../lib/microcopy.js';
import { PerformanceCard } from './performance-card.js';

/*
 * PerformanceCard tests. Hooks are mocked at the module level so the route
 * renders without TanStack Query / outbox setup. The atmosphere effect and
 * viewport-meta effect are exercised via direct DOM assertions.
 */

const {
  useSetlistMock,
  useSongMock,
  navigateMock,
  useWakeLockIndicatorMock,
  setPerformanceViewMock,
  setActiveSongIndexMock,
  setPerformanceActiveMock,
  performanceActiveMock,
} = vi.hoisted(() => ({
  useSetlistMock: vi.fn(),
  useSongMock: vi.fn(),
  navigateMock: vi.fn(),
  // Story 4.2 — default to wakeLockHeld=true so the indicator is hidden
  // and the existing 23 test cases continue to assert against the
  // pre-Story-4.2 DOM. Targeted indicator cases below override this.
  useWakeLockIndicatorMock: vi.fn(() => ({ wakeLockHeld: true })),
  // Story 4.3 — context setters for performanceView + activeSongIndex. The
  // × exit handler also explicitly does NOT call `setPerformanceActive` —
  // the mock below exists so tests can ASSERT it is never invoked.
  setPerformanceViewMock: vi.fn(),
  setActiveSongIndexMock: vi.fn(),
  setPerformanceActiveMock: vi.fn(),
  performanceActiveMock: vi.fn(() => false),
}));

vi.mock('../hooks/use-setlist.js', () => ({ useSetlist: useSetlistMock }));
vi.mock('../hooks/use-song.js', () => ({ useSong: useSongMock }));
vi.mock('../performance/use-wake-lock-indicator.js', () => ({
  useWakeLockIndicator: useWakeLockIndicatorMock,
}));
vi.mock('../performance/performance-context.js', () => ({
  useSetPerformanceView: () => setPerformanceViewMock,
  useSetActiveSongIndex: () => setActiveSongIndexMock,
  useSetPerformanceActive: () => setPerformanceActiveMock,
  usePerformanceActive: () => performanceActiveMock(),
}));
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigateMock };
});

function makeSetlist(overrides: Partial<Setlist> = {}): Setlist {
  return {
    bandId: ACTIVE_BAND_ID,
    setlistId: 'setlistid0000001',
    gigMeta: { venue: 'The Jazz Cafe', date: '2026-06-21', time: '20:00' },
    sections: [
      {
        name: 'Set 1',
        songs: [
          { songId: 'song0000000001aa', titleSnapshot: 'Autumn Leaves' },
          { songId: 'song0000000002bb', titleSnapshot: 'Black Orpheus' },
        ],
      },
      {
        name: 'Set 2',
        songs: [{ songId: 'song0000000003cc', titleSnapshot: 'Take Five' }],
      },
    ],
    clientWrittenAt: '2026-06-19T10:00:00.000Z',
    serverReceivedAt: '2026-06-19T10:00:01.000Z',
    version: 1 as const,
    ...overrides,
  };
}

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    bandId: ACTIVE_BAND_ID,
    songId: 'song0000000001aa',
    title: 'Autumn Leaves',
    key: 'Em',
    patch: 'Rhodes',
    chordChart: '{Intro}\nEm7  A7\nDmaj7\n',
    performanceNotes: 'feel: medium swing',
    practiceNotes: 'practice the bridge',
    clientWrittenAt: '2026-06-19T10:00:00.000Z',
    serverReceivedAt: '2026-06-19T10:00:01.000Z',
    version: 1 as const,
    ...overrides,
  };
}

function renderRoute(setlistId = 'setlistid0000001', songIndex = '0') {
  return render(
    <MemoryRouter initialEntries={[`/performance/${setlistId}/${songIndex}`]}>
      <Routes>
        <Route path="/performance/:setlistId/:songIndex" element={<PerformanceCard />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useSetlistMock.mockReset();
  useSongMock.mockReset();
  navigateMock.mockReset();
  useWakeLockIndicatorMock.mockReset().mockReturnValue({ wakeLockHeld: true });
  setPerformanceViewMock.mockReset();
  setActiveSongIndexMock.mockReset();
  setPerformanceActiveMock.mockReset();
  performanceActiveMock.mockReset().mockReturnValue(false);
  document.documentElement.dataset.atmosphere = 'practice';
  // Ensure a viewport meta tag exists for the effect to mutate.
  let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0';
    document.head.appendChild(meta);
  } else {
    meta.content = 'width=device-width, initial-scale=1.0';
  }
});

afterEach(() => {
  document.documentElement.dataset.atmosphere = 'practice';
});

describe('PerformanceCard — atmosphere + viewport effects', () => {
  it('sets data-atmosphere="performance" on <html> on mount', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute();
    expect(document.documentElement.dataset.atmosphere).toBe('performance');
  });

  it('reactivates performanceActive=true on mount when it was false (Story 4.5 AC-8 — cold-relaunch resume)', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    performanceActiveMock.mockReturnValue(false);
    renderRoute();
    expect(setPerformanceActiveMock).toHaveBeenCalledWith(true);
  });

  it('does NOT re-call setPerformanceActive on mount when it is already true (idempotent entry from Start performance ›)', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    performanceActiveMock.mockReturnValue(true);
    renderRoute();
    expect(setPerformanceActiveMock).not.toHaveBeenCalled();
  });

  it('restores data-atmosphere to the prior value on unmount', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    document.documentElement.dataset.atmosphere = 'practice';
    const { unmount } = renderRoute();
    expect(document.documentElement.dataset.atmosphere).toBe('performance');
    unmount();
    expect(document.documentElement.dataset.atmosphere).toBe('practice');
  });

  it('disables viewport zoom on mount and restores on unmount', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    const before = meta.content;
    const { unmount } = renderRoute();
    expect(meta.content).toContain('user-scalable=no');
    unmount();
    expect(meta.content).toBe(before);
  });
});

describe('PerformanceCard — loaded state rendering', () => {
  it('renders the title, key, and patch when the Song has all fields', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute();
    expect(screen.getByRole('heading', { level: 1, name: 'Autumn Leaves' })).toBeInTheDocument();
    expect(screen.getByText('Em')).toBeInTheDocument();
    expect(screen.getByText('Rhodes')).toBeInTheDocument();
  });

  it('renders the chord chart in performance atmosphere (urlsTappable=false)', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute();
    const chart = screen.getByTestId('chord-chart');
    expect(chart).toBeInTheDocument();
    // No anchor — URLs are inert in Performance atmosphere.
    expect(chart.querySelector('a')).toBeNull();
  });

  it('renders the per-gig annotation when present', () => {
    useSetlistMock.mockReturnValue({
      data: makeSetlist({
        sections: [
          {
            name: 'Set 1',
            songs: [
              {
                songId: 'song0000000001aa',
                titleSnapshot: 'Autumn Leaves',
                perGigAnnotation: 'half-time feel',
              },
            ],
          },
        ],
      }),
      isLoading: false,
    });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute();
    expect(screen.getByText('half-time feel')).toBeInTheDocument();
  });

  it('does not render any placeholder when the per-gig annotation is absent', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute();
    expect(screen.queryByText(/not specified/i)).toBeNull();
  });
});

describe('PerformanceCard — sparse Song (title only)', () => {
  it('does not render Key when the Song has no key', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({
      data: makeSong({ key: undefined, patch: undefined, chordChart: undefined }),
      isLoading: false,
    });
    renderRoute();
    expect(screen.queryByText('Em')).toBeNull();
  });

  it('does not render Patch when the Song has no patch', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({
      data: makeSong({ patch: undefined }),
      isLoading: false,
    });
    renderRoute();
    expect(screen.queryByText('Rhodes')).toBeNull();
  });

  it('does not render a chord chart placeholder when the Song has no chord chart', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({
      data: makeSong({ chordChart: undefined }),
      isLoading: false,
    });
    renderRoute();
    expect(screen.queryByTestId('chord-chart')).toBeNull();
  });
});

describe('PerformanceCard — accessibility labels', () => {
  it('NEXT › has aria-label "Next song"', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute();
    expect(screen.getByRole('button', { name: PERFORMANCE_CARD.ariaNextSong })).toBeInTheDocument();
  });

  it('‹ has aria-label "Previous song"', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute();
    expect(
      screen.getByRole('button', { name: PERFORMANCE_CARD.ariaPreviousSong }),
    ).toBeInTheDocument();
  });

  it('position indicator carries the "Song <n> of <total>" aria-label', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute();
    expect(screen.getByLabelText('Song 1 of 3')).toBeInTheDocument();
  });

  it('focus moves to the NEXT › button on mount (UX-DR6)', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute();
    const nextButton = screen.getByRole('button', { name: PERFORMANCE_CARD.ariaNextSong });
    expect(document.activeElement).toBe(nextButton);
  });
});

describe('PerformanceCard — single-tap navigation', () => {
  it('tapping NEXT › navigates to the next songIndex', async () => {
    const user = userEvent.setup();
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute('setlistid0000001', '0');
    await user.click(screen.getByRole('button', { name: PERFORMANCE_CARD.ariaNextSong }));
    expect(navigateMock).toHaveBeenCalledWith('/performance/setlistid0000001/1');
  });

  it('tapping ‹ navigates to the previous songIndex when not on the first Song', async () => {
    const user = userEvent.setup();
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({
      data: makeSong({ songId: 'song0000000002bb', title: 'Black Orpheus' }),
      isLoading: false,
    });
    renderRoute('setlistid0000001', '1');
    await user.click(screen.getByRole('button', { name: PERFORMANCE_CARD.ariaPreviousSong }));
    expect(navigateMock).toHaveBeenCalledWith('/performance/setlistid0000001/0');
  });

  it('‹ is disabled and aria-disabled on the first Song (songIndex=0)', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute('setlistid0000001', '0');
    const backButton = screen.getByRole('button', {
      name: PERFORMANCE_CARD.ariaPreviousSong,
    }) as HTMLButtonElement;
    expect(backButton.disabled).toBe(true);
    expect(backButton.getAttribute('aria-disabled')).toBe('true');
  });

  it('tapping ‹ on the first Song does not fire navigate', async () => {
    const user = userEvent.setup();
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute('setlistid0000001', '0');
    const backButton = screen.getByRole('button', { name: PERFORMANCE_CARD.ariaPreviousSong });
    await user.click(backButton);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('NEXT › traverses Section boundaries transparently (Set 1 last → Set 2 first)', async () => {
    const user = userEvent.setup();
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({
      data: makeSong({ songId: 'song0000000002bb', title: 'Black Orpheus' }),
      isLoading: false,
    });
    // songIndex=1 is the last Song in Set 1; NEXT › should go to flat
    // index 2 (Take Five, the first Song of Set 2).
    renderRoute('setlistid0000001', '1');
    await user.click(screen.getByRole('button', { name: PERFORMANCE_CARD.ariaNextSong }));
    expect(navigateMock).toHaveBeenCalledWith('/performance/setlistid0000001/2');
  });
});

describe('PerformanceCard — next-song preview', () => {
  it('shows the next Song titleSnapshot in the bottom toolbar', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute('setlistid0000001', '0');
    // Set 1 song 0 is Autumn Leaves → next is Black Orpheus.
    expect(screen.getByText('Black Orpheus')).toBeInTheDocument();
  });

  it('renders an empty preview on the last Song (no "End of setlist" text)', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({
      data: makeSong({ songId: 'song0000000003cc', title: 'Take Five' }),
      isLoading: false,
    });
    renderRoute('setlistid0000001', '2');
    expect(screen.queryByText(/end of setlist/i)).toBeNull();
  });
});

describe('PerformanceCard — graceful not-found', () => {
  it('renders the not-found copy when the Setlist resolves to null', () => {
    useSetlistMock.mockReturnValue({ data: null, isLoading: false });
    useSongMock.mockReturnValue({ data: undefined, isLoading: false });
    renderRoute('missingsetlist00', '0');
    expect(screen.getByText(/Setlist not found/i)).toBeInTheDocument();
  });

  it('renders the not-found state when songIndex is out of bounds (last-Song overshoot)', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: undefined, isLoading: false });
    // Setlist has 3 flat songs; index 3 is out of bounds.
    renderRoute('setlistid0000001', '3');
    expect(screen.getByText(/Setlist not found/i)).toBeInTheDocument();
  });
});

describe('PerformanceCard — wake-lock indicator (Story 4.2)', () => {
  it('renders the indicator with aria-label "Screen may sleep" when wakeLockHeld is false', () => {
    useWakeLockIndicatorMock.mockReturnValue({ wakeLockHeld: false });
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute();
    expect(screen.getByLabelText(PERFORMANCE_CARD.ariaWakeLockNotHeld)).toBeInTheDocument();
  });

  it('does not render the indicator when wakeLockHeld is true', () => {
    useWakeLockIndicatorMock.mockReturnValue({ wakeLockHeld: true });
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute();
    expect(screen.queryByLabelText(PERFORMANCE_CARD.ariaWakeLockNotHeld)).toBeNull();
  });

  it('indicator carries aria-live="assertive" and role="status" (UX-DR6)', () => {
    useWakeLockIndicatorMock.mockReturnValue({ wakeLockHeld: false });
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute();
    const indicator = screen.getByLabelText(PERFORMANCE_CARD.ariaWakeLockNotHeld);
    expect(indicator.getAttribute('aria-live')).toBe('assertive');
    expect(indicator.getAttribute('role')).toBe('status');
  });
});

describe('PerformanceCard — × exit (Story 4.3)', () => {
  it('renders the × button with aria-label "Exit performance mode"', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute();
    expect(
      screen.getByRole('button', { name: PERFORMANCE_CARD.ariaExitPerformance }),
    ).toBeInTheDocument();
  });

  it('tapping × navigates back to /setlists/<setlistId>', async () => {
    const user = userEvent.setup();
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute('setlistid0000001', '1');
    await user.click(screen.getByRole('button', { name: PERFORMANCE_CARD.ariaExitPerformance }));
    expect(navigateMock).toHaveBeenCalledWith('/setlists/setlistid0000001');
  });

  it('tapping × does NOT clear performanceActive (state preserved per FR-19)', async () => {
    const user = userEvent.setup();
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute();
    setPerformanceActiveMock.mockClear();
    await user.click(screen.getByRole('button', { name: PERFORMANCE_CARD.ariaExitPerformance }));
    // The mount effect (Story 4.5 / AC-8) may have called setActive(true)
    // before this clear; what matters for FR-19 is that × never flips it
    // off. Assert no `false` call happened on or after the tap.
    expect(setPerformanceActiveMock).not.toHaveBeenCalledWith(false);
  });

  it('× appears spatially before ‹ in DOM order (UX-DR9 four-corner separation)', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute();
    const exitButton = screen.getByRole('button', {
      name: PERFORMANCE_CARD.ariaExitPerformance,
    });
    const prevButton = screen.getByRole('button', {
      name: PERFORMANCE_CARD.ariaPreviousSong,
    });
    // × lives in the header chrome (top-left); ‹ lives in the footer
    // toolbar (bottom-left). DOM order: × comes before ‹.
    const position = exitButton.compareDocumentPosition(prevButton);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('marks performanceView as "card" on mount and clears it on unmount', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    const { unmount } = renderRoute();
    expect(setPerformanceViewMock).toHaveBeenCalledWith('card');
    setPerformanceViewMock.mockClear();
    unmount();
    expect(setPerformanceViewMock).toHaveBeenCalledWith(null);
  });

  it('mirrors the URL songIndex into context activeSongIndex on mount', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({
      data: makeSong({ songId: 'song0000000002bb', title: 'Black Orpheus' }),
      isLoading: false,
    });
    renderRoute('setlistid0000001', '1');
    expect(setActiveSongIndexMock).toHaveBeenCalledWith(1);
  });
});

describe('PerformanceCard — last-song inert NEXT › (Story 4.4)', () => {
  // The default `makeSetlist()` has 3 flat songs across 2 sections; the
  // last flat index is 2 (Take Five in Set 2). songIndex=2 is therefore
  // the last-Song case.
  it('NEXT › is `disabled` on the last Song (songIndex=flatSongs.length-1)', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({
      data: makeSong({ songId: 'song0000000003cc', title: 'Take Five' }),
      isLoading: false,
    });
    renderRoute('setlistid0000001', '2');
    const nextButton = screen.getByRole('button', {
      name: PERFORMANCE_CARD.ariaNextSong,
    }) as HTMLButtonElement;
    expect(nextButton.disabled).toBe(true);
  });

  it('NEXT › carries `aria-disabled="true"` on the last Song', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({
      data: makeSong({ songId: 'song0000000003cc', title: 'Take Five' }),
      isLoading: false,
    });
    renderRoute('setlistid0000001', '2');
    const nextButton = screen.getByRole('button', { name: PERFORMANCE_CARD.ariaNextSong });
    expect(nextButton.getAttribute('aria-disabled')).toBe('true');
  });

  it('tapping NEXT › on the last Song does NOT call navigate', async () => {
    const user = userEvent.setup();
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({
      data: makeSong({ songId: 'song0000000003cc', title: 'Take Five' }),
      isLoading: false,
    });
    renderRoute('setlistid0000001', '2');
    await user.click(screen.getByRole('button', { name: PERFORMANCE_CARD.ariaNextSong }));
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('NEXT › carries `disabled:opacity-40` styling on the last Song', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({
      data: makeSong({ songId: 'song0000000003cc', title: 'Take Five' }),
      isLoading: false,
    });
    renderRoute('setlistid0000001', '2');
    const nextButton = screen.getByRole('button', { name: PERFORMANCE_CARD.ariaNextSong });
    expect(nextButton.className).toContain('disabled:opacity-40');
  });

  it('next-song preview is empty on the last Song (no "End of setlist" or any other copy)', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({
      data: makeSong({ songId: 'song0000000003cc', title: 'Take Five' }),
      isLoading: false,
    });
    renderRoute('setlistid0000001', '2');
    // The preview span is aria-hidden but it sits between the ‹ and NEXT ›
    // buttons in the footer. We assert by ensuring no end-of-setlist copy
    // is anywhere in the document.
    expect(screen.queryByText(/end of setlist/i)).toBeNull();
    // And confirm the title of the current Song (Take Five) renders as the
    // <h1> heading — not as a preview repeat.
    expect(screen.getByRole('heading', { level: 1, name: 'Take Five' })).toBeInTheDocument();
  });

  it('NEXT › is NOT disabled on a non-last Song (songIndex=0)', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute('setlistid0000001', '0');
    const nextButton = screen.getByRole('button', {
      name: PERFORMANCE_CARD.ariaNextSong,
    }) as HTMLButtonElement;
    expect(nextButton.disabled).toBe(false);
    expect(nextButton.getAttribute('aria-disabled')).toBe('false');
  });

  it('NEXT › is NOT disabled on the second-to-last Song (songIndex=1)', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({
      data: makeSong({ songId: 'song0000000002bb', title: 'Black Orpheus' }),
      isLoading: false,
    });
    renderRoute('setlistid0000001', '1');
    const nextButton = screen.getByRole('button', {
      name: PERFORMANCE_CARD.ariaNextSong,
    }) as HTMLButtonElement;
    expect(nextButton.disabled).toBe(false);
  });
});
