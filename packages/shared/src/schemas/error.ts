import { z } from 'zod';

// API error body: { error: { code, message, fields? } } — see docs/api-contract.md.

export const ERROR_HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_HTTP_STATUS;
export const ERROR_CODES = Object.keys(ERROR_HTTP_STATUS) as [ErrorCode, ...ErrorCode[]];
export const errorCodeSchema = z.enum(ERROR_CODES);

/** One invalid form field, e.g. `{ path: 'phone', message: 'Nomor tidak valid.' }`. */
export const fieldErrorSchema = z.strictObject({
  path: z.string().min(1),
  message: z.string().min(1),
});
export type FieldError = z.infer<typeof fieldErrorSchema>;

export const apiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: errorCodeSchema,
    message: z.string().min(1),
    fields: z.array(fieldErrorSchema).optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
