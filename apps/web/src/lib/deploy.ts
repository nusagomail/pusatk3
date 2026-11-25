import { absoluteUrl } from '../data/site';

/**
 * Only an explicit DEPLOY_ENV=production build may be indexed by search engines. Anything else
 * (staging, local, unset) is noindex, so forgetting the variable can never expose staging.
 */
export function isProductionDeploy(value: string | undefined): boolean {
  return value === 'production';
}

export function robotsTxt(production: boolean): string {
  return production
    ? `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`
    : 'User-agent: *\nDisallow: /\n';
}

const NOINDEX_RULE = '/*\n  X-Robots-Tag: noindex, nofollow\n';

/** Appends a noindex rule for every path to a Cloudflare `_headers` file (idempotent). */
export function withNoindexHeaders(headers: string): string {
  if (headers.includes('X-Robots-Tag: noindex')) return headers;
  return `${headers.endsWith('\n') ? headers : `${headers}\n`}\n${NOINDEX_RULE}`;
}
