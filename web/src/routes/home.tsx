import { EMPTY_STATES } from '../lib/microcopy.js';

/*
 * Setlists home (FR-23, FR-14). Default landing route on both surfaces.
 * Epic 1 has no Setlists API yet — this story renders the empty state
 * only. Epic 3 (Story 3.2) lands the real Tonight / Upcoming / Past
 * sectioned list.
 */
export function Home() {
  return (
    <section aria-labelledby="setlists-heading">
      <h1 id="setlists-heading" className="sr-only">
        Setlists
      </h1>
      <p className="text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-text-secondary)]">
        {EMPTY_STATES.noUpcomingGigs}
      </p>
    </section>
  );
}
