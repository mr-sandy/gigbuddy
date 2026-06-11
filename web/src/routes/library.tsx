import { EMPTY_STATES } from '../lib/microcopy.js';

/*
 * Library (FR-4, FR-24). Epic 2 (Story 2.5) lands the real Song list
 * surface and the inline-edit Song row. Epic 1 renders the empty state
 * with no row affordances per AC-5.
 */
export function Library() {
  return (
    <section aria-labelledby="library-heading">
      <h1 id="library-heading" className="sr-only">
        Library
      </h1>
      <p className="text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] text-[color:var(--color-text-secondary)]">
        {EMPTY_STATES.noSongsInLibrary}
      </p>
    </section>
  );
}
