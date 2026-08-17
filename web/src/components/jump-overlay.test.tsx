import { ACTIVE_BAND_ID, type Section, type Song } from '@gigbuddy/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JumpOverlay } from './jump-overlay.js';

/*
 * JumpOverlay tests. Story 6.3 shipped the shell (dialog role + dismiss +
 * fade); Story 6.4 fills the content region with the pinned search input,
 * the sectioned setlist overview, and the `In this setlist` / `In library`
 * filtering behaviour.
 *
 * `useSongs()` is hoisted-mocked so we can drive the library-reach cases
 * deterministically without a QueryClient wrapper (the underlying hook
 * calls `useQuery` from TanStack Query and would otherwise throw).
 */

const { useSongsMock } = vi.hoisted(() => ({
  useSongsMock: vi.fn(),
}));

vi.mock('../hooks/use-songs.js', () => ({ useSongs: useSongsMock }));

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    bandId: ACTIVE_BAND_ID,
    songId: 'song0000000001aa',
    title: 'Autumn Leaves',
    key: 'Em',
    clientWrittenAt: '2026-06-19T10:00:00.000Z',
    serverReceivedAt: '2026-06-19T10:00:01.000Z',
    version: 1 as const,
    ...overrides,
  };
}

const SECTIONS: Section[] = [
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
];

const LIBRARY_SONGS: Song[] = [
  makeSong({ songId: 'song0000000001aa', title: 'Autumn Leaves', key: 'Em' }),
  makeSong({ songId: 'song0000000002bb', title: 'Black Orpheus', key: 'Am' }),
  makeSong({ songId: 'song0000000003cc', title: 'Take Five', key: 'Ebm' }),
  // Library-only songs (not in any section) — used to test the `In library`
  // group and the library-reach filter.
  makeSong({ songId: 'song0000000004dd', title: 'Sunny', key: 'A' }),
  makeSong({ songId: 'song0000000005ee', title: 'Almost Like Being In Love', key: 'F' }),
];

beforeEach(() => {
  useSongsMock.mockReset();
  useSongsMock.mockReturnValue({ data: LIBRARY_SONGS });
});

function renderOverlay(overrides: Partial<Parameters<typeof JumpOverlay>[0]> = {}): {
  onDismiss: ReturnType<typeof vi.fn>;
  onSelectSong: ReturnType<typeof vi.fn>;
} {
  const onDismiss = vi.fn();
  const onSelectSong = vi.fn();
  render(
    <JumpOverlay
      sections={SECTIONS}
      currentSongId="song0000000001aa"
      onDismiss={onDismiss}
      onSelectSong={onSelectSong}
      {...overrides}
    />,
  );
  return { onDismiss, onSelectSong };
}

describe('JumpOverlay — shell (unchanged from Story 6.3)', () => {
  it('renders with role="dialog" and aria-modal="true"', () => {
    renderOverlay();
    const dialog = screen.getByRole('dialog', { name: 'Jump to a song' });
    expect(dialog).toBeInTheDocument();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('renders the dismiss control with aria-label "Dismiss jump overlay"', () => {
    renderOverlay();
    expect(screen.getByRole('button', { name: 'Dismiss jump overlay' })).toBeInTheDocument();
  });

  it('tapping the dismiss control calls onDismiss after the fade-out completes', async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderOverlay();
    await user.click(screen.getByRole('button', { name: 'Dismiss jump overlay' }));
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1), { timeout: 1000 });
  });

  it('applies transition-opacity duration-150 on the root (AC-3 real fade)', () => {
    renderOverlay();
    const dialog = screen.getByRole('dialog', { name: 'Jump to a song' });
    expect(dialog.className).toContain('transition-opacity');
    expect(dialog.className).toContain('duration-150');
  });
});

describe('JumpOverlay — pinned search input (Story 6.4 AC-1)', () => {
  it('renders a search input with aria-label and placeholder "Search this setlist or library"', () => {
    renderOverlay();
    const input = screen.getByRole('searchbox', { name: 'Search this setlist or library' });
    expect(input).toBeInTheDocument();
    expect(input.getAttribute('placeholder')).toBe('Search this setlist or library');
  });
});

describe('JumpOverlay — no query: full sectioned setlist (AC-2)', () => {
  it('renders every setlist song row in sectioned order with `Set N   <n> songs` headings', () => {
    renderOverlay();
    // Section headings — count uses SECTION_HEADING.songCount pluralisation.
    expect(screen.getByText('Set 1')).toBeInTheDocument();
    expect(screen.getByText('2 songs')).toBeInTheDocument();
    expect(screen.getByText('Set 2')).toBeInTheDocument();
    expect(screen.getByText('1 song')).toBeInTheDocument();
    // Every setlist song rendered.
    expect(screen.getByRole('button', { name: /Autumn Leaves/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Black Orpheus/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Take Five/ })).toBeInTheDocument();
  });

  it('does not render an `In library` heading or any library-only rows', () => {
    renderOverlay();
    expect(screen.queryByText('In library')).toBeNull();
    expect(screen.queryByRole('button', { name: /Sunny/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Almost Like Being In Love/ })).toBeNull();
  });

  it('the plan-cursor row is the only row with aria-current="true" (color-never-alone)', () => {
    renderOverlay({ currentSongId: 'song0000000002bb' });
    const highlighted = screen.getAllByRole('button', { current: true });
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0]?.textContent).toContain('Black Orpheus');
  });
});

describe('JumpOverlay — query filters (AC-3, AC-4, AC-5)', () => {
  it('typing a query matching only a setlist song filters to that row under `In this setlist`, no library rows', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await user.type(
      screen.getByRole('searchbox', { name: 'Search this setlist or library' }),
      'orph',
    );
    expect(screen.getByText('In this setlist')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Black Orpheus/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Autumn Leaves/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Take Five/ })).toBeNull();
    expect(screen.queryByText('In library')).toBeNull();
    // Section headings dropped while filtering.
    expect(screen.queryByText('Set 1')).toBeNull();
    expect(screen.queryByText('Set 2')).toBeNull();
  });

  it('typing a query matching only a library song shows `In library` with that row, no `In this setlist` heading', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await user.type(
      screen.getByRole('searchbox', { name: 'Search this setlist or library' }),
      'sun',
    );
    expect(screen.getByText('In library')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sunny/ })).toBeInTheDocument();
    expect(screen.queryByText('In this setlist')).toBeNull();
  });

  it('a library song sharing a title with a setlist song is NOT duplicated in `In library` (AC-4 de-dup)', async () => {
    const user = userEvent.setup();
    renderOverlay();
    // `autumn` matches "Autumn Leaves" — which is BOTH a setlist entry
    // (via SongRef) and a library entry (via `LIBRARY_SONGS`). It must
    // appear exactly once, under `In this setlist`.
    await user.type(
      screen.getByRole('searchbox', { name: 'Search this setlist or library' }),
      'autumn',
    );
    const matches = screen.getAllByRole('button', { name: /Autumn Leaves/ });
    expect(matches).toHaveLength(1);
    expect(screen.getByText('In this setlist')).toBeInTheDocument();
    expect(screen.queryByText('In library')).toBeNull();
  });

  it('a query matching both setlist and library renders `In this setlist` before `In library` in DOM order (AC-5)', async () => {
    const user = userEvent.setup();
    renderOverlay();
    // `a` — a broad substring matching several titles across both buckets.
    await user.type(screen.getByRole('searchbox', { name: 'Search this setlist or library' }), 'a');
    const setlistHeading = screen.getByText('In this setlist');
    const libraryHeading = screen.getByText('In library');
    const position = setlistHeading.compareDocumentPosition(libraryHeading);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders nothing below the search input when a query matches neither setlist nor library (silence, no invented copy)', async () => {
    const user = userEvent.setup();
    renderOverlay();
    await user.type(
      screen.getByRole('searchbox', { name: 'Search this setlist or library' }),
      'zzznomatch',
    );
    expect(screen.queryByText('In this setlist')).toBeNull();
    expect(screen.queryByText('In library')).toBeNull();
    // Only the dismiss button remains interactive — no song rows.
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.getAttribute('aria-label')).toBe('Dismiss jump overlay');
  });
});

describe('JumpOverlay — row selection (AC-6)', () => {
  it('tapping a setlist row calls onSelectSong with that row songId then onDismiss after the fade', async () => {
    const user = userEvent.setup();
    const { onDismiss, onSelectSong } = renderOverlay();
    await user.click(screen.getByRole('button', { name: /Black Orpheus/ }));
    expect(onSelectSong).toHaveBeenCalledTimes(1);
    expect(onSelectSong).toHaveBeenCalledWith('song0000000002bb');
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1), { timeout: 1000 });
  });

  it('tapping a library-only row calls onSelectSong with that song id', async () => {
    const user = userEvent.setup();
    const { onSelectSong } = renderOverlay();
    await user.type(
      screen.getByRole('searchbox', { name: 'Search this setlist or library' }),
      'sunny',
    );
    await user.click(screen.getByRole('button', { name: /Sunny/ }));
    expect(onSelectSong).toHaveBeenCalledWith('song0000000004dd');
  });
});

describe('JumpOverlay — row key rendering from useSongs()', () => {
  it('renders the per-row key looked up via useSongs() next to the title', () => {
    renderOverlay();
    // "Autumn Leaves" row should show `Em` (from LIBRARY_SONGS lookup).
    const autumnRow = screen.getByRole('button', { name: /Autumn Leaves/ });
    expect(within(autumnRow).getByText('Em')).toBeInTheDocument();
  });
});
