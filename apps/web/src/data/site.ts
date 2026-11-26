/** Canonical origin of the public site (also `site` in astro.config.ts). */
export const SITE_URL = 'https://pusatk3.id';

export const absoluteUrl = (path: string) => new URL(path, SITE_URL).toString();

/**
 * Static public, indexable pages (for sitemap.xml). Add each new static public page here; pages
 * built from data (SEO pages, profiles, schedules) come from GET /api/v1/sitemap (ADR 0023).
 */
export const PUBLIC_PAGES: readonly string[] = ['/'];
