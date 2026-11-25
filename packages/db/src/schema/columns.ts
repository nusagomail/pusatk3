import { integer, text } from 'drizzle-orm/sqlite-core';
import { ulid } from 'ulid';

// Every table: ULID text id + created_at/updated_at as UTC epoch milliseconds (docs/skema-db.md).
export const baseColumns = {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => ulid()),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
};
