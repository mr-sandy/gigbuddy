import { expect, test } from '@playwright/test';

/*
 * Verified-restore Playwright spec (Story 5.2, AC-10).
 *
 * Ran against a deployed URL whose API Lambda has been pointed at a
 * restored side table via `TABLE_NAME` (phase 6 of
 * `infra/runbooks/restore-pitr.md`). This is the automated half of
 * phase 7's "confirm the app reads correctly" — two distinct
 * data-path checks:
 *
 *   1. Library shows at least one Song row (Song read path).
 *   2. Opening a Setlist overview renders at least one Song row
 *      inside it (Setlist + SongRef structural integrity).
 *
 * The canary Song's presence is validated more precisely in phase 5
 * via `aws dynamodb get-item`. This spec is deliberately loose on
 * which Song appears — the executor may run it any time between the
 * env-swap (phase 6) and the swap-back (phase 8), against a table
 * whose canary was written in a different terminal session. Asserting
 * "at least one Song" survives that timing looseness.
 *
 * Configuration comes from environment variables (see
 * `restore/playwright.config.ts`); credentials are never hardcoded.
 */

const password = process.env.RESTORE_DRILL_PASSWORD;
if (!password) {
  throw new Error('RESTORE_DRILL_PASSWORD env var is required to run the restore drill spec');
}
// Non-null local — TypeScript narrows this within the closure below.
const authPassword: string = password;

test('restored table serves Library and Setlist data through the auth gate', async ({ page }) => {
  // --- Auth gate ---
  await page.goto('/login');
  await page.getByLabel('Password').fill(authPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // The Login route navigates to `/` on success. Wait for the
  // Setlists home heading (rendered sr-only but exposed to a11y).
  await expect(page.getByRole('heading', { name: 'Setlists', level: 1 })).toBeVisible();

  // --- Library data path ---
  await page.goto('/library');
  // LibrarySongRow renders as `<li><a href="/songs/:songId">Title</a></li>`.
  // The "+ New song" link is a sibling of the `<ul>`, not inside any
  // `<li>` (web/src/routes/library.tsx), so `li a[href^="/songs/"]`
  // already excludes it.
  await expect(page.locator('li a[href^="/songs/"]').first()).toBeVisible();

  // --- Setlist overview data path ---
  await page.goto('/');
  // GigCard buttons compose their aria-label as "venue, date[, time][, Tonight]".
  // The comma-space pattern is unique to those cards on this route.
  const firstSetlistCard = page.getByRole('button', { name: /, / }).first();
  await firstSetlistCard.click();

  // Setlist overview renders each Song as a `<li>` inside a `<ul>`
  // scoped to a section labelled `setlist-section-<n>-heading`
  // (web/src/routes/setlist-overview.tsx). Scoping to that section is
  // required because on desktop `TopNav` also renders a `<ul><li>` for
  // primary navigation — an unscoped `ul li` selector matches the nav
  // and passes even when the setlist has zero rows.
  await expect(
    page.locator('section[aria-labelledby^="setlist-section-"] li').first(),
  ).toBeVisible();
});
