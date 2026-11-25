import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { resolve } from 'node:path';
import { defineProject } from 'vitest/config';

// Absolute paths: the config also runs from the repo root (`pnpm test`).
const here = import.meta.dirname;

// Tests run inside the Workers runtime (workerd), same as production, with a fresh
// local D1 that has every migration from packages/db applied (test/setup.ts).
export default defineProject({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: resolve(here, 'wrangler.jsonc') },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(resolve(here, '../../packages/db/migrations')),
        },
      },
    })),
  ],
  test: {
    name: 'api',
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
  },
});
