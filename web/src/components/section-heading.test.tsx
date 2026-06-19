import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SectionHeading } from './section-heading.js';

/*
 * SectionHeading is atmosphere-aware. We toggle
 * `document.documentElement.dataset.atmosphere` in beforeEach hooks to
 * drive the two branches (MacBook practice / iPhone performance). The
 * atmosphere is read at render time, NOT memoised across renders, so
 * the dataset toggle is sufficient.
 */

describe('SectionHeading — MacBook (practice)', () => {
  beforeEach(() => {
    document.documentElement.dataset.atmosphere = 'practice';
  });
  afterEach(() => {
    document.documentElement.dataset.atmosphere = 'practice';
  });

  it('renders the section name as an editable field', () => {
    render(<SectionHeading name="Set 1" songCount={4} sectionIndex={0} onRename={() => {}} />);
    const field = screen.getByLabelText('Rename section: Set 1');
    expect(field).toBeInTheDocument();
    expect(field.tagName).toBe('INPUT');
    expect(field).toHaveValue('Set 1');
  });

  it('renders the song count badge with the correct pluralisation', () => {
    render(<SectionHeading name="Set 1" songCount={4} sectionIndex={0} onRename={() => {}} />);
    expect(screen.getByText('· 4 songs')).toBeInTheDocument();
  });

  it('uses the singular form when songCount is 1', () => {
    render(<SectionHeading name="Encore" songCount={1} sectionIndex={2} onRename={() => {}} />);
    expect(screen.getByText('· 1 song')).toBeInTheDocument();
  });

  it('calls onRename(sectionIndex, newName) on blur when the value changed', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(<SectionHeading name="Set 1" songCount={4} sectionIndex={2} onRename={onRename} />);
    const field = screen.getByLabelText('Rename section: Set 1');
    await user.click(field);
    await user.clear(field);
    await user.type(field, 'Set One');
    await user.tab();
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith(2, 'Set One');
  });

  it('does NOT call onRename when blurring without a change', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(<SectionHeading name="Set 1" songCount={4} sectionIndex={0} onRename={onRename} />);
    const field = screen.getByLabelText('Rename section: Set 1');
    await user.click(field);
    await user.tab();
    expect(onRename).not.toHaveBeenCalled();
  });
});

describe('SectionHeading — iPhone (performance)', () => {
  beforeEach(() => {
    document.documentElement.dataset.atmosphere = 'performance';
  });
  afterEach(() => {
    document.documentElement.dataset.atmosphere = 'practice';
  });

  it('renders the section name as static text (no input)', () => {
    render(<SectionHeading name="Set 1" songCount={4} sectionIndex={0} onRename={() => {}} />);
    expect(screen.queryByLabelText('Rename section: Set 1')).toBeNull();
    expect(screen.getByText('Set 1')).toBeInTheDocument();
  });

  it('still renders the song count badge', () => {
    render(<SectionHeading name="Set 1" songCount={4} sectionIndex={0} onRename={() => {}} />);
    expect(screen.getByText('· 4 songs')).toBeInTheDocument();
  });

  it('accepts onRename for type compatibility but never calls it (no edit affordance mounted)', () => {
    const onRename = vi.fn();
    render(<SectionHeading name="Set 1" songCount={4} sectionIndex={0} onRename={onRename} />);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(onRename).not.toHaveBeenCalled();
  });
});
