import { defineConfig, devices } from '@playwright/test';
import { API_URL, WEB_URL } from './e2e/urls';

// Browser tests against the built web app and the local API (docs/adr/0013-e2e-playwright.md).
// Both run in workerd like on Cloudflare, with local bindings only. Run with `pnpm test:e2e`,
// which builds the web app first.

// A fresh API version per run: the edge cache (ADR 0021) is off for the local `dev` version and
// keys on this one, so copies left by an earlier run (.wrangler/state) are never served.
const E2E_APP_VERSION = `e2e-${Date.now().toString(36)}`;

// Always start fresh servers: a leftover `pnpm dev` or older build on these ports fails the run
// loudly instead of being tested by mistake. Wrangler telemetry off (local tests only).
const server = {
  reuseExistingServer: false,
  timeout: 60_000,
  env: {
    WRANGLER_SEND_METRICS: 'false',
    // The web dev server calls the local API over HTTP (API_ORIGIN); never through a proxy.
    NO_PROXY: '127.0.0.1,localhost',
    no_proxy: '127.0.0.1,localhost',
  },
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: WEB_URL,
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /lighthouse\.spec\.ts/,
    },
    // Lighthouse ≥ 90 on the public pages (#41, ADR 0021). Runs after the other tests, one page
    // at a time, so CPU contention does not distort the performance score. No retry: a score
    // below 90 always fails, instead of a lucky second run hiding a downward trend.
    {
      name: 'lighthouse',
      testMatch: /lighthouse\.spec\.ts/,
      dependencies: ['chromium'],
      fullyParallel: false,
      retries: 0,
    },
  ],
  // The API starts first, so the web app (which calls it over HTTP) never sees it missing.
  webServer: [
    {
      command: `pnpm --filter @pusatk3/api exec wrangler dev --ip 127.0.0.1 --port 8787 --var APP_VERSION:${E2E_APP_VERSION}`,
      url: `${API_URL}/api/v1/health`,
      ...server,
    },
    {
      // Port 4322, so it never collides with `astro dev` on 4321. Waits until the API answers.
      command: `node e2e/wait-for.mjs ${API_URL}/api/v1/health && pnpm --filter @pusatk3/web exec wrangler dev -c dist/server/wrangler.json --ip 127.0.0.1 --port 4322`,
      url: WEB_URL,
      ...server,
    },
  ],
});
