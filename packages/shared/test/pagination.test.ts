import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_MAX_LIMIT,
  paginatedSchema,
  paginationQuerySchema,
} from '../src/index';

describe('paginationQuerySchema', () => {
  it('defaults limit to 20 and leaves cursor out', () => {
    expect(PAGINATION_DEFAULT_LIMIT).toBe(20);
    expect(paginationQuerySchema.parse({})).toEqual({ limit: 20 });
  });

  it('coerces query-string limits and keeps the cursor', () => {
    expect(paginationQuerySchema.parse({ cursor: 'abc', limit: '50' })).toEqual({
      cursor: 'abc',
      limit: 50,
    });
    expect(paginationQuerySchema.parse({ limit: '100' }).limit).toBe(PAGINATION_MAX_LIMIT);
  });

  it.each(['0', '101', '-1', '1.5', 'abc', '', ' '])('rejects limit %j', (limit) => {
    expect(paginationQuerySchema.safeParse({ limit }).success).toBe(false);
  });

  it('rejects an empty cursor', () => {
    expect(paginationQuerySchema.safeParse({ cursor: '' }).success).toBe(false);
  });

  it('rejects unknown query keys', () => {
    expect(paginationQuerySchema.safeParse({ page: '2' }).success).toBe(false);
  });
});

describe('paginatedSchema', () => {
  const schema = paginatedSchema(z.strictObject({ id: z.string() }));

  it('accepts items with a next cursor or null', () => {
    expect(schema.parse({ items: [{ id: 'a' }], nextCursor: 'b' }).nextCursor).toBe('b');
    expect(schema.parse({ items: [], nextCursor: null }).nextCursor).toBeNull();
  });

  it('requires nextCursor to be present', () => {
    expect(schema.safeParse({ items: [] }).success).toBe(false);
  });

  it('validates each item and rejects unknown keys', () => {
    expect(schema.safeParse({ items: [{ id: 1 }], nextCursor: null }).success).toBe(false);
    expect(schema.safeParse({ items: [], nextCursor: null, total: 3 }).success).toBe(false);
  });
});
