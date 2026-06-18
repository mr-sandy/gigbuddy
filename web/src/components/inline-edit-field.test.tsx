import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InlineEditField } from './inline-edit-field.js';

describe('InlineEditField', () => {
  it('renders the value prop in the input', () => {
    render(<InlineEditField value="Autumn Leaves" onCommit={() => {}} ariaLabel="Title" />);
    expect(screen.getByRole('textbox')).toHaveValue('Autumn Leaves');
  });

  it('clicking the field focuses the input', async () => {
    const user = userEvent.setup();
    render(<InlineEditField value="Autumn" onCommit={() => {}} ariaLabel="Title" />);
    const input = screen.getByRole('textbox');
    await user.click(input);
    expect(input).toHaveFocus();
  });

  it('typing updates the local buffer', async () => {
    const user = userEvent.setup();
    render(<InlineEditField value="" onCommit={() => {}} ariaLabel="Title" />);
    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.type(input, 'Hello');
    expect(input).toHaveValue('Hello');
  });

  it('blur fires onCommit with the typed value when the buffer changed', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<InlineEditField value="" onCommit={onCommit} ariaLabel="Title" />);
    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.type(input, 'Black Orpheus');
    await user.tab();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('Black Orpheus');
  });

  it('blur does NOT fire onCommit when the buffer equals the original value', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<InlineEditField value="Stable" onCommit={onCommit} ariaLabel="Title" />);
    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.tab();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('updates the local buffer when the value prop changes after mount', () => {
    const { rerender } = render(
      <InlineEditField value="Initial" onCommit={() => {}} ariaLabel="Title" />,
    );
    expect(screen.getByRole('textbox')).toHaveValue('Initial');
    rerender(<InlineEditField value="Updated" onCommit={() => {}} ariaLabel="Title" />);
    expect(screen.getByRole('textbox')).toHaveValue('Updated');
  });

  it('renders a <textarea> when multiline === true', () => {
    render(
      <InlineEditField
        value="line one\nline two"
        onCommit={() => {}}
        ariaLabel="Notes"
        multiline
      />,
    );
    const editor = screen.getByRole('textbox');
    expect(editor.tagName).toBe('TEXTAREA');
  });

  it('puts the aria-label on the editor element', () => {
    render(<InlineEditField value="" onCommit={() => {}} ariaLabel="Chord chart" />);
    expect(screen.getByLabelText('Chord chart')).toBeInTheDocument();
  });

  it('renders the placeholder when the local buffer is empty', () => {
    render(
      <InlineEditField value="" onCommit={() => {}} ariaLabel="Title" placeholder="Song name" />,
    );
    expect(screen.getByPlaceholderText('Song name')).toBeInTheDocument();
  });

  it('disabled === true ignores typing and never fires onCommit', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<InlineEditField value="Locked" onCommit={onCommit} ariaLabel="Title" disabled />);
    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.type(input, 'x');
    await user.tab();
    expect(input).toHaveValue('Locked');
    expect(onCommit).not.toHaveBeenCalled();
  });
});
