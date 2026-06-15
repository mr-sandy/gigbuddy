import { describe, expect, it } from 'vitest';
import {
  decideBlackout,
  FAIL_CLOSED_MESSAGE,
  type Gig,
  londonHour,
  londonIsoDate,
  londonWeekday,
} from './blackout-check.js';

const ok = async () => undefined;
const throwing = async () => {
  throw new Error('boom');
};
const empty = async (): Promise<Gig[]> => [];
const oneGig = (gig: Gig) => async (): Promise<Gig[]> => [gig];
const manyGigs = (gigs: Gig[]) => async (): Promise<Gig[]> => gigs;

// Reference instants (Jan 1 2026 is a Thursday):
// 2026-01-13 = Tue, 2026-01-16 = Fri, 2026-01-18 = Sun, 2026-01-19 = Mon
// 2026-06-15 = Mon, 2026-06-16 = Tue, 2026-06-19 = Fri, 2026-06-20 = Sat, 2026-06-21 = Sun
const TUE_10_GMT = new Date('2026-01-13T10:00:00Z'); // London 10:00 GMT Tue
const TUE_10_BST = new Date('2026-06-16T09:00:00Z'); // London 10:00 BST Tue
const FRI_18_BST = new Date('2026-06-19T17:00:00Z'); // London 18:00 BST Fri
const FRI_1930_GMT = new Date('2026-01-16T19:30:00Z'); // London 19:30 GMT Fri
const SUN_2330_GMT = new Date('2026-01-18T23:30:00Z'); // London 23:30 GMT Sun
const SUN_1759_BST = new Date('2026-06-21T16:59:00Z'); // London 17:59 BST Sun
const MON_0000_GMT = new Date('2026-01-19T00:00:00Z'); // London 00:00 GMT Mon

describe('londonIsoDate', () => {
  it('returns the BST-local date for a UTC instant just before midnight London time during BST', () => {
    // 2026-07-01 22:30 UTC = 2026-07-01 23:30 BST
    expect(londonIsoDate(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-01');
  });

  it('returns the GMT-local date for a UTC instant just before midnight London time in winter', () => {
    // 2026-01-15 22:30 UTC = 2026-01-15 22:30 GMT
    expect(londonIsoDate(new Date('2026-01-15T22:30:00Z'))).toBe('2026-01-15');
  });

  it('rolls forward across the DST spring-forward transition', () => {
    // 2026-03-29 01:30 UTC — clocks sprung forward at 01:00 UTC → 02:00 BST
    expect(londonIsoDate(new Date('2026-03-29T01:30:00Z'))).toBe('2026-03-29');
  });
});

describe('londonWeekday', () => {
  it('returns the correct weekday short name for each day of a 7-day span', () => {
    // 2026-06-15 = Mon, 2026-06-16 = Tue, ..., 2026-06-21 = Sun (verified manually)
    expect(londonWeekday(new Date('2026-06-15T12:00:00Z'))).toBe('Mon');
    expect(londonWeekday(new Date('2026-06-16T12:00:00Z'))).toBe('Tue');
    expect(londonWeekday(new Date('2026-06-17T12:00:00Z'))).toBe('Wed');
    expect(londonWeekday(new Date('2026-06-18T12:00:00Z'))).toBe('Thu');
    expect(londonWeekday(new Date('2026-06-19T12:00:00Z'))).toBe('Fri');
    expect(londonWeekday(new Date('2026-06-20T12:00:00Z'))).toBe('Sat');
    expect(londonWeekday(new Date('2026-06-21T12:00:00Z'))).toBe('Sun');
  });
});

describe('londonHour', () => {
  it('returns 00..23 correctly across GMT', () => {
    expect(londonHour(new Date('2026-01-15T00:30:00Z'))).toBe(0);
    expect(londonHour(new Date('2026-01-15T01:30:00Z'))).toBe(1);
    expect(londonHour(new Date('2026-01-15T17:00:00Z'))).toBe(17);
    expect(londonHour(new Date('2026-01-15T18:00:00Z'))).toBe(18);
    expect(londonHour(new Date('2026-01-15T23:00:00Z'))).toBe(23);
  });

  it('returns 00..23 correctly across BST (UTC+1)', () => {
    expect(londonHour(new Date('2026-07-01T00:00:00Z'))).toBe(1);
    expect(londonHour(new Date('2026-07-01T16:00:00Z'))).toBe(17);
    expect(londonHour(new Date('2026-07-01T17:00:00Z'))).toBe(18);
    expect(londonHour(new Date('2026-07-01T22:00:00Z'))).toBe(23);
    expect(londonHour(new Date('2026-07-01T23:00:00Z'))).toBe(0);
  });
});

describe('decideBlackout', () => {
  it('returns exit 1 with the canonical fail-closed message when describeTable throws', async () => {
    const decision = await decideBlackout({
      now: TUE_10_GMT,
      describeTable: throwing,
      scanGigs: empty,
    });
    expect(decision.exit).toBe(1);
    if (decision.exit === 1) {
      expect(decision.stderr).toBe(FAIL_CLOSED_MESSAGE);
      expect(decision.blockingGigs).toEqual([]);
    }
  });

  it('returns exit 1 with the canonical fail-closed message when scanGigs throws', async () => {
    const decision = await decideBlackout({
      now: TUE_10_GMT,
      describeTable: ok,
      scanGigs: throwing,
    });
    expect(decision.exit).toBe(1);
    if (decision.exit === 1) {
      expect(decision.stderr).toBe(FAIL_CLOSED_MESSAGE);
      expect(decision.blockingGigs).toEqual([]);
    }
  });

  it('exits 0 on a Tuesday morning GMT with empty DDB (AC-6: V1 fresh-deploy path)', async () => {
    const decision = await decideBlackout({
      now: TUE_10_GMT,
      describeTable: ok,
      scanGigs: empty,
    });
    expect(decision.exit).toBe(0);
    if (decision.exit === 0) {
      expect(decision.stdout).toBe(
        'blackout check passed (no upcoming gigs; outside weekend-evening fallback window)',
      );
    }
  });

  it('exits 0 on a Tuesday morning BST with empty DDB (DST-correct fresh-deploy)', async () => {
    const decision = await decideBlackout({
      now: TUE_10_BST,
      describeTable: ok,
      scanGigs: empty,
    });
    expect(decision.exit).toBe(0);
  });

  it('exits 1 on a Friday 18:00 BST with empty DDB (weekend fallback fires)', async () => {
    const decision = await decideBlackout({
      now: FRI_18_BST,
      describeTable: ok,
      scanGigs: empty,
    });
    expect(decision.exit).toBe(1);
    if (decision.exit === 1) {
      expect(decision.stderr.startsWith('BLOCKED: weekend evening static fallback')).toBe(true);
    }
  });

  it('exits 1 on a Friday 19:30 GMT with empty DDB', async () => {
    const decision = await decideBlackout({
      now: FRI_1930_GMT,
      describeTable: ok,
      scanGigs: empty,
    });
    expect(decision.exit).toBe(1);
    if (decision.exit === 1) {
      expect(decision.stderr.startsWith('BLOCKED: weekend evening static fallback')).toBe(true);
    }
  });

  it('exits 1 on a Sunday 23:30 GMT with empty DDB (top of the fallback window)', async () => {
    const decision = await decideBlackout({
      now: SUN_2330_GMT,
      describeTable: ok,
      scanGigs: empty,
    });
    expect(decision.exit).toBe(1);
  });

  it('exits 0 on a Sunday 17:59 BST with empty DDB (one minute below the 18:00 window)', async () => {
    const decision = await decideBlackout({
      now: SUN_1759_BST,
      describeTable: ok,
      scanGigs: empty,
    });
    expect(decision.exit).toBe(0);
  });

  it('exits 0 on Monday 00:00 GMT with empty DDB (midnight Mon is OUT of the weekend window)', async () => {
    const decision = await decideBlackout({
      now: MON_0000_GMT,
      describeTable: ok,
      scanGigs: empty,
    });
    expect(decision.exit).toBe(0);
  });

  it('exits 1 with a formatted line for a single blocking gig with time', async () => {
    const gig: Gig = {
      gigMeta: { venue: 'The Blue Note', date: '2026-06-15', time: '20:00' },
    };
    const decision = await decideBlackout({
      now: new Date('2026-06-14T10:00:00Z'),
      describeTable: ok,
      scanGigs: oneGig(gig),
    });
    expect(decision.exit).toBe(1);
    if (decision.exit === 1) {
      expect(decision.stderr).toBe('BLOCKED: The Blue Note @ 2026-06-15 20:00');
      expect(decision.blockingGigs).toEqual([gig]);
    }
  });

  it('sorts multiple blocking gigs nearest-first by date then time', async () => {
    const later: Gig = { gigMeta: { venue: 'Late Bar', date: '2026-06-15', time: '22:00' } };
    const earlier: Gig = { gigMeta: { venue: 'Early Cafe', date: '2026-06-15', time: '18:00' } };
    const nextDay: Gig = { gigMeta: { venue: 'Next Day', date: '2026-06-16', time: '10:00' } };
    // Pass in non-sorted order to prove the function sorts.
    const decision = await decideBlackout({
      now: new Date('2026-06-14T10:00:00Z'),
      describeTable: ok,
      scanGigs: manyGigs([nextDay, later, earlier]),
    });
    expect(decision.exit).toBe(1);
    if (decision.exit === 1) {
      expect(decision.stderr).toBe(
        [
          'BLOCKED: Early Cafe @ 2026-06-15 18:00',
          'BLOCKED: Late Bar @ 2026-06-15 22:00',
          'BLOCKED: Next Day @ 2026-06-16 10:00',
        ].join('\n'),
      );
      expect(decision.blockingGigs[0]).toBe(earlier);
    }
  });

  it('formats a blocking gig without a trailing time when gigMeta.time is undefined', async () => {
    const gig: Gig = { gigMeta: { venue: 'No Time Venue', date: '2026-06-15' } };
    const decision = await decideBlackout({
      now: new Date('2026-06-14T10:00:00Z'),
      describeTable: ok,
      scanGigs: oneGig(gig),
    });
    expect(decision.exit).toBe(1);
    if (decision.exit === 1) {
      expect(decision.stderr).toBe('BLOCKED: No Time Venue @ 2026-06-15');
    }
  });
});
