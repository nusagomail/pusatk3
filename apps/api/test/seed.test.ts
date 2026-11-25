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

  it('reports rows in the DB that are no longer in the data (never deletes them)', async () => {
    const db = drizzle(env.DB);
    await seedReferenceData(db, data);
    const report = await seedReferenceData(db, {
      ...data,
      categories: data.categories.filter((c) => c.slug !== 'juru-ikat'),
    });
    expect(report.orphans.categories).toEqual(['juru-ikat']);
    expect((await db.select().from(courseCategories)).length).toBe(59);
  });

  it('rejects a category whose field is missing before writing anything', async () => {
    const db = drizzle(env.DB);
    await env.DB.prepare('DELETE FROM course_categories').run();
    await env.DB.prepare('DELETE FROM course_fields').run();
    await env.DB.prepare('DELETE FROM cities').run();
    const bad = {
      ...data,
      categories: data.categories.slice(0, 1).map((c) => ({ ...c, fieldSlug: 'tidak-ada' })),
    };
    await expect(seedReferenceData(db, bad)).rejects.toThrow(/tidak-ada/);
    expect(await counts(db)).toEqual({ fields: 0, categories: 0, cities: 0 });
  });
});
