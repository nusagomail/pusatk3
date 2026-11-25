import { describe, expect, it } from 'vitest';
import { isProductionDeploy, robotsTxt, withNoindexHeaders } from '../src/lib/deploy';

describe('isProductionDeploy', () => {
  it('is true only for an explicit "production"', () => {
    expect(isProductionDeploy('production')).toBe(true);
    for (const value of [undefined, '', 'staging', 'Production', 'prod']) {
      expect(isProductionDeploy(value)).toBe(false);
    }
  });
});

describe('robotsTxt', () => {
  it('allows crawling in production and points to the sitemap', () => {
    expect(robotsTxt(true)).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://pusatk3.id/sitemap.xml\n',
    );
  });

  it('blocks all crawlers anywhere else', () => {
    expect(robotsTxt(false)).toBe('User-agent: *\nDisallow: /\n');
  });
});

describe('withNoindexHeaders', () => {
  it('adds X-Robots-Tag for every path, keeping existing rules', () => {
    const before = '/*\n  X-Content-Type-Options: nosniff\n';
    const after = withNoindexHeaders(before);
    expect(after.startsWith(before)).toBe(true);
    expect(after).toMatch(/\n\/\*\n {2}X-Robots-Tag: noindex, nofollow\n$/);
  });

  it('is idempotent', () => {
    const once = withNoindexHeaders('/*\n  A: b\n');
    expect(withNoindexHeaders(once)).toBe(once);
  });
});
