import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readSessionMarker, STORAGE_KEY, syncSessionMarker } from './session-resume.js';

/*
 * `session-resume.ts` unit tests — Story 4.5 (AC-8, AC-13).
 *
 * jsdom provides a usable `localStorage` so the happy paths can exercise
 * real storage. The Safari-private-mode case is simulated by stubbing
 * `localStorage.setItem` (and `getItem`) to throw — the module must
 * swallow those exceptions silently.
 */

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('syncSessionMarker — writer (AC-13)', () => {
  it('writes {setlistId, songIndex} as JSON on a /performance/:setlistId/:songIndex pathname', () => {
    syncSessionMarker('/performance/sl1/3');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify({ setlistId: 'sl1', songIndex: 3 }),
    );
  });

  it('removes the key when the pathname leaves /performance/ (e.g. /setlists/:id)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ setlistId: 'sl1', songIndex: 3 }));
    syncSessionMarker('/setlists/sl1');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('removes the key on the home pathname', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ setlistId: 'sl1', songIndex: 0 }));
    syncSessionMarker('/');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('removes the key when the path is /performance with no indices (defensive)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ setlistId: 'sl1', songIndex: 0 }));
    syncSessionMarker('/performance');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('removes the key when the songIndex segment is not a finite non-negative integer', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ setlistId: 'sl1', songIndex: 0 }));
    // The regex requires \d+ so non-numeric never matches and we go through
    // the "no match → remove" branch.
    syncSessionMarker('/performance/sl1/abc');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('swallows localStorage exceptions silently (Safari private mode quota=0)', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => syncSessionMarker('/performance/sl1/3')).not.toThrow();
    expect(setItemSpy).toHaveBeenCalled();
  });
});

describe('readSessionMarker — reader (AC-8, AC-13)', () => {
  it('returns the parsed marker after a valid write', () => {
    syncSessionMarker('/performance/setlistABC/5');
    expect(readSessionMarker()).toEqual({ setlistId: 'setlistABC', songIndex: 5 });
  });

  it('returns null when the key is missing', () => {
    expect(readSessionMarker()).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(readSessionMarker()).toBeNull();
  });

  it('returns null when JSON parses but the shape is wrong (no songIndex)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ setlistId: 'sl1' }));
    expect(readSessionMarker()).toBeNull();
  });

  it('returns null when songIndex is negative', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ setlistId: 'sl1', songIndex: -1 }));
    expect(readSessionMarker()).toBeNull();
  });

  it('returns null when songIndex is NaN', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ setlistId: 'sl1', songIndex: Number.NaN }));
    expect(readSessionMarker()).toBeNull();
  });

  it('returns null when setlistId is empty', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ setlistId: '', songIndex: 0 }));
    expect(readSessionMarker()).toBeNull();
  });

  it('swallows localStorage exceptions silently and returns null', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('access denied');
    });
    expect(readSessionMarker()).toBeNull();
  });
});
