import { env } from 'cloudflare:workers';

// Public Turnstile site key of this deployment (wrangler var TURNSTILE_SITE, ADR 0022). Local:
// Cloudflare's public "always passes" test key. Staging/production: the owner's widget; empty
// until set, and then the question form is simply not shown.

/** Site keys look like "0x4AAAAAAA…" (real) or "1x000…AA" (test). */
const SITE_KEY = /^[0-9]x[0-9A-Za-z_-]{10,60}$/;

export function turnstileSiteKey(): string | null {
  const value = (env as Record<string, unknown>).TURNSTILE_SITE;
  return typeof value === 'string' && SITE_KEY.test(value) ? value : null;
}
