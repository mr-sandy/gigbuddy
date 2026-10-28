import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NativeSelect } from './native-select.js';

describe('NativeSelect', () => {
  it('renders a labelled combobox and passes props through', async () => {
    const onChange = vi.fn();
    render(
      <>
        <label htmlFor="pick">Pick one</label>
        <NativeSelect id="pick" defaultValue="a" onChange={onChange}>
          <option value="a">A</option>
          <option value="b">B</option>
        </NativeSelect>
      </>,
    );
    const select = screen.getByRole('combobox', { name: 'Pick one' });
    expect(select).toHaveValue('a');
    await userEvent.selectOptions(select, 'b');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(select).toHaveValue('b');
  });

  it('draws its own hidden chevron and hides the native arrow', () => {
    render(
      <NativeSelect aria-label="Pick" defaultValue="a">
        <option value="a">A</option>
      </NativeSelect>,
    );
    const select = screen.getByRole('combobox', { name: 'Pick' });
    expect(select).toHaveClass('appearance-none');
    const chevron = select.parentElement?.querySelector('svg');
    expect(chevron).toHaveAttribute('aria-hidden', 'true');
    expect(chevron).toHaveClass('pointer-events-none', 'right-3');
  });
});
