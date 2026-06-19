import { ACTIVE_BAND_ID, type Setlist } from '@gigbuddy/shared';
import { render, screen } from '@testing-library/react';
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

const { useSetlistMock, saveSetlistMock, navigateMock, isIPhoneMock } = vi.hoisted(() => ({
  useSetlistMock: vi.fn(),
  saveSetlistMock: vi.fn().mockResolvedValue(undefined),
  navigateMock: vi.fn(),
  isIPhoneMock: vi.fn().mockReturnValue(false),
}));

vi.mock('../hooks/use-setlist.js', () => ({ useSetlist: useSetlistMock }));
vi.mock('../hooks/use-setlist-mutation.js', () => ({
  useSetlistMutation: () => ({ saveSetlist: saveSetlistMock }),
}));
vi.mock('../lib/platform.js', () => ({
  isIPhone: () => isIPhoneMock(),
  isStandalone: () => false,
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

describe('SetlistOverview — Start performance CTA', () => {
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

  it('the iPhone CTA has no onClick handler in Epic 3 (Epic 4 wires it)', async () => {
    const user = userEvent.setup();
    isIPhoneMock.mockReturnValue(true);
    useSetlistMock.mockReturnValue({ data: makeSetlist(), isLoading: false });
    renderRoute();
    const cta = screen.getByRole('button', { name: ACTIONS.startPerformance });
    // Clicking the CTA must not navigate or save anything in Epic 3.
    await user.click(cta);
    expect(navigateMock).not.toHaveBeenCalled();
    expect(saveSetlistMock).not.toHaveBeenCalled();
  });
});
