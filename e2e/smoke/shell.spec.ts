import { expect, test } from '@playwright/test';

/*
 * The smoke run has no session-cookie fixture (see the comment in
 * e2e/playwright.config.ts), so the only state it can reach reliably is
 * signed-out. The signed-in landing page is covered by the unit tests in
 * web/src/routes/home.test.tsx and by the Story 7.2 review snapshots.
 */

test('shows the login on /, with no horizontal scroll at phone or MacBook width', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'GigBuddy' })).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('a removed route (/library) ends on /login showing the same form', async ({ page }) => {
  await page.goto('/library');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'GigBuddy' })).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
});

test('has no horizontal scroll at 360px and 1680px viewport widths', async ({ page }) => {
  for (const width of [360, 1680]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const [scrollWidth, innerWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  }
});
