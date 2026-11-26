import { defineMiddleware } from 'astro:middleware';
import { dataVersionResponseSchema } from '@pusatk3/shared';
import { apiGet } from './lib/api';
import { isProductionDeploy } from './lib/deploy';
import { memoizedVersion, withPageCache } from './lib/page-cache';

// Headers for pages rendered on demand (SSR). `public/_headers` only applies to static assets,
// so SSR responses get the same security headers here (ADR 0010), plus noindex outside
// production (ADR 0011). Prerendered pages are untouched (their headers come from _headers).

const PRODUCTION = isProductionDeploy(import.meta.env.CLOUDFLARE_ENV);

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

/** Public directory pages: browsers revalidate, the CDN may keep them briefly (ADR 0019). */
export const SSR_PAGE_CACHE =
  'public, max-age=0, must-revalidate, s-maxage=300, stale-while-revalidate=600';

/** Data version from the API for the page cache keys (ADR 0021); null when unavailable. */
const dataVersion = memoizedVersion(async () => {
  const result = await apiGet('/meta/data-version', dataVersionResponseSchema);
  return result.ok ? result.data.version : null;
});

/** Changes with every build, so a deploy never serves pages that point at old assets. */
const BUILD_ID: string = __PUSATK3_BUILD_ID__;

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) return next();
  // Deployed: Cache API (edge); no-op on *.workers.dev, absent in unit tests.
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  return withPageCache(context.request, { cache, dataVersion, buildId: BUILD_ID }, async () =>
    withSsrHeaders(await next()),
  );
});

/** Security, robots and cache headers of an SSR page. */
function withSsrHeaders(response: Response): Response {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!response.headers.has(name)) response.headers.set(name, value);
  }
  // frame-ancestors cannot be set in the CSP <meta>; send it as a header.
  const csp = response.headers.get('Content-Security-Policy');
  if (!csp?.includes('frame-ancestors')) {
    response.headers.set(
      'Content-Security-Policy',
      csp ? `${csp.replace(/;\s*$/, '')}; frame-ancestors 'none'` : "frame-ancestors 'none'",
    );
  }
  if (!PRODUCTION) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (!response.headers.has('Cache-Control')) {
    response.headers.set('Cache-Control', response.ok ? SSR_PAGE_CACHE : 'no-store');
  }
  return response;
}
