import type { APIRoute } from 'astro';
import { absoluteUrl } from '../data/site';

// Policy for AI crawlers (GEO) is decided in Fase 3; until then everything public is allowed.
export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
