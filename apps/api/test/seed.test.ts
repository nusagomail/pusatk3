import {
  cities,
  courseCategories,
  courseFields,
  parseCategoriesCsv,
  SAMPLE_CITIES,
  seedReferenceData,
} from '@pusatk3/db';
import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { describe, expect, it } from 'vitest';
import csv from '../../../docs/data/kategori-k3.csv?raw';

const data = { ...parseCategoriesCsv(csv), cities: SAMPLE_CITIES };

const counts = async (db: ReturnType<typeof drizzle>) => ({
  fields: (await db.select().from(courseFields)).length,
  categories: (await db.select().from(courseCategories)).length,
  cities: (await db.select().from(cities)).length,
});

describe('seedReferenceData', () => {
  it('loads 14 fields, 59 categories and the sample cities', async () => {
    const db = drizzle(env.DB);
    await seedReferenceData(db, data);
    expect(await counts(db)).toEqual({ fields: 14, categories: 59, cities: 8 });
  });

  it('is idempotent and updates changed values without new ids', async () => {
    const db = drizzle(env.DB);
    await seedReferenceData(db, data);
    const [before] = await db
      .select()
      .from(courseCategories)
      .where(eq(courseCategories.slug, 'ahli-k3-umum'));

    const renamed = {
      ...data,
      categories: data.categories.map((c) =>
        c.slug === 'ahli-k3-umum' ? { ...c, name: 'AK3U (baru)' } : c,
      ),
    };
    await seedReferenceData(db, renamed);
    await seedReferenceData(db, renamed);

    expect(await counts(db)).toEqual({ fields: 14, categories: 59, cities: 8 });
    const [after] = await db
      .select()
      .from(courseCategories)
      .where(eq(courseCategories.slug, 'ahli-k3-umum'));
    expect(after?.name).toBe('AK3U (baru)');
    expect(after?.id).toBe(before?.id);
    expect(after?.createdAt).toEqual(before?.createdAt);
    expect(after?.issuers).toEqual(['kemnaker']);
  });

  it('links each category to its field', async () => {
    const db = drizzle(env.DB);
    await seedReferenceData(db, data);
    const rows = await db
      .select({ category: courseCategories.slug, field: courseFields.slug })
      .from(courseCategories)
      .innerJoin(courseFields, eq(courseCategories.fieldId, courseFields.id));
    expect(rows).toHaveLength(59);
    expect(rows.find((r) => r.category === 'juru-ikat')?.field).toBe('pesawat-angkat-angkut');
    expect(rows.find((r) => r.category === 'ahli-k3-umum')?.field).toBe('k3-umum');
  });

  it('rejects a category whose field is missing', async () => {
    const db = drizzle(env.DB);
    const bad = {
      ...data,
      categories: data.categories.slice(0, 1).map((c) => ({ ...c, fieldSlug: 'tidak-ada' })),
    };
    await expect(seedReferenceData(db, bad)).rejects.toThrow(/tidak-ada/);
  });
});
