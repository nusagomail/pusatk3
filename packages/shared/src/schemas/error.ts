import { z } from 'zod';

// API error body: { error: { code, message, fields? } } — see docs/api-contract.md.

export const ERROR_HTTP_STATUS = {
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
  SERVICE_UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_HTTP_STATUS;
export const ERROR_CODES = Object.keys(ERROR_HTTP_STATUS) as [ErrorCode, ...ErrorCode[]];
export const errorCodeSchema = z.enum(ERROR_CODES);

/** One invalid form field, e.g. `{ path: 'phone', message: 'Nomor tidak valid.' }`. */
export const fieldErrorSchema = z.object({
  path: z.string().min(1),
  message: z.string().min(1),
});
export type FieldError = z.infer<typeof fieldErrorSchema>;

export const ERROR_MESSAGE_MAX_LENGTH = 500;

// Response envelope: `z.object` strips unknown keys on parse, so internal fields never
// pass through and older clients keep working when a field is added later (ADR 0006).
export const apiErrorSchema = z.object({
  error: z
    .object({
      code: errorCodeSchema,
      message: z.string().trim().min(1).max(ERROR_MESSAGE_MAX_LENGTH),
      fields: z.array(fieldErrorSchema).optional(),
    })
    .refine((error) => error.fields === undefined || error.code === 'VALIDATION_ERROR', {
      message: 'fields is only allowed for VALIDATION_ERROR',
      path: ['fields'],
    }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
