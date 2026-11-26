/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// Astro-aware Vite config so tests can render components with the Container API.
export default getViteConfig(
  {
    test: {
      name: 'web',
      include: ['test/**/*.test.ts'],
    },
    // Pages import the Workers runtime (`cloudflare:workers`); tests use a stub without bindings.
    resolve: {
      alias: { 'cloudflare:workers': `${import.meta.dirname}/test/stubs/cloudflare-workers.ts` },
    },
  },
  // Load apps/web/astro.config.ts even when Vitest runs from the repo root.
  { root: import.meta.dirname },
);
