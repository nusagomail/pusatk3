import type { APIRoute } from 'astro';
import { isProductionDeploy, robotsTxt } from '../lib/deploy';

// Production allows crawling; staging/local builds block it (ADR 0011). Policy for AI crawlers
// (GEO) is decided in Fase 3.
export const GET: APIRoute = () =>
  new Response(robotsTxt(isProductionDeploy(import.meta.env.DEPLOY_ENV)), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
