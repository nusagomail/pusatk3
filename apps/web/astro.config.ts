import { defineConfig } from 'astro/config';

// Minimal static setup (#6). Cloudflare adapter, SSR and cache headers come in #5.
export default defineConfig({
  site: 'https://pusatk3.id',
  trailingSlash: 'never',
});
