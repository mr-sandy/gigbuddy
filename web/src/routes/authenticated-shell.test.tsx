import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthState } from '../auth/auth-context.js';
import {
  PerformanceModeProvider,
  useSetPerformanceActive,
} from '../performance/performance-context.js';
import { AuthenticatedShell } from './authenticated-shell.js';

const { isIPhoneMock } = vi.hoisted(() => ({ isIPhoneMock: vi.fn() }));

vi.mock('../lib/platform.js', () => ({
  isIPhone: isIPhoneMock,
}));

// Story 4.4: AuthenticatedShell now mounts `useNavigateAwayGuard`, which
// reads from TanStack Query cache via `useSetlist`. Each test wraps the
// tree in a fresh QueryClient. Performance Mode is inactive in all tests
// here (the guard short-circuits on `performanceActive === false`), so no
// network call is dispatched.
let queryClient: QueryClient;

beforeEach(() => {
  isIPhoneMock.mockReset();
  isIPhoneMock.mockReturnValue(false);
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
});

afterEach(() => {
  vi.clearAllMocks();
  queryClient.clear();
});

function renderShell(auth: AuthState, wrapper?: (children: React.ReactNode) => React.ReactNode) {
  const tree = (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <PerformanceModeProvider>
          <AuthProvider initial={auth}>
            <Routes>
              <Route path="/" element={<AuthenticatedShell />}>
                <Route index element={<div data-testid="route-content">route content</div>} />
              </Route>
            </Routes>
          </AuthProvider>
        </PerformanceModeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(wrapper ? wrapper(tree) : tree);
}

describe('AuthenticatedShell', () => {
  it('renders TopNav (and not BottomTabs) on MacBook', () => {
    isIPhoneMock.mockReturnValue(false);
    renderShell({ status: 'authenticated', daysUntilExpiry: 365 });
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Tabs' })).toBeNull();
    expect(screen.getByTestId('route-content')).toBeInTheDocument();
  });

  it('renders BottomTabs (and not TopNav) on iPhone', () => {
    isIPhoneMock.mockReturnValue(true);
    renderShell({ status: 'authenticated', daysUntilExpiry: 365 });
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Tabs' })).toBeInTheDocument();
    expect(screen.getByTestId('route-content')).toBeInTheDocument();
  });

  it('hides BOTH TopNav and BottomTabs when Performance Mode is active (AC-8)', () => {
    isIPhoneMock.mockReturnValue(false);
    function ActivateOnMount() {
      const setActive = useSetPerformanceActive();
      useEffect(() => {
        setActive(true);
      }, [setActive]);
      return null;
    }
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <PerformanceModeProvider>
            <AuthProvider initial={{ status: 'authenticated', daysUntilExpiry: 365 }}>
              <ActivateOnMount />
              <Routes>
                <Route path="/" element={<AuthenticatedShell />}>
                  <Route index element={<div data-testid="route-content">route content</div>} />
                </Route>
              </Routes>
            </AuthProvider>
          </PerformanceModeProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Tabs' })).toBeNull();
    expect(screen.getByTestId('route-content')).toBeInTheDocument();
  });

  it('renders ReauthBanner when daysUntilExpiry is at the threshold, regardless of chrome', () => {
    isIPhoneMock.mockReturnValue(false);
    renderShell({ status: 'authenticated', daysUntilExpiry: 10 });
    expect(screen.getByRole('status')).toHaveTextContent('Re-authenticate within 10 days.');
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('does not render the bottom-tabs region on MacBook even when chrome is visible (DOM-level proof)', () => {
    isIPhoneMock.mockReturnValue(false);
    renderShell({ status: 'authenticated', daysUntilExpiry: 365 });
    expect(screen.queryByRole('navigation', { name: 'Tabs' })).toBeNull();
  });
});
