import { and, eq, ne, sql, type SQL } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import {
  appMeta,
  branches,
  cities,
  courseCategories,
  courseFields,
  DATA_VERSION_KEY,
  providerLicenses,
  providers,
  schedules,
} from '../schema';
import type { ReferenceData } from '../seed/seed';
import type { DirectoryImport } from './directory-csv';

// Builds the import as plain SQL statements so the same script runs on local D1
// (`wrangler d1 execute --local --file`) and in the staging deploy pipeline (ADR 0015).
// Queries are built with Drizzle; values are inlined as escaped SQL literals.
// Every statement is an idempotent upsert keyed on a natural key. Nothing is ever deleted.

/** Query builder only: never connected to a database. */
const db = drizzle(async () => ({ rows: [] }));

/** SQL literal for one parameter (SQLite rules: '' escapes a quote). */
export function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof Date) return String(value.getTime());
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Import SQL: invalid number ${value}`);
    return String(value);
  }
  if (typeof value === 'string') {
    if (value.includes('\u0000')) throw new Error('Import SQL: NUL character in text');
    return `'${value.replace(/'/g, "''")}'`;
  }
  throw new Error(`Import SQL: unsupported value ${typeof value}`);
}

/** Replaces each `?` placeholder in order. Drizzle never puts `?` in identifiers or SQL text. */
export function inlineQuery({ sql: text, params }: { sql: string; params: unknown[] }): string {
  const parts = text.split('?');
  if (parts.length - 1 !== params.length) {
    throw new Error(`Import SQL: ${parts.length - 1} placeholders for ${params.length} values`);
  }
  return parts.reduce(
    (out, part, i) => out + (i === 0 ? '' : sqlLiteral(params[i - 1])) + part,
    '',
  );
}

const stmt = (query: { toSQL(): { sql: string; params: unknown[] } }) => inlineQuery(query.toSQL());

const now = () => new Date();

/**
 * New data version (ADR 0021): every edge-cached page and API response keyed on the old one goes
 * stale. Run it last, after the data it announces has been written.
 */
export function dataVersionStatement(version: string = crypto.randomUUID()): string {
  const at = now();
  return stmt(
    db
      .insert(appMeta)
      .values({ key: DATA_VERSION_KEY, value: version, updatedAt: at })
      .onConflictDoUpdate({ target: appMeta.key, set: { value: version, updatedAt: at } }),
  );
}

/** Reference data: 14 fields, 59 categories, cities (same values as `seedReferenceData`). */
export function referenceStatements(data: ReferenceData): string[] {
  const at = now();
  return [
    ...data.fields.map(({ slug, name, sortOrder }) =>
      stmt(
        db
          .insert(courseFields)
          .values({ slug, name, sortOrder })
          .onConflictDoUpdate({
            target: courseFields.slug,
            set: { name, sortOrder, updatedAt: at },
          }),
      ),
    ),
    ...data.cities.map(({ slug, name, province }) =>
      stmt(
        db
          .insert(cities)
          .values({ slug, name, province })
          .onConflictDoUpdate({ target: cities.slug, set: { name, province, updatedAt: at } }),
      ),
    ),
    ...data.categories.map(({ fieldSlug, slug, ...rest }) => {
      const fieldId = sql`(SELECT ${courseFields.id} FROM ${courseFields} WHERE ${courseFields.slug} = ${fieldSlug})`;
      return stmt(
        db
          .insert(courseCategories)
          .values({ slug, fieldId, ...rest })
          .onConflictDoUpdate({
            target: courseCategories.slug,
            set: { fieldId, ...rest, updatedAt: at },
          }),
      );
    }),
  ];
}

/**
 * Directory data (providers, branches, licenses, schedules) from a parsed import.
 * - Only providers that are still `unclaimed` and have the same sample flag are updated: a claimed
 *   provider manages its own data (WhatsApp changes go through OTP, docs/keamanan.md), and a
 *   sample import never touches real data or the other way round. Their branches, licenses and
 *   schedules then fail the import loudly (the provider id resolves to NULL).
 * - Rule 6: when a verified provider's WhatsApp number or license data changes, the provider goes
 *   back to `pending` verification. Status, verification and plan are never set by an import.
 * - Expired schedules are left alone (only the scheduled job sets and keeps `expired`).
 */
export function directoryStatements(
  data: DirectoryImport,
  options: { isSample: boolean },
): string[] {
  const at = now();
  const out: string[] = [];
  const reverify = { verificationStatus: 'pending' as const, updatedAt: at };
  /** Providers this import may change. */
  const importable = and(
    eq(providers.status, 'unclaimed'),
    eq(providers.isSample, options.isSample),
  );
  const verifiedImportable = and(eq(providers.verificationStatus, 'verified'), importable);
  /** Id of an importable provider, or NULL (→ NOT NULL error) for any other. */
  const ownerId = (slug: string): SQL =>
    sql`(SELECT ${providers.id} FROM ${providers} WHERE ${providers.slug} = ${slug} AND ${importable})`;

  for (const p of data.providers) {
    const fields = {
      name: p.name,
      type: p.type,
      description: p.description ?? null,
      whatsapp: p.whatsapp ?? null,
      email: p.email ?? null,
      phone: p.phone ?? null,
      website: p.website ?? null,
      isSample: options.isSample,
    };
    out.push(
      stmt(
        db
          .update(providers)
          .set(reverify)
          .where(
            and(
              eq(providers.slug, p.slug),
              verifiedImportable,
              sql`IFNULL(${providers.whatsapp}, '') <> ${p.whatsapp ?? ''}`,
            ),
          ),
      ),
      stmt(
        db
          .insert(providers)
          .values({ slug: p.slug, ...fields })
          .onConflictDoUpdate({
            target: providers.slug,
            set: { ...fields, updatedAt: at },
            setWhere: importable,
          }),
      ),
    );
  }

  for (const l of data.licenses) {
    const owner = ownerId(l.providerSlug);
    const validUntil = l.validUntil ?? null;
    out.push(
      stmt(
        db
          .update(providers)
          .set(reverify)
          .where(
            and(
              eq(providers.slug, l.providerSlug),
              verifiedImportable,
              sql`NOT EXISTS (SELECT 1 FROM ${providerLicenses} WHERE ${providerLicenses.providerId} = ${providers.id} AND ${providerLicenses.kind} = ${l.kind} AND ${providerLicenses.number} = ${l.number} AND ${providerLicenses.issuer} = ${l.issuer} AND IFNULL(${providerLicenses.validUntil}, '') = ${validUntil ?? ''})`,
            ),
          ),
      ),
      stmt(
        db
          .insert(providerLicenses)
          .values({
            providerId: owner,
            kind: l.kind,
            number: l.number,
            issuer: l.issuer,
            validUntil,
          })
          .onConflictDoUpdate({
            target: [providerLicenses.providerId, providerLicenses.kind, providerLicenses.number],
            set: { issuer: l.issuer, validUntil, updatedAt: at },
          }),
      ),
    );
  }

  for (const b of data.branches) {
    const fields = {
      cityId: sql`(SELECT ${cities.id} FROM ${cities} WHERE ${cities.slug} = ${b.citySlug})`,
      address: b.address,
      lat: b.lat ?? null,
      lng: b.lng ?? null,
      isMain: b.isMain,
    };
    out.push(
      stmt(
        db
          .insert(branches)
          .values({ providerId: ownerId(b.providerSlug), name: b.name, ...fields })
          .onConflictDoUpdate({
            target: [branches.providerId, branches.name],
            set: { ...fields, updatedAt: at },
          }),
      ),
    );
  }

  for (const s of data.schedules) {
    const owner = ownerId(s.providerSlug);
    const branchId =
      s.branchName === undefined
        ? null
        : sql`(SELECT ${branches.id} FROM ${branches} WHERE ${branches.providerId} = ${owner} AND ${branches.name} = ${s.branchName})`;
    const fields = {
      branchId,
      issuer: s.issuer,
      mode: s.mode,
      endDate: s.endDate,
      priceIdr: s.priceIdr ?? null,
      quota: s.quota ?? null,
      description: s.description ?? null,
      requirements: s.requirements ?? null,
      level: s.level ?? null,
      certificateKind: s.certificateKind,
      status: s.status,
    };
    const categoryId = sql`(SELECT ${courseCategories.id} FROM ${courseCategories} WHERE ${courseCategories.slug} = ${s.categorySlug})`;
    out.push(
      stmt(
        db
          .insert(schedules)
          .values({
            providerId: owner,
            categoryId,
            startDate: s.startDate,
            title: s.title,
            ...fields,
          })
          .onConflictDoUpdate({
            target: [
              schedules.providerId,
              schedules.categoryId,
              schedules.startDate,
              schedules.title,
            ],
            set: { ...fields, updatedAt: at },
            setWhere: ne(schedules.status, 'expired'),
          }),
      ),
    );
  }
  return out;
}

/** One SQL file for `wrangler d1 execute --file`. */
export function toSqlScript(statements: readonly string[]): string {
  return `${statements.map((s) => `${s};`).join('\n')}\n`;
}
