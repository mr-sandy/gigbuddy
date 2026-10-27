import { expect, test } from '@playwright/test';

/*
 * The smoke run has no session-cookie fixture (see the comment in
 * e2e/playwright.config.ts), so the only state it can reach reliably is
 * signed-out. The signed-in landing page is covered by the unit tests in
 * web/src/routes/songs.test.tsx, gigs.test.tsx, app-bootstrap.test.tsx and by Sandy's quick look at the live app.
 */

test('shows the login on /', async ({ page }) => {
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

test('/songs, /songs/:songId and the add/edit routes end on /login showing the Password field', async ({
  page,
}) => {
  for (const path of ['/songs', '/songs/anything', '/songs/new', '/songs/anything/edit']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel('Password')).toBeVisible();
  }
});

test('/gigs, /gigs/new, /gigs/:setlistId, /gigs/:setlistId/edit, /gigs/:setlistId/setlist and /gigs/:setlistId/songs/:songId end on /login showing the Password field', async ({
  page,
}) => {
  for (const path of [
    '/gigs',
    '/gigs/new',
    '/gigs/anything',
    '/gigs/anything/edit',
    '/gigs/anything/setlist',
    '/gigs/anything/songs/anything',
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel('Password')).toBeVisible();
  }
});

test('has no horizontal scroll at 360px and 1680px viewport widths', async ({ page }) => {
  for (const width of [360, 1680]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    // Wait for the login form, not the pre-/me boot shell, before measuring.
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    const [scrollWidth, innerWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  }
});
