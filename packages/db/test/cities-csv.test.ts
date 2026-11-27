import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCitiesCsv, SAMPLE_CITIES } from '../src';

// Reference cities for real imports (#54).
const csv = readFileSync(resolve(import.meta.dirname, '../../../docs/data/kota.csv'), 'utf8');

describe('docs/data/kota.csv', () => {
  const cities = parseCitiesCsv(csv);

  it('covers all 38 provinces with unique slugs and names', () => {
    expect(new Set(cities.map((c) => c.province)).size).toBe(38);
    expect(new Set(cities.map((c) => c.slug)).size).toBe(cities.length);
  });

  it('includes every sample city with the same name and province', () => {
    for (const sample of SAMPLE_CITIES) {
      expect(cities).toContainEqual(sample);
    }
  });
});

describe('parseCitiesCsv rules', () => {
  const parse = (...rows: string[]) => parseCitiesCsv(['slug,nama,provinsi', ...rows].join('\n'));
  it.each([
    ['a wrong header', () => parseCitiesCsv('a,b,c\nx,y,z'), /header/],
    ['an invalid slug', () => parse('Bad Slug,Kota,Prov'), /invalid slug/],
    ['a duplicate slug', () => parse('a,Kota A,P', 'a,Kota B,P'), /duplicate slug/],
    ['a duplicate name', () => parse('a,Kota,P', 'b,kota,P'), /duplicate name/],
    ['an empty province', () => parse('a,Kota,'), /expected/],
  ])('refuses %s', (_name, run, error) => {
    expect(run).toThrow(error);
  });
});
