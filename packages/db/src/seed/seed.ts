import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { cities, courseCategories, courseFields } from '../schema';
import type { CategoriesSeed } from './categories-csv';
import type { CitySeed } from './cities';

export interface ReferenceData extends CategoriesSeed {
  cities: readonly CitySeed[];
}

type Db = DrizzleD1Database<Record<string, unknown>>;

/**
 * Upserts reference data by slug, one statement per row, each stage in one D1 batch
 * (transaction). Idempotent: ids and created_at are kept, other values updated. Rows missing
 * from `data` are left alone (removing reference data needs owner approval).
 */
export async function seedReferenceData(db: Db, data: ReferenceData): Promise<void> {
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
    if (!fieldId) {
      throw new Error(`Seed: category "${category.slug}" refers to unknown field "${fieldSlug}"`);
    }
    const values = { ...category, fieldId };
    const { slug: _slug, ...changes } = values;
    return db
      .insert(courseCategories)
      .values(values)
      .onConflictDoUpdate({ target: courseCategories.slug, set: { ...changes, updatedAt: now } });
  });
  const [firstCategory, ...otherCategories] = categoryStatements;
  if (firstCategory) await db.batch([firstCategory, ...otherCategories]);
}
