import { dataVersionQuerySchema, dataVersionResponseSchema } from '@pusatk3/shared';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { readDataVersion } from '../lib/data-version';
import { getDb } from '../lib/db';
import { validateQuery } from '../lib/validate';

/**
 * GET /meta/data-version: public and harmless, an opaque id `<data version>.<API version>` that
 * changes with every import and every API deploy (or rollback). The web app puts it in its page
 * cache keys (ADR 0021). Never cached: it is what announces a change.
 */
export const metaRoutes = new Hono<AppEnv>().get(
  '/meta/data-version',
  validateQuery(dataVersionQuerySchema),
  async (c) => {
    const data = await readDataVersion(getDb(c.env));
    const body = dataVersionResponseSchema.parse({ version: `${data}.${c.env.APP_VERSION}` });
    c.header('Cache-Control', 'no-store');
    return c.json(body);
  },
);
