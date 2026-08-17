import { ACTIVE_BAND_ID, type Setlist, type Song } from '@gigbuddy/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
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
  useSongsMock,
  navigateMock,
  useWakeLockIndicatorMock,
  setPerformanceViewMock,
  setActiveSongIndexMock,
  setPerformanceActiveMock,
  performanceActiveMock,
} = vi.hoisted(() => ({
  useSetlistMock: vi.fn(),
  useSongMock: vi.fn(),
  // Story 6.4 — JumpOverlay calls `useSongs()` (transitively, whenever it
  // mounts). Without a hoisted mock the underlying `useQuery` would throw
  // "No QueryClient set" the moment any `≡ jump` test opens the overlay.
  useSongsMock: vi.fn(),
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
vi.mock('../hooks/use-songs.js', () => ({ useSongs: useSongsMock }));
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
  useSongsMock.mockReset().mockReturnValue({ data: [] });
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

  it('renders the key at --text-perf-meta and the patch at --text-perf-body (Story 6.2 AC-1)', () => {
    // Key/patch chrome must render as a single inline row with a size
    // differentiation between the (larger) key glyph and the (smaller)
    // patch text — both mono/slab, both text-secondary. This asserts the
    // specific invariant type-scale tokens the story locks in.
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute();
    const keySpan = screen.getByText('Em');
    const patchSpan = screen.getByText('Rhodes');
    expect(keySpan.className).toContain('text-[length:var(--text-perf-meta)]');
    expect(patchSpan.className).toContain('text-[length:var(--text-perf-body)]');
    // And confirm the patch is NOT rendered at the larger key size (the
    // pre-story shipped bug this story fixes).
    expect(patchSpan.className).not.toContain('text-[length:var(--text-perf-meta)]');
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

describe('PerformanceCard — next-song preview removed (Story 6.3)', () => {
  // Story 6.3 deleted the Story 4.1 next-song preview span in favour of
  // the `≡ jump` control between ‹ and NEXT ›. The preview shouldn't
  // appear anywhere in the toolbar.
  it('does NOT render the next Song titleSnapshot in the bottom toolbar', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute('setlistid0000001', '0');
    // On songIndex=0 the next Song would have been Black Orpheus. That
    // title must not appear anywhere on the card — heading shows "Autumn
    // Leaves", footer shows only ‹ + ≡ jump + NEXT › (no preview span).
    expect(screen.queryByText('Black Orpheus')).toBeNull();
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

  it('no "End of setlist" or preview-shaped copy anywhere on the last Song (Story 6.3 rollback)', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({
      data: makeSong({ songId: 'song0000000003cc', title: 'Take Five' }),
      isLoading: false,
    });
    renderRoute('setlistid0000001', '2');
    // Story 6.3 deleted the preview span entirely. Confirm neither
    // end-of-setlist copy nor any residual preview text is anywhere in
    // the document.
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

describe('PerformanceCard — jump overlay (Story 6.3)', () => {
  it('renders the `≡ jump` button with aria-label "Open setlist and library jump overlay"', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute();
    expect(
      screen.getByRole('button', { name: PERFORMANCE_CARD.ariaOpenJumpOverlay }),
    ).toBeInTheDocument();
  });

  it('`≡ jump` renders between ‹ and NEXT › in DOM order (four-corners / A2 placement)', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    const { container } = renderRoute();
    const footer = container.querySelector('footer');
    if (footer === null) throw new Error('footer missing');
    const footerButtons = within(footer).getAllByRole('button');
    // Exactly three controls in the toolbar: ‹, ≡ jump, NEXT › — no
    // preview span, no fourth control.
    expect(footerButtons).toHaveLength(3);
    expect(footerButtons[0]?.getAttribute('aria-label')).toBe(PERFORMANCE_CARD.ariaPreviousSong);
    expect(footerButtons[1]?.getAttribute('aria-label')).toBe(PERFORMANCE_CARD.ariaOpenJumpOverlay);
    expect(footerButtons[2]?.getAttribute('aria-label')).toBe(PERFORMANCE_CARD.ariaNextSong);
  });

  it('tapping `≡ jump` mounts the overlay (role=dialog, aria-label "Jump to a song")', async () => {
    const user = userEvent.setup();
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute();
    expect(screen.queryByRole('dialog', { name: 'Jump to a song' })).toBeNull();
    await user.click(screen.getByRole('button', { name: PERFORMANCE_CARD.ariaOpenJumpOverlay }));
    expect(screen.getByRole('dialog', { name: 'Jump to a song' })).toBeInTheDocument();
  });

  it('tapping the overlay dismiss control unmounts the overlay; Performance Card chrome remains', async () => {
    const user = userEvent.setup();
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    renderRoute();
    await user.click(screen.getByRole('button', { name: PERFORMANCE_CARD.ariaOpenJumpOverlay }));
    expect(screen.getByRole('dialog', { name: 'Jump to a song' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dismiss jump overlay' }));
    // Fade-out timer resolves after ~150ms then React unmounts the dialog.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 1000 });
    // The Performance Card's own chrome is still present — the card was
    // never unmounted while the overlay was open.
    expect(screen.getByRole('heading', { level: 1, name: 'Autumn Leaves' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: PERFORMANCE_CARD.ariaExitPerformance }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: PERFORMANCE_CARD.ariaNextSong })).toBeInTheDocument();
  });

  it('tapping a jump-overlay setlist row for another song re-renders the card with that song, WITHOUT navigating (plan cursor untouched)', async () => {
    const user = userEvent.setup();
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    // Story 6.4 — the card's `useSong()` fetch key flips to whichever
    // song the overlay selects. Return a payload that keys off `songId`
    // so we can verify the card re-renders with the target's title.
    useSongMock.mockImplementation((songId: string | null) => {
      if (songId === 'song0000000002bb') {
        return { data: makeSong({ songId, title: 'Black Orpheus' }), isLoading: false };
      }
      return { data: makeSong(), isLoading: false };
    });
    useSongsMock.mockReturnValue({
      data: [
        makeSong({ songId: 'song0000000001aa', title: 'Autumn Leaves' }),
        makeSong({ songId: 'song0000000002bb', title: 'Black Orpheus' }),
        makeSong({ songId: 'song0000000003cc', title: 'Take Five' }),
      ],
    });
    renderRoute('setlistid0000001', '0');
    expect(screen.getByRole('heading', { level: 1, name: 'Autumn Leaves' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: PERFORMANCE_CARD.ariaOpenJumpOverlay }));
    const dialog = screen.getByRole('dialog', { name: 'Jump to a song' });
    const navigateCallsBefore = navigateMock.mock.calls.length;
    await user.click(within(dialog).getByRole('button', { name: /Black Orpheus/ }));
    // Card re-renders with the jumped-to song.
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Black Orpheus' })).toBeInTheDocument(),
    );
    // Plan cursor / URL untouched.
    expect(navigateMock.mock.calls.length).toBe(navigateCallsBefore);
  });

  it('tapping a jump-overlay library-only row re-renders the card with that song, still WITHOUT navigating', async () => {
    const user = userEvent.setup();
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockImplementation((songId: string | null) => {
      if (songId === 'song0000000099zz') {
        return { data: makeSong({ songId, title: 'Sunny' }), isLoading: false };
      }
      return { data: makeSong(), isLoading: false };
    });
    useSongsMock.mockReturnValue({
      data: [
        makeSong({ songId: 'song0000000001aa', title: 'Autumn Leaves' }),
        makeSong({ songId: 'song0000000002bb', title: 'Black Orpheus' }),
        makeSong({ songId: 'song0000000003cc', title: 'Take Five' }),
        // Library-only song — NOT present in `makeSetlist()` sections.
        makeSong({ songId: 'song0000000099zz', title: 'Sunny' }),
      ],
    });
    renderRoute('setlistid0000001', '0');
    await user.click(screen.getByRole('button', { name: PERFORMANCE_CARD.ariaOpenJumpOverlay }));
    const dialog = screen.getByRole('dialog', { name: 'Jump to a song' });
    // Search for the library-only song so its row appears under `In library`.
    await user.type(
      within(dialog).getByRole('searchbox', { name: 'Search this setlist or library' }),
      'sunny',
    );
    const navigateCallsBefore = navigateMock.mock.calls.length;
    await user.click(within(dialog).getByRole('button', { name: /Sunny/ }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Sunny' })).toBeInTheDocument(),
    );
    expect(navigateMock.mock.calls.length).toBe(navigateCallsBefore);
  });

  it('after a detour selection, tapping NEXT › still navigates to plan-cursor + 1 (existing behaviour, unaffected by the detour override)', async () => {
    const user = userEvent.setup();
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockImplementation((songId: string | null) => {
      if (songId === 'song0000000003cc') {
        return { data: makeSong({ songId, title: 'Take Five' }), isLoading: false };
      }
      return { data: makeSong(), isLoading: false };
    });
    useSongsMock.mockReturnValue({
      data: [
        makeSong({ songId: 'song0000000001aa', title: 'Autumn Leaves' }),
        makeSong({ songId: 'song0000000002bb', title: 'Black Orpheus' }),
        makeSong({ songId: 'song0000000003cc', title: 'Take Five' }),
      ],
    });
    renderRoute('setlistid0000001', '0');
    // Jump to Take Five (not plan-cursor + 1 — the detour case).
    await user.click(screen.getByRole('button', { name: PERFORMANCE_CARD.ariaOpenJumpOverlay }));
    const dialog = screen.getByRole('dialog', { name: 'Jump to a song' });
    await user.click(within(dialog).getByRole('button', { name: /Take Five/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 1000 });
    navigateMock.mockClear();
    await user.click(screen.getByRole('button', { name: PERFORMANCE_CARD.ariaNextSong }));
    // NEXT › still computes from parsedSongIndex (0) + 1 = 1 — the
    // detour override does NOT redirect the button's URL math. Full
    // "returns to plan cursor + 1" detour semantics are Story 6.5's
    // scope; this story only guarantees the button still works.
    expect(navigateMock).toHaveBeenCalledWith('/performance/setlistid0000001/1');
  });

  it('tapping `≡ jump` does NOT release wake lock, mutate performanceActive, or navigate', async () => {
    const user = userEvent.setup();
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    useSongMock.mockReturnValue({ data: makeSong(), isLoading: false });
    // Enter with performanceActive=true so the mount effect doesn't call
    // setPerformanceActive(true) — otherwise the assertion below has to
    // account for that mount-time call.
    performanceActiveMock.mockReturnValue(true);
    renderRoute();
    const setActiveCallsBefore = setPerformanceActiveMock.mock.calls.length;
    const setIndexCallsBefore = setActiveSongIndexMock.mock.calls.length;
    const navigateCallsBefore = navigateMock.mock.calls.length;
    await user.click(screen.getByRole('button', { name: PERFORMANCE_CARD.ariaOpenJumpOverlay }));
    // Tapping ≡ jump is inert to Performance Mode state — only local
    // component state (isJumpOverlayOpen) flips. AR-28 invariants hold.
    expect(setPerformanceActiveMock.mock.calls.length).toBe(setActiveCallsBefore);
    expect(setActiveSongIndexMock.mock.calls.length).toBe(setIndexCallsBefore);
    expect(navigateMock.mock.calls.length).toBe(navigateCallsBefore);
  });
});
