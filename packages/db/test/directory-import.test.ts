import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DIRECTORY_CSV_HEADERS,
  inlineQuery,
  parseCategoriesCsv,
  parseDirectoryCsv,
  SAMPLE_CITIES,
  sqlLiteral,
  type DirectoryCsvFiles,
} from '../src';

const root = resolve(import.meta.dirname, '../../..');
const categories = parseCategoriesCsv(
  readFileSync(resolve(root, 'docs/data/kategori-k3.csv'), 'utf8'),
).categories;
const reference = { categories, citySlugs: new Set(SAMPLE_CITIES.map((c) => c.slug)) };
const sample = Object.fromEntries(
  (['penyedia', 'cabang', 'legalitas', 'jadwal'] as const).map((name) => [
    name,
    readFileSync(resolve(root, `docs/data/contoh/${name}.csv`), 'utf8'),
  ]),
) as unknown as DirectoryCsvFiles;

const header = (file: keyof DirectoryCsvFiles) => DIRECTORY_CSV_HEADERS[file].join(',');
const minimal: DirectoryCsvFiles = {
  penyedia: `${header('penyedia')}\npt-a,PT A,pjk3,,,,,\n`,
  cabang: `${header('cabang')}\npt-a,Kantor Pusat,jakarta,Jl. A 1,,,ya\n`,
  legalitas: `${header('legalitas')}\npt-a,izin_pjk3,1/2026,Kemnaker RI,\n`,
  jadwal: `${header('jadwal')}\npt-a,ahli-k3-umum,Kantor Pusat,AK3U,kemnaker,offline,2027-01-11,2027-01-22,5.500.000,30,,,,official,published\n`,
};
const parse = (files: Partial<DirectoryCsvFiles>) =>
  parseDirectoryCsv({ ...minimal, ...files }, reference);
const messages = (files: Partial<DirectoryCsvFiles>) =>
  parse(files).problems.map((p) => `${p.file}:${p.line} ${p.message}`);

describe('sample data (docs/data/contoh)', () => {
  it('parses without problems: 4 providers, 5 branches, 4 licenses, 12 schedules', () => {
    const { data, problems } = parseDirectoryCsv(sample, reference);
    expect(problems).toEqual([]);
    expect(data.providers).toHaveLength(4);
    expect(data.branches).toHaveLength(5);
    expect(data.licenses).toHaveLength(4);
    expect(data.schedules).toHaveLength(12);
  });

  it('is clearly fictional: every name says "Contoh" and no contact numbers exist', () => {
    const { data } = parseDirectoryCsv(sample, reference);
    for (const p of data.providers) {
      expect(p.name).toMatch(/\(Contoh\)$/);
      expect(p.slug).toMatch(/^contoh-/);
      expect([p.whatsapp, p.phone, p.email, p.website]).toEqual([
        undefined,
        undefined,
        undefined,
        undefined,
      ]);
    }
    for (const s of data.schedules) expect(s.title).toContain('(Contoh)');
  });
});

describe('parseDirectoryCsv', () => {
  it('reads prices with thousand separators and resolves the branch', () => {
    const { data, problems } = parse({});
    expect(problems).toEqual([]);
    expect(data.schedules[0]).toMatchObject({ priceIdr: 5_500_000, branchName: 'Kantor Pusat' });
  });

  it('matches branch names case-insensitively but keeps the cabang.csv spelling', () => {
    const jadwal = minimal.jadwal.replace(',Kantor Pusat,', ',kantor pusat,');
    expect(parse({ jadwal }).data.schedules[0]?.branchName).toBe('Kantor Pusat');
  });

  it('refuses a wrong header', () => {
    // Rows referring to the unread providers are reported too; the header comes first.
    expect(messages({ penyedia: 'slug,name\npt-a,PT A\n' })[0]).toMatch(/^penyedia:1 header harus/);
  });

  it.each([
    [
      'duplicate slug',
      { penyedia: `${header('penyedia')}\npt-a,PT A,pjk3,,,,,\npt-a,PT B,pjk3,,,,,\n` },
      /penyedia:3 slug "pt-a" duplikat \(baris 2\)/,
    ],
    [
      'duplicate name',
      { penyedia: `${header('penyedia')}\npt-a,PT A,pjk3,,,,,\npt-b,pt  a,lsp,,,,,\n` },
      /penyedia:3 nama "pt {2}a" sama dengan penyedia "pt-a"/,
    ],
    [
      'invalid WhatsApp',
      { penyedia: `${header('penyedia')}\npt-a,PT A,pjk3,,123,,,\n` },
      /penyedia:2 whatsapp/,
    ],
    [
      'unknown provider in cabang',
      { cabang: `${header('cabang')}\npt-x,Kantor,jakarta,Jl. A,,,ya\n` },
      /cabang:2 penyedia_slug "pt-x"/,
    ],
    [
      'unknown city',
      { cabang: `${header('cabang')}\npt-a,Kantor Pusat,medan,Jl. A,,,ya\n` },
      /cabang:2 kota_slug "medan"/,
    ],
    [
      'bad kantor_pusat',
      { cabang: `${header('cabang')}\npt-a,Kantor Pusat,jakarta,Jl. A,,,iya\n` },
      /cabang:2 kantor_pusat/,
    ],
    [
      'duplicate branch',
      {
        cabang: `${header('cabang')}\npt-a,Kantor Pusat,jakarta,Jl. A,,,ya\npt-a,kantor pusat,bekasi,Jl. B,,,tidak\n`,
      },
      /cabang:3 cabang "kantor pusat" duplikat/,
    ],
    [
      'license number used twice',
      {
        penyedia: `${header('penyedia')}\npt-a,PT A,pjk3,,,,,\npt-b,PT B,pjk3,,,,,\n`,
        legalitas: `${header('legalitas')}\npt-a,izin_pjk3,1/2026,Kemnaker RI,\npt-b,izin_pjk3,1/2026,Kemnaker RI,\n`,
      },
      /legalitas:3 nomor izin_pjk3 "1\/2026" sudah dipakai penyedia "pt-a"/,
    ],
    [
      'unknown category',
      { jadwal: minimal.jadwal.replace('ahli-k3-umum', 'ahli-k3-tidak-ada') },
      /jadwal:2 kategori_slug/,
    ],
    [
      'issuer not valid for the category',
      { jadwal: minimal.jadwal.replace(',kemnaker,', ',bnsp,') },
      /jadwal:2 penerbit "bnsp" tidak berlaku untuk ahli-k3-umum/,
    ],
    [
      'unknown branch',
      { jadwal: minimal.jadwal.replace(',Kantor Pusat,', ',Cabang Lain,') },
      /jadwal:2 cabang "Cabang Lain" tidak ada/,
    ],
    [
      'offline without a branch',
      { jadwal: minimal.jadwal.replace(',Kantor Pusat,', ',,') },
      /jadwal:2 branchName/,
    ],
    [
      'end before start',
      { jadwal: minimal.jadwal.replace('2027-01-22', '2027-01-01') },
      /jadwal:2 endDate/,
    ],
    [
      'bad price',
      { jadwal: minimal.jadwal.replace('5.500.000', 'lima juta') },
      /jadwal:2 priceIdr/,
    ],
    [
      'price with decimals',
      { jadwal: minimal.jadwal.replace('5.500.000', '4500000.00') },
      /jadwal:2 priceIdr/,
    ],
    [
      'two main offices',
      {
        cabang: `${header('cabang')}\npt-a,Kantor Pusat,jakarta,Jl. A,,,ya\npt-a,Kantor Dua,bekasi,Jl. B,,,ya\n`,
      },
      /cabang:3 "pt-a" sudah punya kantor pusat \(baris 2\)/,
    ],
    [
      'wrong column count',
      { jadwal: `${header('jadwal')}\npt-a,ahli-k3-umum\n` },
      /jadwal:2 harus 15 kolom, ada 2/,
    ],
  ])('reports %s with file and line', (_name, files, expected) => {
    expect(messages(files).join('\n')).toMatch(expected);
  });

  it('reports a duplicate schedule (same provider, category, start date and title)', () => {
    const row = minimal.jadwal.split('\n')[1];
    expect(messages({ jadwal: `${minimal.jadwal}${row?.replace('AK3U', 'ak3u')}\n` })).toEqual([
      expect.stringMatching(/^jadwal:3 jadwal duplikat/),
    ]);
  });

  it('ignores blank lines but keeps line numbers', () => {
    const penyedia = `${header('penyedia')}\n\npt-a,PT A,pjk3,,,,,\npt-a,PT A2,pjk3,,,,,\n`;
    expect(messages({ penyedia })).toEqual([
      expect.stringMatching(/^penyedia:4 slug "pt-a" duplikat \(baris 3\)/),
    ]);
  });
});

describe('SQL literals', () => {
  it.each([
    [null, 'NULL'],
    [undefined, 'NULL'],
    [true, '1'],
    [false, '0'],
    [42, '42'],
    ["O'Brien; DROP TABLE providers;--", "'O''Brien; DROP TABLE providers;--'"],
    [new Date(1_700_000_000_000), '1700000000000'],
  ])('%j → %s', (value, expected) => {
    expect(sqlLiteral(value)).toBe(expected);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 'a\u0000b', {}])('refuses %j', (value) => {
    expect(() => sqlLiteral(value)).toThrow(/Import SQL/);
  });

  it('keeps question marks and negative numbers inside literals', () => {
    expect(inlineQuery({ sql: 'select ?, ?', params: ['a?b', -6] })).toBe("select 'a?b', -6");
  });

  it('inlines parameters in order and checks their count', () => {
    expect(inlineQuery({ sql: 'select ? , ?', params: ['a', 1] })).toBe("select 'a' , 1");
    expect(() => inlineQuery({ sql: 'select ?', params: [] })).toThrow(/placeholders/);
  });
});
