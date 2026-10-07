import { defineConfig, devices } from '@playwright/test';

/**
 * E2E suite (T1 in docs/02-roadmap.md).
 *
 * - chromium only; the app has no webkit/firefox-specific behavior worth
 *   paying a second engine for
 * - the app is served by e2e/server.mjs, a one-process test double (static
 *   SPA + REST mocks + WebSocket gateway twin), built ahead from .env.e2e so
 *   every API call stays on 127.0.0.1 and nothing can leak to a real backend
 * - one worker per shard. The server's in-memory store is intentionally
 *   mutable (specs drive it via /e2e/* control endpoints), and serializing
 *   within a shard keeps that state race-free. Sharding still gives three
 *   parallel CI jobs.
 * - retries are off: a retried spec would re-run against already-mutated
 *   server state and fail for the same reason, so retries could never help.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run build:e2e && node e2e/server.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});