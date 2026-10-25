import type { Setlist } from '@gigbuddy/shared';

/*
 * Gig date helpers (Story 7.7). `gigMeta.date` is `YYYY-MM-DD`; "today" is the
 * calendar date in Europe/London, not UTC. ISO dates sort lexicographically,
 * so plain string comparison is correct (AR-48).
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Today's `YYYY-MM-DD` in Europe/London. Never use
 * `new Date().toISOString().slice(0, 10)`: that is UTC and is wrong late in
 * the evening during BST.
 */
export function todayLondon(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) {
    return new Date().toISOString().slice(0, 10);
  }
  return `${year}-${month}-${day}`;
}

/**
 * `2026-11-07` → `Sat 7 Nov 2026`. Names are fixed (not Intl) because ICU
 * versions differ on commas and on `Sep` vs `Sept`. Malformed input is returned unchanged.
 */
export function formatGigDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (Number.isNaN(date.getTime())) return iso;
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Upcoming (today or later, soonest first) and past (most recent first). */
export function orderGigs(
  setlists: Setlist[],
  today: string,
): { upcoming: Setlist[]; past: Setlist[] } {
  const byId = (a: Setlist, b: Setlist) => a.setlistId.localeCompare(b.setlistId);
  const upcoming = setlists
    .filter((s) => s.gigMeta.date >= today)
    .sort((a, b) => a.gigMeta.date.localeCompare(b.gigMeta.date) || byId(a, b));
  const past = setlists
    .filter((s) => s.gigMeta.date < today)
    .sort((a, b) => b.gigMeta.date.localeCompare(a.gigMeta.date) || byId(a, b));
  return { upcoming, past };
}
