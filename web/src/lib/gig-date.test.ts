import type { Setlist } from '@gigbuddy/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatGigDate, orderGigs, todayLondon } from './gig-date.js';

afterEach(() => {
  vi.useRealTimers();
});

function gig(setlistId: string, date: string): Setlist {
  return { setlistId, gigMeta: { venue: 'Venue A', date } } as Setlist;
}

describe('todayLondon', () => {
  it('returns the London date in winter (GMT)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-07T23:30:00Z'));
    expect(todayLondon()).toBe('2026-11-07');
  });

  it('returns the next London day late in the evening UTC during BST', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-21T23:30:00Z'));
    expect(todayLondon()).toBe('2026-06-22');
  });
});

describe('formatGigDate', () => {
  it('formats with weekday and no comma', () => {
    expect(formatGigDate('2026-11-07')).toBe('Sat 7 Nov 2026');
  });

  it('returns malformed input unchanged', () => {
    expect(formatGigDate('soon')).toBe('soon');
    expect(formatGigDate('2026-13-45x')).toBe('2026-13-45x');
  });
});

describe('orderGigs', () => {
  it('puts today in upcoming first, and past most recent first', () => {
    const input = [
      gig('a', '2026-09-12'),
      gig('b', '2026-12-05'),
      gig('c', '2026-11-07'),
      gig('d', '2026-10-31'),
    ];
    const before = input.map((s) => s.setlistId);
    const { upcoming, past } = orderGigs(input, '2026-11-07');
    expect(upcoming.map((s) => s.setlistId)).toEqual(['c', 'b']);
    expect(past.map((s) => s.setlistId)).toEqual(['d', 'a']);
    expect(input.map((s) => s.setlistId)).toEqual(before);
  });

  it('breaks date ties by setlistId', () => {
    const { upcoming } = orderGigs([gig('z', '2026-12-01'), gig('m', '2026-12-01')], '2026-11-07');
    expect(upcoming.map((s) => s.setlistId)).toEqual(['m', 'z']);
  });
});
