/** Canonical origin of the public site (also `site` in astro.config.ts). */
export const SITE_URL = 'https://pusatk3.id';

export const absoluteUrl = (path: string) => new URL(path, SITE_URL).toString();

/** Public, indexable pages (for sitemap.xml). Add each new public page here. */
export const PUBLIC_PAGES: readonly string[] = ['/'];
