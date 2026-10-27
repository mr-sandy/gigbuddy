import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SONG_DELETE, SONG_FORM, SONGS } from '../lib/microcopy.js';
import { SongEdit } from './song-edit.js';

const { useSongMock, useSongsMock, useSetlistsMock, saveSongMock, deleteSongMock } = vi.hoisted(
  () => ({
    useSongMock: vi.fn(),
    useSongsMock: vi.fn(),
    useSetlistsMock: vi.fn(),
    saveSongMock: vi.fn(),
    deleteSongMock: vi.fn(),
  }),
);
vi.mock('../hooks/use-song.js', () => ({ useSong: useSongMock }));
vi.mock('../hooks/use-songs.js', () => ({ useSongs: useSongsMock }));
vi.mock('../hooks/use-setlists.js', () => ({ useSetlists: useSetlistsMock }));
vi.mock('../hooks/use-song-mutation.js', () => ({
  useSongMutation: () => ({ saveSong: saveSongMock, deleteSong: deleteSongMock }),
}));
vi.mock('../lib/id.js', () => ({ generateId: () => 'newsong000000001' }));

function Pathname() {
  return <output data-testid="pathname">{useLocation().pathname}</output>;
}

function BackButton() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      back
    </button>
  );
}

function renderAt(...history: string[]) {
  const result = render(tree(history));
  // A fresh tree re-renders with whatever the hook mocks now return; the
  // router keeps its history.
  return { ...result, rerenderTree: () => result.rerender(tree(history)) };
}

function tree(history: string[]) {
  return (
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <Routes>
        <Route
          path="/songs"
          element={
            <>
              <p>list page</p>
              <Pathname />
              <BackButton />
              <Link to="/songs/new">open add</Link>
              <Outlet />
            </>
          }
        >
          <Route path="new" element={<SongEdit />} />
        </Route>
        <Route
          path="/songs/:songId"
          element={
            <>
              <p>song page</p>
              <Pathname />
              <BackButton />
              <Link to="/songs/abc/edit">open edit</Link>
              <Outlet />
            </>
          }
        >
          <Route path="edit" element={<SongEdit />} />
        </Route>
      </Routes>
    </MemoryRouter>
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
  useSetlistsMock.mockReturnValue({ data: [] });
  deleteSongMock.mockReset().mockResolvedValue('deleted');
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
    await user.click(screen.getByRole('button', { name: SONG_FORM.add }));

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

  it('keeps Save disabled until the title has content', async () => {
    const user = userEvent.setup();
    renderAt('/songs/new');
    const save = screen.getByRole('button', { name: SONG_FORM.add });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText(SONG_FORM.title), '   ');
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText(SONG_FORM.title), 'New Tune');
    expect(save).toBeEnabled();
    await user.click(save);
    expect(saveSongMock).toHaveBeenCalledTimes(1);
  });

  it('disables Save when an edit clears the title', async () => {
    const user = userEvent.setup();
    renderAt('/songs/abc/edit');
    expect(screen.getByRole('button', { name: SONG_FORM.save })).toBeEnabled();
    await user.clear(screen.getByLabelText(SONG_FORM.title));
    expect(screen.getByRole('button', { name: SONG_FORM.save })).toBeDisabled();
  });

  it('opens as a dialog named by its title over the page it came from', () => {
    renderAt('/songs/new');
    expect(screen.getByRole('dialog', { name: SONG_FORM.addHeading })).toBeInTheDocument();
    expect(screen.getByText('list page')).toBeInTheDocument();
  });

  it('shows Edit song and Save for an existing song, with no old page chrome', () => {
    renderAt('/songs/abc/edit');
    expect(screen.getByRole('dialog', { name: SONG_FORM.editHeading })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: SONG_FORM.save })).toBeInTheDocument();
    expect(screen.getByText('song page')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Back to song' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: SONG_FORM.cancel })).not.toBeInTheDocument();
  });

  it('cancels an edit opened directly by replacing to the song page, without saving', async () => {
    const user = userEvent.setup();
    renderAt('/songs/abc/edit');
    await user.click(screen.getByRole('button', { name: SONG_FORM.cancel }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('song page')).toBeInTheDocument();
    expect(saveSongMock).not.toHaveBeenCalled();
  });

  it('closes on Escape, discarding changes', async () => {
    const user = userEvent.setup();
    renderAt('/songs/abc/edit');
    await user.type(screen.getByLabelText(SONG_FORM.title), ' more');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('song page')).toBeInTheDocument();
    expect(saveSongMock).not.toHaveBeenCalled();
  });

  it('steps back on Escape when there is history, as Cancel does', async () => {
    const user = userEvent.setup();
    renderAt('/songs', '/songs/abc', '/songs/abc/edit');
    await user.keyboard('{Escape}');
    expect(screen.getByText('song page')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'back' }));
    expect(screen.getByText('list page')).toBeInTheDocument();
  });

  it('saves once when Save is tapped twice', async () => {
    const user = userEvent.setup();
    let finish = () => {};
    saveSongMock.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    renderAt('/songs', '/songs/abc', '/songs/abc/edit');
    const save = screen.getByRole('button', { name: SONG_FORM.save });
    await user.click(save);
    await user.click(save);
    expect(saveSongMock).toHaveBeenCalledTimes(1);
    finish();
    // "song page" is the parent route, always rendered; wait for the sheet itself to go.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('song page')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'back' }));
    expect(screen.getByText('list page')).toBeInTheDocument();
  });

  it('leaves an edit by stepping back, so Back then reaches the list', async () => {
    const user = userEvent.setup();
    renderAt('/songs', '/songs/abc', '/songs/abc/edit');
    await user.click(screen.getByRole('button', { name: SONG_FORM.save }));
    expect(screen.getByText('song page')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'back' }));
    expect(screen.getByText('list page')).toBeInTheDocument();
  });

  it('cancels an edit by stepping back when there is history', async () => {
    const user = userEvent.setup();
    renderAt('/songs', '/songs/abc', '/songs/abc/edit');
    await user.click(screen.getByRole('button', { name: SONG_FORM.cancel }));
    await user.click(screen.getByRole('button', { name: 'back' }));
    expect(screen.getByText('list page')).toBeInTheDocument();
    expect(saveSongMock).not.toHaveBeenCalled();
  });

  it('cancels an add by stepping back when there is history', async () => {
    const user = userEvent.setup();
    renderAt('/songs', '/songs/new');
    await user.click(screen.getByRole('button', { name: SONG_FORM.cancel }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('list page')).toBeInTheDocument();
    expect(saveSongMock).not.toHaveBeenCalled();
  });

  it('cancels an add opened directly back to the list', async () => {
    const user = userEvent.setup();
    renderAt('/songs/new');
    await user.click(screen.getByRole('button', { name: SONG_FORM.cancel }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('list page')).toBeInTheDocument();
  });

  it('returns focus to the control that opened it', async () => {
    const user = userEvent.setup();
    renderAt('/songs');
    const opener = screen.getByRole('link', { name: 'open add' });
    await user.click(opener);
    expect(screen.getByRole('dialog', { name: SONG_FORM.addHeading })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: SONG_FORM.cancel }));
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('returns focus to the Edit opener, even when the song loads after opening', async () => {
    const user = userEvent.setup();
    useSongMock.mockReturnValue({ data: undefined, isPending: true });
    const { rerenderTree } = renderAt('/songs/abc');
    const opener = screen.getByRole('link', { name: 'open edit' });
    await user.click(opener);
    expect(screen.getByText(SONGS.loading)).toBeInTheDocument();
    useSongMock.mockReturnValue({ data: fullSong });
    rerenderTree();
    expect(screen.getByLabelText(SONG_FORM.title)).toHaveValue('Alpha Test Tune');
    await user.click(screen.getByRole('button', { name: SONG_FORM.cancel }));
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('shows not found for an unknown song', () => {
    useSongMock.mockReturnValue({ data: null, isPending: false });
    useSongsMock.mockReturnValue({ data: [], isPending: false });
    renderAt('/songs/nope/edit');
    expect(screen.getByText(SONGS.notFound)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: SONG_FORM.editHeading })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: SONG_FORM.save })).toBeDisabled();
    expect(screen.queryByLabelText(SONG_FORM.title)).not.toBeInTheDocument();
  });
});

describe('SongEdit delete', () => {
  const gigWith = (songId: string) => ({
    setlistId: 'g1',
    gigMeta: { venue: 'The Venue', date: '2026-11-14' },
    sections: [{ name: '', songs: [{ songId, titleSnapshot: 'Alpha Test Tune' }] }],
  });

  it('is not offered when adding a song', () => {
    renderAt('/songs/new');
    expect(screen.queryByRole('button', { name: SONG_DELETE.button })).not.toBeInTheDocument();
  });

  it('asks in a dialog first, and Keep leaves the song alone', async () => {
    const user = userEvent.setup();
    renderAt('/songs/abc/edit');
    const del = screen.getByRole('button', { name: SONG_DELETE.button });
    expect(del).toHaveAttribute('data-variant', 'destructive-outline');
    await user.click(del);
    const dialog = screen.getByRole('alertdialog', { name: SONG_DELETE.title('Alpha Test Tune') });
    expect(dialog).toHaveTextContent(SONG_DELETE.explain);
    expect(screen.getByRole('button', { name: SONG_DELETE.yes })).toHaveAttribute(
      'data-variant',
      'destructive',
    );
    const keep = screen.getByRole('button', { name: SONG_DELETE.keep });
    expect(keep).toHaveAttribute('data-variant', 'outline');
    expect(keep).toHaveFocus();
    await user.click(keep);
    expect(deleteSongMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: SONG_FORM.editHeading })).toBeInTheDocument();
    await waitFor(() => expect(del).toHaveFocus());
  });

  it('closes only the confirm dialog on Escape, not the sheet', async () => {
    const user = userEvent.setup();
    renderAt('/songs/abc/edit');
    await user.click(screen.getByRole('button', { name: SONG_DELETE.button }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: SONG_FORM.editHeading })).toBeInTheDocument();
  });

  it('deletes on Yes, delete and goes to the song list', async () => {
    const user = userEvent.setup();
    renderAt('/songs/abc/edit');
    await user.click(screen.getByRole('button', { name: SONG_DELETE.button }));
    await user.click(screen.getByRole('button', { name: SONG_DELETE.yes }));
    expect(deleteSongMock).toHaveBeenCalledWith('abc');
    expect(await screen.findByText('list page')).toBeInTheDocument();
  });

  describe('Back after delete (Story 7.23)', () => {
    afterEach(() => {
      window.history.replaceState(null, '', '/');
    });

    it('steps back past the song page when there is history', async () => {
      window.history.replaceState({ idx: 2 }, '');
      const user = userEvent.setup();
      renderAt('/songs/other', '/songs', '/songs/abc', '/songs/abc/edit');
      await user.click(screen.getByRole('button', { name: SONG_DELETE.button }));
      await user.click(screen.getByRole('button', { name: SONG_DELETE.yes }));
      await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/songs'));
      await user.click(screen.getByRole('button', { name: 'back' }));
      expect(screen.getByTestId('pathname')).toHaveTextContent('/songs/other');
    });

    it('replaces the sheet with the list when the history is too short', async () => {
      window.history.replaceState({ idx: 1 }, '');
      const user = userEvent.setup();
      renderAt('/songs/other', '/songs', '/songs/abc', '/songs/abc/edit');
      await user.click(screen.getByRole('button', { name: SONG_DELETE.button }));
      await user.click(screen.getByRole('button', { name: SONG_DELETE.yes }));
      await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/songs'));
      await user.click(screen.getByRole('button', { name: 'back' }));
      expect(screen.getByTestId('pathname')).toHaveTextContent('/songs/abc');
    });
  });

  it('names the gigs that use the song and offers only OK', async () => {
    useSetlistsMock.mockReturnValue({
      data: [gigWith('abc'), { ...gigWith('zzz'), setlistId: 'g2' }],
    });
    const user = userEvent.setup();
    renderAt('/songs/abc/edit');
    await user.click(screen.getByRole('button', { name: SONG_DELETE.button }));
    const dialog = screen.getByRole('alertdialog', {
      name: SONG_DELETE.inUseTitle('Alpha Test Tune'),
    });
    expect(dialog).toHaveTextContent(SONG_DELETE.inUse);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('listitem').textContent).toMatch(/^The Venue, /);
    expect(screen.queryByRole('button', { name: SONG_DELETE.yes })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: SONG_DELETE.keep })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: SONG_DELETE.ok }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('says so when the API reports the song in use', async () => {
    deleteSongMock.mockResolvedValue('in-use');
    const user = userEvent.setup();
    renderAt('/songs/abc/edit');
    await user.click(screen.getByRole('button', { name: SONG_DELETE.button }));
    await user.click(screen.getByRole('button', { name: SONG_DELETE.yes }));
    expect(await screen.findByRole('alert')).toHaveTextContent(SONG_DELETE.inUseUnknown);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('says so when the delete fails', async () => {
    deleteSongMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    renderAt('/songs/abc/edit');
    await user.click(screen.getByRole('button', { name: SONG_DELETE.button }));
    await user.click(screen.getByRole('button', { name: SONG_DELETE.yes }));
    expect(await screen.findByRole('alert')).toHaveTextContent(SONG_DELETE.failed);
    expect(screen.getByLabelText(SONG_FORM.title)).toHaveValue('Alpha Test Tune');
  });
});
