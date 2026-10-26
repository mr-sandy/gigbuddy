import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { GIG_FORM, GIG_SETLIST, GIGS } from '../lib/microcopy.js';
import { Gig } from './gig.js';

const { useSetlistMock, useSetlistsMock } = vi.hoisted(() => ({
  useSetlistMock: vi.fn(),
  useSetlistsMock: vi.fn(),
}));
vi.mock('../hooks/use-setlist.js', () => ({ useSetlist: useSetlistMock }));
vi.mock('../hooks/use-setlists.js', () => ({ useSetlists: useSetlistsMock }));

const gig = (venue: string, sections: unknown[] = []) => ({
  setlistId: 'g1',
  gigMeta: { venue, date: '2026-11-07' },
  sections,
});
const song = (songId: string, titleSnapshot: string) => ({ songId, titleSnapshot });

function renderGig() {
  return render(
    <MemoryRouter initialEntries={['/gigs/g1']}>
      <Routes>
        <Route path="/gigs/:setlistId" element={<Gig />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Gig', () => {
  it('shows the venue as h1 and the date beneath', () => {
    useSetlistMock.mockReturnValue({ data: gig('Venue A') });
    useSetlistsMock.mockReturnValue({ data: undefined, isPending: true });
    renderGig();
    expect(screen.getByRole('heading', { level: 1, name: 'Venue A' })).toBeInTheDocument();
    expect(screen.getByText('Sat 7 Nov 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: GIGS.backToGigs })).toHaveAttribute('href', '/gigs');
  });

  it('uses the date as the title when the venue is blank', () => {
    useSetlistMock.mockReturnValue({
      data: gig(' ', [{ name: '', songs: [song('s1', 'Tune A')] }]),
    });
    useSetlistsMock.mockReturnValue({ data: undefined, isPending: true });
    const { container } = renderGig();
    expect(screen.getByRole('heading', { level: 1, name: 'Sat 7 Nov 2026' })).toBeInTheDocument();
    expect(container.querySelectorAll('p').length).toBe(0);
  });

  it('falls back to the list cache', () => {
    useSetlistMock.mockReturnValue({ data: undefined, isPending: true });
    useSetlistsMock.mockReturnValue({ data: [gig('Cached Venue')], isPending: false });
    renderGig();
    expect(screen.getByRole('heading', { name: 'Cached Venue' })).toBeInTheDocument();
  });

  it('shows not found with the back link', () => {
    useSetlistMock.mockReturnValue({ data: null, isPending: false });
    useSetlistsMock.mockReturnValue({ data: [], isPending: false });
    renderGig();
    expect(screen.getByText(GIGS.notFound)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: GIGS.backToGigs })).toHaveAttribute('href', '/gigs');
  });

  it('links to the edit form only when the gig is shown', () => {
    useSetlistMock.mockReturnValue({ data: gig('Venue A') });
    useSetlistsMock.mockReturnValue({ data: undefined, isPending: true });
    const { unmount } = renderGig();
    expect(screen.getByRole('link', { name: GIG_FORM.editLink })).toHaveAttribute(
      'href',
      '/gigs/g1/edit',
    );
    unmount();
    useSetlistMock.mockReturnValue({ data: null, isPending: false });
    useSetlistsMock.mockReturnValue({ data: [], isPending: false });
    renderGig();
    expect(screen.queryByRole('link', { name: GIG_FORM.editLink })).not.toBeInTheDocument();
  });

  it('shows loading', () => {
    useSetlistMock.mockReturnValue({ data: undefined, isPending: true });
    useSetlistsMock.mockReturnValue({ data: undefined, isPending: true });
    renderGig();
    expect(screen.getByText(GIGS.loading)).toBeInTheDocument();
  });

  describe('setlist', () => {
    const setup = (sections: unknown[]) => {
      useSetlistMock.mockReturnValue({ data: gig('Venue A', sections) });
      useSetlistsMock.mockReturnValue({ data: undefined, isPending: true });
      return renderGig();
    };

    it('lists songs by section in stored order, linking into the gig', () => {
      setup([
        { name: 'Set 1', songs: [song('s2', 'Tune B'), song('s1', 'Tune A')] },
        { name: 'Set 2', songs: [song('s3', 'Tune C')] },
      ]);
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
        'Set 1',
        'Set 2',
      ]);
      const links = screen
        .getAllByRole('link')
        .filter((l) => l.textContent !== GIGS.backToGigs && l.textContent !== GIG_FORM.editLink);
      expect(links.map((l) => l.textContent)).toEqual(['Tune B', 'Tune A', 'Tune C']);
      expect(links.map((l) => l.getAttribute('href'))).toEqual([
        '/gigs/g1/songs/s2',
        '/gigs/g1/songs/s1',
        '/gigs/g1/songs/s3',
      ]);
    });

    it('shows songs of a blank-named section without a heading', () => {
      setup([
        { name: '  ', songs: [song('s1', 'Tune A')] },
        { name: '', songs: [song('s2', 'Tune B')] },
      ]);
      expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
      expect(screen.getByRole('link', { name: 'Tune A' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Tune B' })).toBeInTheDocument();
    });

    it('leaves out a section with no songs', () => {
      setup([
        { name: 'Empty Set', songs: [] },
        { name: 'Set 2', songs: [song('s1', 'Tune A')] },
      ]);
      expect(screen.queryByRole('heading', { name: 'Empty Set' })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Set 2' })).toBeInTheDocument();
    });

    it('renders a song that appears twice as two rows', () => {
      setup([{ name: 'Set 1', songs: [song('s1', 'Tune A'), song('s1', 'Tune A')] }]);
      expect(screen.getAllByRole('link', { name: 'Tune A' })).toHaveLength(2);
    });

    it.each([[[]], [[{ name: 'Set 1', songs: [] }]]])('shows the empty line for %j', (sections) => {
      const { container } = setup(sections);
      expect(screen.getByText(GIG_SETLIST.empty)).toBeInTheDocument();
      expect(container.querySelector('ul')).toBeNull();
    });
  });
});
