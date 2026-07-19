import { defineConfig } from '@playwright/test';

/*
 * Restore-drill Playwright config (Story 5.2). Kept separate from
 * `e2e/playwright.config.ts` because this spec runs against an
 * already-deployed URL (with the API Lambda's `TABLE_NAME` swapped to a
 * restored side table) — not the two local `pnpm dev` servers the smoke
 * config spins up.
 *
 * Configuration comes from environment variables so a mis-invoked run
 * fails fast with a readable message instead of a confusing Playwright
 * navigation error:
 *
 *   RESTORE_DRILL_URL       — the deployed base URL, e.g. https://gig.cormie.com
 *   RESTORE_DRILL_PASSWORD  — the login password (spec file consumes this)
 */

const baseURL = process.env.RESTORE_DRILL_URL;
if (!baseURL) {
  throw new Error('RESTORE_DRILL_URL env var is required to run the restore drill spec');
}

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { viewport: { width: 1280, height: 800 } },
    },
  ],
});
