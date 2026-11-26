import { describe, expect, it } from 'vitest';
import { dateBlock, formatDate, formatDateRange, formatPrice } from '../src/lib/format';
import { parseSearchParams, toQueryString } from '../src/lib/search-params';

describe('format', () => {
  it.each([
    ['2027-01-11', '2027-01-22', '11–22 Jan 2027'],
    ['2027-01-28', '2027-02-03', '28 Jan – 3 Feb 2027'],
    ['2026-12-30', '2027-01-02', '30 Des 2026 – 2 Jan 2027'],
    ['2027-01-11', '2027-01-11', '11 Jan 2027'],
  ])('date range %s–%s → %s', (start, end, expected) => {
    expect(formatDateRange(start, end)).toBe(expected);
  });

  it('formats calendar dates without time-zone shifts', () => {
    expect(formatDate('2027-01-01', { long: true })).toBe('1 Januari 2027');
    expect(dateBlock('2027-01-28', '2027-02-03')).toEqual({ month: 'JAN', days: '28+' });
  });

  it('formats prices in rupiah, unknown prices as a prompt', () => {
    expect(formatPrice(5_500_000)).toBe('Rp5.500.000');
    expect(formatPrice(null)).toBe('Harga: tanyakan penyedia');
  });
});

describe('search params (whitelist)', () => {
  it('keeps only known, non-empty parameters in a fixed order', () => {
    const { query, values } = parseSearchParams(
      new URLSearchParams('utm_source=x&city=bekasi&q=forklift&fbclid=1&mode=&sort=date'),
    );
    expect(values).toEqual({ q: 'forklift', city: 'bekasi', sort: 'date' });
    expect(query).not.toBeNull();
    expect(toQueryString(values)).toBe('?q=forklift&city=bekasi');
  });

  it('reports invalid values instead of passing them on', () => {
    expect(parseSearchParams(new URLSearchParams('priceMin=9&priceMax=1')).query).toBeNull();
    expect(parseSearchParams(new URLSearchParams('month=2027-13')).query).toBeNull();
  });

  it('returns an empty string without parameters', () => {
    expect(toQueryString({})).toBe('');
  });
});
