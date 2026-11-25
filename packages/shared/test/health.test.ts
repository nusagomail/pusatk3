import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from '../src/index';

describe('healthResponseSchema', () => {
  it('accepts ok with a version', () => {
    expect(healthResponseSchema.parse({ status: 'ok', version: 'dev' })).toEqual({
      status: 'ok',
      version: 'dev',
    });
  });

  it('rejects other statuses and an empty version', () => {
    expect(healthResponseSchema.safeParse({ status: 'down', version: 'dev' }).success).toBe(false);
    expect(healthResponseSchema.safeParse({ status: 'ok', version: '' }).success).toBe(false);
  });
});
