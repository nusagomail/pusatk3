import { describe, expect, it } from 'vitest';
import LicenseList from '../src/components/directory/LicenseList.astro';
import { isExpired, jakartaToday } from '../src/lib/format';
import { render } from './render';

const license = (validUntil: string | null) => ({
  kind: 'izin_pjk3' as const,
  number: 'X/1',
  issuer: 'Kemnaker RI',
  validUntil,
});

describe('LicenseList', () => {
  it('labels expired licenses and keeps valid ones neutral', async () => {
    const html = await render(LicenseList, {
      licenses: [license('2001-01-01'), license('2099-12-31')],
      verified: true,
    });
    expect(html).toContain('Kedaluwarsa sejak 1 Jan 2001');
    expect(html).toContain('Berlaku s.d. 31 Des 2099');
  });

  it('warns when the provider is not verified, never when it is', async () => {
    const unverified = await render(LicenseList, { licenses: [license(null)], verified: false });
    expect(unverified).toMatch(/belum diverifikasi/);
    const verified = await render(LicenseList, { licenses: [license(null)], verified: true });
    expect(verified).not.toMatch(/belum diverifikasi/);
  });
});

describe('isExpired / jakartaToday', () => {
  it('compares calendar dates in Asia/Jakarta', () => {
    expect(jakartaToday(Date.UTC(2026, 11, 31, 17, 30))).toBe('2027-01-01');
    expect(isExpired('2026-12-31', '2027-01-01')).toBe(true);
    expect(isExpired('2027-01-01', '2027-01-01')).toBe(false);
    expect(isExpired(null, '2027-01-01')).toBe(false);
  });
});
