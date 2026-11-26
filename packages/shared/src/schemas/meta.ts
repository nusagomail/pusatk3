import { z } from 'zod';

/**
 * GET /api/v1/meta/data-version: opaque version of the public directory data (ADR 0021). Caches
 * (API and web) put it in their keys, so a change makes every cached copy stale at once.
 */
/** No parameters are accepted. */
export const dataVersionQuerySchema = z.strictObject({});

export const dataVersionResponseSchema = z.strictObject({
  version: z.string().min(1).max(64),
});
export type DataVersionResponse = z.infer<typeof dataVersionResponseSchema>;
