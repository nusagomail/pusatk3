import { z } from 'zod';

// Cursor pagination: request `?cursor=…&limit=…`, response `{ items, nextCursor }`.

export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;

export const paginationQuerySchema = z.strictObject({
  cursor: z.string().min(1).optional(),
  // Query-string values arrive as strings; coerce, then bound.
  limit: z.coerce.number().int().min(1).max(PAGINATION_MAX_LIMIT).default(PAGINATION_DEFAULT_LIMIT),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Response schema for one page of `item`. `nextCursor` is null on the last page. */
export function paginatedSchema<T extends z.ZodType>(item: T) {
  return z.strictObject({
    items: z.array(item),
    nextCursor: z.string().min(1).nullable(),
  });
}
