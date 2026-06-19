import type { SongRef } from '@gigbuddy/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SetlistSongRow } from './setlist-song-row.js';

/*
 * SetlistSongRow tests. The component reads atmosphere from
 * `document.documentElement.dataset.atmosphere` at render time — the
 * beforeEach hooks toggle that to drive each branch. List wrapping
 * (<ul>) is added in the parent route; here we render the row in a
 * <ul> wrapper so the <li> child is well-formed.
 */

function makeSongRef(overrides: Partial<SongRef> = {}): SongRef {
  return {
    songId: 'songid0000000001',
    titleSnapshot: 'Autumn Leaves',
    ...overrides,
  };
}

function renderRow(props: Partial<ComponentProps<typeof SetlistSongRow>> = {}): {
  onNavigate: ReturnType<typeof vi.fn>;
  onAnnotationChange: ReturnType<typeof vi.fn>;
} {
  const onNavigate = vi.fn();
  const onAnnotationChange = vi.fn();
  render(
    <ul>
      <SetlistSongRow
        songRef={makeSongRef()}
        sectionIndex={0}
        songIndex={0}
        onNavigate={onNavigate}
        onAnnotationChange={onAnnotationChange}
        {...props}
      />
    </ul>,
  );
  return { onNavigate, onAnnotationChange };
}

describe('SetlistSongRow — MacBook (practice)', () => {
  beforeEach(() => {
    document.documentElement.dataset.atmosphere = 'practice';
  });
  afterEach(() => {
    document.documentElement.dataset.atmosphere = 'practice';
  });

  it('renders the song title from titleSnapshot', () => {
    renderRow({ songRef: makeSongRef({ titleSnapshot: 'Black Orpheus' }) });
    expect(screen.getByText('Black Orpheus')).toBeInTheDocument();
  });

  it('renders the annotation as a button when perGigAnnotation is set', () => {
    renderRow({ songRef: makeSongRef({ perGigAnnotation: 'half-time feel' }) });
    expect(screen.getByText('half-time feel')).toBeInTheDocument();
  });

  it('renders title only when perGigAnnotation is absent (no placeholder text per AC-7)', () => {
    renderRow({ songRef: makeSongRef() });
    expect(screen.queryByText('half-time feel')).toBeNull();
    // AC-7: no visible affordance text; invisible tap zone still accessible via aria-label
    expect(screen.queryByText('Add note')).toBeNull();
  });

  it('calls onNavigate(songId) when the title button is tapped', async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderRow({
      songRef: makeSongRef({ songId: 'mysongid12345678', titleSnapshot: 'Take Five' }),
    });
    await user.click(screen.getByRole('button', { name: 'Take Five' }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('mysongid12345678');
  });

  it('opens an inline edit field when the annotation area is tapped', async () => {
    const user = userEvent.setup();
    renderRow({ songRef: makeSongRef({ perGigAnnotation: 'soft intro' }) });
    await user.click(screen.getByRole('button', { name: 'Edit per-gig note for Autumn Leaves' }));
    expect(screen.getByLabelText('Per-gig note for Autumn Leaves')).toBeInTheDocument();
  });

  it('commits the annotation on blur via onAnnotationChange(sectionIndex, songIndex, value)', async () => {
    const user = userEvent.setup();
    const { onAnnotationChange } = renderRow({
      sectionIndex: 1,
      songIndex: 3,
      songRef: makeSongRef({ perGigAnnotation: 'soft intro' }),
    });
    await user.click(screen.getByRole('button', { name: 'Edit per-gig note for Autumn Leaves' }));
    const field = screen.getByLabelText('Per-gig note for Autumn Leaves');
    await user.clear(field);
    await user.type(field, 'extended intro');
    await user.tab();
    expect(onAnnotationChange).toHaveBeenCalledTimes(1);
    expect(onAnnotationChange).toHaveBeenCalledWith(1, 3, 'extended intro');
  });

  it('opens an empty inline edit field from the invisible add-note tap zone when annotation is absent', async () => {
    const user = userEvent.setup();
    renderRow({ songRef: makeSongRef() });
    await user.click(screen.getByRole('button', { name: 'Add per-gig note for Autumn Leaves' }));
    const field = screen.getByLabelText('Per-gig note for Autumn Leaves');
    expect(field).toHaveValue('');
  });

  it('row satisfies the 44px tap-target minimum', () => {
    renderRow();
    const li = screen.getByRole('button', { name: 'Autumn Leaves' }).closest('li');
    expect(li?.className).toContain('min-h-tap');
  });
});

describe('SetlistSongRow — iPhone (performance)', () => {
  beforeEach(() => {
    document.documentElement.dataset.atmosphere = 'performance';
  });
  afterEach(() => {
    document.documentElement.dataset.atmosphere = 'practice';
  });

  it('opens a bottom-sheet dialog when the row is tapped', async () => {
    const user = userEvent.setup();
    renderRow();
    await user.click(screen.getByRole('button', { name: 'Edit per-gig note for Autumn Leaves' }));
    expect(
      screen.getByRole('dialog', { name: 'Per-gig note for Autumn Leaves' }),
    ).toBeInTheDocument();
  });

  it('Done button commits the annotation via onAnnotationChange', async () => {
    const user = userEvent.setup();
    const { onAnnotationChange } = renderRow({
      sectionIndex: 2,
      songIndex: 1,
      songRef: makeSongRef({ perGigAnnotation: 'half-time feel' }),
    });
    await user.click(screen.getByRole('button', { name: 'Edit per-gig note for Autumn Leaves' }));
    const field = screen.getByLabelText('Per-gig note text for Autumn Leaves');
    await user.clear(field);
    await user.type(field, 'double-time feel');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onAnnotationChange).toHaveBeenCalledTimes(1);
    expect(onAnnotationChange).toHaveBeenCalledWith(2, 1, 'double-time feel');
  });

  it('Done button closes the sheet after committing', async () => {
    const user = userEvent.setup();
    renderRow();
    await user.click(screen.getByRole('button', { name: 'Edit per-gig note for Autumn Leaves' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('× dismiss button closes the sheet WITHOUT calling onAnnotationChange', async () => {
    const user = userEvent.setup();
    const { onAnnotationChange } = renderRow({
      songRef: makeSongRef({ perGigAnnotation: 'half-time' }),
    });
    await user.click(screen.getByRole('button', { name: 'Edit per-gig note for Autumn Leaves' }));
    const field = screen.getByLabelText('Per-gig note text for Autumn Leaves');
    await user.clear(field);
    await user.type(field, 'this should be discarded');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onAnnotationChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does NOT navigate on row tap (annotation-focused, not navigation)', async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderRow();
    await user.click(screen.getByRole('button', { name: 'Edit per-gig note for Autumn Leaves' }));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('shows the title and the existing annotation in the row body', () => {
    renderRow({ songRef: makeSongRef({ perGigAnnotation: 'half-time feel' }) });
    expect(screen.getByText('Autumn Leaves')).toBeInTheDocument();
    expect(screen.getByText('half-time feel')).toBeInTheDocument();
  });

  it('row satisfies the 44px tap-target minimum', () => {
    renderRow();
    const button = screen.getByRole('button', {
      name: 'Edit per-gig note for Autumn Leaves',
    });
    expect(button.className).toContain('min-h-tap');
  });
});
