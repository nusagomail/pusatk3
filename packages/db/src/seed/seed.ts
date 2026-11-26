import { inArray, not } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { appMeta, cities, courseCategories, courseFields, DATA_VERSION_KEY } from '../schema';
import type { CategoriesSeed } from './categories-csv';
import type { CitySeed } from './cities';

export interface ReferenceData extends CategoriesSeed {
  cities: readonly CitySeed[];
}

/** Slugs present in the database but missing from the seed data (never deleted automatically). */
export interface SeedReport {
  orphans: { fields: string[]; categories: string[]; cities: string[] };
}

type Db = DrizzleD1Database<Record<string, unknown>>;

/**
 * Upserts reference data by slug, one statement per row, each stage in one D1 batch
 * (transaction). Idempotent: ids and created_at are kept, other values updated. Rows missing
 * from `data` are reported, not removed (removing reference data needs owner approval).
 * Note: a remote D1 batch is limited to 50 queries on the Free plan; this is used locally.
 */
export async function seedReferenceData(db: Db, data: ReferenceData): Promise<SeedReport> {
  // Validate references before writing anything.
  const knownFields = new Set(data.fields.map((f) => f.slug));
  for (const category of data.categories) {
    if (!knownFields.has(category.fieldSlug)) {
      throw new Error(
        `Seed: category "${category.slug}" refers to unknown field "${category.fieldSlug}"`,
      );
    }
  }

  const now = new Date();
  const fieldAndCityStatements = [
    ...data.fields.map(({ slug, name, sortOrder }) =>
      db
        .insert(courseFields)
        .values({ slug, name, sortOrder })
        .onConflictDoUpdate({
          target: courseFields.slug,
          set: { name, sortOrder, updatedAt: now },
        }),
    ),
    ...data.cities.map(({ slug, name, province }) =>
      db
        .insert(cities)
        .values({ slug, name, province })
        .onConflictDoUpdate({ target: cities.slug, set: { name, province, updatedAt: now } }),
    ),
  ];
  const [firstFieldOrCity, ...otherFieldsAndCities] = fieldAndCityStatements;
  if (firstFieldOrCity) await db.batch([firstFieldOrCity, ...otherFieldsAndCities]);

  const fieldIds = new Map(
    (await db.select({ id: courseFields.id, slug: courseFields.slug }).from(courseFields)).map(
      (f) => [f.slug, f.id],
    ),
  );

  const categoryStatements = data.categories.map(({ fieldSlug, ...category }) => {
    const fieldId = fieldIds.get(fieldSlug);
    if (!fieldId) throw new Error(`Seed: field "${fieldSlug}" was not written`);
    const values = { ...category, fieldId };
    const { slug: _slug, ...changes } = values;
    return db
      .insert(courseCategories)
      .values(values)
      .onConflictDoUpdate({ target: courseCategories.slug, set: { ...changes, updatedAt: now } });
  });
  const [firstCategory, ...otherCategories] = categoryStatements;
  if (firstCategory) await db.batch([firstCategory, ...otherCategories]);

  // Cached pages and API responses keyed on the old version go stale (ADR 0021).
  const version = crypto.randomUUID();
  await db
    .insert(appMeta)
    .values({ key: DATA_VERSION_KEY, value: version, updatedAt: now })
    .onConflictDoUpdate({ target: appMeta.key, set: { value: version, updatedAt: now } });

  const orphanSlugs = async (
    table: typeof courseFields | typeof courseCategories | typeof cities,
    slugs: string[],
  ) =>
    (
      await db
        .select({ slug: table.slug })
        .from(table)
        .where(slugs.length > 0 ? not(inArray(table.slug, slugs)) : undefined)
    ).map((r) => r.slug);

  return {
    orphans: {
      fields: await orphanSlugs(
        courseFields,
        data.fields.map((f) => f.slug),
      ),
      categories: await orphanSlugs(
        courseCategories,
        data.categories.map((c) => c.slug),
      ),
      cities: await orphanSlugs(
        cities,
        data.cities.map((c) => c.slug),
      ),
    },
  };
}
