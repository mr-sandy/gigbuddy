import { ACTIVE_BAND_ID, type Setlist } from '@gigbuddy/shared';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Tests for the navigate-away end-state detector (Story 4.4, FR-21).
 *
 * Hooks are mocked at the module level so we can drive `performanceActive`,
 * `activeSetlistId`, and the cached setlist independently. The router is a
 * `MemoryRouter` with explicit initialEntries — each test mounts a tree
 * pinned to a specific pathname and asserts on whether `endPerformance`
 * was called.
 */

const { performanceActiveMock, activeSetlistIdMock, endPerformanceMock, setlistDataMock } =
  vi.hoisted(() => ({
    performanceActiveMock: vi.fn(() => false),
    activeSetlistIdMock: vi.fn(() => null as string | null),
    endPerformanceMock: vi.fn(),
    setlistDataMock: vi.fn(() => ({ data: null as Setlist | null | undefined })),
  }));

vi.mock('../performance/performance-context.js', () => ({
  usePerformanceActive: () => performanceActiveMock(),
  useActivePerformanceSession: () => ({
    activeSetlistId: activeSetlistIdMock(),
    activeSongIndex: 0,
  }),
}));

vi.mock('./use-performance-end.js', () => ({
  usePerformanceEnd: () => endPerformanceMock,
}));

vi.mock('./use-setlist.js', () => ({
  useSetlist: () => setlistDataMock(),
}));

// Import the hook AFTER all vi.mock calls.
const { useNavigateAwayGuard } = await import('./use-navigate-away-guard.js');

function Probe(): ReactNode {
  useNavigateAwayGuard();
  return null;
}

function makeSetlist(setlistId: string, songIds: string[]): Setlist {
  return {
    bandId: ACTIVE_BAND_ID,
    setlistId,
    gigMeta: { venue: 'V', date: '2026-06-21', time: '20:00' },
    sections: [
      {
        name: 'Set 1',
        songs: songIds.map((id) => ({ songId: id, titleSnapshot: `Snap ${id}` })),
      },
    ],
    clientWrittenAt: '2026-06-19T10:00:00.000Z',
    serverReceivedAt: '2026-06-19T10:00:01.000Z',
    version: 1 as const,
  };
}

function renderAtPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  performanceActiveMock.mockReset().mockReturnValue(false);
  activeSetlistIdMock.mockReset().mockReturnValue(null);
  endPerformanceMock.mockReset();
  setlistDataMock.mockReset().mockReturnValue({ data: null });
});

describe('useNavigateAwayGuard — inactive Performance Mode', () => {
  it('does NOTHING when performanceActive is false (initial mount)', () => {
    performanceActiveMock.mockReturnValue(false);
    activeSetlistIdMock.mockReturnValue('setlistA00000001');
    renderAtPath('/library');
    expect(endPerformanceMock).not.toHaveBeenCalled();
  });

  it('does NOT call endPerformance when performanceActive is true but activeSetlistId is null', () => {
    performanceActiveMock.mockReturnValue(true);
    activeSetlistIdMock.mockReturnValue(null);
    renderAtPath('/library');
    expect(endPerformanceMock).not.toHaveBeenCalled();
  });
});

describe('useNavigateAwayGuard — in-chain routes (state preserved)', () => {
  beforeEach(() => {
    performanceActiveMock.mockReturnValue(true);
    activeSetlistIdMock.mockReturnValue('setlistA00000001');
    setlistDataMock.mockReturnValue({
      data: makeSetlist('setlistA00000001', ['songA0000000001a', 'songA0000000002b']),
    });
  });

  it('preserves state on /performance/<activeSetlistId>/0 (Performance Card)', () => {
    renderAtPath('/performance/setlistA00000001/0');
    expect(endPerformanceMock).not.toHaveBeenCalled();
  });

  it('preserves state on /performance/<activeSetlistId>/1 (any index in the chain)', () => {
    renderAtPath('/performance/setlistA00000001/1');
    expect(endPerformanceMock).not.toHaveBeenCalled();
  });

  it('preserves state on /setlists/<activeSetlistId> (active overview after × exit, FR-19)', () => {
    renderAtPath('/setlists/setlistA00000001');
    expect(endPerformanceMock).not.toHaveBeenCalled();
  });

  it('preserves state on /songs/:songId when the songId is referenced by the active Setlist (AC-2)', () => {
    renderAtPath('/songs/songA0000000001a');
    expect(endPerformanceMock).not.toHaveBeenCalled();
  });
});

describe('useNavigateAwayGuard — out-of-chain routes (state ends)', () => {
  beforeEach(() => {
    performanceActiveMock.mockReturnValue(true);
    activeSetlistIdMock.mockReturnValue('setlistA00000001');
    setlistDataMock.mockReturnValue({
      data: makeSetlist('setlistA00000001', ['songA0000000001a', 'songA0000000002b']),
    });
  });

  it('ends state on / (home)', () => {
    renderAtPath('/');
    expect(endPerformanceMock).toHaveBeenCalledTimes(1);
  });

  it('ends state on /library', () => {
    renderAtPath('/library');
    expect(endPerformanceMock).toHaveBeenCalledTimes(1);
  });

  it('ends state on /setlists/<other-setlistId>', () => {
    renderAtPath('/setlists/setlistB00000001');
    expect(endPerformanceMock).toHaveBeenCalledTimes(1);
  });

  it('ends state on /songs/:songId when the songId is NOT in the active Setlist (AC-3)', () => {
    renderAtPath('/songs/songZ0000000099z');
    expect(endPerformanceMock).toHaveBeenCalledTimes(1);
  });

  it('ends state on /songs/:songId when the active Setlist data is unavailable (defensive — out of cache)', () => {
    setlistDataMock.mockReturnValue({ data: undefined });
    renderAtPath('/songs/songA0000000001a');
    expect(endPerformanceMock).toHaveBeenCalledTimes(1);
  });
});
