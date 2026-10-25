import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SONG_FORM, SONGS } from '../lib/microcopy.js';
import { SongEdit } from './song-edit.js';

const { useSongMock, useSongsMock, saveSongMock } = vi.hoisted(() => ({
  useSongMock: vi.fn(),
  useSongsMock: vi.fn(),
  saveSongMock: vi.fn(),
}));
vi.mock('../hooks/use-song.js', () => ({ useSong: useSongMock }));
vi.mock('../hooks/use-songs.js', () => ({ useSongs: useSongsMock }));
vi.mock('../hooks/use-song-mutation.js', () => ({
  useSongMutation: () => ({ saveSong: saveSongMock }),
}));
vi.mock('../lib/id.js', () => ({ generateId: () => 'newsong000000001' }));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/songs" element={<p>list page</p>} />
        <Route path="/songs/new" element={<SongEdit />} />
        <Route path="/songs/:songId" element={<p>song page</p>} />
        <Route path="/songs/:songId/edit" element={<SongEdit />} />
      </Routes>
    </MemoryRouter>,
  );
}

const fullSong = {
  bandId: 'jack-ruby-5',
  songId: 'abc',
  title: 'Alpha Test Tune',
  key: 'Fm Blues',
  patch: 'Jazz Organ (P14)',
  chordChart: 'Fm7 | Bb7',
  performanceNotes: 'perf note text',
  practiceNotes: 'practice note text',
  serverReceivedAt: '2026-10-01T10:00:00.000Z',
  clientWrittenAt: '2026-10-01T09:00:00.000Z',
  version: 1,
};

beforeEach(() => {
  saveSongMock.mockReset().mockResolvedValue(undefined);
  useSongMock.mockReturnValue({ data: fullSong });
  useSongsMock.mockReturnValue({ data: undefined, isPending: true });
});

describe('SongEdit', () => {
  it('adds a song with only the filled fields', async () => {
    const user = userEvent.setup();
    renderAt('/songs/new');
    await user.type(screen.getByLabelText(SONG_FORM.title), 'Round Midnight');
    await user.type(screen.getByLabelText(SONG_FORM.key), 'Eb minor');
    await user.type(
      screen.getByLabelText(SONG_FORM.chordChart),
      'Cm7 | F7{Enter}Stage: watch Ivan',
    );
    await user.click(screen.getByRole('button', { name: SONG_FORM.save }));

    expect(saveSongMock).toHaveBeenCalledTimes(1);
    const record = saveSongMock.mock.calls[0]?.[0];
    expect(Object.keys(record).sort()).toEqual(
      ['bandId', 'songId', 'title', 'key', 'chordChart', 'clientWrittenAt', 'version'].sort(),
    );
    expect(record.songId).toBe('newsong000000001');
    expect(record.chordChart).toBe('Cm7 | F7\nStage: watch Ivan');
    expect(await screen.findByText('song page')).toBeInTheDocument();
  });

  it('edits a song, keeping notes and dropping a blanked field', async () => {
    const user = userEvent.setup();
    renderAt('/songs/abc/edit');
    expect(screen.getByLabelText(SONG_FORM.title)).toHaveValue('Alpha Test Tune');
    expect(screen.getByLabelText(SONG_FORM.key)).toHaveValue('Fm Blues');
    expect(screen.getByLabelText(SONG_FORM.chordChart)).toHaveValue('Fm7 | Bb7');
    await user.clear(screen.getByLabelText(SONG_FORM.patch));
    await user.clear(screen.getByLabelText(SONG_FORM.title));
    await user.type(screen.getByLabelText(SONG_FORM.title), 'Renamed Tune');
    await user.click(screen.getByRole('button', { name: SONG_FORM.save }));

    const record = saveSongMock.mock.calls[0]?.[0];
    expect(record.title).toBe('Renamed Tune');
    expect(record).not.toHaveProperty('patch');
    expect(record).not.toHaveProperty('serverReceivedAt');
    expect(record.performanceNotes).toBe('perf note text');
    expect(record.practiceNotes).toBe('practice note text');
    expect(record.clientWrittenAt).not.toBe(fullSong.clientWrittenAt);
    expect(await screen.findByText('song page')).toBeInTheDocument();
  });

  it('refuses a blank title', async () => {
    const user = userEvent.setup();
    renderAt('/songs/new');
    await user.type(screen.getByLabelText(SONG_FORM.title), '   ');
    await user.click(screen.getByRole('button', { name: SONG_FORM.save }));
    expect(screen.getByRole('alert')).toHaveTextContent(SONG_FORM.titleRequired);
    expect(saveSongMock).not.toHaveBeenCalled();
  });

  it('cancels an edit back to the song page without saving', async () => {
    const user = userEvent.setup();
    renderAt('/songs/abc/edit');
    await user.click(screen.getByRole('link', { name: SONG_FORM.cancel }));
    expect(screen.getByText('song page')).toBeInTheDocument();
    expect(saveSongMock).not.toHaveBeenCalled();
  });

  it('cancels an add back to the list', async () => {
    const user = userEvent.setup();
    renderAt('/songs/new');
    await user.click(screen.getByRole('link', { name: SONG_FORM.cancel }));
    expect(screen.getByText('list page')).toBeInTheDocument();
    expect(saveSongMock).not.toHaveBeenCalled();
  });

  it('shows not found for an unknown song', () => {
    useSongMock.mockReturnValue({ data: null, isPending: false });
    useSongsMock.mockReturnValue({ data: [], isPending: false });
    renderAt('/songs/nope/edit');
    expect(screen.getByText(SONGS.notFound)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: SONGS.backToSongs })).toHaveAttribute('href', '/songs');
    expect(screen.queryByLabelText(SONG_FORM.title)).not.toBeInTheDocument();
  });
});
