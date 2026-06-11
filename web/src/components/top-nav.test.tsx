import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { TopNav } from './top-nav.js';

function renderAt(path: string, rightActions?: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TopNav rightActions={rightActions} />
    </MemoryRouter>,
  );
}

describe('TopNav', () => {
  it('renders the BandLabel, the two nav items, and no rightActions slot by default', () => {
    renderAt('/');
    expect(screen.getByText(/GigBuddy · The Jack Ruby 5/)).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const list = within(nav).getByRole('list');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    const [setlistsItem, libraryItem] = items as [HTMLElement, HTMLElement];
    expect(within(setlistsItem).getByRole('link', { name: 'Setlists' })).toBeInTheDocument();
    expect(within(libraryItem).getByRole('link', { name: 'Library' })).toBeInTheDocument();
  });

  it('appends rightActions AFTER the Library nav item', () => {
    renderAt('/', <button type="button">+ New setlist</button>);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const items = within(nav).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    const [, libraryItem, actionsItem] = items as [HTMLElement, HTMLElement, HTMLElement];
    expect(within(libraryItem).getByRole('link', { name: 'Library' })).toBeInTheDocument();
    expect(within(actionsItem).getByRole('button', { name: '+ New setlist' })).toBeInTheDocument();
  });

  it('marks the Library link as the current page when on /library', () => {
    renderAt('/library');
    const libraryLink = screen.getByRole('link', { name: 'Library' });
    expect(libraryLink).toHaveAttribute('aria-current', 'page');
    const setlistsLink = screen.getByRole('link', { name: 'Setlists' });
    expect(setlistsLink).not.toHaveAttribute('aria-current', 'page');
  });

  it('marks the Setlists link as current on / (end: true match)', () => {
    renderAt('/');
    const setlistsLink = screen.getByRole('link', { name: 'Setlists' });
    expect(setlistsLink).toHaveAttribute('aria-current', 'page');
  });
});
