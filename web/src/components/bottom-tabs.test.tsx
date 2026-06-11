import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { BottomTabs } from './bottom-tabs.js';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomTabs />
    </MemoryRouter>,
  );
}

describe('BottomTabs', () => {
  it('renders both tabs with aria-labels including the "tab" suffix', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: 'Setlists tab' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Library tab' })).toBeInTheDocument();
  });

  it('marks the Library tab as current when on /library', () => {
    renderAt('/library');
    const libraryTab = screen.getByRole('link', { name: 'Library tab' });
    expect(libraryTab).toHaveAttribute('aria-current', 'page');
    const setlistsTab = screen.getByRole('link', { name: 'Setlists tab' });
    expect(setlistsTab).not.toHaveAttribute('aria-current', 'page');
  });

  it('marks ONLY the Setlists tab as current on / (end: true match does not bleed to /library)', () => {
    renderAt('/');
    const setlistsTab = screen.getByRole('link', { name: 'Setlists tab' });
    const libraryTab = screen.getByRole('link', { name: 'Library tab' });
    expect(setlistsTab).toHaveAttribute('aria-current', 'page');
    expect(libraryTab).not.toHaveAttribute('aria-current', 'page');
  });
});
