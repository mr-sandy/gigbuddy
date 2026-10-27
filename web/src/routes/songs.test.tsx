import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { EXPORT, SONG_FORM, SONGS } from '../lib/microcopy.js';
import { Songs } from './songs.js';

const { useSongsMock } = vi.hoisted(() => ({ useSongsMock: vi.fn() }));
vi.mock('../hooks/use-songs.js', () => ({ useSongs: useSongsMock }));

function renderSongs() {
  return render(
    <MemoryRouter>
      <Songs />
    </MemoryRouter>,
  );
}

describe('Songs (list)', () => {
  it('renders rows in data order with links to each song', () => {
    useSongsMock.mockReturnValue({
      data: [
        { songId: 'a1', title: 'Alpha Test Tune' },
        { songId: 'b2', title: 'beta test tune' },
      ],
      isPending: false,
    });
    renderSongs();
    const rows = screen.getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual(['Alpha Test Tune', 'beta test tune']);
    expect(screen.getByRole('link', { name: 'Alpha Test Tune' })).toHaveAttribute(
      'href',
      '/songs/a1',
    );
    expect(screen.getByRole('link', { name: 'beta test tune' })).toHaveAttribute(
      'href',
      '/songs/b2',
    );
  });

  it('shows the title only, never the key', () => {
    useSongsMock.mockReturnValue({
      data: [{ songId: 'a1', title: 'Alpha Test Tune', key: 'Bb minor' }],
      isPending: false,
    });
    renderSongs();
    expect(screen.queryByText(/Bb minor/)).toBeNull();
  });

  it('renders the loading line', () => {
    useSongsMock.mockReturnValue({ data: undefined, isPending: true });
    renderSongs();
    expect(screen.getByText(SONGS.loading)).toHaveAttribute('aria-live', 'polite');
  });

  it('renders the error line', () => {
    useSongsMock.mockReturnValue({ data: undefined, isPending: false, isError: true });
    renderSongs();
    expect(screen.getByText(SONGS.error)).toBeInTheDocument();
  });

  it('renders the empty line', () => {
    useSongsMock.mockReturnValue({ data: [], isPending: false });
    renderSongs();
    expect(screen.getByText(SONGS.empty)).toBeInTheDocument();
  });

  it('shows cached data despite a background error', () => {
    useSongsMock.mockReturnValue({
      data: [{ songId: 'a1', title: 'Alpha Test Tune' }],
      isPending: false,
      isError: true,
    });
    renderSongs();
    expect(screen.getByText('Alpha Test Tune')).toBeInTheDocument();
    expect(screen.queryByText(SONGS.error)).toBeNull();
  });

  it('shows the band name in the header, with no Home link', () => {
    useSongsMock.mockReturnValue({ data: [], isPending: false });
    renderSongs();
    expect(screen.getByText('The Jack Ruby 5')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Home' })).toBeNull();
  });

  it('links to the add song form', () => {
    useSongsMock.mockReturnValue({ data: [], isPending: false });
    renderSongs();
    expect(screen.getByRole('link', { name: SONG_FORM.addLink })).toHaveAttribute(
      'href',
      '/songs/new',
    );
  });

  it('ends a loaded list with a plain export link', () => {
    useSongsMock.mockReturnValue({
      data: [{ songId: 'a1', title: 'Alpha Test Tune' }],
      isPending: false,
    });
    renderSongs();
    const link = screen.getByRole('link', { name: EXPORT.link });
    expect(link).toHaveAttribute('href', '/api/v1/export');
    expect(link).toHaveAttribute('data-variant', 'link');
  });

  it('shows the export link when the list is empty or errored', () => {
    useSongsMock.mockReturnValue({ data: [], isPending: false });
    const { unmount } = renderSongs();
    expect(screen.getByRole('link', { name: EXPORT.link })).toBeInTheDocument();
    unmount();
    useSongsMock.mockReturnValue({ data: undefined, isPending: false, isError: true });
    renderSongs();
    expect(screen.getByRole('link', { name: EXPORT.link })).toBeInTheDocument();
  });
});
