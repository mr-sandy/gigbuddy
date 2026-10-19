import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AuthenticatedShell } from './authenticated-shell.js';

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<AuthenticatedShell />}>
          <Route index element={<div data-testid="route-content">route content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AuthenticatedShell', () => {
  it('renders a plain main wrapping the route Outlet, with no chrome', () => {
    renderShell();
    expect(screen.getByTestId('route-content')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
