import { fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GIG_PLAY, GIG_SETLIST, SONG_FORM, SONGS, WAKE_LOCK } from '../lib/microcopy.js';
import { Song } from './song.js';

const { useSongMock, useSongsMock, useSetlistMock, useSetlistsMock, useWakeLockMock } = vi.hoisted(
  () => ({
    useSongMock: vi.fn(),
    useSongsMock: vi.fn(),
    useSetlistMock: vi.fn(),
    useSetlistsMock: vi.fn(),
    useWakeLockMock: vi.fn(),
  }),
);
vi.mock('../hooks/use-song.js', () => ({ useSong: useSongMock }));
vi.mock('../hooks/use-songs.js', () => ({ useSongs: useSongsMock }));
vi.mock('../hooks/use-setlist.js', () => ({ useSetlist: useSetlistMock }));
vi.mock('../hooks/use-setlists.js', () => ({ useSetlists: useSetlistsMock }));
vi.mock('../hooks/use-wake-lock.js', () => ({ useWakeLock: useWakeLockMock }));

beforeEach(() => {
  useSetlistMock.mockReturnValue({ data: undefined, isPending: true });
  useSetlistsMock.mockReturnValue({ data: undefined, isPending: true });
  useWakeLockMock.mockReset();
  useWakeLockMock.mockReturnValue({ failed: false });
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

const ref = (songId: string) => ({ songId, titleSnapshot: `Title ${songId}` });
const gigWith = () => ({
  setlistId: 'g1',
  gigMeta: { venue: 'Venue A', date: '2026-11-07' },
  sections: [
    { name: 'Set 1', songs: [ref('a'), ref('b')] },
    { name: 'Set 2', songs: [ref('a')] },
  ],
});

function renderSong() {
  return render(
    <MemoryRouter initialEntries={['/songs/abc']}>
      <Routes>
        <Route path="/songs/:songId" element={<Song />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderGigSong(entry = '/gigs/g1/songs/abc') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/gigs/:setlistId/songs/:songId" element={<Song />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Song', () => {
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

  it('shows key, patch and chart for a full song, without the notes', () => {
    useSongMock.mockReturnValue({
      data: {
        songId: 'abc',
        title: 'Alpha Test Tune',
        key: 'Fm Blues',
        patch: 'Jazz Organ (P14)',
        chordChart: 'Fm7 | Bb7',
        performanceNotes: 'perf note text',
        practiceNotes: 'practice note text',
      },
    });
    useSongsMock.mockReturnValue({ data: undefined, isPending: true });
    renderSong();
    expect(screen.getByText('Fm Blues · Jazz Organ (P14)')).toBeInTheDocument();
    expect(screen.getByText('Fm7 | Bb7')).toBeInTheDocument();
    expect(screen.queryByText('perf note text')).not.toBeInTheDocument();
    expect(screen.queryByText('practice note text')).not.toBeInTheDocument();
  });

  it('shows only the title when nothing else is set', () => {
    useSongMock.mockReturnValue({ data: { songId: 'abc', title: 'Alpha Test Tune' } });
    useSongsMock.mockReturnValue({ data: undefined, isPending: true });
    const { container } = renderSong();
    expect(screen.getByRole('heading', { name: 'Alpha Test Tune' })).toBeInTheDocument();
    expect(container.textContent).not.toContain('·');
    expect(container.querySelectorAll('p').length).toBe(0);
  });

  it('shows just the key when there is no patch', () => {
    useSongMock.mockReturnValue({
      data: { songId: 'abc', title: 'Alpha Test Tune', key: 'Fm Blues' },
    });
    useSongsMock.mockReturnValue({ data: undefined, isPending: true });
    const { container } = renderSong();
    expect(screen.getByText('Fm Blues')).toBeInTheDocument();
    expect(container.textContent).not.toContain('·');
  });

  it('keeps chart line breaks', () => {
    const chart = 'Fm7 | Bb7\nStage: watch Ivan for the stop';
    useSongMock.mockReturnValue({
      data: { songId: 'abc', title: 'Alpha Test Tune', chordChart: chart },
    });
    useSongsMock.mockReturnValue({ data: undefined, isPending: true });
    renderSong();
    const el = screen.getByTestId('chord-chart');
    expect(el.textContent).toBe(chart);
    expect(el).toHaveClass('whitespace-pre-wrap');
  });

  it('links to the edit form when the song is shown', () => {
    useSongMock.mockReturnValue({ data: { songId: 'abc', title: 'Alpha Test Tune' } });
    useSongsMock.mockReturnValue({ data: undefined, isPending: true });
    renderSong();
    expect(screen.getByRole('link', { name: SONG_FORM.editLink })).toHaveAttribute(
      'href',
      '/songs/abc/edit',
    );
  });

  it('has no edit link when the song is not found', () => {
    useSongMock.mockReturnValue({ data: null, isPending: false });
    useSongsMock.mockReturnValue({ data: [], isPending: false });
    renderSong();
    expect(screen.queryByRole('link', { name: SONG_FORM.editLink })).not.toBeInTheDocument();
  });

  describe('inside a gig', () => {
    it('shows the title, links Back to gig and has no Edit link', () => {
      useSongMock.mockReturnValue({ data: { songId: 'abc', title: 'Alpha Test Tune' } });
      useSongsMock.mockReturnValue({ data: undefined, isPending: true });
      renderGigSong();
      expect(
        screen.getByRole('heading', { level: 1, name: 'Alpha Test Tune' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: GIG_SETLIST.backToGig })).toHaveAttribute(
        'href',
        '/gigs/g1',
      );
      expect(screen.queryByRole('link', { name: SONGS.backToSongs })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: SONG_FORM.editLink })).not.toBeInTheDocument();
    });

    it('shows not found with Back to gig', () => {
      useSongMock.mockReturnValue({ data: null, isPending: false });
      useSongsMock.mockReturnValue({ data: [], isPending: false });
      renderGigSong();
      expect(screen.getByText(SONGS.notFound)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: GIG_SETLIST.backToGig })).toHaveAttribute(
        'href',
        '/gigs/g1',
      );
    });
  });

  describe('play bar', () => {
    const setup = (songId: string, query = '', song: unknown = { songId, title: 'T' }) => {
      useSongMock.mockReturnValue({ data: song, isPending: false });
      useSongsMock.mockReturnValue({ data: [], isPending: false });
      useSetlistMock.mockReturnValue({ data: gigWith() });
      renderGigSong(`/gigs/g1/songs/${songId}${query}`);
    };

    it('in the middle shows both links and the position', () => {
      setup('b');
      expect(screen.getByRole('link', { name: GIG_PLAY.previousSong })).toHaveAttribute(
        'href',
        '/gigs/g1/songs/a?at=1',
      );
      expect(screen.getByRole('link', { name: GIG_PLAY.nextSong })).toHaveAttribute(
        'href',
        '/gigs/g1/songs/a?at=3',
      );
      expect(screen.getByText('2 of 3')).toBeInTheDocument();
      expect(screen.queryByText('Previous')).not.toBeInTheDocument();
      expect(screen.queryByText('Next')).not.toBeInTheDocument();
    });

    it('carries the scroll-padding hook', () => {
      setup('b');
      expect(screen.getByText('2 of 3').closest('nav')).toHaveAttribute('data-bottom-bar', 'play');
    });

    it('steps both ways and ignores the inert end', () => {
      setup('b', '?at=2');
      fireEvent.click(screen.getByLabelText(GIG_PLAY.nextSong));
      expect(screen.getByText('3 of 3')).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText(GIG_PLAY.previousSong));
      expect(screen.getByText('2 of 3')).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText(GIG_PLAY.previousSong));
      expect(screen.getByText('1 of 3')).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText(GIG_PLAY.previousSong));
      expect(screen.getByText('1 of 3')).toBeInTheDocument();
    });

    it('at the first song Previous is inert', () => {
      setup('a', '?at=1');
      const prev = screen.getByLabelText(GIG_PLAY.previousSong);
      expect(prev).toHaveAttribute('aria-disabled', 'true');
      expect(prev).not.toHaveAttribute('href');
      expect(screen.getByRole('link', { name: GIG_PLAY.nextSong })).toHaveAttribute(
        'href',
        '/gigs/g1/songs/b?at=2',
      );
    });

    it('at the last song Next is inert', () => {
      setup('a', '?at=3');
      expect(screen.getByText('3 of 3')).toBeInTheDocument();
      const next = screen.getByLabelText(GIG_PLAY.nextSong);
      expect(next).toHaveAttribute('aria-disabled', 'true');
      expect(next).not.toHaveAttribute('href');
      expect(screen.getByRole('link', { name: GIG_PLAY.previousSong })).toBeInTheDocument();
    });

    it('a repeated song with no at shows its first place', () => {
      setup('a');
      expect(screen.getByText('1 of 3')).toBeInTheDocument();
    });

    it('still shows when the song record is not found', () => {
      setup('b', '', null);
      expect(screen.getByText(SONGS.notFound)).toBeInTheDocument();
      expect(screen.getByText('2 of 3')).toBeInTheDocument();
    });

    it('is absent when the setlist has not loaded', () => {
      useSongMock.mockReturnValue({ data: { songId: 'b', title: 'T' } });
      useSongsMock.mockReturnValue({ data: undefined, isPending: true });
      renderGigSong('/gigs/g1/songs/b');
      expect(screen.queryByLabelText(GIG_PLAY.nextSong)).not.toBeInTheDocument();
    });

    it('is absent when the song is not in the setlist', () => {
      setup('zzz');
      expect(screen.queryByLabelText(GIG_PLAY.nextSong)).not.toBeInTheDocument();
    });

    it('is absent on /songs/:songId', () => {
      useSongMock.mockReturnValue({ data: { songId: 'abc', title: 'T' } });
      useSongsMock.mockReturnValue({ data: undefined, isPending: true });
      renderSong();
      expect(screen.queryByLabelText(GIG_PLAY.nextSong)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(GIG_PLAY.previousSong)).not.toBeInTheDocument();
    });
  });

  describe('wake lock', () => {
    const found = () => {
      useSongMock.mockReturnValue({ data: { songId: 'abc', title: 'T' }, isPending: false });
      useSongsMock.mockReturnValue({ data: [], isPending: false });
    };
    const notFound = () => {
      useSongMock.mockReturnValue({ data: null, isPending: false });
      useSongsMock.mockReturnValue({ data: [], isPending: false });
    };

    it('is held on /songs/:songId', () => {
      found();
      renderSong();
      expect(useWakeLockMock).toHaveBeenCalled();
    });

    it('is held on the gig song route', () => {
      found();
      renderGigSong();
      expect(useWakeLockMock).toHaveBeenCalled();
    });

    it('shows no note while the lock is held', () => {
      found();
      renderSong();
      expect(screen.queryByText(WAKE_LOCK.maySleep)).not.toBeInTheDocument();
    });

    it('shows the note when the lock failed, on both routes', () => {
      useWakeLockMock.mockReturnValue({ failed: true });
      found();
      const { unmount } = renderSong();
      expect(screen.getByText(WAKE_LOCK.maySleep)).toBeInTheDocument();
      unmount();
      renderGigSong();
      expect(screen.getByText(WAKE_LOCK.maySleep)).toBeInTheDocument();
    });

    it('shows the note when the song is not found', () => {
      useWakeLockMock.mockReturnValue({ failed: true });
      notFound();
      renderSong();
      expect(screen.getByText(SONGS.notFound)).toBeInTheDocument();
      expect(screen.getByText(WAKE_LOCK.maySleep)).toBeInTheDocument();
    });

    it('is kept across Next and released on leaving the song page', () => {
      const life = { mounts: 0, unmounts: 0 };
      useWakeLockMock.mockImplementation(() => {
        useEffect(() => {
          life.mounts += 1;
          return () => {
            life.unmounts += 1;
          };
        }, []);
        return { failed: false };
      });
      useSongMock.mockReturnValue({ data: { songId: 'a', title: 'T' }, isPending: false });
      useSongsMock.mockReturnValue({ data: [], isPending: false });
      useSetlistMock.mockReturnValue({ data: gigWith() });
      render(
        <MemoryRouter initialEntries={['/gigs/g1/songs/a?at=1']}>
          <Routes>
            <Route path="/gigs/:setlistId" element={<p>Gig page</p>} />
            <Route path="/gigs/:setlistId/songs/:songId" element={<Song />} />
          </Routes>
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByRole('link', { name: GIG_PLAY.nextSong }));
      expect(screen.getByText('2 of 3')).toBeInTheDocument();
      expect(life).toEqual({ mounts: 1, unmounts: 0 });
      fireEvent.click(screen.getByRole('link', { name: GIG_SETLIST.backToGig }));
      expect(screen.getByText('Gig page')).toBeInTheDocument();
      expect(life).toEqual({ mounts: 1, unmounts: 1 });
    });
  });
});
