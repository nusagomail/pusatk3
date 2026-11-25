import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCategoriesCsv } from '../src/seed/categories-csv';

const csv = readFileSync(
  resolve(import.meta.dirname, '../../../docs/data/kategori-k3.csv'),
  'utf8',
);
const HEADER = 'bidang_slug,bidang,slug,nama,penerbit,dokumen,masa_berlaku,catatan,regulasi';
const row = (overrides: Partial<Record<string, string>> = {}) => {
  const base = {
    bidang_slug: 'k3-umum',
    bidang: 'K3 Umum',
    slug: 'ahli-k3-umum',
    nama: 'Ahli K3 Umum',
    penerbit: 'KEMNAKER',
    dokumen: 'SKP',
    masa_berlaku: '3 th',
    catatan: 'x',
    regulasi: 'UU 1/1970',
    ...overrides,
  };
  return Object.values(base)
    .map((v) => `"${v.replaceAll('"', '""')}"`)
    .join(',');
};

describe('parseCategoriesCsv on docs/data/kategori-k3.csv', () => {
  const data = parseCategoriesCsv(csv);

  it('reads 14 fields and 59 categories', () => {
    expect(data.fields).toHaveLength(14);
    expect(data.categories).toHaveLength(59);
  });

  it('keeps field order as in the CSV', () => {
    expect(data.fields[0]).toEqual({
      slug: 'k3-umum',
      name: 'K3 Umum & Sistem Manajemen',
      sortOrder: 1,
    });
    expect(data.fields.map((f) => f.sortOrder)).toEqual(
      Array.from({ length: 14 }, (_, i) => i + 1),
    );
  });

  it('maps a known category', () => {
    expect(data.categories.find((c) => c.slug === 'ahli-k3-umum')).toEqual({
      fieldSlug: 'k3-umum',
      slug: 'ahli-k3-umum',
      name: 'Ahli K3 Umum (AK3U)',
      issuers: ['kemnaker'],
      documentType: 'SKP + sertifikat',
      typicalValidityYears: 3,
      regulationRef:
        'UU 1/1970; Permenaker PER.02/MEN/1992 (Ahli K3); PP 50/2012 (SMK3); Permenaker 13/2025 (P2K3)',
    });
  });

  it('uses only known issuers and valid validity values', () => {
    const issuers = new Set(data.categories.flatMap((c) => c.issuers));
    expect([...issuers].sort()).toEqual(['bnsp', 'esdm', 'intl', 'kemnaker', 'pupr']);
    for (const c of data.categories) {
      expect(c.typicalValidityYears === null || [3, 4, 5].includes(c.typicalValidityYears)).toBe(
        true,
      );
    }
  });
});

describe('parseCategoriesCsv rules', () => {
  const parse = (...rows: string[]) => parseCategoriesCsv([HEADER, ...rows].join('\n'));

  it.each([
    ['5 th', 5],
    ['3 th*', 3],
    ['3 th (SKP)', 3],
    ['—', null],
    ['Skema', null],
  ])('validity %j → %j', (masa_berlaku, years) => {
    expect(parse(row({ masa_berlaku })).categories[0]?.typicalValidityYears).toBe(years);
  });

  it('handles quoted commas, quotes, newlines and CRLF', () => {
    const data = parseCategoriesCsv(
      [HEADER, row({ catatan: 'a, "b"\nc', regulasi: 'PP 50/2012, UU 1/1970' })].join('\r\n') +
        '\r\n',
    );
    expect(data.categories[0]?.regulationRef).toBe('PP 50/2012, UU 1/1970');
  });

  it('ignores a UTF-8 byte order mark', () => {
    const bom = String.fromCharCode(0xfeff);
    expect(parseCategoriesCsv(`${bom}${HEADER}\n${row()}`).categories).toHaveLength(1);
  });

  it('rejects an unknown issuer', () => {
    expect(() => parse(row({ penerbit: 'KEMENKES' }))).toThrow(/issuer/i);
  });

  it('rejects an unknown validity value', () => {
    expect(() => parse(row({ masa_berlaku: 'seumur hidup' }))).toThrow(/masa_berlaku/);
  });

  it('rejects duplicate category slugs', () => {
    expect(() => parse(row(), row())).toThrow(/duplicate/i);
  });

  it('rejects a field slug with two different names', () => {
    expect(() => parse(row(), row({ slug: 'lain', bidang: 'Nama Lain' }))).toThrow(/bidang/);
  });

  it('rejects empty required values and a wrong header', () => {
    expect(() => parse(row({ nama: '' }))).toThrow(/nama/);
    expect(() => parseCategoriesCsv('a,b\n1,2')).toThrow(/header/i);
  });

  it('rejects an unterminated quote', () => {
    expect(() => parseCategoriesCsv(`${HEADER}\n"abc`)).toThrow(/quote/i);
  });
});
