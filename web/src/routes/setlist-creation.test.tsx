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

/*
 * Story 3.5 — Paste-to-parse integration. The textarea above the manual
 * sections feeds rows into ParseRowStatus. Tests cover AC-18 — render,
 * Fuzzy accept/reject, Unknown + Add to library / Discard, Save-gating.
 */

describe('SetlistCreation — Paste-to-parse', () => {
  it('renders a textarea with aria-label "Paste setlist"', () => {
    renderRoute();
    expect(screen.getByLabelText('Paste setlist')).toBeInTheDocument();
  });

  it('shows the empty-result copy when no paste yet', () => {
    renderRoute();
    expect(screen.getByText('Paste a setlist above.')).toBeInTheDocument();
  });

  it('pasting text triggers parser and renders ParseRowStatus rows', async () => {
    const user = userEvent.setup();
    renderRoute();
    const textarea = screen.getByLabelText('Paste setlist');
    // "Autumn Leaves" exists in LIBRARY → Matched. "Howlin Wolf" → Unknown.
    await user.click(textarea);
    await user.paste('Set 1\nAutumn Leaves\nHowlin Wolf');
    expect(await screen.findByText('Matched')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('Fuzzy "Yes, that one" converts the row to Matched', async () => {
    // Library has "Autumn Leaves"; paste "Autum Leaves" → Fuzzy (single
    // missing 'n' in the prefix is well above 0.92 JW).
    const user = userEvent.setup();
    renderRoute();
    const textarea = screen.getByLabelText('Paste setlist');
    await user.click(textarea);
    await user.paste('Autum Leaves');
    expect(await screen.findByText('Fuzzy')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yes, that one' }));
    expect(screen.getByText('Matched')).toBeInTheDocument();
    expect(screen.queryByText('Fuzzy')).toBeNull();
  });

  it('Fuzzy "No — new song" converts the row to Unknown', async () => {
    const user = userEvent.setup();
    renderRoute();
    const textarea = screen.getByLabelText('Paste setlist');
    await user.click(textarea);
    await user.paste('Autum Leaves');
    expect(await screen.findByText('Fuzzy')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'No — new song' }));
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.queryByText('Fuzzy')).toBeNull();
  });

  it('Unknown "+ Add to library" calls saveSong and converts to Matched', async () => {
    const user = userEvent.setup();
    renderRoute();
    const textarea = screen.getByLabelText('Paste setlist');
    await user.click(textarea);
    await user.paste('Some Wholly New Song');
    expect(await screen.findByText('Unknown')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Add to library' }));
    expect(saveSongMock).toHaveBeenCalledTimes(1);
    const songCall = saveSongMock.mock.calls[0]?.[0];
    // Title must preserve the user's casing from the paste — not lowercased
    // normalized form (AC-7 / AR-11: Library gets a human-readable title).
    expect(songCall).toEqual(
      expect.objectContaining({
        bandId: ACTIVE_BAND_ID,
        title: 'Some Wholly New Song',
        version: 1,
      }),
    );
    expect(screen.getByText('Matched')).toBeInTheDocument();
  });

  it('Unknown "Discard" removes the row', async () => {
    const user = userEvent.setup();
    renderRoute();
    const textarea = screen.getByLabelText('Paste setlist');
    await user.click(textarea);
    await user.paste('Howlin Wolf - 2nd May');
    expect(await screen.findByText('Unknown')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByText('Unknown')).toBeNull();
    expect(screen.getByText('Paste a setlist above.')).toBeInTheDocument();
  });

  it('Save is disabled when Fuzzy/Unknown rows remain (aria-disabled=true)', async () => {
    const user = userEvent.setup();
    renderRoute();
    const venue = screen.getByLabelText('Venue');
    await user.click(venue);
    await user.type(venue, 'The Jazz Cafe');
    await user.tab();
    await user.type(screen.getByLabelText('Date'), '2026-06-21');
    const textarea = screen.getByLabelText('Paste setlist');
    await user.click(textarea);
    await user.paste('Howlin Wolf - 2nd May');
    expect(await screen.findByText('Unknown')).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toHaveAttribute('aria-disabled', 'true');
    await user.click(save);
    expect(saveSetlistMock).not.toHaveBeenCalled();
  });

  it('Save is enabled and merges parsed sections after all rows resolved', async () => {
    const user = userEvent.setup();
    renderRoute();
    const venue = screen.getByLabelText('Venue');
    await user.click(venue);
    await user.type(venue, 'The Jazz Cafe');
    await user.tab();
    await user.type(screen.getByLabelText('Date'), '2026-06-21');
    const textarea = screen.getByLabelText('Paste setlist');
    await user.click(textarea);
    // Two matched rows from the LIBRARY → Save unblocked immediately.
    await user.paste('Set 1\nAutumn Leaves\nBlack Orpheus');
    const matchedLabels = await screen.findAllByText('Matched');
    expect(matchedLabels).toHaveLength(2);

    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toHaveAttribute('aria-disabled', 'false');
    await user.click(save);
    expect(saveSetlistMock).toHaveBeenCalledTimes(1);
    const payload = saveSetlistMock.mock.calls[0]?.[0];
    expect(payload.sections).toEqual([
      {
        name: 'Set 1',
        songs: [
          { songId: 'song0000000001aa', titleSnapshot: 'Autumn Leaves' },
          { songId: 'song0000000002bb', titleSnapshot: 'Black Orpheus' },
        ],
      },
    ]);
  });

  it('titleSnapshot in Save payload uses canonical Library title, not the pasted string (AR-11)', async () => {
    // Paste a slightly-misspelled title that fuzzy-matches a Library entry.
    // The saved Setlist must carry the canonical Song.title as titleSnapshot,
    // not the raw pasted text.
    const user = userEvent.setup();
    renderRoute();
    const venue = screen.getByLabelText('Venue');
    await user.click(venue);
    await user.type(venue, 'Test Venue');
    await user.tab();
    await user.type(screen.getByLabelText('Date'), '2026-06-21');
    const textarea = screen.getByLabelText('Paste setlist');
    await user.click(textarea);
    // "Autum Leaves" → fuzzy match for Library entry "Autumn Leaves"
    await user.paste('Autum Leaves');
    expect(await screen.findByText('Fuzzy')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yes, that one' }));
    expect(screen.getByText('Matched')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saveSetlistMock).toHaveBeenCalledTimes(1);
    const payload = saveSetlistMock.mock.calls[0]?.[0];
    // titleSnapshot must be the canonical Library title, NOT the pasted form
    expect(payload.sections[0]?.songs[0]?.titleSnapshot).toBe('Autumn Leaves');
    expect(payload.sections[0]?.songs[0]?.titleSnapshot).not.toBe('Autum Leaves');
  });

  it('Discard frees Save when Fuzzy/Unknown rows are dropped instead of resolved', async () => {
    const user = userEvent.setup();
    renderRoute();
    const venue = screen.getByLabelText('Venue');
    await user.click(venue);
    await user.type(venue, 'The Jazz Cafe');
    await user.tab();
    await user.type(screen.getByLabelText('Date'), '2026-06-21');
    const textarea = screen.getByLabelText('Paste setlist');
    await user.click(textarea);
    await user.paste('Set 1\nAutumn Leaves\nGarbage Title Junk');
    await screen.findByText('Unknown');
    // Save blocked while Unknown row is present.
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    // Now only Matched remains → Save unblocked.
    expect(screen.queryByText('Unknown')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-disabled', 'false');
  });
});
