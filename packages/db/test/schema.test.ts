import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import {
  branches,
  cities,
  courseCategories,
  courseFields,
  providerLicenses,
  providers,
  schedules,
} from '../src/schema';

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

  it('providers', () => {
    expect(getTableConfig(providers).name).toBe('providers');
    expect(columns(providers)).toEqual(
      [
        ...base,
        'description',
        'email',
        'logo_key',
        'name',
        'phone',
        'plan',
        'slug',
        'status',
        'type',
        'verification_status',
        'verified_at',
        'website',
        'whatsapp',
      ].sort(),
    );
  });

  it('branches', () => {
    expect(columns(branches)).toEqual(
      [...base, 'address', 'city_id', 'is_main', 'lat', 'lng', 'name', 'provider_id'].sort(),
    );
  });

  it('provider_licenses', () => {
    expect(columns(providerLicenses)).toEqual(
      [...base, 'document_key', 'issuer', 'kind', 'number', 'provider_id', 'valid_until'].sort(),
    );
  });

  it('schedules', () => {
    expect(columns(schedules)).toEqual(
      [
        ...base,
        'branch_id',
        'category_id',
        'certificate_kind',
        'description',
        'end_date',
        'issuer',
        'level',
        'mode',
        'price_idr',
        'provider_id',
        'quota',
        'requirements',
        'start_date',
        'status',
        'title',
      ].sort(),
    );
  });

  it('directory tables reference their parents', () => {
    const parents = (table: Parameters<typeof getTableConfig>[0]) =>
      getTableConfig(table)
        .foreignKeys.map((fk) => getTableConfig(fk.reference().foreignTable).name)
        .sort();
    expect(parents(branches)).toEqual(['cities', 'providers']);
    expect(parents(providerLicenses)).toEqual(['providers']);
    expect(parents(schedules)).toEqual(['branches', 'course_categories', 'providers']);
    const slug = getTableConfig(providers).columns.find((c) => c.name === 'slug');
    expect(slug?.isUnique).toBe(true);
  });

  it('enum columns are guarded by CHECK constraints', () => {
    const checks = (table: Parameters<typeof getTableConfig>[0]) =>
      getTableConfig(table).checks.map((c) => c.name);
    expect(checks(providers).length).toBeGreaterThanOrEqual(4);
    expect(checks(providerLicenses).length).toBeGreaterThanOrEqual(1);
    expect(checks(schedules).length).toBeGreaterThanOrEqual(6);
  });
});
