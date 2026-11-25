import { describe, expect, it } from 'vitest';
import { ERROR_CODES, ERROR_HTTP_STATUS, apiErrorSchema, errorCodeSchema } from '../src/index';

describe('error codes', () => {
  it('map to the HTTP statuses in docs/api-contract.md', () => {
    expect(ERROR_HTTP_STATUS).toEqual({
      BAD_REQUEST: 400,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      PAYLOAD_TOO_LARGE: 413,
      UNSUPPORTED_MEDIA_TYPE: 415,
      VALIDATION_ERROR: 422,
      RATE_LIMITED: 429,
      INTERNAL_ERROR: 500,
    });
    expect(Object.keys(ERROR_HTTP_STATUS)).toEqual([...ERROR_CODES]);
  });

  it('rejects unknown codes', () => {
    expect(errorCodeSchema.safeParse('TEAPOT').success).toBe(false);
    expect(errorCodeSchema.safeParse('forbidden').success).toBe(false);
  });
});

describe('apiErrorSchema', () => {
  it('accepts the documented shape', () => {
    const body = { error: { code: 'FORBIDDEN', message: 'Tidak boleh.' } };
    expect(apiErrorSchema.parse(body)).toEqual(body);
  });

  it('accepts field errors for form validation', () => {
    const body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Periksa isian.',
        fields: [{ path: 'phone', message: 'Nomor tidak valid.' }],
      },
    };
    expect(apiErrorSchema.parse(body)).toEqual(body);
  });

  it.each(['', '   ', 'x'.repeat(501)])('rejects message %j', (message) => {
    expect(apiErrorSchema.safeParse({ error: { code: 'NOT_FOUND', message } }).success).toBe(false);
  });

  it('rejects unknown codes', () => {
    expect(apiErrorSchema.safeParse({ error: { code: 'TEAPOT', message: 'x' } }).success).toBe(
      false,
    );
  });

  it('strips unknown keys so internals never pass through a parsed body', () => {
    const parsed = apiErrorSchema.parse({
      error: { code: 'NOT_FOUND', message: 'x', stack: 'at ...' },
      debug: true,
    });
    expect(parsed).toEqual({ error: { code: 'NOT_FOUND', message: 'x' } });
  });

  it('allows fields only for VALIDATION_ERROR', () => {
    expect(
      apiErrorSchema.safeParse({
        error: { code: 'FORBIDDEN', message: 'x', fields: [{ path: 'a', message: 'b' }] },
      }).success,
    ).toBe(false);
  });

  it('rejects malformed field errors', () => {
    expect(
      apiErrorSchema.safeParse({
        error: { code: 'VALIDATION_ERROR', message: 'x', fields: [{ path: '', message: 'y' }] },
      }).success,
    ).toBe(false);
  });
});
