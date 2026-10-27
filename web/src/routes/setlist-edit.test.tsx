import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Outlet, Route, Routes, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatGigDate } from '../lib/gig-date.js';
import { GIGS, SETLIST_TEXT } from '../lib/microcopy.js';
import { setlistToText } from '../lib/setlist-text.js';
import { SetlistEdit } from './setlist-edit.js';

const { useSetlistMock, useSetlistsMock, useSongsMock, saveSetlistMock } = vi.hoisted(() => ({
  useSetlistMock: vi.fn(),
  useSetlistsMock: vi.fn(),
  useSongsMock: vi.fn(),
  saveSetlistMock: vi.fn(),
}));
vi.mock('../hooks/use-setlist.js', () => ({ useSetlist: useSetlistMock }));
vi.mock('../hooks/use-setlists.js', () => ({ useSetlists: useSetlistsMock }));
vi.mock('../hooks/use-songs.js', () => ({ useSongs: useSongsMock }));
vi.mock('../hooks/use-setlist-mutation.js', () => ({
  useSetlistMutation: () => ({ saveSetlist: saveSetlistMock }),
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

  it('lists unmatched lines, does not save and keeps the typed text', async () => {
    const user = userEvent.setup();
    renderAt('/gigs/g1/setlist');
    const box = screen.getByLabelText(SETLIST_TEXT.label);
    await user.clear(box);
    await user.type(box, 'Tune A\nMystery');
    await user.click(screen.getByRole('button', { name: SETLIST_TEXT.save }));

    expect(screen.getByRole('alert')).toHaveTextContent(`${SETLIST_TEXT.notInLibrary} Mystery`);
    expect(saveSetlistMock).not.toHaveBeenCalled();
    expect(box).toHaveValue('Tune A\nMystery');
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
