import { ACTIVE_BAND_ID, type Song } from '@gigbuddy/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { LibrarySongRow } from './library-song-row.js';

function makeSong(songId: string, title: string): Song {
  return {
    bandId: ACTIVE_BAND_ID,
    songId,
    title,
    clientWrittenAt: '2026-06-17T12:00:00.000Z',
    serverReceivedAt: '2026-06-17T12:00:01.000Z',
    version: 1 as const,
  };
}

function renderRow(song: Song) {
  return render(
    <MemoryRouter>
      <ul>
        <LibrarySongRow song={song} />
      </ul>
    </MemoryRouter>,
  );
}

describe('LibrarySongRow', () => {
  it('renders the title text inside a link', () => {
    renderRow(makeSong('a', 'Autumn Leaves'));
    const link = screen.getByRole('link', { name: 'Autumn Leaves' });
    expect(link).toBeInTheDocument();
  });

  it('links to /songs/<songId>', () => {
    renderRow(makeSong('xyzNanoID01234567', 'Blue Bossa'));
    const link = screen.getByRole('link', { name: 'Blue Bossa' });
    expect(link).toHaveAttribute('href', '/songs/xyzNanoID01234567');
  });

  it('applies the min-h-tap utility on the link element', () => {
    renderRow(makeSong('a', 'Charleston'));
    const link = screen.getByRole('link', { name: 'Charleston' });
    expect(link.className).toContain('min-h-tap');
  });

  it('does not set aria-label and renders no buttons (visible text is the accessible name)', () => {
    renderRow(makeSong('a', 'Donna Lee'));
    const link = screen.getByRole('link', { name: 'Donna Lee' });
    expect(link.hasAttribute('aria-label')).toBe(false);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
