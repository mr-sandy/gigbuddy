import { ACTIVE_BAND_ID, type Song } from '@gigbuddy/shared';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VALIDATION_MESSAGES } from '../lib/microcopy.js';
import { SetlistCreation } from './setlist-creation.js';

/*
 * SetlistCreation route tests. Hooks are mocked at the module level so the
 * route is exercised without TanStack Query / outbox setup. The platform
 * mock keeps atmosphere = practice (MacBook).
 */

const { useSongsMock, saveSetlistMock, saveSongMock, navigateMock } = vi.hoisted(() => ({
  useSongsMock: vi.fn(),
  saveSetlistMock: vi.fn().mockResolvedValue(undefined),
  saveSongMock: vi.fn().mockResolvedValue(undefined),
  navigateMock: vi.fn(),
}));

vi.mock('../hooks/use-songs.js', () => ({ useSongs: useSongsMock }));
vi.mock('../hooks/use-setlist-mutation.js', () => ({
  useSetlistMutation: () => ({ saveSetlist: saveSetlistMock }),
}));
vi.mock('../hooks/use-song-mutation.js', () => ({
  useSongMutation: () => ({ saveSong: saveSongMock }),
}));
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigateMock };
});

function makeSong(songId: string, title: string): Song {
  return {
    bandId: ACTIVE_BAND_ID,
    songId,
    title,
    clientWrittenAt: '2026-06-19T12:00:00.000Z',
    serverReceivedAt: '2026-06-19T12:00:01.000Z',
    version: 1 as const,
  };
}

const LIBRARY: Song[] = [
  makeSong('song0000000001aa', 'Autumn Leaves'),
  makeSong('song0000000002bb', 'Black Orpheus'),
];

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={['/setlists/new']}>
      <Routes>
        <Route path="/setlists/new" element={<SetlistCreation />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useSongsMock.mockReset().mockReturnValue({ data: LIBRARY, isLoading: false });
  saveSetlistMock.mockReset().mockResolvedValue(undefined);
  saveSongMock.mockReset().mockResolvedValue(undefined);
  navigateMock.mockReset();
  document.documentElement.dataset.atmosphere = 'practice';
});

afterEach(() => {
  document.documentElement.dataset.atmosphere = 'practice';
});

describe('SetlistCreation — Gig metadata fields', () => {
  it('renders Venue, Date, and Time fields', () => {
    renderRoute();
    expect(screen.getByLabelText('Venue')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Time (optional)')).toBeInTheDocument();
  });

  it('Venue InlineEditField updates draft state on commit', async () => {
    const user = userEvent.setup();
    renderRoute();
    const venue = screen.getByLabelText('Venue');
    await user.click(venue);
    await user.type(venue, 'The Jazz Cafe');
    await user.tab();
    // The committed value is what gets sent to saveSetlist later — exercise
    // via Save flow to confirm.
    const date = screen.getByLabelText('Date');
    await user.type(date, '2026-06-21');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saveSetlistMock).toHaveBeenCalledTimes(1);
    expect(saveSetlistMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        gigMeta: expect.objectContaining({ venue: 'The Jazz Cafe' }),
      }),
    );
  });

  it('Date input updates draft state', async () => {
    const user = userEvent.setup();
    renderRoute();
    const date = screen.getByLabelText('Date');
    await user.type(date, '2026-06-21');
    expect(date).toHaveValue('2026-06-21');
  });
});

describe('SetlistCreation — validation', () => {
  it('Save with empty Venue shows venueRequired and makes no API call', async () => {
    const user = userEvent.setup();
    renderRoute();
    await user.type(screen.getByLabelText('Date'), '2026-06-21');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText(VALIDATION_MESSAGES.venueRequired)).toBeInTheDocument();
    expect(saveSetlistMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('Save with empty Date shows dateRequired and makes no API call', async () => {
    const user = userEvent.setup();
    renderRoute();
    const venue = screen.getByLabelText('Venue');
    await user.click(venue);
    await user.type(venue, 'The Jazz Cafe');
    await user.tab();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText(VALIDATION_MESSAGES.dateRequired)).toBeInTheDocument();
    expect(saveSetlistMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('whitespace-only Venue counts as empty', async () => {
    const user = userEvent.setup();
    renderRoute();
    const venue = screen.getByLabelText('Venue');
    await user.click(venue);
    await user.type(venue, '   ');
    await user.tab();
    await user.type(screen.getByLabelText('Date'), '2026-06-21');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText(VALIDATION_MESSAGES.venueRequired)).toBeInTheDocument();
    expect(saveSetlistMock).not.toHaveBeenCalled();
  });
});

describe('SetlistCreation — Save flow', () => {
  it('Save with Venue + Date calls saveSetlist with the expected shape', async () => {
    const user = userEvent.setup();
    renderRoute();
    const venue = screen.getByLabelText('Venue');
    await user.click(venue);
    await user.type(venue, 'The Jazz Cafe');
    await user.tab();
    await user.type(screen.getByLabelText('Date'), '2026-06-21');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(saveSetlistMock).toHaveBeenCalledTimes(1);
    const payload = saveSetlistMock.mock.calls[0]?.[0];
    expect(payload).toEqual(
      expect.objectContaining({
        bandId: ACTIVE_BAND_ID,
        gigMeta: { venue: 'The Jazz Cafe', date: '2026-06-21' },
        sections: [],
        version: 1,
      }),
    );
    expect(payload.setlistId).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(typeof payload.clientWrittenAt).toBe('string');
    expect(payload).not.toHaveProperty('serverReceivedAt');
    // Time was empty — must be omitted from gigMeta.
    expect(payload.gigMeta).not.toHaveProperty('time');
  });

  it('Save navigates to /setlists/<newId> after saveSetlist', async () => {
    const user = userEvent.setup();
    renderRoute();
    const venue = screen.getByLabelText('Venue');
    await user.click(venue);
    await user.type(venue, 'Venue');
    await user.tab();
    await user.type(screen.getByLabelText('Date'), '2026-06-21');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const payload = saveSetlistMock.mock.calls[0]?.[0];
    expect(navigateMock).toHaveBeenCalledWith(`/setlists/${payload.setlistId}`);
  });

  it('Save with optional Time populates gigMeta.time', async () => {
    const user = userEvent.setup();
    renderRoute();
    const venue = screen.getByLabelText('Venue');
    await user.click(venue);
    await user.type(venue, 'Venue');
    await user.tab();
    await user.type(screen.getByLabelText('Date'), '2026-06-21');
    await user.type(screen.getByLabelText('Time (optional)'), '20:00');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const payload = saveSetlistMock.mock.calls[0]?.[0];
    expect(payload.gigMeta).toEqual({
      venue: 'Venue',
      date: '2026-06-21',
      time: '20:00',
    });
  });

  it('Save with empty Setlist (no sections) is valid', async () => {
    const user = userEvent.setup();
    renderRoute();
    const venue = screen.getByLabelText('Venue');
    await user.click(venue);
    await user.type(venue, 'Venue');
    await user.tab();
    await user.type(screen.getByLabelText('Date'), '2026-06-21');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const payload = saveSetlistMock.mock.calls[0]?.[0];
    expect(payload.sections).toEqual([]);
  });
});

describe('SetlistCreation — sections', () => {
  it('+ Add section appends a section with default name "Set 1"', async () => {
    const user = userEvent.setup();
    renderRoute();
    await user.click(screen.getByRole('button', { name: '+ Add section' }));
    expect(screen.getByLabelText('Rename section: Set 1')).toBeInTheDocument();
  });

  it('+ Add section twice appends "Set 1" then "Set 2"', async () => {
    const user = userEvent.setup();
    renderRoute();
    await user.click(screen.getByRole('button', { name: '+ Add section' }));
    await user.click(screen.getByRole('button', { name: '+ Add section' }));
    expect(screen.getByLabelText('Rename section: Set 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Rename section: Set 2')).toBeInTheDocument();
  });

  it('default Set 1 is created on first + Add song when no section exists', async () => {
    const user = userEvent.setup();
    renderRoute();
    // No section yet → there is a single + Add song button (the
    // route-level affordance).
    const addSong = screen.getByRole('button', { name: '+ Add song' });
    await user.click(addSong);
    // Section heading for Set 1 should now be present.
    expect(screen.getByLabelText('Rename section: Set 1')).toBeInTheDocument();
    // The search row is mounted under that section.
    expect(screen.getByLabelText('Search songs')).toBeInTheDocument();
  });
});
