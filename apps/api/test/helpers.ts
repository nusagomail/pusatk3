import { apiErrorSchema } from '@pusatk3/shared';
import type { ApiError } from '@pusatk3/shared';
import { env } from 'cloudflare:test';
import { expect } from 'vitest';
import type { createApp } from '../src/app';

type App = ReturnType<typeof createApp>;

/** Calls the app in-process (inside workerd) with the test bindings. */
export function call(app: App, path: string, init?: RequestInit): Promise<Response> {
  return Promise.resolve(app.request(`https://api.test${path}`, init, env));
}

/** Asserts a standard error body with the expected status and code, and returns it. */
export async function expectApiError(
  res: Response,
  status: number,
  code: ApiError['error']['code'],
): Promise<ApiError> {
  expect(res.status).toBe(status);
  expect(res.headers.get('content-type')).toMatch(/^application\/json/);
  const raw: unknown = await res.json();
  // Strict check: the body has no keys beyond the contract.
  expect(Object.keys(raw as object)).toEqual(['error']);
  const body = apiErrorSchema.parse(raw);
  expect(body.error.code).toBe(code);
  return body;
}
