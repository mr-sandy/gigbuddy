import { ACTIVE_BAND_ID, type Song } from '@gigbuddy/shared';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SongSearchRow } from './song-search-row.js';

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
  makeSong('song0000000003cc', 'Blue Bossa'),
  makeSong('song0000000004dd', 'Take Five'),
];

const onSelect = vi.fn();
const onAddNew = vi.fn();
const onCancel = vi.fn();

function renderRow(songs: Song[] = LIBRARY) {
  return render(
    <SongSearchRow songs={songs} onSelect={onSelect} onAddNew={onAddNew} onCancel={onCancel} />,
  );
}

beforeEach(() => {
  onSelect.mockReset();
  onAddNew.mockReset();
  onCancel.mockReset();
});

describe('SongSearchRow', () => {
  it('renders an input labelled "Search songs" that is auto-focused', () => {
    renderRow();
    const input = screen.getByLabelText('Search songs');
    expect(input).toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it('shows no dropdown when the query is empty', () => {
    renderRow();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('filters songs by case-insensitive substring on title (capped at 8)', async () => {
    const user = userEvent.setup();
    renderRow();
    await user.type(screen.getByLabelText('Search songs'), 'bl');
    const listbox = screen.getByRole('listbox');
    // Both "Black Orpheus" and "Blue Bossa" match "bl" case-insensitively.
    expect(screen.getByRole('button', { name: 'Black Orpheus' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Blue Bossa' })).toBeInTheDocument();
    // "Autumn Leaves" and "Take Five" do not match.
    expect(screen.queryByRole('button', { name: 'Autumn Leaves' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Take Five' })).toBeNull();
    // Listbox is present.
    expect(listbox).toBeInTheDocument();
  });

  it('selecting a match calls onSelect with the matching SongRef (songId + titleSnapshot)', async () => {
    const user = userEvent.setup();
    renderRow();
    await user.type(screen.getByLabelText('Search songs'), 'autumn');
    await user.click(screen.getByRole('button', { name: 'Autumn Leaves' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({
      songId: 'song0000000001aa',
      titleSnapshot: 'Autumn Leaves',
    });
  });

  it('shows "+ Add to library" when the query is non-empty and has no exact match', async () => {
    const user = userEvent.setup();
    renderRow();
    await user.type(screen.getByLabelText('Search songs'), 'New Song');
    expect(screen.getByRole('button', { name: '+ Add to library: New Song' })).toBeInTheDocument();
  });

  it('does NOT show "+ Add to library" when the query matches an existing title exactly (case-insensitive)', async () => {
    const user = userEvent.setup();
    renderRow();
    await user.type(screen.getByLabelText('Search songs'), 'autumn leaves');
    expect(screen.queryByRole('button', { name: /\+ Add to library/ })).toBeNull();
    // The exact match should still appear as a selectable option.
    expect(screen.getByRole('button', { name: 'Autumn Leaves' })).toBeInTheDocument();
  });

  it('tapping "+ Add to library" calls onAddNew with the typed (trimmed) title', async () => {
    const user = userEvent.setup();
    renderRow();
    await user.type(screen.getByLabelText('Search songs'), '  Brand New  ');
    await user.click(screen.getByRole('button', { name: '+ Add to library: Brand New' }));
    expect(onAddNew).toHaveBeenCalledTimes(1);
    expect(onAddNew).toHaveBeenCalledWith('Brand New');
  });

  it('Escape calls onCancel', async () => {
    const user = userEvent.setup();
    renderRow();
    const input = screen.getByLabelText('Search songs');
    await user.click(input);
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
