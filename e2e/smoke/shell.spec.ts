import { expect, test } from '@playwright/test';

test('authenticated shell paints the MacBook chrome and the Setlists empty state', async ({
  page,
}) => {
  await page.goto('/');
  // MacBook chrome (desktop Chrome viewport): passive Band label + primary nav.
  await expect(page.getByText('GigBuddy · The Jack Ruby 5')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  // Default landing route is /, the Setlists home empty state.
  await expect(page.getByText('No upcoming gigs.')).toBeVisible();
});
