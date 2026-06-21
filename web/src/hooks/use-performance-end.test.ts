import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  setActiveMock,
  setPerformanceViewMock,
  resetSessionMock,
  setPerformanceActiveForWakeLockMock,
  releaseMock,
} = vi.hoisted(() => ({
  setActiveMock: vi.fn(),
  setPerformanceViewMock: vi.fn(),
  resetSessionMock: vi.fn(),
  setPerformanceActiveForWakeLockMock: vi.fn(),
  releaseMock: vi.fn(),
}));

vi.mock('../performance/performance-context.js', () => ({
  useSetPerformanceActive: () => setActiveMock,
  useSetPerformanceView: () => setPerformanceViewMock,
  useResetPerformanceSession: () => resetSessionMock,
}));

vi.mock('../performance/wake-lock.js', () => ({
  setPerformanceActiveForWakeLock: setPerformanceActiveForWakeLockMock,
  release: releaseMock,
}));

// Import AFTER vi.mock so the mocked dependencies are in place.
const { usePerformanceEnd } = await import('./use-performance-end.js');

beforeEach(() => {
  setActiveMock.mockReset();
  setPerformanceViewMock.mockReset();
  resetSessionMock.mockReset();
  setPerformanceActiveForWakeLockMock.mockReset();
  releaseMock.mockReset();
});

describe('usePerformanceEnd', () => {
  it('returns a function', () => {
    const { result } = renderHook(() => usePerformanceEnd());
    expect(typeof result.current).toBe('function');
  });

  it('returns a stable reference across re-renders (useCallback)', () => {
    const { result, rerender } = renderHook(() => usePerformanceEnd());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('invokes wakeLock.setPerformanceActiveForWakeLock(false) before wakeLock.release()', () => {
    const order: string[] = [];
    setPerformanceActiveForWakeLockMock.mockImplementation(() => order.push('setFlag'));
    releaseMock.mockImplementation(() => order.push('release'));

    const { result } = renderHook(() => usePerformanceEnd());
    result.current();

    expect(setPerformanceActiveForWakeLockMock).toHaveBeenCalledWith(false);
    expect(releaseMock).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['setFlag', 'release']);
  });

  it('calls setActive(false) LAST so AR-28 suppressions lift after cleanup completes', () => {
    const order: string[] = [];
    setPerformanceActiveForWakeLockMock.mockImplementation(() => order.push('setFlag'));
    releaseMock.mockImplementation(() => order.push('release'));
    setPerformanceViewMock.mockImplementation(() => order.push('view'));
    resetSessionMock.mockImplementation(() => order.push('reset'));
    setActiveMock.mockImplementation(() => order.push('setActive'));

    const { result } = renderHook(() => usePerformanceEnd());
    result.current();

    expect(setActiveMock).toHaveBeenCalledWith(false);
    expect(order[order.length - 1]).toBe('setActive');
  });

  it('clears the performance view marker', () => {
    const { result } = renderHook(() => usePerformanceEnd());
    result.current();
    expect(setPerformanceViewMock).toHaveBeenCalledWith(null);
  });

  it('resets the session pointer (activeSetlistId → null, activeSongIndex → 0)', () => {
    const { result } = renderHook(() => usePerformanceEnd());
    result.current();
    expect(resetSessionMock).toHaveBeenCalledTimes(1);
  });
});
