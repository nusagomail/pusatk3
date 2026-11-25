import { categoriesResponseSchema } from '@pusatk3/shared';
import { parseCategoriesCsv, SAMPLE_CITIES, seedReferenceData } from '@pusatk3/db';
import { env, SELF } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import csv from '../../../docs/data/kategori-k3.csv?raw';
import { call, expectApiError } from './helpers';

const url = 'https://api.test/api/v1/categories';

beforeEach(async () => {
  await seedReferenceData(drizzle(env.DB), { ...parseCategoriesCsv(csv), cities: SAMPLE_CITIES });
});

describe('GET /api/v1/categories (public)', () => {
  it('works for anonymous visitors and returns 14 fields with 59 categories', async () => {
    const res = await SELF.fetch(url);
    expect(res.status).toBe(200);
    const body = categoriesResponseSchema.parse(await res.json());
    expect(body.items).toHaveLength(14);
    expect(body.items.flatMap((f) => f.categories)).toHaveLength(59);
  });

  it('orders fields by sort_order and categories by name', async () => {
    const body = categoriesResponseSchema.parse(await (await SELF.fetch(url)).json());
    expect(body.items[0]?.slug).toBe('k3-umum');
    for (const field of body.items) {
      const names = field.categories.map((c) => c.name);
      expect(names).toEqual([...names].sort(new Intl.Collator('id').compare));
    }
  });

  it('returns only the explicit output fields', async () => {
    const raw = (await (await SELF.fetch(url)).json()) as { items: Record<string, unknown>[] };
    const field = raw.items[0] as { categories: Record<string, unknown>[] } & Record<
      string,
      unknown
    >;
    expect(Object.keys(field).sort()).toEqual(['categories', 'name', 'slug']);
    expect(Object.keys(field.categories[0] ?? {}).sort()).toEqual(
      ['documentType', 'issuers', 'name', 'regulationRef', 'slug', 'typicalValidityYears'].sort(),
    );
  });

  it('maps a known category', async () => {
    const body = categoriesResponseSchema.parse(await (await SELF.fetch(url)).json());
    const ak3u = body.items[0]?.categories.find((c) => c.slug === 'ahli-k3-umum');
    expect(ak3u).toMatchObject({
      issuers: ['kemnaker'],
      typicalValidityYears: 3,
      documentType: 'SKP + sertifikat',
    });
  });

  it('is cacheable at the edge', async () => {
    const res = await SELF.fetch(url);
    expect(res.headers.get('cache-control')).toBe(
      'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    );
  });

  it('ignores identity headers (same public response)', async () => {
    const res = await SELF.fetch(url, {
      headers: { authorization: 'Bearer x', cookie: 'session=y' },
    });
    expect(res.status).toBe(200);
  });

  it('rejects any query parameter with 422', async () => {
    await expectApiError(await SELF.fetch(`${url}?field=k3-umum`), 422, 'VALIDATION_ERROR');
  });
});

describe('GET /api/v1/categories edge cases', () => {
  it('does not cache an empty list at the edge', async () => {
    await env.DB.prepare('DELETE FROM course_categories').run();
    const res = await SELF.fetch(url);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [] });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('returns 500 without details when the database fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const brokenDb = {
      prepare: () => {
        throw new Error('D1_ERROR: no such table: course_fields');
      },
    } as unknown as D1Database;
    const res = await call(createApp(), '/api/v1/categories', undefined, { ...env, DB: brokenDb });
    const body = await expectApiError(res, 500, 'INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('course_fields');
    vi.restoreAllMocks();
  });
});
