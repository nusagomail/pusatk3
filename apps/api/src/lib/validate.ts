import type { FieldError } from '@pusatk3/shared';
import { validator } from 'hono/validator';
import type { z } from 'zod';
import { AppError } from './errors';

/** Maps Zod issues to `fields`; issues without a path (root) stay in the main message only. */
export function toFieldErrors(error: z.ZodError): FieldError[] {
  return error.issues
    .filter((issue) => issue.path.length > 0)
    .map((issue) => ({ path: issue.path.map(String).join('.'), message: issue.message }));
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

/** Validates the JSON body. Malformed JSON → 400 (Hono); schema failure → 422. */
export function validateJson<T extends z.ZodType>(schema: T) {
  return validator('json', validateWith(schema));
}

/** Validates query parameters (single values; repeated keys arrive as the first value). */
export function validateQuery<T extends z.ZodType>(schema: T) {
  return validator('query', validateWith(schema));
}
