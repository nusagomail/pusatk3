import { dataVersionQuerySchema, dataVersionResponseSchema } from '@pusatk3/shared';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { readDataVersion } from '../lib/data-version';
import { getDb } from '../lib/db';
import { validateQuery } from '../lib/validate';

/**
 * GET /meta/data-version: public and harmless (an opaque id that changes with the data). The web
 * app puts it in its page cache keys (ADR 0021). Never cached: it is what announces a change.
 */
export const metaRoutes = new Hono<AppEnv>().get(
  '/meta/data-version',
  validateQuery(dataVersionQuerySchema),
  async (c) => {
    const body = dataVersionResponseSchema.parse({ version: await readDataVersion(getDb(c.env)) });
    c.header('Cache-Control', 'no-store');
    return c.json(body);
  },
);
