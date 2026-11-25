import { issuerSchema } from '@pusatk3/shared';
import { describe, expect, it } from 'vitest';

describe('@pusatk3/shared in the Workers runtime', () => {
  it('loads and validates', () => {
    expect(navigator.userAgent).toBe('Cloudflare-Workers');
    expect(issuerSchema.parse('kemnaker')).toBe('kemnaker');
  });
});
