import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/auth-context.js';
import { Login } from './login.js';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function renderLogin() {
  return render(
    <AuthProvider initial={{ status: 'unauthenticated' }}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<h1>Home</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('Login route', () => {
  it('navigates to / after a successful login and follow-up /me probe', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { status: 'applied' }))
      .mockResolvedValueOnce(
        jsonResponse(200, { status: 'ok', data: { authenticated: true, daysUntilExpiry: 365 } }),
      );

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/password/i), 'right-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/auth/login',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/me',
      expect.objectContaining({ credentials: 'same-origin' }),
    );
  });

  it('renders "Wrong password." on a 401 and stays on /login', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong password.');
    expect(screen.queryByRole('heading', { name: 'Home' })).toBeNull();
  });

  it('renders "Service unavailable." when fetch rejects (offline)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/password/i), 'anything');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable.');
  });

  it('renders "Service unavailable." when /me re-probe returns non-authenticated after login', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { status: 'applied' }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/password/i), 'right-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable.');
    expect(screen.queryByRole('heading', { name: 'Home' })).toBeNull();
  });
});
