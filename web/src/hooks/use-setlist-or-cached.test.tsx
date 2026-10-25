import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GIGS } from '../lib/microcopy.js';
import { useSetlistOrCached } from './use-setlist-or-cached.js';

const { useSetlistMock, useSetlistsMock } = vi.hoisted(() => ({
  useSetlistMock: vi.fn(),
  useSetlistsMock: vi.fn(),
}));
vi.mock('./use-setlist.js', () => ({ useSetlist: useSetlistMock }));
vi.mock('./use-setlists.js', () => ({ useSetlists: useSetlistsMock }));

const gig = (venue: string) => ({ setlistId: 'g1', gigMeta: { venue, date: '2026-11-07' } });

describe('useSetlistOrCached', () => {
  it('prefers the single-setlist query', () => {
    useSetlistMock.mockReturnValue({ data: gig('One') });
    useSetlistsMock.mockReturnValue({ data: [gig('Cached')] });
    const { result } = renderHook(() => useSetlistOrCached('g1'));
    expect(result.current.setlist?.gigMeta.venue).toBe('One');
    expect(result.current.statusLine).toBeNull();
  });

  it('falls back to the list cache while pending', () => {
    useSetlistMock.mockReturnValue({ data: undefined, isPending: true });
    useSetlistsMock.mockReturnValue({ data: [gig('Cached')] });
    const { result } = renderHook(() => useSetlistOrCached('g1'));
    expect(result.current.setlist?.gigMeta.venue).toBe('Cached');
  });

  it('reports not found when the server returned null', () => {
    useSetlistMock.mockReturnValue({ data: null, isPending: false });
    useSetlistsMock.mockReturnValue({ data: [], isPending: false });
    const { result } = renderHook(() => useSetlistOrCached('g1'));
    expect(result.current.setlist).toBeUndefined();
    expect(result.current.statusLine).toBe(GIGS.notFound);
  });

  it('reports loading, then error', () => {
    useSetlistMock.mockReturnValue({ data: undefined, isPending: true });
    useSetlistsMock.mockReturnValue({ data: undefined, isPending: true });
    expect(renderHook(() => useSetlistOrCached('g1')).result.current.statusLine).toBe(GIGS.loading);
    useSetlistMock.mockReturnValue({ data: undefined, isPending: false });
    useSetlistsMock.mockReturnValue({ data: undefined, isPending: false });
    expect(renderHook(() => useSetlistOrCached('g1')).result.current.statusLine).toBe(GIGS.error);
  });
});
