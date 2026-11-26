import { sitemapResponseSchema } from '@pusatk3/shared';
import type { APIRoute } from 'astro';
import { PUBLIC_PAGES, absoluteUrl } from '../data/site';
import { apiGet } from '../lib/api';
import { landingPath } from '../lib/landing-page';

// Dynamic sitemap (#27, ADR 0023): static public pages plus the published SEO pages, provider
// profiles and schedule details from the API. Never sample data (the API leaves it out). If the
// API is unavailable: 503 + Retry-After (crawlers keep the previous sitemap), never cached.
export const prerender = false;

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async () => {
  const result = await apiGet('/sitemap', sitemapResponseSchema);
  const paths = [
    ...PUBLIC_PAGES,
    ...(result.ok
      ? [
          ...result.data.landingPages.map((p) => landingPath(p.category, p.city)),
          ...result.data.providers.map((slug) => `/penyedia/${encodeURIComponent(slug)}`),
          ...result.data.schedules.map((id) => `/jadwal/${id}`),
        ]
      : []),
  ];
  const urls = paths
    .map((path) => `  <url><loc>${escapeXml(absoluteUrl(path))}</loc></url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, {
    status: result.ok ? 200 : 503,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      ...(result.ok ? {} : { 'Cache-Control': 'no-store', 'Retry-After': '120' }),
    },
  });
};
