import { ACTIVE_BAND_ID, type Song } from '@gigbuddy/shared';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIONS, EMPTY_STATES, FIELD_LABELS } from '../lib/microcopy.js';
import { SongDetail } from './song-detail.js';

const { useSongMock, saveSongMock, navigateMock } = vi.hoisted(() => ({
  useSongMock: vi.fn(),
  saveSongMock: vi.fn().mockResolvedValue(undefined),
  navigateMock: vi.fn(),
}));

vi.mock('../hooks/use-song.js', () => ({ useSong: useSongMock }));
vi.mock('../hooks/use-song-mutation.js', () => ({
  useSongMutation: () => ({ saveSong: saveSongMock }),
}));
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigateMock };
});

function makeSong(songId: string, overrides: Partial<Song> = {}): Song {
  return {
    bandId: ACTIVE_BAND_ID,
    songId,
    title: 'Autumn Leaves',
    clientWrittenAt: '2026-06-17T12:00:00.000Z',
    serverReceivedAt: '2026-06-17T12:00:01.000Z',
    version: 1 as const,
    ...overrides,
  };
}

function renderAtEdit(songId: string) {
  return render(
    <MemoryRouter initialEntries={[`/songs/${songId}`]}>
      <Routes>
        <Route path="/songs/:songId" element={<SongDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderAtNew() {
  return render(
    <MemoryRouter initialEntries={['/songs/new']}>
      <Routes>
        <Route path="/songs/new" element={<SongDetail />} />
        <Route path="/songs/:songId" element={<SongDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useSongMock.mockReset();
  saveSongMock.mockReset().mockResolvedValue(undefined);
  navigateMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SongDetail — edit existing song', () => {
  it('renders all FR-5 fields with their values and shows the chord chart preview', () => {
    const song = makeSong('abc', {
      title: 'Black Orpheus',
      key: 'Dm',
      patch: 'Rhodes',
      chordChart: '{Verse}\nDm A7 Dm',
      performanceNotes: 'feel: slow burn',
      practiceNotes: 'work the bridge',
    });
    useSongMock.mockReturnValue({ data: song, isLoading: false });
    renderAtEdit('abc');

    expect(screen.getByLabelText(FIELD_LABELS.title)).toHaveValue('Black Orpheus');
    expect(screen.getByLabelText(FIELD_LABELS.key)).toHaveValue('Dm');
    expect(screen.getByLabelText(FIELD_LABELS.patch)).toHaveValue('Rhodes');
    expect(screen.getByLabelText(FIELD_LABELS.chordChart)).toHaveValue('{Verse}\nDm A7 Dm');
    expect(screen.getByLabelText(FIELD_LABELS.performanceNotes)).toHaveValue('feel: slow burn');
    expect(screen.getByLabelText(FIELD_LABELS.practiceNotes)).toHaveValue('work the bridge');

    expect(screen.getByTestId('chord-chart')).toBeInTheDocument();
  });

  it('debounces a single-field edit to one saveSong call with the merged record', async () => {
    const user = userEvent.setup();
    const song = makeSong('abc', { title: 'Original' });
    useSongMock.mockReturnValue({ data: song, isLoading: false });

    renderAtEdit('abc');

    const titleField = screen.getByLabelText(FIELD_LABELS.title);
    await user.click(titleField);
    await user.clear(titleField);
    await user.type(titleField, 'new title');
    await user.tab();

    await waitFor(() => expect(saveSongMock).toHaveBeenCalledTimes(1), { timeout: 600 });
    const payload = saveSongMock.mock.calls[0]?.[0];
    expect(payload).toEqual(
      expect.objectContaining({
        bandId: ACTIVE_BAND_ID,
        songId: 'abc',
        title: 'new title',
        version: 1,
      }),
    );
    expect(typeof payload.clientWrittenAt).toBe('string');
    expect(payload).not.toHaveProperty('serverReceivedAt');
  });

  it('coalesces rapid edits within the debounce window to one save with the latest value', async () => {
    const user = userEvent.setup();
    const song = makeSong('abc', { title: 'Original' });
    useSongMock.mockReturnValue({ data: song, isLoading: false });

    renderAtEdit('abc');

    const titleField = screen.getByLabelText(FIELD_LABELS.title);

    await user.click(titleField);
    await user.clear(titleField);
    await user.type(titleField, 'first');
    await user.tab();

    // Re-focus immediately (well within the 200ms debounce window) and replace.
    await user.click(titleField);
    await user.clear(titleField);
    await user.type(titleField, 'second');
    await user.tab();

    await waitFor(() => expect(saveSongMock).toHaveBeenCalledTimes(1), { timeout: 600 });
    expect(saveSongMock.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ title: 'second' }));
  });

  it('renders the not-found copy + Back to library link when data is null', () => {
    useSongMock.mockReturnValue({ data: null, isLoading: false });
    renderAtEdit('missing');

    expect(screen.getByText(EMPTY_STATES.songNotFound)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: ACTIONS.backToLibrary });
    expect(link).toHaveAttribute('href', '/library');
    expect(screen.queryByLabelText(FIELD_LABELS.title)).toBeNull();
  });

  it('renders the sr-only loading message when data is undefined and isLoading', () => {
    useSongMock.mockReturnValue({ data: undefined, isLoading: true });
    renderAtEdit('abc');

    expect(screen.getByText('Loading song.')).toBeInTheDocument();
    expect(screen.queryByLabelText(FIELD_LABELS.title)).toBeNull();
  });
});

describe('SongDetail — /songs/new create flow', () => {
  it('auto-focuses Title and renders the other fields as disabled inputs', () => {
    useSongMock.mockReturnValue({ data: undefined, isLoading: false });
    renderAtNew();

    const titleField = screen.getByLabelText(FIELD_LABELS.title);
    expect(titleField).toHaveFocus();

    expect(screen.getByLabelText(FIELD_LABELS.key)).toBeDisabled();
    expect(screen.getByLabelText(FIELD_LABELS.patch)).toBeDisabled();
    expect(screen.getByLabelText(FIELD_LABELS.chordChart)).toBeDisabled();
    expect(screen.getByLabelText(FIELD_LABELS.performanceNotes)).toBeDisabled();
    expect(screen.getByLabelText(FIELD_LABELS.practiceNotes)).toBeDisabled();
  });

  it('commits a new song and navigates to /songs/<id> when Title is non-empty on blur', async () => {
    const user = userEvent.setup();
    useSongMock.mockReturnValue({ data: undefined, isLoading: false });
    renderAtNew();

    const titleField = screen.getByLabelText(FIELD_LABELS.title);
    await user.type(titleField, 'Black Orpheus');
    await user.tab();

    await waitFor(() => expect(saveSongMock).toHaveBeenCalledTimes(1), { timeout: 600 });
    const payload = saveSongMock.mock.calls[0]?.[0];
    expect(payload).toEqual(
      expect.objectContaining({
        bandId: ACTIVE_BAND_ID,
        title: 'Black Orpheus',
        version: 1,
      }),
    );
    expect(payload.songId).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(typeof payload.clientWrittenAt).toBe('string');

    await waitFor(() => expect(navigateMock).toHaveBeenCalledTimes(1));
    expect(navigateMock).toHaveBeenCalledWith(`/songs/${payload.songId}`, { replace: true });
  });

  it('does NOT save or navigate when Title is blurred while empty', async () => {
    const user = userEvent.setup();
    useSongMock.mockReturnValue({ data: undefined, isLoading: false });
    renderAtNew();

    const titleField = screen.getByLabelText(FIELD_LABELS.title);
    await user.click(titleField);
    await user.tab();

    // Give the debounce ample time to fire — it must not.
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(saveSongMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
