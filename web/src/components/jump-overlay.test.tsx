import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { JumpOverlay } from './jump-overlay.js';

/*
 * JumpOverlay — Story 6.3 minimal shell. Tests focus on the shell's
 * accessibility contract, the dismiss callback, and (critically for scope
 * discipline) the ABSENCE of Story-6.4 content — no search field, no
 * setlist rows, no library rows. Any of those appearing here would mean
 * the story overshot its scope.
 */
describe('JumpOverlay', () => {
  it('renders with role="dialog" and aria-modal="true"', () => {
    render(<JumpOverlay onDismiss={() => undefined} />);
    const dialog = screen.getByRole('dialog', { name: 'Jump to a song' });
    expect(dialog).toBeInTheDocument();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('renders the dismiss control with aria-label "Dismiss jump overlay"', () => {
    render(<JumpOverlay onDismiss={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Dismiss jump overlay' })).toBeInTheDocument();
  });

  it('tapping the dismiss control calls onDismiss after the fade-out completes', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<JumpOverlay onDismiss={onDismiss} />);
    await user.click(screen.getByRole('button', { name: 'Dismiss jump overlay' }));
    // The fade-out is ~150ms; onDismiss fires when the timer resolves so
    // the parent can unmount the overlay after the transition plays.
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1), { timeout: 1000 });
  });

  it('renders no search field, setlist rows, or library rows (Story 6.4 scope guard)', () => {
    render(<JumpOverlay onDismiss={() => undefined} />);
    // No text input / searchbox — Story 6.4 owns the pinned search field.
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    // No list of setlist rows or library rows — Story 6.4 owns the
    // sectioned setlist overview and the `In library` results group.
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('listitem')).toBeNull();
    // Exactly one interactive button in the shell — the dismiss control.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('applies transition-opacity duration-150 on the root (AC-3 real fade)', () => {
    render(<JumpOverlay onDismiss={() => undefined} />);
    const dialog = screen.getByRole('dialog', { name: 'Jump to a song' });
    expect(dialog.className).toContain('transition-opacity');
    expect(dialog.className).toContain('duration-150');
  });
});
