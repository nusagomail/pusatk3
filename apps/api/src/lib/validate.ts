import type { FieldError } from '@pusatk3/shared';
import { validator } from 'hono/validator';
import type { z } from 'zod';
import { AppError } from './errors';

/** Upper bound on `fields` so a huge invalid body cannot produce a huge error response. */
export const MAX_FIELD_ERRORS = 50;

/** Maps Zod issues to `fields`; issues without a usable path (root) stay in the main message. */
export function toFieldErrors(error: z.ZodError): FieldError[] {
  return error.issues
    .map((issue) => ({ path: issue.path.map(String).join('.'), message: issue.message }))
    .filter((field) => field.path !== '')
    .slice(0, MAX_FIELD_ERRORS);
}

const JSON_MEDIA_TYPE = /^application\/(?:[\w.+-]+\+)?json$/i;

function isJsonRequest(contentType: string | undefined): boolean {
  const mediaType = contentType?.split(';')[0]?.trim() ?? '';
  return JSON_MEDIA_TYPE.test(mediaType);
}

function validateWith<T extends z.ZodType>(schema: T) {
  return (value: unknown): z.output<T> => {
    const result = schema.safeParse(value);
    if (!result.success) {
      throw new AppError('VALIDATION_ERROR', undefined, toFieldErrors(result.error));
    }
    return result.data;
  };
}

/**
 * Validates the JSON body. Non-JSON content-type → 415 (also blocks CORS "simple" text/plain
 * posts); malformed JSON → 400 (Hono); schema failure → 422.
 */
export function validateJson<T extends z.ZodType>(schema: T) {
  const parse = validateWith(schema);
  return validator('json', (value, c) => {
    if (!isJsonRequest(c.req.header('content-type'))) throw new AppError('UNSUPPORTED_MEDIA_TYPE');
    return parse(value);
  });
}

/** Validates path parameters (e.g. `:id`, `:slug`). */
export function validateParam<T extends z.ZodType>(schema: T) {
  return validator('param', validateWith(schema));
}

/** Validates query parameters. A repeated key (`?a=1&a=2`) arrives as an array. */
export function validateQuery<T extends z.ZodType>(schema: T) {
  return validator('query', validateWith(schema));
}
