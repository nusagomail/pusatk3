import { describe, expect, it } from 'vitest';
import {
  categoriesQuerySchema,
  categoriesResponseSchema,
  categorySchema,
  slugSchema,
} from '../src/index';

const category = {
  slug: 'ahli-k3-umum',
  name: 'Ahli K3 Umum (AK3U)',
  issuers: ['kemnaker'],
  documentType: 'SKP',
  typicalValidityYears: 3,
  regulationRef: 'UU 1/1970',
};

describe('categoriesResponseSchema', () => {
  it('accepts fields with categories and strips internal columns', () => {
    const parsed = categoriesResponseSchema.parse({
      items: [
        {
          slug: 'k3-umum',
          name: 'K3 Umum',
          id: 'x',
          categories: [{ ...category, fieldId: 'f', synonyms: [] }],
        },
      ],
    });
    expect(parsed).toEqual({
      items: [{ slug: 'k3-umum', name: 'K3 Umum', categories: [category] }],
    });
  });

  it('allows a null validity but rejects unknown issuers and empty issuer lists', () => {
    const ok = {
      items: [{ slug: 'a', name: 'A', categories: [{ ...category, typicalValidityYears: null }] }],
    };
    expect(categoriesResponseSchema.safeParse(ok).success).toBe(true);
    for (const issuers of [['kemenkes'], []]) {
      const bad = { items: [{ slug: 'a', name: 'A', categories: [{ ...category, issuers }] }] };
      expect(categoriesResponseSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('categoriesQuerySchema', () => {
  it('accepts no parameters and rejects any', () => {
    expect(categoriesQuerySchema.safeParse({}).success).toBe(true);
    expect(categoriesQuerySchema.safeParse({ field: 'k3-umum' }).success).toBe(false);
  });
});

describe('slugSchema', () => {
  it.each(['k3-umum', 'ahli-k3-umum', 'pjk3', 'a1'])('accepts %j', (slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(true);
  });
  it.each(['', 'Bad Slug!', 'K3-umum', '-a', 'a-', 'a--b', 'a_b'])('rejects %j', (slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(false);
  });
});

describe('categorySchema validity', () => {
  it.each([0, -1, 1.5, 51])('rejects typicalValidityYears %j', (years) => {
    expect(categorySchema.safeParse({ ...category, typicalValidityYears: years }).success).toBe(
      false,
    );
  });
});
