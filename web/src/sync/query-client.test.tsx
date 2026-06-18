import 'fake-indexeddb/auto';
import { useQueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { queryClient, SyncProvider } from './query-client.js';

vi.mock('@tanstack/react-query-persist-client', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query-persist-client')>(
    '@tanstack/react-query-persist-client',
  );
  return {
    ...actual,
    PersistQueryClientProvider: vi.fn(actual.PersistQueryClientProvider),
  };
});

function Reader({ label }: { label: string }) {
  const client = useQueryClient();
  const value = client.getQueryData<number>(['test-shared-key']);
  return <span data-testid={label}>{value ?? 'unset'}</span>;
}

describe('SyncProvider', () => {
  it('renders children once the persister has hydrated', async () => {
    render(
      <SyncProvider>
        <span>hello-sync</span>
      </SyncProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText('hello-sync')).toBeInTheDocument();
    });
  });

  it('configures the persister with maxAge: Infinity (overrides the 24h default)', () => {
    // Regression guard: the library default is 24h, which would silently evict
    // the cache on an iPhone PWA that hasn't been opened in a day. Sandy's
    // expectation is "cache survives reload forever; buster invalidates."
    render(
      <SyncProvider>
        <span>maxage-probe</span>
      </SyncProvider>,
    );
    const mockedProvider = vi.mocked(PersistQueryClientProvider);
    expect(mockedProvider).toHaveBeenCalled();
    const props = mockedProvider.mock.calls.at(-1)?.[0];
    expect(props?.persistOptions.maxAge).toBe(Number.POSITIVE_INFINITY);
    expect(props?.persistOptions.buster).toBe('v1');
  });

  it('shares one module-scope QueryClient across mounts', async () => {
    queryClient.setQueryData(['test-shared-key'], 42);
    const { unmount } = render(
      <SyncProvider>
        <Reader label="first" />
      </SyncProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('first')).toHaveTextContent('42');
    });
    unmount();
    render(
      <SyncProvider>
        <Reader label="second" />
      </SyncProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('second')).toHaveTextContent('42');
    });
  });
});
