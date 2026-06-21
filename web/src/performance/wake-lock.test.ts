import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as wakeLock from './wake-lock.js';

/*
 * `wake-lock.ts` unit tests — Story 4.2 (AC-12).
 *
 * The module under test holds singleton state at module scope. The
 * `_resetForTests` export wipes that state between tests so we can
 * exercise the API from a known starting point.
 *
 * `navigator.wakeLock` is mocked via `vi.stubGlobal` so we can drive both
 * the success path and the unsupported / denial paths.
 */

interface MockSentinel {
  released: boolean;
  release: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  // Test-only helper to fire the 'release' event handler the module
  // installed via addEventListener.
  __fireRelease: () => void;
}

function makeMockSentinel(): MockSentinel {
  // Track the release handler the module installs so the test can fire it.
  let releaseHandler: (() => void) | null = null;
  const sentinel: MockSentinel = {
    released: false,
    release: vi.fn(async () => {
      sentinel.released = true;
    }),
    addEventListener: vi.fn((event: string, handler: () => void) => {
      if (event === 'release') {
        releaseHandler = handler;
      }
    }),
    removeEventListener: vi.fn(),
    __fireRelease: () => {
      sentinel.released = true;
      releaseHandler?.();
    },
  };
  return sentinel;
}

function stubWakeLock(requestImpl?: (kind: string) => Promise<MockSentinel>) {
  const sentinel = makeMockSentinel();
  const request = vi.fn(requestImpl ?? (async () => sentinel));
  vi.stubGlobal('navigator', { ...navigator, wakeLock: { request } });
  return { sentinel, request };
}

beforeEach(() => {
  wakeLock._resetForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  wakeLock._resetForTests();
});

describe('wake-lock — acquire success path', () => {
  it('isHeld() is false before acquire and true after success', async () => {
    stubWakeLock();
    expect(wakeLock.isHeld()).toBe(false);
    await wakeLock.acquire();
    expect(wakeLock.isHeld()).toBe(true);
  });

  it('notifies subscribers on successful acquire', async () => {
    stubWakeLock();
    const cb = vi.fn();
    wakeLock.onChange(cb);
    await wakeLock.acquire();
    expect(cb).toHaveBeenCalled();
  });

  it('attaches a release listener to the sentinel', async () => {
    const { sentinel } = stubWakeLock();
    await wakeLock.acquire();
    expect(sentinel.addEventListener).toHaveBeenCalledWith('release', expect.any(Function));
  });
});

describe('wake-lock — acquire failure paths (silent per AR-28)', () => {
  it('does not throw when navigator.wakeLock is undefined', async () => {
    vi.stubGlobal('navigator', { ...navigator, wakeLock: undefined });
    await expect(wakeLock.acquire()).resolves.toBeUndefined();
    expect(wakeLock.isHeld()).toBe(false);
  });

  it('does not throw when navigator.wakeLock.request rejects', async () => {
    stubWakeLock(async () => {
      throw new Error('OS denied');
    });
    await expect(wakeLock.acquire()).resolves.toBeUndefined();
    expect(wakeLock.isHeld()).toBe(false);
  });

  it('notifies subscribers on failed acquire', async () => {
    stubWakeLock(async () => {
      throw new Error('OS denied');
    });
    const cb = vi.fn();
    wakeLock.onChange(cb);
    await wakeLock.acquire();
    expect(cb).toHaveBeenCalled();
  });
});

describe('wake-lock — OS-initiated release event', () => {
  it('updates isHeld() to false and notifies subscribers on sentinel release', async () => {
    const { sentinel } = stubWakeLock();
    await wakeLock.acquire();
    expect(wakeLock.isHeld()).toBe(true);

    const cb = vi.fn();
    wakeLock.onChange(cb);
    sentinel.__fireRelease();
    expect(wakeLock.isHeld()).toBe(false);
    expect(cb).toHaveBeenCalled();
  });

  it('triggers a reacquire via timer when performance is active', async () => {
    vi.useFakeTimers();
    const { sentinel, request } = stubWakeLock();
    await wakeLock.acquire();
    expect(request).toHaveBeenCalledTimes(1);

    sentinel.__fireRelease();
    // OS release resets attempts → next retry is immediate (0ms delay).
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledTimes(2);
  });
});

describe('wake-lock — explicit release()', () => {
  it('drops the sentinel and notifies subscribers', async () => {
    stubWakeLock();
    await wakeLock.acquire();
    const cb = vi.fn();
    wakeLock.onChange(cb);
    wakeLock.release();
    expect(wakeLock.isHeld()).toBe(false);
    expect(cb).toHaveBeenCalled();
  });

  it('calls sentinel.release() if a sentinel is held', async () => {
    const { sentinel } = stubWakeLock();
    await wakeLock.acquire();
    wakeLock.release();
    expect(sentinel.release).toHaveBeenCalled();
  });

  it('cancels any pending backoff retry timer', async () => {
    vi.useFakeTimers();
    const { request } = stubWakeLock(async () => {
      throw new Error('OS denied');
    });
    // First failure schedules a retry (delay 0).
    await wakeLock.acquire();
    // Second failure schedules another retry (delay 1000).
    await vi.advanceTimersByTimeAsync(0);
    // Now release — pending 1000ms timer must be cancelled and no further
    // request calls must fire.
    const callsBeforeRelease = request.mock.calls.length;
    wakeLock.release();
    await vi.advanceTimersByTimeAsync(5000);
    expect(request.mock.calls.length).toBe(callsBeforeRelease);
  });
});

describe('wake-lock — exponential backoff (NFR-28)', () => {
  it('schedules retries with 0ms → 1000ms → 5000ms → 30000ms → 60000ms cap delays', async () => {
    vi.useFakeTimers();
    const { request } = stubWakeLock(async () => {
      throw new Error('OS denied');
    });

    // First acquire — immediate, schedules retry #2 with 0ms delay.
    await wakeLock.acquire();
    expect(request).toHaveBeenCalledTimes(1);

    // Retry #2 — at 0ms. After it fails, retry #3 is scheduled at 1000ms.
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledTimes(2);

    // Retry #3 — at 1000ms. After it fails, retry #4 is scheduled at 5000ms.
    await vi.advanceTimersByTimeAsync(1000);
    expect(request).toHaveBeenCalledTimes(3);

    // Retry #4 — at 5000ms. After it fails, retry #5 is scheduled at 30000ms.
    await vi.advanceTimersByTimeAsync(5000);
    expect(request).toHaveBeenCalledTimes(4);

    // Retry #5 — at 30000ms. After it fails, retry #6 is scheduled at 60000ms.
    await vi.advanceTimersByTimeAsync(30000);
    expect(request).toHaveBeenCalledTimes(5);

    // Retry #6 — at 60000ms cap.
    await vi.advanceTimersByTimeAsync(60000);
    expect(request).toHaveBeenCalledTimes(6);

    // Retry #7 — also at 60000ms cap (not 120000).
    await vi.advanceTimersByTimeAsync(60000);
    expect(request).toHaveBeenCalledTimes(7);
  });

  it('resets backoff counter after a successful acquire', async () => {
    vi.useFakeTimers();
    let shouldFail = true;
    let lastReturnedSentinel: MockSentinel | null = null;
    const { request } = stubWakeLock(async () => {
      if (shouldFail) throw new Error('OS denied');
      const s = makeMockSentinel();
      lastReturnedSentinel = s;
      return s;
    });

    // First failure (immediate) → retry #2 scheduled at 0ms.
    await wakeLock.acquire();
    expect(request).toHaveBeenCalledTimes(1);
    // Retry #2 at 0ms — still failing → retry #3 at 1000ms.
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledTimes(2);
    // Now succeed on retry #3.
    shouldFail = false;
    await vi.advanceTimersByTimeAsync(1000);
    expect(request).toHaveBeenCalledTimes(3);
    expect(wakeLock.isHeld()).toBe(true);

    // Force the sentinel to release (OS) — that should reset attempts and
    // try again at delay 0, NOT continue from 5000ms.
    if (lastReturnedSentinel === null) throw new Error('sentinel not captured');
    shouldFail = true;
    (lastReturnedSentinel as MockSentinel).__fireRelease();
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledTimes(4);
  });
});

describe('wake-lock — onChange subscriber management', () => {
  it('returned unsubscribe removes the callback from the registry', async () => {
    stubWakeLock();
    const cb = vi.fn();
    const unsubscribe = wakeLock.onChange(cb);
    unsubscribe();
    await wakeLock.acquire();
    expect(cb).not.toHaveBeenCalled();
  });

  it('multiple subscribers all fire on state change', async () => {
    stubWakeLock();
    const a = vi.fn();
    const b = vi.fn();
    wakeLock.onChange(a);
    wakeLock.onChange(b);
    await wakeLock.acquire();
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });
});

describe('wake-lock — setPerformanceActiveForWakeLock', () => {
  it('cancels pending retries when set to false', async () => {
    vi.useFakeTimers();
    const { request } = stubWakeLock(async () => {
      throw new Error('OS denied');
    });
    await wakeLock.acquire(); // attempt 1, schedule retry at 0
    const calls = request.mock.calls.length;
    wakeLock.setPerformanceActiveForWakeLock(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(request).toHaveBeenCalledTimes(calls);
  });
});

describe('wake-lock — visibilitychange handler', () => {
  it('calls acquire() when document becomes visible and performance is active', async () => {
    const { request } = stubWakeLock();
    // Mark performance active without acquiring (so we can isolate the
    // visibilitychange path).
    wakeLock.setPerformanceActiveForWakeLock(true);
    expect(request).not.toHaveBeenCalled();

    // Force visibilityState to 'visible' and dispatch the event the
    // module's singleton listener is bound to.
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    // The handler kicks off acquire() asynchronously; flush microtasks.
    await Promise.resolve();
    expect(request).toHaveBeenCalled();
  });

  it('does NOT call acquire() when visibility changes while performance is inactive', async () => {
    const { request } = stubWakeLock();
    wakeLock.setPerformanceActiveForWakeLock(false);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(request).not.toHaveBeenCalled();
  });
});
