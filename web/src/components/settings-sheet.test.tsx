import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BandMenu } from './settings-sheet.js';

const bandButton = () => screen.getByRole('button', { name: 'The Jack Ruby 5' });

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('BandMenu', () => {
  it('shows the band as a popup button with no dialog open', () => {
    render(<BandMenu />);
    expect(bandButton()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens on click and closes with Done, returning focus', async () => {
    const user = userEvent.setup();
    render(<BandMenu />);
    await user.click(bandButton());
    expect(screen.getByRole('dialog', { name: 'GigBuddy' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(bandButton()).toHaveFocus());
  });

  it('closes with Escape', async () => {
    const user = userEvent.setup();
    render(<BandMenu />);
    await user.click(bandButton());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(bandButton()).toHaveFocus());
  });

  it('lists the current band', async () => {
    const user = userEvent.setup();
    render(<BandMenu />);
    await user.click(bandButton());
    expect(screen.getByRole('heading', { name: 'Band' })).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    const row = dialog.querySelector('[aria-current="true"]');
    expect(row).toHaveTextContent('The Jack Ruby 5');
  });

  it('offers a plain export link with help text', async () => {
    const user = userEvent.setup();
    render(<BandMenu />);
    await user.click(bandButton());
    const link = screen.getByRole('link', { name: 'Export all data' });
    expect(link).toHaveAttribute('href', '/api/v1/export');
    expect(link).toHaveAttribute('data-variant', 'link');
    expect(
      screen.getByText("Downloads every band's songs and gigs as one file."),
    ).toBeInTheDocument();
  });

  it('changes and remembers the appearance without closing the sheet', async () => {
    const user = userEvent.setup();
    render(<BandMenu />);
    await user.click(bandButton());
    const group = screen.getByRole('group', { name: 'Appearance' });
    expect(group.querySelectorAll('button')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'System', pressed: true })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dark' }));
    expect(screen.getByRole('button', { name: 'Dark', pressed: true })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('gigbuddy-theme')).toBe('dark');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Light' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    await user.click(screen.getByRole('button', { name: 'System' }));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem('gigbuddy-theme')).toBeNull();
  });

  it('shows the remembered choice on reopen and on a fresh render', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<BandMenu />);
    await user.click(bandButton());
    await user.click(screen.getByRole('button', { name: 'Dark' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await user.click(bandButton());
    expect(screen.getByRole('button', { name: 'Dark', pressed: true })).toBeInTheDocument();
    unmount();

    render(<BandMenu />);
    await user.click(bandButton());
    expect(screen.getByRole('button', { name: 'Dark', pressed: true })).toBeInTheDocument();
  });

  it('falls back to System when storage is unreadable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const user = userEvent.setup();
    render(<BandMenu />);
    await user.click(bandButton());
    expect(screen.getByRole('button', { name: 'System', pressed: true })).toBeInTheDocument();
  });
});
