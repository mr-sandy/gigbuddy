import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SONGS } from '../lib/microcopy.js';
import { useSongOrCached } from './use-song-or-cached.js';

const { useSongMock, useSongsMock } = vi.hoisted(() => ({
  useSongMock: vi.fn(),
  useSongsMock: vi.fn(),
}));
vi.mock('./use-song.js', () => ({ useSong: useSongMock }));
vi.mock('./use-songs.js', () => ({ useSongs: useSongsMock }));

describe('useSongOrCached', () => {
  it('prefers the single-song query', () => {
    useSongMock.mockReturnValue({ data: { songId: 'abc', title: 'One' } });
    useSongsMock.mockReturnValue({ data: [{ songId: 'abc', title: 'Cached' }] });
    const { result } = renderHook(() => useSongOrCached('abc'));
    expect(result.current.song?.title).toBe('One');
    expect(result.current.statusLine).toBeNull();
  });

  it('falls back to the list cache while pending', () => {
    useSongMock.mockReturnValue({ data: undefined, isPending: true });
    useSongsMock.mockReturnValue({ data: [{ songId: 'abc', title: 'Cached' }] });
    const { result } = renderHook(() => useSongOrCached('abc'));
    expect(result.current.song?.title).toBe('Cached');
  });

  it('reports not found when the server returned null', () => {
    useSongMock.mockReturnValue({ data: null, isPending: false });
    useSongsMock.mockReturnValue({ data: [], isPending: false });
    const { result } = renderHook(() => useSongOrCached('abc'));
    expect(result.current.song).toBeUndefined();
    expect(result.current.statusLine).toBe(SONGS.notFound);
  });

  it('reports loading while nothing is available', () => {
    useSongMock.mockReturnValue({ data: undefined, isPending: true });
    useSongsMock.mockReturnValue({ data: undefined, isPending: true });
    const { result } = renderHook(() => useSongOrCached('abc'));
    expect(result.current.statusLine).toBe(SONGS.loading);
  });

  it('reports an error when both fail', () => {
    useSongMock.mockReturnValue({ data: undefined, isPending: false });
    useSongsMock.mockReturnValue({ data: undefined, isPending: false });
    const { result } = renderHook(() => useSongOrCached('abc'));
    expect(result.current.statusLine).toBe(SONGS.error);
  });
});
