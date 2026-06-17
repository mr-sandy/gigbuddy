import 'fake-indexeddb/auto';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiFetch } from './api/client.js';
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

function stubIPhoneUA(): void {
  vi.stubGlobal('navigator', {
    ...navigator,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
}

function stubIPhonePWA(): void {
  vi.stubGlobal('navigator', {
    ...navigator,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    standalone: true,
  });
}

function stubMatchMedia(matches: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
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

  it('renders the install-instructions surface and skips /me on iPhone Safari', () => {
    stubIPhoneUA();
    stubMatchMedia(false);
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    render(<AppBootstrap />);
    expect(screen.getByRole('heading', { level: 1, name: 'Install GigBuddy' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    // SyncWiring must not mount on the install-gate path — no 'online' listener from startFlusher.
    expect(addEventListenerSpy).not.toHaveBeenCalledWith('online', expect.any(Function));
    addEventListenerSpy.mockRestore();
  });

  it('boots the authenticated shell on iPhone PWA (display-mode standalone)', async () => {
    stubIPhonePWA();
    stubMatchMedia(true);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { status: 'ok', data: { authenticated: true, daysUntilExpiry: 365 } }),
    );
    render(<AppBootstrap />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Setlists' })).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/me', expect.anything());
  });

  it('SyncWiring installs the unauthorized handler: a 401 from apiFetch redirects to /login', async () => {
    // /me first → authenticated shell mounts → SyncWiring effect runs.
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { status: 'ok', data: { authenticated: true, daysUntilExpiry: 365 } }),
    );
    render(<AppBootstrap />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Setlists' })).toBeInTheDocument();
    });
    // Now fire a network call via apiFetch that returns 401 WITH x-server-now —
    // the SyncWiring handler should flip auth to 'unauthenticated' and the
    // router should redirect.
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'ok', data: [] }), {
        status: 401,
        headers: {
          'content-type': 'application/json',
          'x-server-now': new Date().toISOString(),
        },
      }),
    );
    // The schema parse will throw because the body isn't an error envelope —
    // catch and swallow; the side effect (handler firing) is what we verify.
    await act(async () => {
      try {
        await apiFetch('/api/v1/songs', { method: 'GET', schema: z.unknown() });
      } catch {
        /* expected */
      }
    });
    await waitFor(() => {
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });
  });

  it('boots the authenticated shell on MacBook even if display-mode standalone matches', async () => {
    // No iPhone UA stub — default jsdom navigator is a non-iPhone agent.
    stubMatchMedia(true); // simulates the edge of a future macOS PWA install
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { status: 'ok', data: { authenticated: true, daysUntilExpiry: 365 } }),
    );
    render(<AppBootstrap />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Setlists' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: 'Install GigBuddy' })).toBeNull();
  });
});
