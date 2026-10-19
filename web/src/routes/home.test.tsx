import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { HOME } from '../lib/microcopy.js';
import { Home } from './home.js';

const { useSongsMock, useSetlistsMock } = vi.hoisted(() => ({
  useSongsMock: vi.fn(),
  useSetlistsMock: vi.fn(),
}));
vi.mock('../hooks/use-songs.js', () => ({ useSongs: useSongsMock }));
vi.mock('../hooks/use-setlists.js', () => ({ useSetlists: useSetlistsMock }));

function songsArray(n: number) {
  return Array.from({ length: n }, (_, i) => ({ songId: `s${i}` }));
}

function gigsArray(n: number) {
  return Array.from({ length: n }, (_, i) => ({ setlistId: `g${i}` }));
}

describe('Home (landing page)', () => {
  it('renders the GigBuddy heading and band name', () => {
    useSongsMock.mockReturnValue({ data: songsArray(1), isPending: false });
    useSetlistsMock.mockReturnValue({ data: gigsArray(1), isPending: false });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'GigBuddy' })).toBeInTheDocument();
    expect(screen.getByText('The Jack Ruby 5')).toBeInTheDocument();
  });

  it('renders counts built from live data (not hard-coded), pluralised', () => {
    useSongsMock.mockReturnValue({ data: songsArray(52), isPending: false });
    useSetlistsMock.mockReturnValue({ data: gigsArray(7), isPending: false });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText('52 songs · 7 gigs')).toBeInTheDocument();
  });

  it('singularises the counts line at one each', () => {
    useSongsMock.mockReturnValue({ data: songsArray(1), isPending: false });
    useSetlistsMock.mockReturnValue({ data: gigsArray(1), isPending: false });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText('1 song · 1 gig')).toBeInTheDocument();
  });

  it('renders the loading line while either query is pending with no data', () => {
    useSongsMock.mockReturnValue({ data: undefined, isPending: true });
    useSetlistsMock.mockReturnValue({ data: undefined, isPending: true });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText(HOME.loading)).toBeInTheDocument();
  });

  it('renders the error line when neither query has data and neither is pending', () => {
    useSongsMock.mockReturnValue({ data: undefined, isPending: false, isError: true });
    useSetlistsMock.mockReturnValue({ data: undefined, isPending: false, isError: true });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText(HOME.error)).toBeInTheDocument();
  });

  it('shows cached counts despite a background error on one query', () => {
    useSongsMock.mockReturnValue({ data: songsArray(3), isPending: false, isError: true });
    useSetlistsMock.mockReturnValue({ data: gigsArray(2), isPending: false });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText('3 songs · 2 gigs')).toBeInTheDocument();
  });

  it('gives the status line aria-live="polite"', () => {
    useSongsMock.mockReturnValue({ data: undefined, isPending: true });
    useSetlistsMock.mockReturnValue({ data: undefined, isPending: true });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText(HOME.loading)).toHaveAttribute('aria-live', 'polite');
  });

  it('links to /songs', () => {
    useSongsMock.mockReturnValue({ data: songsArray(1), isPending: false });
    useSetlistsMock.mockReturnValue({ data: gigsArray(1), isPending: false });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Songs' })).toHaveAttribute('href', '/songs');
  });
});
