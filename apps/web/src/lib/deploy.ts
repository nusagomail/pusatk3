import { absoluteUrl } from '../data/site';

/**
 * Only a build with CLOUDFLARE_ENV "production" may be indexed by search engines. Anything else
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

const NOINDEX_LINE = '  X-Robots-Tag: noindex, nofollow\n';

/**
 * Adds `X-Robots-Tag: noindex, nofollow` for every path to a Cloudflare `_headers` file
 * (idempotent). The line goes INTO the existing `/*` block: Cloudflare does not merge two `/*`
 * blocks, so a second one would drop the security headers of the first.
 */
export function withNoindexHeaders(headers: string): string {
  const lines = headers.split('\n');
  const start = lines.findIndex((line) => line === '/*');
  if (start === -1) {
    return `${headers.endsWith('\n') ? headers : `${headers}\n`}\n/*\n${NOINDEX_LINE}`;
  }
  let end = start + 1;
  while (end < lines.length && /^\s+\S/.test(lines[end] ?? '')) end++;
  if (lines.slice(start + 1, end).some((line) => line.trim() === NOINDEX_LINE.trim())) {
    return headers;
  }
  lines.splice(end, 0, NOINDEX_LINE.trimEnd());
  return lines.join('\n');
}
