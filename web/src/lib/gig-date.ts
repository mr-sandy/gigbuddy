import type { Setlist } from '@gigbuddy/shared';

/*
 * London-timezone calendar utilities + pure setlist sectioning (Story 3.2).
 *
 * `gigMeta.date` is an ISO date string (`YYYY-MM-DD`). "Today" for the
 * GigBuddy home surface is the calendar date in Europe/London — NOT UTC —
 * so a Saturday gig at 23:59 London time is still "Tonight" until midnight
 * London time, even when UTC has already rolled over.
 *
 * `sectionSetlists()` is a pure function (no React, no TanStack, no I/O)
 * so it can be unit tested independently of the UI and reused by other
 * hooks (e.g. `useTonightGig()` for Epic 4 pre-fetch wiring).
 *
 * ISO date strings sort lexicographically — string comparison
 * (`date > today`) is correct for `YYYY-MM-DD` (AR-48).
 */

/**
 * Returns today's calendar date as `YYYY-MM-DD` in the `Europe/London`
 * timezone.
 *
 * Do NOT use `new Date().toISOString().slice(0, 10)` for this — that is
 * UTC, and diverges from London time near UTC midnight (and always during
 * BST, May–October).
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
    // Should be impossible: en-GB with the options above always emits all
    // three parts. Fall back to ISO UTC date so callers always get a
    // well-formed YYYY-MM-DD string rather than NaN.
    return new Date().toISOString().slice(0, 10);
  }
  return `${year}-${month}-${day}`;
}

/**
 * Formats a `YYYY-MM-DD` ISO date as a short human-readable string in the
 * `en-GB` locale, e.g. `2026-06-21` → `21 Jun 2026`.
 *
 * Parses the date manually to avoid `new Date(iso)` parsing as UTC midnight
 * (which can roll the day back in some locales / timezones during display).
 *
 * Returns the original string unchanged when the input is malformed — the
 * caller can decide how to surface that, but rendering raw input is
 * preferable to NaN.
 */
export function formatGigDate(isoDate: string): string {
  const parts = isoDate.split('-').map((p) => Number.parseInt(p, 10));
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) {
    return isoDate;
  }
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return isoDate;
  }
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export interface SectionedSetlists {
  tonight: Setlist | null;
  upcoming: Setlist[];
  past: Setlist[];
}

/**
 * Sections a flat list of Setlists into Tonight / Upcoming / Past relative
 * to the given `today` (`YYYY-MM-DD`, Europe/London calendar date).
 *
 * - `tonight`: the Setlist dated today if any, otherwise the soonest
 *   upcoming Setlist (promoted), otherwise `null`.
 * - `upcoming`: future-dated Setlists EXCLUDING the one promoted to
 *   tonight, in chronological order (soonest first).
 * - `past`: past-dated Setlists in reverse chronological order (most
 *   recent first).
 *
 * Defensive sort: the server returns setlists in ascending date order
 * (GSI1), but `sectionSetlists()` re-sorts to stay correct regardless of
 * input order — it's a pure utility, not a list owner.
 */
export function sectionSetlists(setlists: Setlist[], today: string): SectionedSetlists {
  const sorted = [...setlists].sort((a, b) => a.gigMeta.date.localeCompare(b.gigMeta.date));
  const todayGig = sorted.find((s) => s.gigMeta.date === today) ?? null;
  const future = sorted.filter((s) => s.gigMeta.date > today);
  const past = sorted.filter((s) => s.gigMeta.date < today).reverse();

  let tonight: Setlist | null = null;
  let upcoming: Setlist[] = [];

  if (todayGig) {
    tonight = todayGig;
    upcoming = future;
  } else if (future.length > 0) {
    tonight = future[0] ?? null;
    upcoming = future.slice(1);
  }

  return { tonight, upcoming, past };
}
