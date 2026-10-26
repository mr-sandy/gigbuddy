import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWakeLock } from './use-wake-lock.js';

type FakeSentinel = EventTarget & { released: boolean; release: ReturnType<typeof vi.fn> };

function fakeSentinel(): FakeSentinel {
  const s = new EventTarget() as FakeSentinel;
  s.released = false;
  s.release = vi.fn(async () => {
    s.released = true;
  });
  return s;
}

function stubWakeLock(request: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
}

afterEach(() => {
  delete (navigator as { wakeLock?: unknown }).wakeLock;
  delete (document as { visibilityState?: unknown }).visibilityState;
});

describe('useWakeLock', () => {
  it('requests a screen lock on mount and is not failed while held', async () => {
    const sentinel = fakeSentinel();
    const request = vi.fn().mockResolvedValue(sentinel);
    stubWakeLock(request);
    const { result } = renderHook(() => useWakeLock());
    expect(result.current.failed).toBe(false);
    await waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
    await act(async () => {});
    expect(result.current.failed).toBe(false);
  });

  it('is failed when the request is rejected', async () => {
    stubWakeLock(vi.fn().mockRejectedValue(new Error('NotAllowedError')));
    const { result } = renderHook(() => useWakeLock());
    await waitFor(() => expect(result.current.failed).toBe(true));
  });

  it('is failed when the API is missing', async () => {
    const { result } = renderHook(() => useWakeLock());
    await waitFor(() => expect(result.current.failed).toBe(true));
  });

  it('releases the lock on unmount', async () => {
    const sentinel = fakeSentinel();
    stubWakeLock(vi.fn().mockResolvedValue(sentinel));
    const { unmount } = renderHook(() => useWakeLock());
    await act(async () => {});
    unmount();
    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });

  it('requests again when the page becomes visible after a release', async () => {
    const first = fakeSentinel();
    const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValue(fakeSentinel());
    stubWakeLock(request);
    renderHook(() => useWakeLock());
    await act(async () => {});
    setVisibility('hidden');
    await act(async () => {
      first.dispatchEvent(new Event('release'));
    });
    expect(request).toHaveBeenCalledTimes(1);
    setVisibility('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not request again on becoming visible while the lock is held', async () => {
    const request = vi.fn().mockResolvedValue(fakeSentinel());
    stubWakeLock(request);
    renderHook(() => useWakeLock());
    await act(async () => {});
    setVisibility('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('requests again when the system releases the lock while visible', async () => {
    const first = fakeSentinel();
    const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValue(fakeSentinel());
    stubWakeLock(request);
    renderHook(() => useWakeLock());
    await act(async () => {});
    setVisibility('visible');
    await act(async () => {
      first.dispatchEvent(new Event('release'));
    });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('makes one request when release and visibilitychange arrive together', async () => {
    const first = fakeSentinel();
    const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValue(fakeSentinel());
    stubWakeLock(request);
    renderHook(() => useWakeLock());
    await act(async () => {});
    setVisibility('visible');
    await act(async () => {
      first.dispatchEvent(new Event('release'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('releases at once a lock that arrives after unmount', async () => {
    const sentinel = fakeSentinel();
    let resolve: (s: FakeSentinel) => void = () => {};
    stubWakeLock(vi.fn(() => new Promise<FakeSentinel>((r) => (resolve = r))));
    const { unmount } = renderHook(() => useWakeLock());
    unmount();
    await act(async () => {
      resolve(sentinel);
    });
    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });
});
