import { ACTIVE_BAND_ID, type Song } from '@gigbuddy/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIONS, EMPTY_STATES } from '../lib/microcopy.js';
import { Library } from './library.js';

const { useSongsMock, isIPhoneMock } = vi.hoisted(() => ({
  useSongsMock: vi.fn(),
  isIPhoneMock: vi.fn().mockReturnValue(false),
}));
vi.mock('../hooks/use-songs.js', () => ({ useSongs: useSongsMock }));
vi.mock('../lib/platform.js', () => ({
  isIPhone: () => isIPhoneMock(),
  isStandalone: () => false,
}));

function makeSong(songId: string, title: string): Song {
  return {
    bandId: ACTIVE_BAND_ID,
    songId,
    title,
    clientWrittenAt: '2026-06-17T12:00:00.000Z',
    serverReceivedAt: '2026-06-17T12:00:01.000Z',
    version: 1 as const,
  };
}

function renderLibrary() {
  return render(
    <MemoryRouter>
      <Library />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useSongsMock.mockReset();
  isIPhoneMock.mockReset().mockReturnValue(false);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Library', () => {
  it('renders one row per song in the order returned by useSongs', () => {
    // Deliberately non-alphabetical order — proves the route trusts the
    // hook's order and does NOT re-sort client-side (the server alphabetizes;
    // the client must preserve whatever the hook returns).
    useSongsMock.mockReturnValue({
      data: [
        makeSong('c', 'Charleston'),
        makeSong('a', 'Autumn Leaves'),
        makeSong('b', 'Blue Bossa'),
      ],
      isLoading: false,
    });
    renderLibrary();
    const links = screen.getAllByRole('link');
    // First link is "+ New song"; the next three are the song rows in hook
    // order; the final link is the Story 5.1 `Export all data` footer
    // affordance (MacBook default — `isIPhoneMock` returns false).
    expect(links).toHaveLength(5);
    expect(links[0]).toHaveAttribute('href', '/songs/new');
    expect(links[1]).toHaveTextContent('Charleston');
    expect(links[1]).toHaveAttribute('href', '/songs/c');
    expect(links[2]).toHaveTextContent('Autumn Leaves');
    expect(links[2]).toHaveAttribute('href', '/songs/a');
    expect(links[3]).toHaveTextContent('Blue Bossa');
    expect(links[3]).toHaveAttribute('href', '/songs/b');
    expect(links[4]).toHaveAttribute('href', '/api/v1/export');
    expect(links[4]).toHaveTextContent(ACTIONS.exportAllData);
  });

  it('renders the locked empty-state copy when data is an empty array', () => {
    useSongsMock.mockReturnValue({ data: [], isLoading: false });
    renderLibrary();
    expect(screen.getByText(EMPTY_STATES.noSongsInLibrary)).toBeInTheDocument();
  });

  it('shows the + New song affordance in both empty and populated states', () => {
    useSongsMock.mockReturnValue({ data: [], isLoading: false });
    const { rerender } = renderLibrary();
    expect(screen.getByRole('link', { name: ACTIONS.newSong })).toHaveAttribute(
      'href',
      '/songs/new',
    );
    useSongsMock.mockReturnValue({
      data: [makeSong('a', 'Autumn Leaves')],
      isLoading: false,
    });
    rerender(
      <MemoryRouter>
        <Library />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: ACTIONS.newSong })).toHaveAttribute(
      'href',
      '/songs/new',
    );
  });

  it('renders only the loading announcement while data is undefined and isLoading', () => {
    useSongsMock.mockReturnValue({ data: undefined, isLoading: true });
    renderLibrary();
    expect(screen.getByText('Loading library.')).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_STATES.noSongsInLibrary)).toBeNull();
    // The + New song link remains visible during loading too.
    expect(screen.getByRole('link', { name: ACTIONS.newSong })).toBeInTheDocument();
  });

  it('exposes a Library h1 to the accessibility tree', () => {
    useSongsMock.mockReturnValue({ data: [], isLoading: false });
    renderLibrary();
    expect(screen.getByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument();
  });

  it('does NOT set aria-label on song row links (visible text is the accessible name)', () => {
    useSongsMock.mockReturnValue({
      data: [makeSong('a', 'Autumn Leaves')],
      isLoading: false,
    });
    renderLibrary();
    const row = screen.getByRole('link', { name: 'Autumn Leaves' });
    expect(row.hasAttribute('aria-label')).toBe(false);
  });

  it('+ New song link satisfies min-h-tap and has accessible name from ACTIONS.newSong', () => {
    useSongsMock.mockReturnValue({ data: [], isLoading: false });
    renderLibrary();
    const link = screen.getByRole('link', { name: ACTIONS.newSong });
    expect(link.className).toContain('min-h-tap');
  });
});

/*
 * Story 5.1 (FR-33, AR-38) — MacBook Library footer affordance. The
 * `Export all data` link must be a plain `<a href="/api/v1/export">` so
 * the browser handles the `Content-Disposition: attachment` response as
 * a native download; iPhone does not render the affordance in V1.
 */
describe('Library — Export all data footer affordance (Story 5.1)', () => {
  it('renders the Export all data link on MacBook with the correct href and text', () => {
    isIPhoneMock.mockReturnValue(false);
    useSongsMock.mockReturnValue({ data: [], isLoading: false });
    renderLibrary();
    const link = screen.getByRole('link', { name: ACTIONS.exportAllData });
    expect(link).toHaveAttribute('href', '/api/v1/export');
    expect(link).toHaveTextContent('Export all data');
  });

  it('renders the Export all data link on both the empty and populated branches', () => {
    isIPhoneMock.mockReturnValue(false);
    useSongsMock.mockReturnValue({ data: [], isLoading: false });
    const { rerender } = renderLibrary();
    expect(screen.getByRole('link', { name: ACTIONS.exportAllData })).toBeInTheDocument();
    useSongsMock.mockReturnValue({
      data: [makeSong('a', 'Autumn Leaves')],
      isLoading: false,
    });
    rerender(
      <MemoryRouter>
        <Library />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: ACTIONS.exportAllData })).toBeInTheDocument();
  });

  it('does NOT render the Export all data link on iPhone', () => {
    isIPhoneMock.mockReturnValue(true);
    useSongsMock.mockReturnValue({ data: [], isLoading: false });
    renderLibrary();
    expect(screen.queryByRole('link', { name: ACTIONS.exportAllData })).toBeNull();
  });

  it('Export all data link satisfies min-h-tap', () => {
    isIPhoneMock.mockReturnValue(false);
    useSongsMock.mockReturnValue({ data: [], isLoading: false });
    renderLibrary();
    const link = screen.getByRole('link', { name: ACTIONS.exportAllData });
    expect(link.className).toContain('min-h-tap');
  });

  it('uses a plain <a> element (not a React Router Link) so browser handles the download', () => {
    isIPhoneMock.mockReturnValue(false);
    useSongsMock.mockReturnValue({ data: [], isLoading: false });
    renderLibrary();
    const link = screen.getByRole('link', { name: ACTIONS.exportAllData });
    // A plain <a href="/api/v1/export"> yields the literal absolute path
    // in the href attribute. React Router's <Link> would strip the leading
    // slash and route via history.pushState — no download would fire.
    expect(link.getAttribute('href')).toBe('/api/v1/export');
    expect(link.tagName).toBe('A');
  });
});
