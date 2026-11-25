import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { cities, courseCategories, courseFields } from '../src/schema';

const columns = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table)
    .columns.map((c) => c.name)
    .sort();

const base = ['created_at', 'id', 'updated_at'];

// Column names mirror docs/skema-db.md (source of truth).
describe('schema matches docs/skema-db.md', () => {
  it('cities', () => {
    expect(getTableConfig(cities).name).toBe('cities');
    expect(columns(cities)).toEqual([...base, 'name', 'province', 'slug'].sort());
  });

  it('course_fields', () => {
    expect(getTableConfig(courseFields).name).toBe('course_fields');
    expect(columns(courseFields)).toEqual([...base, 'name', 'slug', 'sort_order'].sort());
  });

  it('course_categories', () => {
    expect(getTableConfig(courseCategories).name).toBe('course_categories');
    expect(columns(courseCategories)).toEqual(
      [
        ...base,
        'document_type',
        'field_id',
        'issuers',
        'name',
        'regulation_ref',
        'slug',
        'synonyms',
        'typical_validity_years',
      ].sort(),
    );
  });

  it('slugs are unique and categories reference their field', () => {
    for (const table of [cities, courseFields, courseCategories]) {
      const slug = getTableConfig(table).columns.find((c) => c.name === 'slug');
      expect(slug?.isUnique || getTableConfig(table).indexes.some((i) => i.config.unique)).toBe(
        true,
      );
    }
    const fks = getTableConfig(courseCategories).foreignKeys.map((fk) => fk.reference());
    expect(fks.map((fk) => getTableConfig(fk.foreignTable).name)).toEqual(['course_fields']);
  });
});
