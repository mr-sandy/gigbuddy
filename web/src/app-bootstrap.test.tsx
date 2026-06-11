import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppBootstrap } from './app-bootstrap.js';
import { EMPTY_STATES } from './lib/microcopy.js';
import { router } from './router.js';

const fetchMock = vi.fn();

beforeEach(async () => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  // The createBrowserRouter() instance is module-scoped; reset its location so
  // each test starts at '/' regardless of where a previous test left it.
  window.history.replaceState(null, '', '/');
  await router.navigate('/', { replace: true });
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

describe('AppBootstrap', () => {
  it('renders the GigBuddy shell heading while the /me probe is in-flight', () => {
    fetchMock.mockReturnValueOnce(new Promise(() => undefined)); // never resolves
    render(<AppBootstrap />);
    expect(screen.getByRole('heading', { name: 'GigBuddy' })).toBeInTheDocument();
  });

  it('mounts the authenticated shell with Setlists home after a 200 /me response', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { status: 'ok', data: { authenticated: true, daysUntilExpiry: 365 } }),
    );
    render(<AppBootstrap />);
    // Two unambiguous signals that the authenticated shell rendered, NOT the boot
    // loading shell: the (sr-only) Setlists h1 and the locked empty-state copy.
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Setlists' })).toBeInTheDocument();
    });
    expect(screen.getByText(EMPTY_STATES.noUpcomingGigs)).toBeInTheDocument();
  });

  it('redirects to /login when /me returns 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    render(<AppBootstrap />);
    await waitFor(() => {
      // The login route renders a password input with autocomplete="current-password".
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });
  });

  it('stays on the shell (no /login redirect) when fetch rejects (offline-cache path)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    render(<AppBootstrap />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'GigBuddy' })).toBeInTheDocument();
    });
    // No login input should appear — AR-16 says we stay on the cached shell.
    expect(screen.queryByLabelText(/password/i)).toBeNull();
  });
});
