import { courseCategories, courseFields } from '@pusatk3/db';
import { categoriesQuerySchema, categoriesResponseSchema } from '@pusatk3/shared';
import type { CategoriesResponse } from '@pusatk3/shared';
import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { PUBLIC_REFERENCE_CACHE } from '../lib/cache';
import { getDb } from '../lib/db';
import { validateQuery } from '../lib/validate';

// Public (no login). Edge-cached under the data version (ADR 0021): a seed or import refreshes it.
// Fields without categories are omitted (inner join).
const byName = new Intl.Collator('id');
export const categoriesRoutes = new Hono<AppEnv>().get(
  '/categories',
  validateQuery(categoriesQuerySchema),
  async (c) => {
    const rows = await getDb(c.env)
      .select({
        fieldSlug: courseFields.slug,
        fieldName: courseFields.name,
        slug: courseCategories.slug,
        name: courseCategories.name,
        issuers: courseCategories.issuers,
        documentType: courseCategories.documentType,
        typicalValidityYears: courseCategories.typicalValidityYears,
        regulationRef: courseCategories.regulationRef,
      })
      .from(courseFields)
      .innerJoin(courseCategories, eq(courseCategories.fieldId, courseFields.id))
      .orderBy(asc(courseFields.sortOrder), asc(courseFields.slug));

    const fields = new Map<string, CategoriesResponse['items'][number]>();
    for (const { fieldSlug, fieldName, ...category } of rows) {
      const field = fields.get(fieldSlug) ?? { slug: fieldSlug, name: fieldName, categories: [] };
      field.categories.push(category);
      fields.set(fieldSlug, field);
    }
    for (const field of fields.values()) {
      field.categories.sort((a, b) => byName.compare(a.name, b.name) || (a.slug < b.slug ? -1 : 1));
    }

    // Explicit output schema: only documented fields leave the API.
    const body = categoriesResponseSchema.parse({ items: [...fields.values()] });
    // An empty list means the database is not seeded yet: never let the edge keep it.
    c.header('Cache-Control', body.items.length > 0 ? PUBLIC_REFERENCE_CACHE : 'no-store');
    return c.json(body);
  },
);
