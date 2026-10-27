import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Outlet, Route, Routes, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatGigDate } from '../lib/gig-date.js';
import { GIG_DELETE, GIG_FORM, GIGS } from '../lib/microcopy.js';
import { GigEdit } from './gig-edit.js';

const { useSetlistMock, useSetlistsMock, saveSetlistMock, deleteSetlistMock } = vi.hoisted(() => ({
  useSetlistMock: vi.fn(),
  useSetlistsMock: vi.fn(),
  saveSetlistMock: vi.fn(),
  deleteSetlistMock: vi.fn(),
}));
vi.mock('../hooks/use-setlist.js', () => ({ useSetlist: useSetlistMock }));
vi.mock('../hooks/use-setlists.js', () => ({ useSetlists: useSetlistsMock }));
vi.mock('../hooks/use-setlist-mutation.js', () => ({
  useSetlistMutation: () => ({ saveSetlist: saveSetlistMock, deleteSetlist: deleteSetlistMock }),
}));
vi.mock('../lib/id.js', () => ({ generateId: () => 'newgig0000000001' }));

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
        <Route
          path="/gigs"
          element={
            <>
              <p>list page</p>
              <Link to="/gigs/new">open add</Link>
              <Outlet />
            </>
          }
        >
          <Route path="new" element={<GigEdit />} />
        </Route>
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
          <Route path="edit" element={<GigEdit />} />
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

beforeEach(() => {
  saveSetlistMock.mockReset().mockResolvedValue(undefined);
  deleteSetlistMock.mockReset().mockResolvedValue(undefined);
  useSetlistMock.mockReturnValue({ data: fullGig });
  useSetlistsMock.mockReturnValue({ data: undefined, isPending: true });
});

describe('GigEdit', () => {
  it('opens as a dialog named by its title over the page it came from', () => {
    renderAt('/gigs/new');
    expect(screen.getByRole('dialog', { name: GIG_FORM.addHeading })).toBeInTheDocument();
    expect(screen.getByText('list page')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Back to gigs' })).not.toBeInTheDocument();
  });

  it('shows Edit gig and Save for an existing gig', () => {
    renderAt('/gigs/g1/edit');
    expect(screen.getByRole('dialog', { name: GIG_FORM.editHeading })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: GIG_FORM.save })).toBeInTheDocument();
    expect(screen.getByText('gig page')).toBeInTheDocument();
  });

  it('adds a gig with no sections', async () => {
    const user = userEvent.setup();
    renderAt('/gigs/new');
    await user.type(screen.getByLabelText(GIG_FORM.venue), 'Test Venue');
    await user.type(screen.getByLabelText(GIG_FORM.date), '2026-11-07');
    await user.type(screen.getByLabelText(GIG_FORM.time), '20:00');
    await user.click(screen.getByRole('button', { name: GIG_FORM.add }));

    expect(saveSetlistMock).toHaveBeenCalledTimes(1);
    const record = saveSetlistMock.mock.calls[0]?.[0];
    expect(Object.keys(record).sort()).toEqual(
      ['bandId', 'setlistId', 'gigMeta', 'sections', 'clientWrittenAt', 'version'].sort(),
    );
    expect(record.setlistId).toBe('newgig0000000001');
    expect(record.sections).toEqual([]);
    expect(record.gigMeta).toEqual({ venue: 'Test Venue', date: '2026-11-07', time: '20:00' });
    expect(await screen.findByText('gig page')).toBeInTheDocument();
  });

  it('edits a gig, keeping sections and saving a blanked time as absent', async () => {
    const user = userEvent.setup();
    renderAt('/gigs/g1/edit');
    expect(screen.getByLabelText(GIG_FORM.venue)).toHaveValue('Venue A');
    expect(screen.getByLabelText(GIG_FORM.date)).toHaveValue('2026-11-07');
    expect(screen.getByLabelText(GIG_FORM.time)).toHaveValue('20:00');
    await user.clear(screen.getByLabelText(GIG_FORM.time));
    await user.clear(screen.getByLabelText(GIG_FORM.venue));
    await user.type(screen.getByLabelText(GIG_FORM.venue), 'Venue B');
    await user.click(screen.getByRole('button', { name: GIG_FORM.save }));

    const record = saveSetlistMock.mock.calls[0]?.[0];
    expect(record.gigMeta).toEqual({ venue: 'Venue B', date: '2026-11-07' });
    expect(record.gigMeta).not.toHaveProperty('time');
    expect(record.sections).toEqual(sections);
    expect(record).not.toHaveProperty('serverReceivedAt');
    expect(record.clientWrittenAt).not.toBe(fullGig.clientWrittenAt);
    expect(await screen.findByText('gig page')).toBeInTheDocument();
  });

  it('keeps Save disabled until venue and date are filled', async () => {
    const user = userEvent.setup();
    renderAt('/gigs/new');
    const save = screen.getByRole('button', { name: GIG_FORM.add });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText(GIG_FORM.venue), 'Test Venue');
    expect(save).toBeDisabled();
    await user.clear(screen.getByLabelText(GIG_FORM.venue));
    await user.type(screen.getByLabelText(GIG_FORM.venue), '   ');
    await user.type(screen.getByLabelText(GIG_FORM.date), '2026-11-07');
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText(GIG_FORM.venue), 'Test Venue');
    expect(save).toBeEnabled();
    await user.click(save);
    expect(saveSetlistMock).toHaveBeenCalledTimes(1);
  });

  it('cancels an edit opened directly back to the gig page without saving', async () => {
    const user = userEvent.setup();
    renderAt('/gigs/g1/edit');
    await user.click(screen.getByRole('button', { name: GIG_FORM.cancel }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('gig page')).toBeInTheDocument();
    expect(saveSetlistMock).not.toHaveBeenCalled();
  });

  it('cancels an edit by stepping back when there is history', async () => {
    const user = userEvent.setup();
    renderAt('/gigs', '/gigs/g1', '/gigs/g1/edit');
    await user.click(screen.getByRole('button', { name: GIG_FORM.cancel }));
    await user.click(screen.getByRole('button', { name: 'back' }));
    expect(screen.getByText('list page')).toBeInTheDocument();
  });

  it('closes on Escape, discarding changes', async () => {
    const user = userEvent.setup();
    renderAt('/gigs/g1/edit');
    await user.type(screen.getByLabelText(GIG_FORM.venue), ' more');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('gig page')).toBeInTheDocument();
    expect(saveSetlistMock).not.toHaveBeenCalled();
  });

  it('steps back on Escape when there is history, as Cancel does', async () => {
    const user = userEvent.setup();
    renderAt('/gigs', '/gigs/g1', '/gigs/g1/edit');
    await user.keyboard('{Escape}');
    expect(screen.getByText('gig page')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'back' }));
    expect(screen.getByText('list page')).toBeInTheDocument();
  });

  it('cancels an add opened directly back to the list', async () => {
    const user = userEvent.setup();
    renderAt('/gigs/new');
    await user.click(screen.getByRole('button', { name: GIG_FORM.cancel }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('list page')).toBeInTheDocument();
    expect(saveSetlistMock).not.toHaveBeenCalled();
  });

  it('returns focus to the control that opened it', async () => {
    const user = userEvent.setup();
    renderAt('/gigs');
    const opener = screen.getByRole('link', { name: 'open add' });
    await user.click(opener);
    expect(screen.getByRole('dialog', { name: GIG_FORM.addHeading })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: GIG_FORM.cancel }));
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('shows not found for an unknown gig', () => {
    useSetlistMock.mockReturnValue({ data: null, isPending: false });
    useSetlistsMock.mockReturnValue({ data: [], isPending: false });
    renderAt('/gigs/nope/edit');
    expect(screen.getByText(GIGS.notFound)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: GIG_FORM.editHeading })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: GIG_FORM.save })).toBeDisabled();
    expect(screen.queryByLabelText(GIG_FORM.venue)).not.toBeInTheDocument();
  });
});

describe('GigEdit delete', () => {
  const label = `Venue A, ${formatGigDate('2026-11-07')}`;

  it('offers no delete when adding a gig', () => {
    renderAt('/gigs/new');
    expect(screen.queryByRole('button', { name: GIG_DELETE.button })).not.toBeInTheDocument();
  });

  it('asks in a dialog naming the saved gig, and Keep returns to the form', async () => {
    const user = userEvent.setup();
    renderAt('/gigs/g1/edit');
    await user.clear(screen.getByLabelText(GIG_FORM.venue));
    await user.type(screen.getByLabelText(GIG_FORM.venue), 'Unsaved');
    const del = screen.getByRole('button', { name: GIG_DELETE.button });
    expect(del).toHaveAttribute('data-variant', 'destructive-outline');
    await user.click(del);
    const dialog = screen.getByRole('alertdialog', { name: GIG_DELETE.title(label) });
    expect(dialog).toHaveTextContent(GIG_DELETE.explain);
    expect(screen.getByRole('button', { name: GIG_DELETE.yes })).toHaveAttribute(
      'data-variant',
      'destructive',
    );
    const keep = screen.getByRole('button', { name: GIG_DELETE.keep });
    expect(keep).toHaveAttribute('data-variant', 'outline');
    expect(keep).toHaveFocus();
    await user.click(keep);
    expect(deleteSetlistMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText(GIG_FORM.venue)).toHaveValue('Unsaved');
    await waitFor(() => expect(del).toHaveFocus());
  });

  it('closes only the confirm dialog on Escape, not the sheet', async () => {
    const user = userEvent.setup();
    renderAt('/gigs/g1/edit');
    await user.click(screen.getByRole('button', { name: GIG_DELETE.button }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: GIG_FORM.editHeading })).toBeInTheDocument();
  });

  it('names the gig by date alone when it has no venue', async () => {
    useSetlistMock.mockReturnValue({
      data: { ...fullGig, gigMeta: { venue: '', date: '2026-11-07' } },
    });
    const user = userEvent.setup();
    renderAt('/gigs/g1/edit');
    await user.click(screen.getByRole('button', { name: GIG_DELETE.button }));
    expect(
      screen.getByRole('alertdialog', { name: GIG_DELETE.title(formatGigDate('2026-11-07')) }),
    ).toBeInTheDocument();
  });

  it('deletes on Yes, delete and goes to the gig list', async () => {
    const user = userEvent.setup();
    renderAt('/gigs/g1/edit');
    await user.click(screen.getByRole('button', { name: GIG_DELETE.button }));
    await user.click(screen.getByRole('button', { name: GIG_DELETE.yes }));
    expect(deleteSetlistMock).toHaveBeenCalledWith('g1');
    expect(await screen.findByText('list page')).toBeInTheDocument();
  });

  it('disables "Yes, delete" while the request runs', async () => {
    deleteSetlistMock.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderAt('/gigs/g1/edit');
    await user.click(screen.getByRole('button', { name: GIG_DELETE.button }));
    await user.click(screen.getByRole('button', { name: GIG_DELETE.yes }));
    expect(screen.getByRole('button', { name: GIG_DELETE.yes })).toBeDisabled();
  });

  it('says so when the delete fails', async () => {
    deleteSetlistMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    renderAt('/gigs/g1/edit');
    await user.click(screen.getByRole('button', { name: GIG_DELETE.button }));
    await user.click(screen.getByRole('button', { name: GIG_DELETE.yes }));
    expect(await screen.findByRole('alert')).toHaveTextContent(GIG_DELETE.failed);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText(GIG_FORM.venue)).toHaveValue('Venue A');
  });
});
