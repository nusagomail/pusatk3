import { getViteConfig } from 'astro/config';

// Astro-aware Vite config so tests can render components with the Container API.
export default getViteConfig({
  test: {
    name: 'web',
    include: ['test/**/*.test.ts'],
  },
});
