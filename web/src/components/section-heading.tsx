import type { JSX } from 'react';
import { InlineEditField } from './inline-edit-field.js';

/*
 * SectionHeading (Story 3.3, FR-10 / FR-11). Renders one section title +
 * inline song count badge in the Setlist overview. The component is
 * atmosphere-aware:
 *
 *   - MacBook (practice): wraps the name in InlineEditField so Sandy can
 *     rename in place. Blur commits via `onRename(sectionIndex, newName)`.
 *   - iPhone (performance): renders the name as static text. The
 *     `onRename` prop is still accepted for type compatibility but no
 *     edit affordance is mounted (FR-10 — section names are not editable
 *     on iPhone).
 *
 * Atmosphere detection is read at render time from
 * `document.documentElement.dataset.atmosphere` — same `readAtmosphere()`
 * pattern as song-detail.tsx (boot-fixed, never changes mid-session).
 *
 * The count badge is part of the heading line: `Set 1 · 4 songs`. The
 * badge is rendered in mono `text-secondary` to differentiate from the
 * editorial-serif name.
 */

function readAtmosphere(): 'practice' | 'performance' {
  if (typeof document === 'undefined') return 'practice';
  return document.documentElement.dataset.atmosphere === 'performance' ? 'performance' : 'practice';
}

export type SectionHeadingProps = {
  name: string;
  songCount: number;
  sectionIndex: number;
  onRename: (sectionIndex: number, newName: string) => void;
};

const NAME_CLASS =
  'text-[length:var(--text-section-heading)] leading-[var(--text-section-heading--line-height)] font-[family-name:var(--font-serif-editorial)] text-[color:var(--color-text-secondary)] uppercase tracking-wide [font-variant-caps:small-caps]';

const COUNT_CLASS =
  'text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] font-[family-name:var(--font-mono-slab)] text-[color:var(--color-text-secondary)]';

export function SectionHeading({
  name,
  songCount,
  sectionIndex,
  onRename,
}: SectionHeadingProps): JSX.Element {
  const atmosphere = readAtmosphere();
  const countLabel = `· ${songCount} ${songCount === 1 ? 'song' : 'songs'}`;

  if (atmosphere === 'performance') {
    return (
      <div className="flex items-baseline gap-[calc(var(--spacing-unit)*2)]">
        <span className={NAME_CLASS}>{name}</span>
        <span className={COUNT_CLASS}>{countLabel}</span>
      </div>
    );
  }

  return (
    <div className="flex items-baseline gap-[calc(var(--spacing-unit)*2)]">
      <InlineEditField
        value={name}
        onCommit={(next) => onRename(sectionIndex, next)}
        ariaLabel={`Rename section: ${name}`}
        inputClassName={NAME_CLASS}
      />
      <span className={COUNT_CLASS}>{countLabel}</span>
    </div>
  );
}
