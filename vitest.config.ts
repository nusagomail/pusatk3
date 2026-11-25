import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'root',
          include: ['tests/**/*.test.ts'],
        },
      },
      // Each app/package with its own Vitest config joins automatically.
      'apps/*/vitest.config.ts',
      'packages/*/vitest.config.ts',
    ],
  },
});
