import { env } from 'cloudflare:workers';

// Public Turnstile site key of this deployment (wrangler var TURNSTILE_SITE, ADR 0022). Local:
// Cloudflare's public "always passes" test key. Staging/production: the owner's widget; empty
// until set, and then the question form is simply not shown.

/** Site keys look like "0x4AAAAAAA…" (real) or "1x000…AA" (test). */
const SITE_KEY = /^[0-9]x[0-9A-Za-z_-]{10,60}$/;
export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

export function turnstileSiteKey(): string | null {
  const value = (env as Record<string, unknown>).TURNSTILE_SITE;
  return typeof value === 'string' && SITE_KEY.test(value) ? value : null;
}

/** The part of Astro's CSP API used here (absent where CSP is off, e.g. some tests). */
export interface CspControl {
  insertScriptResource(resource: string): void;
  insertDirective(directive: string): void;
}

/**
 * Lets the Turnstile widget load on this page only. Adding a script resource replaces Astro's
 * default 'self', so it is added back explicitly (bundled /_astro scripts keep working).
 */
export function allowTurnstile(csp: CspControl | undefined): void {
  csp?.insertScriptResource("'self'");
  csp?.insertScriptResource(TURNSTILE_ORIGIN);
  csp?.insertDirective(`frame-src ${TURNSTILE_ORIGIN}`);
}
