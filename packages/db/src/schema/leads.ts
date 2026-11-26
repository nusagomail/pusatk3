import { LEAD_CHANNEL_VALUES, LEAD_STATUS_VALUES } from '@pusatk3/shared';
import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { baseColumns } from './columns';
import { isoDate, oneOf, providers, schedules } from './directory';

// Leads and view counts (Fase 1, #28), see docs/skema-db.md and ADR 0022.
// Personal data (UU PDP): only form leads carry it (name, phone/email, message), with the time
// of consent. WhatsApp clicks carry none. Personal fields are cleared 12 months after
// `created_at` (retention, ADR 0022); the counts stay.

export const leads = sqliteTable(
  'leads',
  {
    ...baseColumns,
    providerId: text('provider_id')
      .notNull()
      .references(() => providers.id),
    /** Schedule the visitor asked about; null for a click from the provider profile. */
    scheduleId: text('schedule_id').references(() => schedules.id),
    /** Account of the visitor (Fase 2); always null for now. */
    userId: text('user_id'),
    channel: text('channel', { enum: LEAD_CHANNEL_VALUES }).notNull(),
    name: text('name'),
    /** Normalised "62…" Indonesian number. */
    phone: text('phone'),
    email: text('email'),
    message: text('message'),
    /** When the visitor agreed to share the data with the provider (form only). */
    consentAt: integer('consent_at', { mode: 'timestamp_ms' }),
    /** When personal fields were cleared by the retention rule. */
    anonymizedAt: integer('anonymized_at', { mode: 'timestamp_ms' }),
    status: text('status', { enum: LEAD_STATUS_VALUES }).notNull().default('new'),
  },
  (t) => [
    index('leads_provider_created_idx').on(t.providerId, t.createdAt),
    index('leads_schedule_id_idx').on(t.scheduleId),
    index('leads_created_at_idx').on(t.createdAt),
    check('leads_channel_check', oneOf(t.channel, LEAD_CHANNEL_VALUES)),
    check('leads_status_check', oneOf(t.status, LEAD_STATUS_VALUES)),
    // A WhatsApp click never carries personal data; a form lead has consent and a contact
    // (unless it was anonymized).
    check(
      'leads_personal_data_check',
      sql`(${t.channel} = 'whatsapp' AND ${t.name} IS NULL AND ${t.phone} IS NULL AND ${t.email} IS NULL AND ${t.message} IS NULL AND ${t.consentAt} IS NULL)
        OR (${t.channel} = 'form' AND (${t.anonymizedAt} IS NOT NULL OR (${t.consentAt} IS NOT NULL AND ${t.name} IS NOT NULL AND ${t.message} IS NOT NULL AND (${t.phone} IS NOT NULL OR ${t.email} IS NOT NULL))))`,
    ),
  ],
);

/** Daily view counts per provider (and schedule); no visitor data. Filled in Fase 2. */
export const profileViews = sqliteTable(
  'profile_views',
  {
    ...baseColumns,
    providerId: text('provider_id')
      .notNull()
      .references(() => providers.id),
    /** Empty string for profile views (NULL would break the unique key in SQLite). */
    scheduleId: text('schedule_id').notNull().default(''),
    /** Jakarta date "YYYY-MM-DD". */
    day: text('day').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [
    uniqueIndex('profile_views_key_unique').on(t.providerId, t.scheduleId, t.day),
    check('profile_views_day_check', isoDate(t.day)),
    check('profile_views_count_check', sql`${t.count} >= 0`),
  ],
);
