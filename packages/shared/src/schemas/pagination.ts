import { z } from 'zod';

// Cursor pagination: request `?cursor=…&limit=…`, response `{ items, nextCursor }`.

export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;
export const PAGINATION_CURSOR_MAX_LENGTH = 512;

// Only canonical decimal strings ("20", never "020", "2e1" or " 20 "), so each page
// size has exactly one URL and public pages stay cache-friendly.
const canonicalLimit = z
  .union([
    z.number(),
    z
      .string()
      .regex(/^[1-9]\d{0,2}$/)
      .transform(Number),
  ])
  .pipe(z.number().int().min(1).max(PAGINATION_MAX_LIMIT));

export const paginationQuerySchema = z.strictObject({
  cursor: z.string().min(1).max(PAGINATION_CURSOR_MAX_LENGTH).optional(),
  limit: canonicalLimit.default(PAGINATION_DEFAULT_LIMIT),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * Response schema for one page of `item`. `nextCursor` is null on the last page.
 * Unknown envelope keys are stripped, not rejected (see apiErrorSchema).
 */
export function paginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().min(1).nullable(),
  });
}
