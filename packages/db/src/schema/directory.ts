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
  foreignKey,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import { cities, courseCategories } from './catalog';
import { baseColumns } from './columns';

// Directory tables (Fase 1), see docs/skema-db.md. Enum columns are guarded by CHECK
// constraints built from the shared constants, so the database refuses unknown values too.

/** CHECK (column IN (...)); values come from our own constants, never from input. */
function oneOf(column: AnySQLiteColumn, values: readonly string[]): SQL {
  for (const value of values) {
    if (!/^[a-z0-9_]+$/.test(value)) throw new Error(`unsafe enum value in CHECK: ${value}`);
  }
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
    /** Sample data (staging/local only): always labelled "Contoh" in the UI (owner decision, #22). */
    isSample: integer('is_sample', { mode: 'boolean' }).notNull().default(false),
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
    // Lets schedules reference (branch, provider) so a branch of another provider is refused.
    uniqueIndex('branches_id_provider_id_unique').on(t.id, t.providerId),
    // Natural key for imports: branch names are unique per provider.
    uniqueIndex('branches_provider_id_name_unique').on(t.providerId, t.name),
    index('branches_city_id_idx').on(t.cityId),
    check('branches_is_main_check', sql`${t.isMain} IN (0, 1)`),
    check(
      'branches_coordinates_check',
      sql`(${t.lat} IS NULL AND ${t.lng} IS NULL) OR (typeof(${t.lat}) = 'real' AND typeof(${t.lng}) = 'real' AND ${t.lat} BETWEEN -90 AND 90 AND ${t.lng} BETWEEN -180 AND 180)`,
    ),
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
    // Natural key for imports and re-verification: one license number per kind per provider.
    uniqueIndex('provider_licenses_provider_kind_number_unique').on(t.providerId, t.kind, t.number),
  ],
);

export const schedules = sqliteTable(
  'schedules',
  {
    ...baseColumns,
    providerId: text('provider_id')
      .notNull()
      .references(() => providers.id),
    /** Required for offline, null for online; must belong to the same provider (FK below). */
    branchId: text('branch_id'),
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
    check(
      'schedules_branch_check',
      sql`(${t.mode} = 'offline' AND ${t.branchId} IS NOT NULL) OR (${t.mode} = 'online' AND ${t.branchId} IS NULL)`,
    ),
    check(
      'schedules_price_check',
      sql`${t.priceIdr} IS NULL OR (typeof(${t.priceIdr}) = 'integer' AND ${t.priceIdr} >= 0)`,
    ),
    check(
      'schedules_quota_check',
      sql`${t.quota} IS NULL OR (typeof(${t.quota}) = 'integer' AND ${t.quota} >= 1)`,
    ),
    foreignKey({
      name: 'schedules_branch_same_provider_fk',
      columns: [t.branchId, t.providerId],
      foreignColumns: [branches.id, branches.providerId],
    }),
    // Public listings: published schedules by date; provider and category pages.
    index('schedules_status_start_date_idx').on(t.status, t.startDate),
    // Natural key for imports: one schedule per provider, category, start date and title.
    uniqueIndex('schedules_natural_key_unique').on(
      t.providerId,
      t.categoryId,
      t.startDate,
      t.title,
    ),
    index('schedules_provider_id_idx').on(t.providerId),
    index('schedules_category_id_idx').on(t.categoryId),
    index('schedules_branch_id_idx').on(t.branchId),
  ],
);
