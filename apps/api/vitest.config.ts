import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineProject } from 'vitest/config';

// Tests run inside the Workers runtime (workerd), same as production.
export default defineProject({
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })],
  test: {
    name: 'api',
    include: ['test/**/*.test.ts'],
  },
});
