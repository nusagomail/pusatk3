import { defineConfig, devices } from '@playwright/test';
import { API_URL, WEB_URL } from './e2e/urls';

// Browser tests against the built web app and the local API (docs/adr/0013-e2e-playwright.md).
// Both run in workerd like on Cloudflare, with local bindings only. Run with `pnpm test:e2e`,
// which builds the web app first.

// Always start fresh servers: a leftover `pnpm dev` or older build on these ports fails the run
// loudly instead of being tested by mistake. Wrangler telemetry off (local tests only).
const server = {
  reuseExistingServer: false,
  timeout: 60_000,
  env: { WRANGLER_SEND_METRICS: 'false' },
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
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Port 4322, so it never collides with `astro dev` on 4321.
      command:
        'pnpm --filter @pusatk3/web exec wrangler dev -c dist/client/wrangler.json --ip 127.0.0.1 --port 4322',
      url: WEB_URL,
      ...server,
    },
    {
      command: 'pnpm --filter @pusatk3/api exec wrangler dev --ip 127.0.0.1 --port 8787',
      url: `${API_URL}/api/v1/health`,
      ...server,
    },
  ],
});
