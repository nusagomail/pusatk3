import type { Issuer } from '@pusatk3/shared';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { baseColumns } from './columns';

export const cities = sqliteTable('cities', {
  ...baseColumns,
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  province: text('province').notNull(),
});

/** Bidang K3 (14), see docs/kategori-k3.md. */
export const courseFields = sqliteTable('course_fields', {
  ...baseColumns,
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull(),
});

/** Kategori sertifikasi (59), seeded from docs/data/kategori-k3.csv. */
export const courseCategories = sqliteTable('course_categories', {
  ...baseColumns,
  fieldId: text('field_id')
    .notNull()
    .references(() => courseFields.id),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  /** JSON array of issuer codes (`issuerSchema`). */
  issuers: text('issuers', { mode: 'json' }).$type<Issuer[]>().notNull(),
  documentType: text('document_type').notNull(),
  /** Typical validity for reminders; null when it depends on the scheme. */
  typicalValidityYears: integer('typical_validity_years'),
  regulationRef: text('regulation_ref').notNull(),
  /** JSON array of search synonyms (filled in Fase 1). */
  synonyms: text('synonyms', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .$defaultFn(() => []),
});
