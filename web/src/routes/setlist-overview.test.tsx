import { ACTIVE_BAND_ID, type Setlist } from '@gigbuddy/shared';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIONS, EMPTY_STATES } from '../lib/microcopy.js';
import { SetlistOverview } from './setlist-overview.js';

/*
 * SetlistOverview tests. Hooks are mocked at the module level so the route
 * is exercised in isolation without TanStack Query / outbox setup. Platform
 * is mocked per-suite to drive the iPhone-only CTA branch.
 */

const {
  useSetlistMock,
  saveSetlistMock,
  navigateMock,
  isIPhoneMock,
  startPerformanceMock,
  performanceActiveMock,
  activePerformanceSessionMock,
  setPerformanceViewMock,
} = vi.hoisted(() => ({
  useSetlistMock: vi.fn(),
  saveSetlistMock: vi.fn().mockResolvedValue(undefined),
  navigateMock: vi.fn(),
  isIPhoneMock: vi.fn().mockReturnValue(false),
  startPerformanceMock: vi.fn().mockResolvedValue(undefined),
  // Story 4.3 — Performance Mode context defaults. The pre-existing tests
  // run with `performanceActive=false`; the new strip cases override.
  performanceActiveMock: vi.fn<() => boolean>(() => false),
  activePerformanceSessionMock: vi.fn<
    () => { activeSetlistId: string | null; activeSongIndex: number }
  >(() => ({ activeSetlistId: null, activeSongIndex: 0 })),
  setPerformanceViewMock: vi.fn(),
}));

vi.mock('../hooks/use-setlist.js', () => ({ useSetlist: useSetlistMock }));
vi.mock('../hooks/use-setlist-mutation.js', () => ({
  useSetlistMutation: () => ({ saveSetlist: saveSetlistMock }),
}));
vi.mock('../lib/platform.js', () => ({
  isIPhone: () => isIPhoneMock(),
  isStandalone: () => false,
}));
vi.mock('../performance/use-start-performance.js', () => ({
  useStartPerformance: () => startPerformanceMock,
}));
vi.mock('../performance/performance-context.js', () => ({
  usePerformanceActive: () => performanceActiveMock(),
  useActivePerformanceSession: () => activePerformanceSessionMock(),
  useSetPerformanceView: () => setPerformanceViewMock,
}));
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigateMock };
});

function makeSetlist(overrides: Partial<Setlist> = {}): Setlist {
  return {
    bandId: ACTIVE_BAND_ID,
    setlistId: 'setlistid0000001',
    gigMeta: { venue: 'The Jazz Cafe', date: '2026-06-21', time: '20:00' },
    sections: [
      {
        name: 'Set 1',
        songs: [
          { songId: 'song0000000001aa', titleSnapshot: 'Autumn Leaves' },
          {
            songId: 'song0000000002bb',
            titleSnapshot: 'Black Orpheus',
            perGigAnnotation: 'half-time feel',
          },
        ],
      },
      {
        name: 'Set 2',
        songs: [{ songId: 'song0000000003cc', titleSnapshot: 'Take Five' }],
      },
    ],
    clientWrittenAt: '2026-06-19T10:00:00.000Z',
    serverReceivedAt: '2026-06-19T10:00:01.000Z',
    version: 1 as const,
    ...overrides,
  };
}

function renderRoute(setlistId = 'setlistid0000001') {
  return render(
    <MemoryRouter initialEntries={[`/setlists/${setlistId}`]}>
      <Routes>
        <Route path="/setlists/:setlistId" element={<SetlistOverview />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useSetlistMock.mockReset();
  saveSetlistMock.mockReset().mockResolvedValue(undefined);
  navigateMock.mockReset();
  isIPhoneMock.mockReset().mockReturnValue(false);
  startPerformanceMock.mockReset().mockResolvedValue(undefined);
  // Story 4.3 — default to Performance Mode inactive so the pre-existing
  // tests continue to assert against the pre-strip DOM. Targeted cases
  // below override.
  performanceActiveMock.mockReset().mockReturnValue(false);
  activePerformanceSessionMock
    .mockReset()
    .mockReturnValue({ activeSetlistId: null, activeSongIndex: 0 });
  setPerformanceViewMock.mockReset();
  document.documentElement.dataset.atmosphere = 'practice';
});

afterEach(() => {
  document.documentElement.dataset.atmosphere = 'practice';
});

describe('SetlistOverview — loading and not-found', () => {
  it('renders nothing in the body while the query is loading', () => {
    useSetlistMock.mockReturnValue({ data: undefined, isLoading: true });
    renderRoute();
    expect(screen.queryByText(EMPTY_STATES.setlistNotFound)).toBeNull();
    // No spinner, no copy — just the empty section shell.
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('renders the locked not-found copy when useSetlist resolves to null', () => {
    useSetlistMock.mockReturnValue({ data: null, isLoading: false });
    renderRoute('missingsetlistid');
    expect(screen.getByText(EMPTY_STATES.setlistNotFound)).toBeInTheDocument();
  });
});

describe('SetlistOverview — loaded state', () => {
  it('renders the venue and the formatted date+time in the header', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute();
    expect(screen.getByRole('heading', { level: 1, name: 'The Jazz Cafe' })).toBeInTheDocument();
    expect(screen.getByText('21 Jun 2026 · 20:00')).toBeInTheDocument();
  });

  it('omits the time from the date display when gigMeta.time is absent', () => {
    useSetlistMock.mockReturnValue({
      data: makeSetlist({
        gigMeta: { venue: 'Foo Bar', date: '2026-06-21' },
      }),
      isLoading: false,
    });
    renderRoute();
    // Scope the assertion to the gig metadata paragraph — section headings
    // also include `·` in their count badge (`Set 1 · 4 songs`).
    const dateNode = screen.getByText('21 Jun 2026');
    expect(dateNode.textContent).toBe('21 Jun 2026');
    expect(dateNode.textContent).not.toContain('·');
  });

  it('renders sections in stored order with their headings', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute();
    // Both sections render their name as an editable field (MacBook).
    expect(screen.getByLabelText('Rename section: Set 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Rename section: Set 2')).toBeInTheDocument();
  });

  it('renders song titles from titleSnapshot in stored order', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute();
    const titles = ['Autumn Leaves', 'Black Orpheus', 'Take Five'];
    for (const title of titles) {
      expect(screen.getByRole('button', { name: title })).toBeInTheDocument();
    }
  });

  it('renders the per-gig annotation where present', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute();
    expect(screen.getByText('half-time feel')).toBeInTheDocument();
  });
});

describe('SetlistOverview — section rename flow', () => {
  it('flows onRename through to saveSetlist with the updated section name', async () => {
    const user = userEvent.setup();
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute();

    const field = screen.getByLabelText('Rename section: Set 1');
    await user.click(field);
    await user.clear(field);
    await user.type(field, 'Opener');
    await user.tab();

    expect(saveSetlistMock).toHaveBeenCalledTimes(1);
    const payload = saveSetlistMock.mock.calls[0]?.[0];
    expect(payload.sections[0].name).toBe('Opener');
    expect(payload.sections[1].name).toBe('Set 2');
    // Songs in the renamed section are preserved unchanged.
    expect(payload.sections[0].songs).toHaveLength(2);
    expect(payload.sections[0].songs[0].titleSnapshot).toBe('Autumn Leaves');
    // serverReceivedAt is omitted by SetlistPutInputSchema.strict().
    expect(payload).not.toHaveProperty('serverReceivedAt');
    // clientWrittenAt is fresh (LWW stamp on every write).
    expect(typeof payload.clientWrittenAt).toBe('string');
  });
});

describe('SetlistOverview — annotation change flow', () => {
  it('flows onAnnotationChange through to saveSetlist with the updated annotation', async () => {
    const user = userEvent.setup();
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute();

    // Tap the annotation button on Black Orpheus to enter edit.
    await user.click(screen.getByRole('button', { name: 'Edit per-gig note for Black Orpheus' }));
    const field = screen.getByLabelText('Per-gig note for Black Orpheus');
    await user.clear(field);
    await user.type(field, 'double-time feel');
    await user.tab();

    expect(saveSetlistMock).toHaveBeenCalledTimes(1);
    const payload = saveSetlistMock.mock.calls[0]?.[0];
    expect(payload.sections[0].songs[1].perGigAnnotation).toBe('double-time feel');
  });

  it('clears the annotation (omits perGigAnnotation) when the new value is empty', async () => {
    const user = userEvent.setup();
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute();

    await user.click(screen.getByRole('button', { name: 'Edit per-gig note for Black Orpheus' }));
    const field = screen.getByLabelText('Per-gig note for Black Orpheus');
    await user.clear(field);
    await user.tab();

    expect(saveSetlistMock).toHaveBeenCalledTimes(1);
    const payload = saveSetlistMock.mock.calls[0]?.[0];
    expect(payload.sections[0].songs[1]).not.toHaveProperty('perGigAnnotation');
  });
});

/*
 * Story 3.6 — drag-reorder flow tests.
 *
 * Drag state lives in setlist-overview.tsx; firing native HTML5 DnD
 * events end-to-end through jsdom is brittle, so these tests drive the
 * reorder via the keyboard parity path (Move up / Move down buttons),
 * which invokes the SAME handleReorder code path as a drop event.
 * Cross-section and invalid-target cases are exercised by direct
 * dispatch of synthesised drag events.
 */
describe('SetlistOverview — reorder flow (keyboard path)', () => {
  it('Move down on the first song in a section calls saveSetlist with a swapped order', async () => {
    const user = userEvent.setup();
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute();

    // Two Move down buttons in Set 1 (only the first is enabled — the
    // second song is last in section). Click the FIRST one.
    const moveDownButtons = screen.getAllByRole('button', { name: 'Move down' });
    // Set 1 has 2 songs → 2 buttons (Autumn Leaves: enabled, Black Orpheus: disabled).
    // Set 2 has 1 song → 1 button (Take Five: disabled).
    expect(moveDownButtons).toHaveLength(3);
    const firstMoveDown = moveDownButtons[0];
    if (!firstMoveDown) throw new Error('expected at least one Move down button');
    await user.click(firstMoveDown);

    expect(saveSetlistMock).toHaveBeenCalledTimes(1);
    const payload = saveSetlistMock.mock.calls[0]?.[0];
    expect(
      payload.sections[0].songs.map((s: { titleSnapshot: string }) => s.titleSnapshot),
    ).toEqual(['Black Orpheus', 'Autumn Leaves']);
    // Other section is untouched.
    expect(
      payload.sections[1].songs.map((s: { titleSnapshot: string }) => s.titleSnapshot),
    ).toEqual(['Take Five']);
    // serverReceivedAt is omitted by SetlistPutInputSchema.strict().
    expect(payload).not.toHaveProperty('serverReceivedAt');
    expect(typeof payload.clientWrittenAt).toBe('string');
  });

  it('Move up on the second song in a section restores the original order', async () => {
    const user = userEvent.setup();
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute();

    const moveUpButtons = screen.getAllByRole('button', { name: 'Move up' });
    // The first Move up in Set 1 (on Autumn Leaves) is disabled; the
    // second (on Black Orpheus) is enabled.
    const enabledMoveUp = moveUpButtons.find((b) => !(b as HTMLButtonElement).disabled);
    expect(enabledMoveUp).toBeDefined();
    if (!enabledMoveUp) throw new Error('expected an enabled Move up button');
    await user.click(enabledMoveUp);

    expect(saveSetlistMock).toHaveBeenCalledTimes(1);
    const payload = saveSetlistMock.mock.calls[0]?.[0];
    expect(
      payload.sections[0].songs.map((s: { titleSnapshot: string }) => s.titleSnapshot),
    ).toEqual(['Black Orpheus', 'Autumn Leaves']);
  });

  it('Move up is aria-disabled on the first song in a section', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute();
    // The first Move up (Autumn Leaves, songIndex 0) must be disabled.
    const moveUpButtons = screen.getAllByRole('button', { name: 'Move up' });
    expect((moveUpButtons[0] as HTMLButtonElement).disabled).toBe(true);
    expect(moveUpButtons[0]?.getAttribute('aria-disabled')).toBe('true');
  });

  it('Move down is aria-disabled on the last song in a section', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute();
    const moveDownButtons = screen.getAllByRole('button', { name: 'Move down' });
    // Set 1 last song (Black Orpheus, index 1) and Set 2 last song
    // (Take Five, index 0) must both be disabled.
    const disabled = moveDownButtons.filter((b) => (b as HTMLButtonElement).disabled);
    expect(disabled).toHaveLength(2);
  });

  it('rapid successive reorders fire multiple saveSetlist calls (outbox coalesces them)', async () => {
    const user = userEvent.setup();
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute();

    const moveDownButtons = screen.getAllByRole('button', { name: 'Move down' });
    const firstMoveDown = moveDownButtons[0];
    if (!firstMoveDown) throw new Error('expected at least one Move down button');
    // Two clicks on the same enabled button → two saveSetlist calls
    // queued. The outbox (mocked at the hook layer) is responsible for
    // coalescing — the route's job is just to fire each PUT.
    await user.click(firstMoveDown);
    await user.click(firstMoveDown);

    expect(saveSetlistMock).toHaveBeenCalledTimes(2);
  });

  it('does NOT render drag handles or Move up/down buttons on iPhone', () => {
    isIPhoneMock.mockReturnValue(true);
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute();
    expect(screen.queryByRole('button', { name: 'Move up' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move down' })).toBeNull();
    expect(screen.queryByRole('img', { name: 'Drag to reorder Autumn Leaves' })).toBeNull();
  });
});

/*
 * jsdom's DragEvent does not honor `clientX`/`clientY` from event-init
 * (DragEvent inherits MouseEvent in the spec, but jsdom drops the
 * coordinate fields). To exercise the midpoint heuristic in the row,
 * we build the DragEvent via createEvent then patch the coordinate
 * fields as own-properties — React's synthetic event reads them as-is
 * from the underlying native event.
 */
function makeDataTransfer(): DataTransfer {
  const store = new Map<string, string>();
  return {
    setData(format: string, value: string) {
      store.set(format, value);
    },
    getData(format: string) {
      return store.get(format) ?? '';
    },
    clearData() {
      store.clear();
    },
    effectAllowed: 'none',
    dropEffect: 'none',
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: [],
    dropEffectAllowed: 'none',
    setDragImage: () => {},
  } as unknown as DataTransfer;
}

function fireDragEventAt(
  node: HTMLElement,
  type: 'dragStart' | 'dragOver' | 'drop' | 'dragEnd',
  init: { dataTransfer: DataTransfer; clientY?: number },
): void {
  const event = createEvent[type](node, { dataTransfer: init.dataTransfer });
  if (init.clientY !== undefined) {
    Object.defineProperty(event, 'clientY', { value: init.clientY, configurable: true });
  }
  fireEvent(node, event);
}

describe('SetlistOverview — reorder flow (drag-and-drop path)', () => {
  it('fires a full SetlistPutInput with reordered sections on a same-section drop', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute();

    const rows = screen
      .getAllByRole('button', { name: /^(Autumn Leaves|Black Orpheus|Take Five)$/ })
      .map((b) => b.closest('li'))
      .filter((el): el is HTMLLIElement => el !== null);
    const source = rows[0];
    const target = rows[1];
    if (!source || !target) throw new Error('expected at least two song rows');

    const dataTransfer = makeDataTransfer();
    // Set the target row's bounding box so the midpoint check resolves
    // to "below" — clientY past the midpoint of a 100px-tall row.
    target.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 100,
        left: 0,
        right: 100,
        height: 100,
        width: 100,
        x: 0,
        y: 0,
      }) as DOMRect;

    fireDragEventAt(source, 'dragStart', { dataTransfer });
    fireDragEventAt(target, 'dragOver', { dataTransfer, clientY: 90 });
    fireDragEventAt(target, 'drop', { dataTransfer, clientY: 90 });
    fireDragEventAt(source, 'dragEnd', { dataTransfer });

    expect(saveSetlistMock).toHaveBeenCalledTimes(1);
    const payload = saveSetlistMock.mock.calls[0]?.[0];
    expect(
      payload.sections[0].songs.map((s: { titleSnapshot: string }) => s.titleSnapshot),
    ).toEqual(['Black Orpheus', 'Autumn Leaves']);
    // Whole-record PUT: serverReceivedAt is stripped, clientWrittenAt fresh.
    expect(payload).not.toHaveProperty('serverReceivedAt');
    expect(typeof payload.clientWrittenAt).toBe('string');
    expect(
      payload.sections[1].songs.map((s: { titleSnapshot: string }) => s.titleSnapshot),
    ).toEqual(['Take Five']);
  });

  it('fires a full SetlistPutInput with cross-section reorder on drop', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute();

    // Drag Autumn Leaves (section 0, song 0) onto Take Five (section 1,
    // song 0), drop "above" → Autumn Leaves moves to section 1 ahead of
    // Take Five.
    const rows = screen
      .getAllByRole('button', { name: /^(Autumn Leaves|Black Orpheus|Take Five)$/ })
      .map((b) => b.closest('li'))
      .filter((el): el is HTMLLIElement => el !== null);
    const source = rows[0];
    const target = rows[2];
    if (!source || !target) throw new Error('expected at least three song rows');

    const dataTransfer = makeDataTransfer();
    target.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 100,
        left: 0,
        right: 100,
        height: 100,
        width: 100,
        x: 0,
        y: 0,
      }) as DOMRect;

    fireDragEventAt(source, 'dragStart', { dataTransfer });
    fireDragEventAt(target, 'dragOver', { dataTransfer, clientY: 10 });
    fireDragEventAt(target, 'drop', { dataTransfer, clientY: 10 });
    fireDragEventAt(source, 'dragEnd', { dataTransfer });

    expect(saveSetlistMock).toHaveBeenCalledTimes(1);
    const payload = saveSetlistMock.mock.calls[0]?.[0];
    expect(
      payload.sections[0].songs.map((s: { titleSnapshot: string }) => s.titleSnapshot),
    ).toEqual(['Black Orpheus']);
    expect(
      payload.sections[1].songs.map((s: { titleSnapshot: string }) => s.titleSnapshot),
    ).toEqual(['Autumn Leaves', 'Take Five']);
  });

  it('does NOT call saveSetlist when dragEnd fires without a preceding drop (invalid drop)', () => {
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute();

    const source = screen.getByRole('button', { name: 'Autumn Leaves' }).closest('li');
    if (!source) throw new Error('expected a source row');

    const dataTransfer = makeDataTransfer();
    fireDragEventAt(source as HTMLElement, 'dragStart', { dataTransfer });
    // No drop — drag ends in empty space.
    fireDragEventAt(source as HTMLElement, 'dragEnd', { dataTransfer });

    expect(saveSetlistMock).not.toHaveBeenCalled();
  });
});

describe('SetlistOverview — Start performance CTA (Story 4.1)', () => {
  it('renders the Start performance CTA on iPhone', () => {
    isIPhoneMock.mockReturnValue(true);
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute();
    expect(screen.getByRole('button', { name: ACTIONS.startPerformance })).toBeInTheDocument();
  });

  it('does NOT render the Start performance CTA on MacBook', () => {
    isIPhoneMock.mockReturnValue(false);
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute();
    expect(screen.queryByRole('button', { name: ACTIONS.startPerformance })).toBeNull();
  });

  it('tapping the CTA invokes useStartPerformance with the setlist id', async () => {
    const user = userEvent.setup();
    isIPhoneMock.mockReturnValue(true);
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute();
    await user.click(screen.getByRole('button', { name: ACTIONS.startPerformance }));
    expect(startPerformanceMock).toHaveBeenCalledTimes(1);
    expect(startPerformanceMock).toHaveBeenCalledWith('setlistid0000001');
  });

  it('disables the CTA when the Setlist has no Songs in any Section (AC-2)', async () => {
    const user = userEvent.setup();
    isIPhoneMock.mockReturnValue(true);
    useSetlistMock.mockReturnValue({
      data: makeSetlist({
        sections: [
          { name: 'Set 1', songs: [] },
          { name: 'Set 2', songs: [] },
        ],
      }),
      isLoading: false,
    });
    renderRoute();
    const cta = screen.getByRole('button', {
      name: ACTIONS.startPerformance,
    }) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    expect(cta.getAttribute('aria-disabled')).toBe('true');
    await user.click(cta);
    expect(startPerformanceMock).not.toHaveBeenCalled();
  });

  it('keeps the CTA enabled when at least one Section has at least one Song', () => {
    isIPhoneMock.mockReturnValue(true);
    useSetlistMock.mockReturnValue({
      data: makeSetlist({
        sections: [
          { name: 'Set 1', songs: [] },
          {
            name: 'Set 2',
            songs: [{ songId: 'song0000000003cc', titleSnapshot: 'Take Five' }],
          },
        ],
      }),
      isLoading: false,
    });
    renderRoute();
    const cta = screen.getByRole('button', {
      name: ACTIONS.startPerformance,
    }) as HTMLButtonElement;
    expect(cta.disabled).toBe(false);
  });

  it('does not render the CTA while the Setlist query is loading', () => {
    isIPhoneMock.mockReturnValue(true);
    useSetlistMock.mockReturnValue({ data: undefined, isLoading: true });
    renderRoute();
    expect(screen.queryByRole('button', { name: ACTIONS.startPerformance })).toBeNull();
  });
});

describe('SetlistOverview — CurrentlyPerformingStrip (Story 4.3)', () => {
  it('renders the strip when performanceActive is true and setlistId matches', () => {
    performanceActiveMock.mockReturnValue(true);
    activePerformanceSessionMock.mockReturnValue({
      activeSetlistId: 'setlistid0000001',
      activeSongIndex: 1,
    });
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute('setlistid0000001');
    expect(screen.getByRole('region', { name: 'Currently performing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume performance' })).toBeInTheDocument();
  });

  it('strip displays the title of the song at activeSongIndex (titleSnapshot)', () => {
    performanceActiveMock.mockReturnValue(true);
    activePerformanceSessionMock.mockReturnValue({
      activeSetlistId: 'setlistid0000001',
      // Index 1 → Black Orpheus (flat order over Set 1 / Set 2).
      activeSongIndex: 1,
    });
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute('setlistid0000001');
    const region = screen.getByRole('region', { name: 'Currently performing' });
    expect(region).toHaveTextContent('Black Orpheus');
  });

  it('does NOT render the strip when performanceActive is false', () => {
    performanceActiveMock.mockReturnValue(false);
    activePerformanceSessionMock.mockReturnValue({
      activeSetlistId: 'setlistid0000001',
      activeSongIndex: 0,
    });
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute('setlistid0000001');
    expect(screen.queryByRole('region', { name: 'Currently performing' })).toBeNull();
  });

  it('does NOT render the strip when setlistId does not match the active setlist', () => {
    performanceActiveMock.mockReturnValue(true);
    activePerformanceSessionMock.mockReturnValue({
      activeSetlistId: 'somethingelse00',
      activeSongIndex: 0,
    });
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute('setlistid0000001');
    expect(screen.queryByRole('region', { name: 'Currently performing' })).toBeNull();
  });

  it('Resume › navigates to /performance/<setlistId>/<activeSongIndex>', async () => {
    const user = userEvent.setup();
    performanceActiveMock.mockReturnValue(true);
    activePerformanceSessionMock.mockReturnValue({
      activeSetlistId: 'setlistid0000001',
      activeSongIndex: 2,
    });
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute('setlistid0000001');
    await user.click(screen.getByRole('button', { name: 'Resume performance' }));
    expect(navigateMock).toHaveBeenCalledWith('/performance/setlistid0000001/2');
  });

  it('marks performanceView as "overview" while the strip is active', () => {
    performanceActiveMock.mockReturnValue(true);
    activePerformanceSessionMock.mockReturnValue({
      activeSetlistId: 'setlistid0000001',
      activeSongIndex: 0,
    });
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute('setlistid0000001');
    expect(setPerformanceViewMock).toHaveBeenCalledWith('overview');
  });

  it('moves focus to the Resume › button after the strip mounts (AC-10)', () => {
    performanceActiveMock.mockReturnValue(true);
    activePerformanceSessionMock.mockReturnValue({
      activeSetlistId: 'setlistid0000001',
      activeSongIndex: 0,
    });
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute('setlistid0000001');
    const resume = screen.getByRole('button', { name: 'Resume performance' });
    expect(document.activeElement).toBe(resume);
  });
});
