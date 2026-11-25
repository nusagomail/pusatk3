// Proves @pusatk3/shared resolves from another workspace package the same way
// apps/api and apps/web will import it (type-checked by `pnpm typecheck` too).
import { describe, expect, it } from 'vitest';
import { apiErrorSchema, issuerSchema, paginationQuerySchema } from '@pusatk3/shared';
import type { ApiError, Issuer } from '@pusatk3/shared';

describe('@pusatk3/shared import', () => {
  it('exposes schemas and types to other packages', () => {
    const issuer: Issuer = issuerSchema.parse('bnsp');
    const body: ApiError = { error: { code: 'NOT_FOUND', message: 'Tidak ditemukan.' } };
    expect(issuer).toBe('bnsp');
    expect(apiErrorSchema.parse(body)).toEqual(body);
    expect(paginationQuerySchema.parse({}).limit).toBe(20);
  });
});
