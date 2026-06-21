import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CURRENTLY_PERFORMING } from '../lib/microcopy.js';
import { CurrentlyPerformingStrip } from './currently-performing-strip.js';

/*
 * CurrentlyPerformingStrip — Story 4.3 component tests. The strip is
 * presentational: visibility logic is owned by `setlist-overview.tsx`
 * and tested there. These tests cover render, aria contract, and the
 * Resume callback.
 */

describe('CurrentlyPerformingStrip', () => {
  it('renders the locked label and the current Song title', () => {
    render(<CurrentlyPerformingStrip currentSongTitle="Autumn Leaves" onResume={() => {}} />);
    expect(screen.getByText(CURRENTLY_PERFORMING.label)).toBeInTheDocument();
    expect(screen.getByText('Autumn Leaves')).toBeInTheDocument();
  });

  it('exposes a region landmark labelled "Currently performing"', () => {
    render(<CurrentlyPerformingStrip currentSongTitle="Autumn Leaves" onResume={() => {}} />);
    expect(
      screen.getByRole('region', { name: CURRENTLY_PERFORMING.ariaRegion }),
    ).toBeInTheDocument();
  });

  it('renders the Resume › button with aria-label "Resume performance"', () => {
    render(<CurrentlyPerformingStrip currentSongTitle="Autumn Leaves" onResume={() => {}} />);
    const button = screen.getByRole('button', { name: CURRENTLY_PERFORMING.ariaResumeButton });
    expect(button).toBeInTheDocument();
    expect(button.textContent).toBe(CURRENTLY_PERFORMING.resumeButton);
  });

  it('invokes onResume when the Resume button is tapped', async () => {
    const user = userEvent.setup();
    const onResume = vi.fn();
    render(<CurrentlyPerformingStrip currentSongTitle="Autumn Leaves" onResume={onResume} />);
    await user.click(screen.getByRole('button', { name: CURRENTLY_PERFORMING.ariaResumeButton }));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('uses the accent background and bg text token classes (locked visual)', () => {
    render(<CurrentlyPerformingStrip currentSongTitle="Autumn Leaves" onResume={() => {}} />);
    const region = screen.getByRole('region', { name: CURRENTLY_PERFORMING.ariaRegion });
    expect(region.className).toContain('bg-[color:var(--color-accent)]');
    expect(region.className).toContain('text-[color:var(--color-bg)]');
  });
});
