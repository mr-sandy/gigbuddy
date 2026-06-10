import { expect, test } from '@playwright/test';

test('placeholder page renders GigBuddy heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'GigBuddy' })).toBeVisible();
});
