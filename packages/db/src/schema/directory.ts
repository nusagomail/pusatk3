import {
  CERTIFICATE_KIND_VALUES,
  ISSUER_VALUES,
  LICENSE_KIND_VALUES,
  PLAN_CODE_VALUES,
  PROVIDER_STATUS_VALUES,
  PROVIDER_TYPE_VALUES,
  SCHEDULE_MODE_VALUES,
  SCHEDULE_STATUS_VALUES,
  VERIFICATION_STATUS_VALUES,
} from '@pusatk3/shared';
import { sql, type SQL } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import { cities, courseCategories } from './catalog';
import { baseColumns } from './columns';

// Directory tables (Fase 1), see docs/skema-db.md. Enum columns are guarded by CHECK
// constraints built from the shared constants, so the database refuses unknown values too.

/** CHECK (column IN (...)); values come from our own constants, never from input. */
function oneOf(column: AnySQLiteColumn, values: readonly string[]): SQL {
  return sql`${column} IN (${sql.raw(values.map((v) => `'${v}'`).join(', '))})`;
}

/** "YYYY-MM-DD" shape (real-date validation happens in the Zod schema). */
function isoDate(column: AnySQLiteColumn): SQL {
  return sql`${column} GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'`;
}

export const providers = sqliteTable(
  'providers',
  {
    ...baseColumns,
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    type: text('type', { enum: PROVIDER_TYPE_VALUES }).notNull(),
    description: text('description'),
    /** R2 object key of the logo (never a URL from input). */
    logoKey: text('logo_key'),
    /** Normalised "62…" (whatsappNumberSchema). Changing it triggers re-verification (Fase 2). */
    whatsapp: text('whatsapp'),
    email: text('email'),
    phone: text('phone'),
    website: text('website'),
    status: text('status', { enum: PROVIDER_STATUS_VALUES }).notNull().default('unclaimed'),
    verificationStatus: text('verification_status', { enum: VERIFICATION_STATUS_VALUES })
      .notNull()
      .default('none'),
    verifiedAt: integer('verified_at', { mode: 'timestamp_ms' }),
    /** Subscription plan; never affects the verification badge or organic ranking. */
    plan: text('plan', { enum: PLAN_CODE_VALUES }).notNull().default('free'),
  },
  (t) => [
    check('providers_type_check', oneOf(t.type, PROVIDER_TYPE_VALUES)),
    check('providers_status_check', oneOf(t.status, PROVIDER_STATUS_VALUES)),
    check(
      'providers_verification_status_check',
      oneOf(t.verificationStatus, VERIFICATION_STATUS_VALUES),
    ),
    check('providers_plan_check', oneOf(t.plan, PLAN_CODE_VALUES)),
  ],
);

export const branches = sqliteTable(
  'branches',
  {
    ...baseColumns,
    providerId: text('provider_id')
      .notNull()
      .references(() => providers.id),
    name: text('name').notNull(),
    cityId: text('city_id')
      .notNull()
      .references(() => cities.id),
    address: text('address').notNull(),
    lat: real('lat'),
    lng: real('lng'),
    isMain: integer('is_main', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [
    index('branches_provider_id_idx').on(t.providerId),
    index('branches_city_id_idx').on(t.cityId),
  ],
);

export const providerLicenses = sqliteTable(
  'provider_licenses',
  {
    ...baseColumns,
    providerId: text('provider_id')
      .notNull()
      .references(() => providers.id),
    kind: text('kind', { enum: LICENSE_KIND_VALUES }).notNull(),
    number: text('number').notNull(),
    /** Free text: "Kemnaker RI", "BNSP", or the LSP name for a TUK. */
    issuer: text('issuer').notNull(),
    /** R2 object key of the license document (private bucket). */
    documentKey: text('document_key'),
    /** "YYYY-MM-DD"; null when the license has no expiry. */
    validUntil: text('valid_until'),
  },
  (t) => [
    check('provider_licenses_kind_check', oneOf(t.kind, LICENSE_KIND_VALUES)),
    check(
      'provider_licenses_valid_until_check',
      sql`${t.validUntil} IS NULL OR ${isoDate(t.validUntil)}`,
    ),
    index('provider_licenses_provider_id_idx').on(t.providerId),
  ],
);

export const schedules = sqliteTable(
  'schedules',
  {
    ...baseColumns,
    providerId: text('provider_id')
      .notNull()
      .references(() => providers.id),
    /** Null for online schedules. */
    branchId: text('branch_id').references(() => branches.id),
    categoryId: text('category_id')
      .notNull()
      .references(() => courseCategories.id),
    title: text('title').notNull(),
    issuer: text('issuer', { enum: ISSUER_VALUES }).notNull(),
    mode: text('mode', { enum: SCHEDULE_MODE_VALUES }).notNull(),
    /** Calendar dates "YYYY-MM-DD" (Asia/Jakarta days, no time zone). */
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    priceIdr: integer('price_idr'),
    quota: integer('quota'),
    description: text('description'),
    requirements: text('requirements'),
    /** e.g. "Kelas I", "Madya". */
    level: text('level'),
    certificateKind: text('certificate_kind', { enum: CERTIFICATE_KIND_VALUES }).notNull(),
    status: text('status', { enum: SCHEDULE_STATUS_VALUES }).notNull().default('draft'),
  },
  (t) => [
    check('schedules_issuer_check', oneOf(t.issuer, ISSUER_VALUES)),
    check('schedules_mode_check', oneOf(t.mode, SCHEDULE_MODE_VALUES)),
    check('schedules_status_check', oneOf(t.status, SCHEDULE_STATUS_VALUES)),
    check('schedules_certificate_kind_check', oneOf(t.certificateKind, CERTIFICATE_KIND_VALUES)),
    check(
      'schedules_dates_check',
      sql`${isoDate(t.startDate)} AND ${isoDate(t.endDate)} AND ${t.endDate} >= ${t.startDate}`,
    ),
    check('schedules_price_check', sql`${t.priceIdr} IS NULL OR ${t.priceIdr} >= 0`),
    check('schedules_quota_check', sql`${t.quota} IS NULL OR ${t.quota} >= 1`),
    // Public listings: published schedules by date; provider and category pages.
    index('schedules_status_start_date_idx').on(t.status, t.startDate),
    index('schedules_provider_id_idx').on(t.providerId),
    index('schedules_category_id_idx').on(t.categoryId),
    index('schedules_branch_id_idx').on(t.branchId),
  ],
);
