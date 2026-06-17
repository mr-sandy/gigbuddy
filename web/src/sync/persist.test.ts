import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from './persist.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('requestPersistentStorage', () => {
  it('returns true when navigator.storage.persist() resolves true', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.stubGlobal('navigator', {
      storage: { persist: () => Promise.resolve(true) },
    });
    await expect(requestPersistentStorage()).resolves.toBe(true);
  });

  it('returns false when navigator.storage.persist() rejects', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.stubGlobal('navigator', {
      storage: { persist: () => Promise.reject(new Error('safari private window')) },
    });
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('returns false when navigator.storage is missing (older browsers)', async () => {
    vi.stubGlobal('navigator', {});
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('logs a structured info line with the granted flag', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.stubGlobal('navigator', {
      storage: { persist: () => Promise.resolve(false) },
    });
    await requestPersistentStorage();
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify({ level: 'info', msg: 'storage-persist', granted: false }),
    );
  });
});
