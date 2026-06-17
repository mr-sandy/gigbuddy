import 'fake-indexeddb/auto';
import { useQueryClient } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { queryClient, SyncProvider } from './query-client.js';

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
