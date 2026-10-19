import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { SONGS } from '../lib/microcopy.js';
import { Song } from './song.js';

const { useSongMock, useSongsMock } = vi.hoisted(() => ({
  useSongMock: vi.fn(),
  useSongsMock: vi.fn(),
}));
vi.mock('../hooks/use-song.js', () => ({ useSong: useSongMock }));
vi.mock('../hooks/use-songs.js', () => ({ useSongs: useSongsMock }));

function renderSong() {
  return render(
    <MemoryRouter initialEntries={['/songs/abc']}>
      <Routes>
        <Route path="/songs/:songId" element={<Song />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Song (stub page)', () => {
  it('shows the title from useSong', () => {
    useSongMock.mockReturnValue({ data: { songId: 'abc', title: 'Alpha Test Tune' } });
    useSongsMock.mockReturnValue({ data: undefined, isPending: true });
    renderSong();
    expect(screen.getByRole('heading', { level: 1, name: 'Alpha Test Tune' })).toBeInTheDocument();
  });

  it('falls back to the list cache while useSong is pending', () => {
    useSongMock.mockReturnValue({ data: undefined, isPending: true });
    useSongsMock.mockReturnValue({
      data: [{ songId: 'abc', title: 'beta test tune' }],
      isPending: false,
    });
    renderSong();
    expect(screen.getByRole('heading', { name: 'beta test tune' })).toBeInTheDocument();
  });

  it('shows not found when the server returned null and the list has no match', () => {
    useSongMock.mockReturnValue({ data: null, isPending: false });
    useSongsMock.mockReturnValue({ data: [], isPending: false });
    renderSong();
    expect(screen.getByText(SONGS.notFound)).toBeInTheDocument();
  });

  it('shows loading while nothing is available yet', () => {
    useSongMock.mockReturnValue({ data: undefined, isPending: true });
    useSongsMock.mockReturnValue({ data: undefined, isPending: true });
    renderSong();
    expect(screen.getByText(SONGS.loading)).toBeInTheDocument();
  });

  it('shows the error line when both fail', () => {
    useSongMock.mockReturnValue({ data: undefined, isPending: false, isError: true });
    useSongsMock.mockReturnValue({ data: undefined, isPending: false, isError: true });
    renderSong();
    expect(screen.getByText(SONGS.error)).toBeInTheDocument();
  });

  it('links back to /songs', () => {
    useSongMock.mockReturnValue({ data: null, isPending: false });
    useSongsMock.mockReturnValue({ data: [], isPending: false });
    renderSong();
    expect(screen.getByRole('link', { name: SONGS.backToSongs })).toHaveAttribute('href', '/songs');
  });
});
