import { defineConfig, devices } from '@playwright/test';

/*
 * Two webServer entries (Playwright v1.33+): the web dev server proxies
 * /api/v1/* to the api dev server (see web/vite.config.ts `server.proxy`),
 * so the SPA can talk to the local API on http://localhost:3100 while
 * fetches stay relative to the SPA origin.
 *
 * The api server's runtime env vars (JWT_KEY_PARAM, PASSWORD_HASH_PARAM,
 * TABLE_NAME, AWS credentials) must be present in the shell that launches
 * Playwright. Tests that exercise authenticated paths additionally need
 * a session-cookie fixture — separate follow-up; this config only owns
 * the "Playwright starts both servers" half of the contract.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5273',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter api run dev',
      url: 'http://localhost:3100/api/v1/health',
      reuseExistingServer: true,
      cwd: '..',
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter web run dev',
      url: 'http://localhost:5273',
      reuseExistingServer: true,
      cwd: '..',
      timeout: 60_000,
    },
  ],
});
