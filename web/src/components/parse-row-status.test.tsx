import { ACTIVE_BAND_ID, type Song } from '@gigbuddy/shared';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MatchResult } from '../paste-parse/matcher.js';
import { ParseRowStatus } from './parse-row-status.js';

/*
 * ParseRowStatus tests — Story 3.5 AC-17. Covers:
 *   - Matched row renders ✓, canonical title, no action buttons
 *   - Matched row with different paste form renders "(was: …)" caption
 *   - Fuzzy row renders ?, suggested title, both buttons (Yes/No)
 *   - Unknown row renders +, normalized title, all three action buttons
 *   - Color-never-alone verified via glyph + label present in all states
 *   - Inline title edit fires onTitleEdit on blur with the new value
 *   - Unknown's `Pick from library` mounts SongSearchRow inline
 */

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

const HANDLERS = {
  onAcceptFuzzy: vi.fn(),
  onRejectFuzzy: vi.fn(),
  onAddToLibrary: vi.fn(),
  onPickFromLibrary: vi.fn(),
  onDiscard: vi.fn(),
  onTitleEdit: vi.fn(),
};

function freshHandlers() {
  HANDLERS.onAcceptFuzzy = vi.fn();
  HANDLERS.onRejectFuzzy = vi.fn();
  HANDLERS.onAddToLibrary = vi.fn();
  HANDLERS.onPickFromLibrary = vi.fn();
  HANDLERS.onDiscard = vi.fn();
  HANDLERS.onTitleEdit = vi.fn();
  return HANDLERS;
}

describe('ParseRowStatus — Matched state', () => {
  it('renders ✓ glyph, "Matched" label, canonical title, and no action buttons', () => {
    const song = makeSong('s0000000000mqn1', 'Mas Que Nada');
    const result: MatchResult = { status: 'matched', song };
    const handlers = freshHandlers();
    render(
      <ParseRowStatus
        result={result}
        rawTitle="Mas Que Nada"
        displayTitle="Mas Que Nada"
        songs={[song]}
        {...handlers}
      />,
    );
    expect(screen.getByText('✓')).toBeInTheDocument();
    expect(screen.getByText('Matched')).toBeInTheDocument();
    expect(screen.getByLabelText('Song title')).toHaveValue('Mas Que Nada');
    // No action buttons in Matched.
    expect(screen.queryByRole('button', { name: 'Yes, that one' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'No — new song' })).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Add to library' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pick from library' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull();
  });

  it('renders "(was: …)" caption when canonical title differs from paste form', () => {
    const song = makeSong('s0000000000chb1', 'Coming Home Baby');
    const result: MatchResult = { status: 'matched', song };
    const handlers = freshHandlers();
    render(
      <ParseRowStatus
        result={result}
        rawTitle="COMIN' HOME BABY"
        displayTitle="Coming Home Baby"
        songs={[song]}
        {...handlers}
      />,
    );
    expect(screen.getByText(/was:/)).toBeInTheDocument();
    expect(screen.getByText(/COMIN' HOME BABY/)).toBeInTheDocument();
  });

  it('does NOT render "(was: …)" caption when paste form already matches canonical (case-insensitive)', () => {
    const song = makeSong('s0000000000mqn1', 'Mas Que Nada');
    const result: MatchResult = { status: 'matched', song };
    const handlers = freshHandlers();
    render(
      <ParseRowStatus
        result={result}
        rawTitle="MAS QUE NADA"
        displayTitle="Mas Que Nada"
        songs={[song]}
        {...handlers}
      />,
    );
    expect(screen.queryByText(/was:/)).toBeNull();
  });
});

describe('ParseRowStatus — Fuzzy state', () => {
  it('renders ? glyph, "Fuzzy" label, suggested title, and Yes/No buttons', () => {
    const song = makeSong('s0000000000chb1', 'Coming Home Baby');
    const result: MatchResult = { status: 'fuzzy', song, score: 0.98 };
    const handlers = freshHandlers();
    render(
      <ParseRowStatus
        result={result}
        rawTitle="COMIN' HOME BABY"
        displayTitle="Coming Home Baby"
        songs={[song]}
        {...handlers}
      />,
    );
    expect(screen.getByText('?')).toBeInTheDocument();
    expect(screen.getByText('Fuzzy')).toBeInTheDocument();
    expect(screen.getByLabelText('Song title')).toHaveValue('Coming Home Baby');
    expect(screen.getByRole('button', { name: 'Yes, that one' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No — new song' })).toBeInTheDocument();
  });

  it('invokes onAcceptFuzzy / onRejectFuzzy when tapped', async () => {
    const user = userEvent.setup();
    const song = makeSong('s0000000000chb1', 'Coming Home Baby');
    const result: MatchResult = { status: 'fuzzy', song, score: 0.98 };
    const handlers = freshHandlers();
    render(
      <ParseRowStatus
        result={result}
        rawTitle="COMIN' HOME BABY"
        displayTitle="Coming Home Baby"
        songs={[song]}
        {...handlers}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Yes, that one' }));
    expect(handlers.onAcceptFuzzy).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'No — new song' }));
    expect(handlers.onRejectFuzzy).toHaveBeenCalledTimes(1);
  });
});

describe('ParseRowStatus — Unknown state', () => {
  it('renders + glyph, "Unknown" label, normalized title, and three action buttons', () => {
    const result: MatchResult = { status: 'unknown' };
    const handlers = freshHandlers();
    render(
      <ParseRowStatus
        result={result}
        rawTitle="Howlin Wolf - 2nd May"
        displayTitle="howlin wolf"
        songs={[]}
        {...handlers}
      />,
    );
    expect(screen.getByText('+')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByLabelText('Song title')).toHaveValue('howlin wolf');
    expect(screen.getByRole('button', { name: '+ Add to library' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pick from library' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
  });

  it('invokes onAddToLibrary and onDiscard when tapped', async () => {
    const user = userEvent.setup();
    const result: MatchResult = { status: 'unknown' };
    const handlers = freshHandlers();
    render(
      <ParseRowStatus
        result={result}
        rawTitle="some line"
        displayTitle="some line"
        songs={[]}
        {...handlers}
      />,
    );
    await user.click(screen.getByRole('button', { name: '+ Add to library' }));
    expect(handlers.onAddToLibrary).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(handlers.onDiscard).toHaveBeenCalledTimes(1);
  });

  it('Pick from library swaps the action buttons for an inline SongSearchRow', async () => {
    const user = userEvent.setup();
    const song = makeSong('s0000000000abc1', 'Cantaloupe Island');
    const result: MatchResult = { status: 'unknown' };
    const handlers = freshHandlers();
    render(
      <ParseRowStatus
        result={result}
        rawTitle="cantaloupe"
        displayTitle="cantaloupe"
        songs={[song]}
        {...handlers}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Pick from library' }));
    // SongSearchRow's input
    expect(screen.getByLabelText('Search songs')).toBeInTheDocument();
    // Original action buttons gone
    expect(screen.queryByRole('button', { name: '+ Add to library' })).toBeNull();
  });

  it('selecting a library song from the inline picker calls onPickFromLibrary with the SongRef', async () => {
    const user = userEvent.setup();
    const song = makeSong('s0000000000abc1', 'Cantaloupe Island');
    const result: MatchResult = { status: 'unknown' };
    const handlers = freshHandlers();
    render(
      <ParseRowStatus
        result={result}
        rawTitle="cantaloupe"
        displayTitle="cantaloupe"
        songs={[song]}
        {...handlers}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Pick from library' }));
    await user.type(screen.getByLabelText('Search songs'), 'cantaloupe');
    await user.click(screen.getByRole('button', { name: 'Cantaloupe Island' }));
    expect(handlers.onPickFromLibrary).toHaveBeenCalledTimes(1);
    expect(handlers.onPickFromLibrary).toHaveBeenCalledWith({
      songId: song.songId,
      titleSnapshot: song.title,
    });
  });
});

describe('ParseRowStatus — inline title edit', () => {
  it('fires onTitleEdit on blur with the new value', async () => {
    const user = userEvent.setup();
    const song = makeSong('s0000000000abc1', 'Cantaloupe Island');
    const result: MatchResult = { status: 'fuzzy', song, score: 0.95 };
    const handlers = freshHandlers();
    render(
      <ParseRowStatus
        result={result}
        rawTitle="cantaloup"
        displayTitle="Cantaloupe Island"
        songs={[song]}
        {...handlers}
      />,
    );
    const input = screen.getByLabelText('Song title');
    await user.clear(input);
    await user.type(input, 'Watermelon Man');
    await user.tab();
    expect(handlers.onTitleEdit).toHaveBeenCalledWith('Watermelon Man');
  });

  it('does NOT fire onTitleEdit when title is unchanged', async () => {
    const user = userEvent.setup();
    const song = makeSong('s0000000000abc1', 'Cantaloupe Island');
    const result: MatchResult = { status: 'matched', song };
    const handlers = freshHandlers();
    render(
      <ParseRowStatus
        result={result}
        rawTitle="Cantaloupe Island"
        displayTitle="Cantaloupe Island"
        songs={[song]}
        {...handlers}
      />,
    );
    await user.click(screen.getByLabelText('Song title'));
    await user.tab();
    expect(handlers.onTitleEdit).not.toHaveBeenCalled();
  });
});

describe('ParseRowStatus — color-never-alone', () => {
  it.each([
    [{ status: 'matched', song: makeSong('s1', 'X') } as MatchResult, '✓', 'Matched'],
    [{ status: 'fuzzy', song: makeSong('s2', 'X'), score: 0.95 } as MatchResult, '?', 'Fuzzy'],
    [{ status: 'unknown' } as MatchResult, '+', 'Unknown'],
  ])('state %#: pairs glyph + label so color is never the sole signal', (result, glyph, label) => {
    const handlers = freshHandlers();
    render(
      <ParseRowStatus result={result} rawTitle="X" displayTitle="X" songs={[]} {...handlers} />,
    );
    expect(screen.getByText(glyph)).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
