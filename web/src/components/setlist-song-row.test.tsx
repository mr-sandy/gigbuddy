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

/*
 * Story 3.6 — drag-reorder affordances on MacBook.
 *
 * The drag handle appears only when the parent has wired drag callbacks
 * (drag state lives in setlist-overview.tsx). When drag callbacks are
 * undefined the row renders without any drag affordance. Move up / Move
 * down buttons follow the same opt-in pattern.
 */
describe('SetlistSongRow — MacBook drag handle and keyboard buttons', () => {
  beforeEach(() => {
    document.documentElement.dataset.atmosphere = 'practice';
  });
  afterEach(() => {
    document.documentElement.dataset.atmosphere = 'practice';
  });

  it('renders a drag handle with the locked aria-label when drag callbacks are wired', () => {
    renderRow({
      onDragStart: vi.fn(),
      onDragOverRow: vi.fn(),
      onDropRow: vi.fn(),
      onDragEnd: vi.fn(),
    });
    expect(screen.getByRole('img', { name: 'Drag to reorder Autumn Leaves' })).toBeInTheDocument();
  });

  it('makes the <li> draggable when drag callbacks are wired', () => {
    renderRow({
      onDragStart: vi.fn(),
      onDragOverRow: vi.fn(),
      onDropRow: vi.fn(),
      onDragEnd: vi.fn(),
    });
    const li = screen.getByRole('button', { name: 'Autumn Leaves' }).closest('li');
    expect(li?.getAttribute('draggable')).toBe('true');
  });

  it('does NOT render the drag handle when drag callbacks are not wired', () => {
    renderRow();
    expect(screen.queryByRole('img', { name: 'Drag to reorder Autumn Leaves' })).toBeNull();
  });

  it('does NOT mark the <li> draggable when drag callbacks are not wired', () => {
    renderRow();
    const li = screen.getByRole('button', { name: 'Autumn Leaves' }).closest('li');
    expect(li?.hasAttribute('draggable')).toBe(false);
  });

  it('renders Move up and Move down buttons when keyboard callbacks are wired', () => {
    renderRow({ onMoveUp: vi.fn(), onMoveDown: vi.fn() });
    expect(screen.getByRole('button', { name: 'Move up' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move down' })).toBeInTheDocument();
  });

  it('marks Move up aria-disabled and inert when isFirstInSection', async () => {
    const user = userEvent.setup();
    const onMoveUp = vi.fn();
    renderRow({ onMoveUp, onMoveDown: vi.fn(), isFirstInSection: true });
    const moveUp = screen.getByRole('button', { name: 'Move up' });
    expect(moveUp.getAttribute('aria-disabled')).toBe('true');
    expect(moveUp).toBeDisabled();
    // Even bypassing pointer-events, userEvent click on a disabled button is a no-op.
    await user.click(moveUp);
    expect(onMoveUp).not.toHaveBeenCalled();
  });

  it('marks Move down aria-disabled and inert when isLastInSection', async () => {
    const user = userEvent.setup();
    const onMoveDown = vi.fn();
    renderRow({ onMoveUp: vi.fn(), onMoveDown, isLastInSection: true });
    const moveDown = screen.getByRole('button', { name: 'Move down' });
    expect(moveDown.getAttribute('aria-disabled')).toBe('true');
    expect(moveDown).toBeDisabled();
    await user.click(moveDown);
    expect(onMoveDown).not.toHaveBeenCalled();
  });

  it('fires onMoveUp(sectionIndex, songIndex) on click when not first', async () => {
    const user = userEvent.setup();
    const onMoveUp = vi.fn();
    renderRow({ sectionIndex: 1, songIndex: 2, onMoveUp, onMoveDown: vi.fn() });
    await user.click(screen.getByRole('button', { name: 'Move up' }));
    expect(onMoveUp).toHaveBeenCalledTimes(1);
    expect(onMoveUp).toHaveBeenCalledWith(1, 2);
  });

  it('fires onMoveDown(sectionIndex, songIndex) on click when not last', async () => {
    const user = userEvent.setup();
    const onMoveDown = vi.fn();
    renderRow({ sectionIndex: 0, songIndex: 0, onMoveUp: vi.fn(), onMoveDown });
    await user.click(screen.getByRole('button', { name: 'Move down' }));
    expect(onMoveDown).toHaveBeenCalledTimes(1);
    expect(onMoveDown).toHaveBeenCalledWith(0, 0);
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

  /*
   * AC-7: NO drag handle on iPhone — not even sr-only — and NO draggable
   * attribute on the <li>. This holds even if a (misconfigured) parent
   * happens to pass drag callbacks down; the platform-routed
   * IPhoneRow branch ignores them entirely.
   */
  it('does NOT render a drag handle on iPhone even when drag callbacks are passed', () => {
    renderRow({
      onDragStart: vi.fn(),
      onDragOverRow: vi.fn(),
      onDropRow: vi.fn(),
      onDragEnd: vi.fn(),
      onMoveUp: vi.fn(),
      onMoveDown: vi.fn(),
    });
    expect(screen.queryByRole('img', { name: 'Drag to reorder Autumn Leaves' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move up' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move down' })).toBeNull();
  });

  it('does NOT mark the iPhone <li> draggable', () => {
    renderRow({
      onDragStart: vi.fn(),
      onDragOverRow: vi.fn(),
      onDropRow: vi.fn(),
      onDragEnd: vi.fn(),
    });
    const li = screen
      .getByRole('button', { name: 'Edit per-gig note for Autumn Leaves' })
      .closest('li');
    expect(li?.hasAttribute('draggable')).toBe(false);
  });
});
