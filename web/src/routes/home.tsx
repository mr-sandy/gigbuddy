import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { GigCard } from '../components/gig-card.js';
import { useSetlists } from '../hooks/use-setlists.js';
import { sectionSetlists, todayLondon } from '../lib/gig-date.js';
import { ACTIONS, EMPTY_STATES } from '../lib/microcopy.js';
import { isIPhone } from '../lib/platform.js';

/*
 * Setlists home (FR-14, FR-23). Default landing route on both surfaces.
 *
 * Sections (in scroll order, AC-1):
 *   1. Tonight  — always rendered with heading. Shows the today-dated
 *                  Setlist (with TONIGHT badge) OR the soonest upcoming
 *                  Setlist promoted (no badge) OR the locked empty-state
 *                  copy. No "create new setlist" CTA per EXPERIENCE.md
 *                  State Patterns.
 *   2. Upcoming — heading and cards only when content remains after
 *                  Tonight promotion.
 *   3. Past     — heading and cards only when content exists; reverse
 *                  chronological order.
 *
 * Atmosphere (Practice on MacBook, Performance on iPhone) is applied at
 * boot by applyBootAtmosphere() in web/src/main.tsx — the Home route does
 * NOT touch data-atmosphere itself.
 *
 * `todayLondon()` runs at render time (not in a hook) so when the
 * `visibilitychange` foreground tick bumps state, sectioning re-derives
 * with the freshly-read calendar date and the previous-day Tonight slot
 * correctly rolls into Past.
 *
 * TanStack Query owns data freshness (default refetch-on-window-focus).
 * Loading and error states render quietly (no full-page spinner, no
 * toast) per AR-28 / EXPERIENCE.md State Patterns: while loading the
 * sections simply have no cards; on error the empty-state copy renders.
 */
export function Home() {
  const setlists = useSetlists();
  const [, setTick] = useState(0);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setTick((t) => t + 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const today = todayLondon();
  const { tonight, upcoming, past } = sectionSetlists(setlists.data ?? [], today);
  const tonightIsToday = tonight !== null && tonight.gigMeta.date === today;
  const iphone = isIPhone();

  return (
    <section aria-labelledby="setlists-heading">
      <h1 id="setlists-heading" className="sr-only">
        Setlists
      </h1>

      {/* iPhone-only: the `+ New setlist` affordance lives in the Home route
          because there is no TopNav on iPhone. MacBook mounts the
          equivalent link in TopNav's `rightActions` slot via
          `AuthenticatedShell` — no duplication. (Story 3.4.) */}
      {iphone ? (
        <Link
          to="/setlists/new"
          className="mb-[var(--spacing-section-gap)] inline-flex min-h-tap items-center py-[calc(var(--spacing-unit)*2)] text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-accent)] hover:text-[color:var(--color-accent-strong)] focus-visible:text-[color:var(--color-accent-strong)]"
        >
          {ACTIONS.newSetlist}
        </Link>
      ) : null}

      <section aria-labelledby="setlists-tonight-heading">
        <h2
          id="setlists-tonight-heading"
          className="mb-[calc(var(--spacing-unit)*3)] text-[length:var(--text-section-heading)] leading-[var(--text-section-heading--line-height)] text-[color:var(--color-text-secondary)]"
        >
          Tonight
        </h2>
        {tonight ? (
          <GigCard setlist={tonight} showBadge={tonightIsToday} />
        ) : (
          <p className="text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-text-secondary)]">
            {EMPTY_STATES.noUpcomingGigs}
          </p>
        )}
      </section>

      {upcoming.length > 0 ? (
        <section
          aria-labelledby="setlists-upcoming-heading"
          className="mt-[var(--spacing-section-gap)]"
        >
          <h2
            id="setlists-upcoming-heading"
            className="mb-[calc(var(--spacing-unit)*3)] text-[length:var(--text-section-heading)] leading-[var(--text-section-heading--line-height)] text-[color:var(--color-text-secondary)]"
          >
            Upcoming
          </h2>
          <ul className="flex flex-col gap-[var(--spacing-card-stack-gap)]">
            {upcoming.map((s) => (
              <li key={s.setlistId}>
                <GigCard setlist={s} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {past.length > 0 ? (
        <section
          aria-labelledby="setlists-past-heading"
          className="mt-[var(--spacing-section-gap)]"
        >
          <h2
            id="setlists-past-heading"
            className="mb-[calc(var(--spacing-unit)*3)] text-[length:var(--text-section-heading)] leading-[var(--text-section-heading--line-height)] text-[color:var(--color-text-secondary)]"
          >
            Past
          </h2>
          <ul className="flex flex-col gap-[var(--spacing-card-stack-gap)]">
            {past.map((s) => (
              <li key={s.setlistId}>
                <GigCard setlist={s} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
