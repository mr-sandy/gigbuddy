import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * `useWakeLockIndicator` hook tests — Story 4.2 (AC-12).
 *
 * `wake-lock.ts` is mocked at the module level so the hook can be
 * exercised without touching the W3C API or the singleton state in the
 * real module. The mock exposes a `__triggerChange` helper to simulate
 * the `onChange` callback firing.
 */

const {
  acquireMock,
  releaseMock,
  isHeldMock,
  onChangeMock,
  setPerformanceActiveMock,
  triggerChange,
} = vi.hoisted(() => {
  const subscribers = new Set<() => void>();
  return {
    acquireMock: vi.fn(async () => {}),
    releaseMock: vi.fn(),
    isHeldMock: vi.fn(() => false),
    onChangeMock: vi.fn((cb: () => void) => {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    }),
    setPerformanceActiveMock: vi.fn(),
    triggerChange: () => {
      for (const cb of subscribers) cb();
    },
  };
});

vi.mock('./wake-lock.js', () => ({
  acquire: acquireMock,
  release: releaseMock,
  isHeld: isHeldMock,
  onChange: onChangeMock,
  setPerformanceActiveForWakeLock: setPerformanceActiveMock,
}));

import { useWakeLockIndicator } from './use-wake-lock-indicator.js';

beforeEach(() => {
  acquireMock.mockReset().mockImplementation(async () => {});
  releaseMock.mockReset();
  isHeldMock.mockReset().mockReturnValue(false);
  onChangeMock.mockClear();
  setPerformanceActiveMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useWakeLockIndicator', () => {
  it('subscribes to wakeLock.onChange on mount', () => {
    renderHook(() => useWakeLockIndicator());
    expect(onChangeMock).toHaveBeenCalledTimes(1);
  });

  it('returns the unsubscribe function on unmount', () => {
    const unsubscribe = vi.fn();
    onChangeMock.mockReturnValueOnce(unsubscribe);
    const { unmount } = renderHook(() => useWakeLockIndicator());
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('calls wakeLock.acquire() on mount', () => {
    renderHook(() => useWakeLockIndicator());
    expect(acquireMock).toHaveBeenCalledTimes(1);
  });

  it('marks the singleton performance-active on mount', () => {
    renderHook(() => useWakeLockIndicator());
    expect(setPerformanceActiveMock).toHaveBeenCalledWith(true);
  });

  it('returns wakeLockHeld=false when the singleton reports not-held', () => {
    isHeldMock.mockReturnValue(false);
    const { result } = renderHook(() => useWakeLockIndicator());
    expect(result.current.wakeLockHeld).toBe(false);
  });

  it('returns wakeLockHeld=true when the singleton reports held', () => {
    isHeldMock.mockReturnValue(true);
    const { result } = renderHook(() => useWakeLockIndicator());
    expect(result.current.wakeLockHeld).toBe(true);
  });

  it('updates wakeLockHeld when onChange fires with a new state', () => {
    isHeldMock.mockReturnValue(false);
    const { result } = renderHook(() => useWakeLockIndicator());
    expect(result.current.wakeLockHeld).toBe(false);
    isHeldMock.mockReturnValue(true);
    act(() => {
      triggerChange();
    });
    expect(result.current.wakeLockHeld).toBe(true);
  });

  it('does NOT call wakeLock.release() on unmount', () => {
    const { unmount } = renderHook(() => useWakeLockIndicator());
    unmount();
    expect(releaseMock).not.toHaveBeenCalled();
  });

  it('does NOT call setPerformanceActiveForWakeLock(false) on unmount', () => {
    const { unmount } = renderHook(() => useWakeLockIndicator());
    unmount();
    // mounted-with-true is the only call expected
    expect(setPerformanceActiveMock).toHaveBeenCalledTimes(1);
    expect(setPerformanceActiveMock).toHaveBeenCalledWith(true);
  });
});
