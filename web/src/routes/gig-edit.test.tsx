import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
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

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/gigs" element={<p>list page</p>} />
        <Route path="/gigs/new" element={<GigEdit />} />
        <Route path="/gigs/:setlistId" element={<p>gig page</p>} />
        <Route path="/gigs/:setlistId/edit" element={<GigEdit />} />
      </Routes>
    </MemoryRouter>,
  );
}

const sections = [
  { name: 'Set 1', songs: [{ songId: 's1', titleSnapshot: 'Tune A', perGigAnnotation: 'slow' }] },
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
  it('adds a gig with no sections', async () => {
    const user = userEvent.setup();
    renderAt('/gigs/new');
    await user.type(screen.getByLabelText(GIG_FORM.venue), 'Test Venue');
    await user.type(screen.getByLabelText(GIG_FORM.date), '2026-11-07');
    await user.type(screen.getByLabelText(GIG_FORM.time), '20:00');
    await user.click(screen.getByRole('button', { name: GIG_FORM.save }));

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

  it('refuses a blank venue', async () => {
    const user = userEvent.setup();
    renderAt('/gigs/new');
    await user.type(screen.getByLabelText(GIG_FORM.venue), '   ');
    await user.type(screen.getByLabelText(GIG_FORM.date), '2026-11-07');
    await user.click(screen.getByRole('button', { name: GIG_FORM.save }));
    expect(screen.getByRole('alert')).toHaveTextContent(GIG_FORM.required);
    expect(saveSetlistMock).not.toHaveBeenCalled();
  });

  it('refuses a blank date', async () => {
    const user = userEvent.setup();
    renderAt('/gigs/new');
    await user.type(screen.getByLabelText(GIG_FORM.venue), 'Test Venue');
    await user.click(screen.getByRole('button', { name: GIG_FORM.save }));
    expect(screen.getByRole('alert')).toHaveTextContent(GIG_FORM.required);
    expect(screen.getByLabelText(GIG_FORM.date)).toHaveAttribute('aria-invalid', 'true');
    expect(saveSetlistMock).not.toHaveBeenCalled();
  });

  it('cancels an edit back to the gig page without saving', async () => {
    const user = userEvent.setup();
    renderAt('/gigs/g1/edit');
    await user.click(screen.getByRole('link', { name: GIG_FORM.cancel }));
    expect(screen.getByText('gig page')).toBeInTheDocument();
    expect(saveSetlistMock).not.toHaveBeenCalled();
  });

  it('cancels an add back to the list', async () => {
    const user = userEvent.setup();
    renderAt('/gigs/new');
    await user.click(screen.getByRole('link', { name: GIG_FORM.cancel }));
    expect(screen.getByText('list page')).toBeInTheDocument();
    expect(saveSetlistMock).not.toHaveBeenCalled();
  });

  it('shows not found for an unknown gig', () => {
    useSetlistMock.mockReturnValue({ data: null, isPending: false });
    useSetlistsMock.mockReturnValue({ data: [], isPending: false });
    renderAt('/gigs/nope/edit');
    expect(screen.getByText(GIGS.notFound)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: GIGS.backToGigs })).toHaveAttribute('href', '/gigs');
    expect(screen.queryByLabelText(GIG_FORM.venue)).not.toBeInTheDocument();
  });
});

describe('GigEdit delete', () => {
  const confirmLine = `${GIG_DELETE.confirm} Venue A, ${formatGigDate('2026-11-07')}?`;

  it('offers no delete when adding a gig', () => {
    renderAt('/gigs/new');
    expect(screen.queryByRole('button', { name: GIG_DELETE.button })).not.toBeInTheDocument();
  });

  it('asks first, naming the saved gig, and Keep returns to the form', async () => {
    const user = userEvent.setup();
    renderAt('/gigs/g1/edit');
    await user.clear(screen.getByLabelText(GIG_FORM.venue));
    await user.type(screen.getByLabelText(GIG_FORM.venue), 'Unsaved');
    await user.click(screen.getByRole('button', { name: GIG_DELETE.button }));
    expect(screen.getByText(confirmLine)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: GIG_DELETE.keep }));
    expect(deleteSetlistMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText(GIG_FORM.venue)).toHaveValue('Unsaved');
    expect(screen.getByRole('button', { name: GIG_DELETE.button })).toBeInTheDocument();
  });

  it('names the gig by date alone when it has no venue', async () => {
    useSetlistMock.mockReturnValue({
      data: { ...fullGig, gigMeta: { venue: '', date: '2026-11-07' } },
    });
    const user = userEvent.setup();
    renderAt('/gigs/g1/edit');
    await user.click(screen.getByRole('button', { name: GIG_DELETE.button }));
    expect(
      screen.getByText(`${GIG_DELETE.confirm} ${formatGigDate('2026-11-07')}?`),
    ).toBeInTheDocument();
  });

  it('deletes on the second tap and goes to the gig list', async () => {
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
    expect(screen.getByLabelText(GIG_FORM.venue)).toHaveValue('Venue A');
  });
});
