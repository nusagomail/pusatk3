import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Small key/value store for application state (ADR 0021). `data_version` changes whenever public
 * directory data changes (import, later provider edits); edge caches key on it, so a new value
 * makes every cached page and API response stale at once without a purge API.
 */
export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const DATA_VERSION_KEY = 'data_version';
