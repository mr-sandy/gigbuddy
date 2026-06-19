import type { Setlist } from '@gigbuddy/shared';
import { useNavigate } from 'react-router';
import { formatGigDate } from '../lib/gig-date.js';

/*
 * GigCard (Story 3.2, AC-7 / AC-14). Renders one Setlist as a tappable
 * card on the Setlists home surface. Mirrors the LibrarySongRow pattern:
 * card-style components in this app are `<button>` elements driving
 * `useNavigate()`, not `<a href>` tags — keeps keyboard / tap semantics
 * consistent and avoids the default browser navigation that conflicts
 * with React Router.
 *
 * `showBadge` is the Tonight badge — only the Tonight slot when the gig
 * is actually dated today (NOT for promoted-upcoming gigs).
 *
 * Visual contract (DESIGN.md / tokens.css):
 *   - venue: editorial serif, --text-home-tonight (28px)
 *   - date+time: mono slab, --text-practice-body, text-secondary
 *   - surface: --color-surface fill, --shadow-card, --radius-card (16px)
 *   - tap target: min-h-tap (44px floor)
 *   - badge: --color-accent fill, --color-bg text (readable on accent)
 *
 * aria-label composes venue + date + (time if present) + ", Tonight"
 * when the badge is shown so the accessible name captures all visible
 * information for screen readers.
 *
 * `formatGigDate` lives in `lib/gig-date.ts` (Story 3.3 — also consumed
 * by setlist-overview.tsx); the helper is shared, not local to this
 * component.
 */

export interface GigCardProps {
  setlist: Setlist;
  showBadge?: boolean;
}

export function GigCard({ setlist, showBadge = false }: GigCardProps) {
  const navigate = useNavigate();
  const { venue, date, time } = setlist.gigMeta;
  const formattedDate = formatGigDate(date);
  const dateAndTime = time ? `${formattedDate} · ${time}` : formattedDate;
  const ariaLabelParts = [venue, formattedDate];
  if (time) ariaLabelParts.push(time);
  if (showBadge) ariaLabelParts.push('Tonight');
  const ariaLabel = ariaLabelParts.join(', ');

  return (
    <button
      type="button"
      onClick={() => navigate(`/setlists/${setlist.setlistId}`)}
      aria-label={ariaLabel}
      className="relative flex min-h-tap w-full flex-col items-start gap-[calc(var(--spacing-unit)*2)] rounded-[var(--radius-card)] bg-[color:var(--color-surface)] p-[var(--spacing-card-pad)] text-left shadow-[var(--shadow-card)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
    >
      {showBadge ? (
        <span className="rounded-[var(--radius-button)] px-[calc(var(--spacing-unit)*2)] py-[calc(var(--spacing-unit)*1)] text-[length:var(--text-practice-body)] font-[family-name:var(--font-mono-slab)] uppercase tracking-wide bg-[color:var(--color-accent)] text-[color:var(--color-bg)]">
          TONIGHT
        </span>
      ) : null}
      <span className="text-[length:var(--text-home-tonight)] leading-[var(--text-home-tonight--line-height)] font-[family-name:var(--font-serif-editorial)] text-[color:var(--color-text-primary)]">
        {venue}
      </span>
      <span className="text-[length:var(--text-practice-body)] leading-[var(--text-practice-body--line-height)] font-[family-name:var(--font-mono-slab)] text-[color:var(--color-text-secondary)]">
        {dateAndTime}
      </span>
    </button>
  );
}
