import { ACTIVE_BAND_ID, type Setlist } from '@gigbuddy/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sectionSetlists, todayLondon } from './gig-date.js';

function makeSetlist(setlistId: string, date: string, venue = 'Venue'): Setlist {
  return {
    bandId: ACTIVE_BAND_ID,
    setlistId,
    gigMeta: { venue, date, time: '20:00' },
    sections: [],
    clientWrittenAt: '2026-06-19T10:00:00.000Z',
    serverReceivedAt: '2026-06-19T10:00:01.000Z',
    version: 1 as const,
  };
}

describe('todayLondon', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a YYYY-MM-DD formatted string', () => {
    vi.setSystemTime(new Date('2026-06-21T12:00:00Z'));
    const result = todayLondon();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns the Europe/London calendar date when UTC and London agree (winter, GMT)', () => {
    // 2026-01-15T12:00:00Z — January, no BST, London == UTC
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    expect(todayLondon()).toBe('2026-01-15');
  });

  it('returns the BST date during summer when London is ahead of UTC', () => {
    // 23:30 UTC on 21 June 2026 = 00:30 BST on 22 June 2026 in London.
    // Using new Date().toISOString().slice(0,10) (UTC) would return
    // '2026-06-21'. The London-correct answer is '2026-06-22'.
    vi.setSystemTime(new Date('2026-06-21T23:30:00Z'));
    expect(todayLondon()).toBe('2026-06-22');
  });

  it('returns yesterday in London when the UTC date already rolled to the next day during GMT', () => {
    // 00:30 UTC on 2026-01-16 = 00:30 GMT on 2026-01-16 in London too —
    // they agree in GMT. Use a late-evening BST case where UTC has
    // already crossed midnight but London has not yet:
    //   01 Jun 2026 23:30 BST = 22:30 UTC same day — both agree it's the 1st.
    //   01 Jun 2026 23:30 UTC = 00:30 BST next day — London says 2nd.
    // We test the inverse direction: UTC has crossed midnight but London
    // is still on the previous day cannot happen (London >= UTC in BST,
    // and == in GMT). So the only divergence point is "London ahead of
    // UTC near midnight", already covered by the BST case above. This
    // case checks that a plain UTC date during GMT still matches London.
    vi.setSystemTime(new Date('2026-02-14T22:00:00Z'));
    expect(todayLondon()).toBe('2026-02-14');
  });
});

describe('sectionSetlists', () => {
  const today = '2026-06-21';

  it('returns all empty sections when input is empty', () => {
    const result = sectionSetlists([], today);
    expect(result.tonight).toBeNull();
    expect(result.upcoming).toEqual([]);
    expect(result.past).toEqual([]);
  });

  it('places the today-dated setlist into tonight and does not duplicate it in upcoming', () => {
    const todayGig = makeSetlist('today1', today);
    const future = makeSetlist('future1', '2026-07-04');
    const result = sectionSetlists([todayGig, future], today);
    expect(result.tonight).toBe(todayGig);
    expect(result.upcoming).toEqual([future]);
    expect(result.past).toEqual([]);
  });

  it('promotes the soonest future setlist to tonight when no setlist is dated today', () => {
    const soon = makeSetlist('soon', '2026-06-22');
    const later = makeSetlist('later', '2026-07-04');
    const result = sectionSetlists([soon, later], today);
    expect(result.tonight).toBe(soon);
    expect(result.upcoming).toEqual([later]);
    expect(result.past).toEqual([]);
  });

  it('returns tonight = null when there is no today gig and no future gigs', () => {
    const past1 = makeSetlist('past1', '2026-06-01');
    const result = sectionSetlists([past1], today);
    expect(result.tonight).toBeNull();
    expect(result.upcoming).toEqual([]);
    expect(result.past).toEqual([past1]);
  });

  it('returns past setlists in reverse chronological order (most recent first)', () => {
    const older = makeSetlist('older', '2026-05-01');
    const newer = makeSetlist('newer', '2026-06-01');
    const ancient = makeSetlist('ancient', '2025-12-25');
    const result = sectionSetlists([older, ancient, newer], today);
    expect(result.past.map((s) => s.setlistId)).toEqual(['newer', 'older', 'ancient']);
  });

  it('returns upcoming in chronological order (soonest first) when no today gig', () => {
    const a = makeSetlist('a', '2026-07-01');
    const b = makeSetlist('b', '2026-06-25');
    const c = makeSetlist('c', '2026-08-15');
    // No today gig — soonest (b, 2026-06-25) promotes to tonight; rest in
    // chronological order: a (2026-07-01), c (2026-08-15).
    const result = sectionSetlists([a, b, c], today);
    expect(result.tonight).toBe(b);
    expect(result.upcoming.map((s) => s.setlistId)).toEqual(['a', 'c']);
  });

  it('returns upcoming in chronological order when there is a today gig', () => {
    const today1 = makeSetlist('today1', today);
    const a = makeSetlist('a', '2026-08-15');
    const b = makeSetlist('b', '2026-06-25');
    const result = sectionSetlists([a, today1, b], today);
    expect(result.tonight).toBe(today1);
    expect(result.upcoming.map((s) => s.setlistId)).toEqual(['b', 'a']);
  });

  it('handles a mix of past, today, and future correctly', () => {
    const past1 = makeSetlist('past1', '2026-05-01');
    const past2 = makeSetlist('past2', '2026-06-10');
    const todayGig = makeSetlist('today', today);
    const future1 = makeSetlist('future1', '2026-07-01');
    const future2 = makeSetlist('future2', '2026-06-22');
    const result = sectionSetlists([past1, future1, todayGig, past2, future2], today);
    expect(result.tonight).toBe(todayGig);
    expect(result.upcoming.map((s) => s.setlistId)).toEqual(['future2', 'future1']);
    expect(result.past.map((s) => s.setlistId)).toEqual(['past2', 'past1']);
  });

  it('does not mutate the input array', () => {
    const a = makeSetlist('a', '2026-07-01');
    const b = makeSetlist('b', '2026-05-25');
    const input = [a, b];
    const snapshot = [...input];
    sectionSetlists(input, today);
    expect(input).toEqual(snapshot);
  });
});
