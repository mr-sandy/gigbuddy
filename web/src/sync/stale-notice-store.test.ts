import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetStaleNoticeForTests,
  clearStaleNotice,
  getStaleNotice,
  setStaleNotice,
  subscribeStaleNotice,
} from './stale-notice-store.js';

beforeEach(() => {
  __resetStaleNoticeForTests();
});

describe('stale-notice-store', () => {
  it('starts with a null notice', () => {
    expect(getStaleNotice()).toBeNull();
  });

  it('setStaleNotice updates the snapshot and notifies subscribers', () => {
    const cb = vi.fn();
    subscribeStaleNotice(cb);
    setStaleNotice({ recordKey: 'song:b:1', at: '2026-06-17T12:00:00.000Z' });
    expect(getStaleNotice()).toEqual({ recordKey: 'song:b:1', at: '2026-06-17T12:00:00.000Z' });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('clearStaleNotice resets to null and notifies (when there was a notice)', () => {
    const cb = vi.fn();
    setStaleNotice({ recordKey: 'song:b:1', at: '2026-06-17T12:00:00.000Z' });
    subscribeStaleNotice(cb);
    clearStaleNotice();
    expect(getStaleNotice()).toBeNull();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('clearStaleNotice is a no-op when there is no notice (no notifications)', () => {
    const cb = vi.fn();
    subscribeStaleNotice(cb);
    clearStaleNotice();
    expect(cb).not.toHaveBeenCalled();
  });

  it('supports multiple subscribers and individual unsubscribes', () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = subscribeStaleNotice(a);
    subscribeStaleNotice(b);
    setStaleNotice({ recordKey: 'song:b:1', at: '2026-06-17T12:00:00.000Z' });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    unsubA();
    setStaleNotice({ recordKey: 'song:b:2', at: '2026-06-17T12:00:01.000Z' });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('replaces an existing notice with a new one (V1: at most one notice at a time)', () => {
    setStaleNotice({ recordKey: 'song:b:1', at: '2026-06-17T12:00:00.000Z' });
    setStaleNotice({ recordKey: 'song:b:2', at: '2026-06-17T12:00:01.000Z' });
    expect(getStaleNotice()?.recordKey).toBe('song:b:2');
  });
});
