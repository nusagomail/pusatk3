import { createHash } from 'node:crypto';
import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';
import type { AstroIntegration } from 'astro';
import { mediaOrigin } from './src/lib/media';
import { THEME_INIT_SCRIPT } from './src/lib/theme';

/** Internal component showcase: only routed in `astro dev`, never in a build. */
const devOnlyPages: AstroIntegration = {
  name: 'pusatk3:dev-only-pages',
  hooks: {
    'astro:config:setup': ({ command, injectRoute }) => {
      if (command === 'dev') {
        injectRoute({ pattern: '/internal/komponen', entrypoint: './src/dev/komponen.astro' });
      }
    },
  },
};

// Intro video bucket URL: one source (the build environment, e.g. CI) for both the page and
// the CSP, so they can never disagree. A .env file is deliberately not used for this value.
const mediaBaseUrl = process.env.PUBLIC_MEDIA_BASE_URL ?? '';
const videoOrigin = mediaOrigin(mediaBaseUrl);

// Astro hashes bundled scripts, but not the hand-inlined theme script in <head>.
const themeScriptHash =
  `sha256-${createHash('sha256').update(THEME_INIT_SCRIPT).digest('base64')}` as const;

// Pages are prerendered (static, served from the CDN) unless they opt out with
// `export const prerender = false` (SSR on Workers). See ADR 0010.
export default defineConfig({
  site: 'https://pusatk3.id',
  trailingSlash: 'never',
  // No sessions yet (auth is Fase 2): avoids an auto-provisioned KV namespace.
  session: false,
  // Content-Security-Policy <meta> with hashes of every inline/bundled script and style.
  // frame-ancestors cannot be set in <meta>; it is sent as a header (public/_headers).
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self'",
        "font-src 'self'",
        `media-src 'self'${videoOrigin ? ` ${videoOrigin}` : ''}`,
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: { hashes: [themeScriptHash] },
    },
  },
  integrations: [devOnlyPages],
  // Never inline assets as data: URIs (small font files would be blocked by the CSP).
  vite: {
    build: { assetsInlineLimit: 0 },
    define: { 'import.meta.env.PUBLIC_MEDIA_BASE_URL': JSON.stringify(mediaBaseUrl) },
  },
  adapter: cloudflare({
    // Local bindings only; never proxy to remote resources during dev/build.
    remoteBindings: false,
    // No image transforms yet: avoids an IMAGES binding.
    imageService: 'passthrough',
  }),
});
