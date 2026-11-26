import { z } from 'zod';

/** GET /api/v1/meta/data-version accepts no parameters. */
export const dataVersionQuerySchema = z.strictObject({});

/**
 * Opaque version of the public data and of the API deploy (ADR 0021). The web page cache puts it
 * in its keys, so an import or an API deploy makes every cached page stale at once.
 */
export const dataVersionResponseSchema = z.strictObject({
  version: z.string().min(1).max(128),
});
export type DataVersionResponse = z.infer<typeof dataVersionResponseSchema>;
