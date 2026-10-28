import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Outlet, Route, Routes, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatGigDate } from '../lib/gig-date.js';
import { GIGS, SETLIST_TEXT } from '../lib/microcopy.js';
import { setlistToText } from '../lib/setlist-text.js';
import { SetlistEdit } from './setlist-edit.js';

const { useSetlistMock, useSetlistsMock, useSongsMock, saveSetlistMock, saveSongMock } = vi.hoisted(
  () => ({
    useSetlistMock: vi.fn(),
    useSetlistsMock: vi.fn(),
    useSongsMock: vi.fn(),
    saveSetlistMock: vi.fn(),
    saveSongMock: vi.fn(),
  }),
);
vi.mock('../hooks/use-setlist.js', () => ({ useSetlist: useSetlistMock }));
vi.mock('../hooks/use-setlists.js', () => ({ useSetlists: useSetlistsMock }));
vi.mock('../hooks/use-songs.js', () => ({ useSongs: useSongsMock }));
vi.mock('../hooks/use-setlist-mutation.js', () => ({
  useSetlistMutation: () => ({ saveSetlist: saveSetlistMock }),
}));
vi.mock('../hooks/use-song-mutation.js', () => ({
  useSongMutation: () => ({ saveSong: saveSongMock }),
}));

function BackButton() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      back
    </button>
  );
}

function renderAt(...history: string[]) {
  return render(
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <Routes>
        <Route path="/gigs" element={<p>list page</p>} />
        <Route
          path="/gigs/:setlistId"
          element={
            <>
              <p>gig page</p>
              <BackButton />
              <Outlet />
            </>
          }
        >
          <Route path="setlist" element={<SetlistEdit />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const sections = [
  { name: 'Set 1', songs: [{ songId: 's1', titleSnapshot: 'Tune A' }] },
  { name: 'Set 2', songs: [{ songId: 's2', titleSnapshot: 'Tune B' }] },
];
const fullGig = {
  bandId: 'jack-ruby-5',
  setlistId: 'g1',
  gigMeta: { venue: 'Venue A', date: '2026-11-07', time: '20:00' },
  sections,
  serverReceivedAt: '2026-10-01T10:00:00.000Z',
  clientWrittenAt: '2026-10-01T09:00:00.000Z',
  version: 1,
};
const songs = [
  { songId: 's1', title: 'Tune A' },
  { songId: 's2', title: 'Tune B' },
  { songId: 's3', title: 'Tune C' },
];

beforeEach(() => {
  saveSetlistMock.mockReset().mockResolvedValue(undefined);
  saveSongMock.mockReset().mockResolvedValue(undefined);
  useSetlistMock.mockReturnValue({ data: fullGig });
  useSetlistsMock.mockReturnValue({ data: undefined, isPending: true });
  useSongsMock.mockReturnValue({ data: songs, isPending: false });
});

describe('SetlistEdit', () => {
  it('opens as a dialog over the gig page, with the gig line as its description', () => {
    renderAt('/gigs/g1/setlist');
    const dialog = screen.getByRole('dialog', { name: SETLIST_TEXT.heading });
    expect(dialog).toHaveAccessibleDescription(`Venue A · ${formatGigDate('2026-11-07')}`);
    expect(screen.getByText('gig page')).toBeInTheDocument();
    expect(screen.getByLabelText(SETLIST_TEXT.label)).toHaveValue(setlistToText(sections));
  });

  it('describes the gig by date alone when it has no venue', () => {
    useSetlistMock.mockReturnValue({
      data: { ...fullGig, gigMeta: { venue: '', date: '2026-11-07' } },
    });
    renderAt('/gigs/g1/setlist');
    expect(screen.getByRole('dialog', { name: SETLIST_TEXT.heading })).toHaveAccessibleDescription(
      formatGigDate('2026-11-07'),
    );
  });

  it('saves edited text as a whole record, keeping gig details and annotations', async () => {
    const user = userEvent.setup();
    renderAt('/gigs/g1/setlist');
    const box = screen.getByLabelText(SETLIST_TEXT.label);
    await user.clear(box);
    await user.type(box, 'Tune C\nTune A');
    await user.click(screen.getByRole('button', { name: SETLIST_TEXT.save }));

    expect(saveSetlistMock).toHaveBeenCalledTimes(1);
    const record = saveSetlistMock.mock.calls[0]?.[0];
    expect(Object.keys(record).sort()).toEqual(
      ['bandId', 'setlistId', 'gigMeta', 'sections', 'clientWrittenAt', 'version'].sort(),
    );
    expect(record.gigMeta).toEqual(fullGig.gigMeta);
    expect(record.sections).toEqual([
      {
        name: '',
        songs: [
          { songId: 's3', titleSnapshot: 'Tune C' },
          { songId: 's1', titleSnapshot: 'Tune A' },
        ],
      },
    ]);
    expect(await screen.findByText('gig page')).toBeInTheDocument();
  });

  async function typeAndSave(text: string) {
    const user = userEvent.setup();
    renderAt('/gigs/g1/setlist');
    const box = screen.getByLabelText(SETLIST_TEXT.label);
    await user.clear(box);
    await user.type(box, text);
    await user.click(screen.getByRole('button', { name: SETLIST_TEXT.save }));
    return user;
  }

  it('asks about an unknown line on a second step, defaulting to a new song, and saves nothing', async () => {
    await typeAndSave('Tune A\nMYSTERY SONG');
    expect(screen.getByRole('dialog', { name: SETLIST_TEXT.checkHeading })).toBeInTheDocument();
    expect(screen.getByText(SETLIST_TEXT.checkIntro(1, 1))).toBeInTheDocument();
    const select = screen.getByRole('combobox', { name: '“MYSTERY SONG”' });
    expect(select).toHaveValue('new');
    expect(
      screen.getByRole('option', { name: SETLIST_TEXT.addNew('Mystery Song') }),
    ).toBeInTheDocument();
    expect(select).toHaveFocus();
    expect(screen.queryByRole('button', { name: SETLIST_TEXT.cancel })).not.toBeInTheDocument();
    expect(saveSetlistMock).not.toHaveBeenCalled();
    expect(saveSongMock).not.toHaveBeenCalled();
  });

  it('Back returns to the text exactly as it was', async () => {
    const user = await typeAndSave('Tune A\nMystery');
    await user.click(screen.getByRole('button', { name: SETLIST_TEXT.back }));
    expect(screen.getByLabelText(SETLIST_TEXT.label)).toHaveValue('Tune A\nMystery');
    expect(saveSetlistMock).not.toHaveBeenCalled();
  });

  it('saves a new song before the setlist and uses its id', async () => {
    const user = await typeAndSave('Tune A\nMYSTERY SONG\nmystery song');
    await user.click(screen.getByRole('button', { name: SETLIST_TEXT.save }));
    await vi.waitFor(() => expect(saveSetlistMock).toHaveBeenCalledTimes(1));
    expect(saveSongMock).toHaveBeenCalledTimes(1);
    const song = saveSongMock.mock.calls[0]?.[0];
    expect(Object.keys(song).sort()).toEqual(
      ['bandId', 'songId', 'title', 'clientWrittenAt', 'version'].sort(),
    );
    expect(song.title).toBe('Mystery Song');
    expect(saveSongMock.mock.invocationCallOrder[0]).toBeLessThan(
      saveSetlistMock.mock.invocationCallOrder[0] ?? 0,
    );
    expect(saveSetlistMock.mock.calls[0]?.[0].sections).toEqual([
      {
        name: '',
        songs: [
          { songId: 's1', titleSnapshot: 'Tune A' },
          { songId: song.songId, titleSnapshot: 'Mystery Song' },
          { songId: song.songId, titleSnapshot: 'Mystery Song' },
        ],
      },
    ]);
    expect(await screen.findByText('gig page')).toBeInTheDocument();
  });

  it('leaves a line out without creating a song', async () => {
    const user = await typeAndSave('Tune A\nMystery');
    await user.selectOptions(screen.getByRole('combobox'), SETLIST_TEXT.leaveOut);
    await user.click(screen.getByRole('button', { name: SETLIST_TEXT.save }));
    await vi.waitFor(() => expect(saveSetlistMock).toHaveBeenCalledTimes(1));
    expect(saveSongMock).not.toHaveBeenCalled();
    expect(saveSetlistMock.mock.calls[0]?.[0].sections).toEqual([
      { name: '', songs: [{ songId: 's1', titleSnapshot: 'Tune A' }] },
    ]);
  });

  it('saves a library song picked from the whole library', async () => {
    const user = await typeAndSave('Mystery');
    await user.selectOptions(screen.getByRole('combobox'), 'Tune C');
    await user.click(screen.getByRole('button', { name: SETLIST_TEXT.save }));
    await vi.waitFor(() => expect(saveSetlistMock).toHaveBeenCalledTimes(1));
    expect(saveSongMock).not.toHaveBeenCalled();
    expect(saveSetlistMock.mock.calls[0]?.[0].sections).toEqual([
      { name: '', songs: [{ songId: 's3', titleSnapshot: 'Tune C' }] },
    ]);
  });

  it('defaults a shared title to its first song, shown with its key', async () => {
    useSongsMock.mockReturnValue({
      data: [...songs, { songId: 's4', title: 'Tune A', key: 'E♭' }],
      isPending: false,
    });
    const user = await typeAndSave('Tune A');
    const select = screen.getByRole('combobox', { name: '“Tune A”' });
    expect(select).toHaveValue('song:s1');
    // The key shows on the shared-title candidates only, not in the whole-library group.
    expect(screen.getAllByRole('option', { name: 'Tune A · E♭' })).toHaveLength(1);
    expect(screen.getAllByRole('option', { name: 'Tune A' })).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: SETLIST_TEXT.save }));
    await vi.waitFor(() => expect(saveSetlistMock).toHaveBeenCalledTimes(1));
    expect(saveSetlistMock.mock.calls[0]?.[0].sections[0].songs).toEqual([
      { songId: 's1', titleSnapshot: 'Tune A' },
    ]);
  });

  it('saves in one step when every line matches, tidied', async () => {
    await typeAndSave('1. tune b 4:30');
    await vi.waitFor(() => expect(saveSetlistMock).toHaveBeenCalledTimes(1));
    expect(saveSetlistMock.mock.calls[0]?.[0].sections).toEqual([
      { name: '', songs: [{ songId: 's2', titleSnapshot: 'Tune B' }] },
    ]);
  });

  it('saves in one step when every line is a close match, with the library title', async () => {
    useSongsMock.mockReturnValue({
      data: [...songs, { songId: 's5', title: 'Cissy Strut' }],
      isPending: false,
    });
    await typeAndSave('C1ssy Strut');
    await vi.waitFor(() => expect(saveSetlistMock).toHaveBeenCalledTimes(1));
    expect(saveSetlistMock.mock.calls[0]?.[0].sections).toEqual([
      { name: '', songs: [{ songId: 's5', titleSnapshot: 'Cissy Strut' }] },
    ]);
  });

  it('lists close matches under "Matched for you" when another line needs a decision', async () => {
    useSongsMock.mockReturnValue({
      data: [...songs, { songId: 's5', title: 'Cissy Strut' }],
      isPending: false,
    });
    await typeAndSave('C1ssy Strut\nQqqqqqqq');
    expect(screen.getByRole('heading', { name: SETLIST_TEXT.matchedHeading })).toBeInTheDocument();
    expect(
      screen.getByText(SETLIST_TEXT.matchedItem('C1ssy Strut', 'Cissy Strut')),
    ).toBeInTheDocument();
  });

  it('has no "Matched for you" heading when nothing was matched for you', async () => {
    await typeAndSave('Tune A\nMYSTERY SONG');
    expect(screen.queryByText(SETLIST_TEXT.matchedHeading)).not.toBeInTheDocument();
  });

  it('defaults a less certain line to its best guess and saves that song', async () => {
    const user = await typeAndSave('Tune Cxx');
    const select = screen.getByRole('combobox', { name: '“Tune Cxx”' });
    expect(select).toHaveValue('song:s3');
    expect(screen.getByRole('group', { name: SETLIST_TEXT.bestGuess })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: SETLIST_TEXT.save }));
    await vi.waitFor(() => expect(saveSetlistMock).toHaveBeenCalledTimes(1));
    expect(saveSongMock).not.toHaveBeenCalled();
    expect(saveSetlistMock.mock.calls[0]?.[0].sections[0].songs).toEqual([
      { songId: 's3', titleSnapshot: 'Tune C' },
    ]);
  });

  it('still adds a new song when chosen over the best guess', async () => {
    const user = await typeAndSave('Tune Cxx');
    await user.selectOptions(screen.getByRole('combobox'), SETLIST_TEXT.addNew('Tune Cxx'));
    await user.click(screen.getByRole('button', { name: SETLIST_TEXT.save }));
    await vi.waitFor(() => expect(saveSongMock).toHaveBeenCalledTimes(1));
  });

  it('closes on Escape from the second step without saving anything', async () => {
    const user = await typeAndSave('Mystery');
    await user.keyboard('{Escape}');
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('gig page')).toBeInTheDocument();
    expect(saveSongMock).not.toHaveBeenCalled();
    expect(saveSetlistMock).not.toHaveBeenCalled();
  });

  it('disables Save while the library loads', () => {
    useSongsMock.mockReturnValue({ data: undefined, isPending: true });
    renderAt('/gigs/g1/setlist');
    expect(screen.getByRole('button', { name: SETLIST_TEXT.save })).toBeDisabled();
    expect(screen.getByText(SETLIST_TEXT.songsLoading)).toBeInTheDocument();
  });

  it('says so when the library fails with nothing cached', () => {
    useSongsMock.mockReturnValue({ data: undefined, isPending: false });
    renderAt('/gigs/g1/setlist');
    expect(screen.getByRole('button', { name: SETLIST_TEXT.save })).toBeDisabled();
    expect(screen.getByText(SETLIST_TEXT.songsError)).toBeInTheDocument();
  });

  it('cancels back to the gig page without saving when opened directly', async () => {
    const user = userEvent.setup();
    renderAt('/gigs/g1/setlist');
    await user.click(screen.getByRole('button', { name: SETLIST_TEXT.cancel }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('gig page')).toBeInTheDocument();
    expect(saveSetlistMock).not.toHaveBeenCalled();
  });

  it('cancels by stepping back when there is history', async () => {
    const user = userEvent.setup();
    renderAt('/gigs', '/gigs/g1', '/gigs/g1/setlist');
    await user.click(screen.getByRole('button', { name: SETLIST_TEXT.cancel }));
    await user.click(screen.getByRole('button', { name: 'back' }));
    expect(screen.getByText('list page')).toBeInTheDocument();
  });

  it('closes on Escape without saving', async () => {
    const user = userEvent.setup();
    renderAt('/gigs/g1/setlist');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('gig page')).toBeInTheDocument();
    expect(saveSetlistMock).not.toHaveBeenCalled();
  });

  it('steps back on Escape when there is history, as Cancel does', async () => {
    const user = userEvent.setup();
    renderAt('/gigs', '/gigs/g1', '/gigs/g1/setlist');
    await user.keyboard('{Escape}');
    expect(screen.getByText('gig page')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'back' }));
    expect(screen.getByText('list page')).toBeInTheDocument();
  });

  it('shows not found for an unknown gig', () => {
    useSetlistMock.mockReturnValue({ data: null, isPending: false });
    useSetlistsMock.mockReturnValue({ data: [], isPending: false });
    renderAt('/gigs/nope/setlist');
    expect(screen.getByText(GIGS.notFound)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: SETLIST_TEXT.heading })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: SETLIST_TEXT.save })).toBeDisabled();
    expect(screen.queryByLabelText(SETLIST_TEXT.label)).not.toBeInTheDocument();
  });
});
