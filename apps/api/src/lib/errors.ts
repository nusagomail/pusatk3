import { ERROR_HTTP_STATUS } from '@pusatk3/shared';
import type { ApiError, ErrorCode, FieldError } from '@pusatk3/shared';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Default user-facing messages (Indonesian; UI may localise by code). */
export const DEFAULT_ERROR_MESSAGES: Record<ErrorCode, string> = {
  BAD_REQUEST: 'Permintaan tidak dapat dibaca.',
  UNAUTHORIZED: 'Silakan masuk terlebih dahulu.',
  FORBIDDEN: 'Anda tidak memiliki akses.',
  NOT_FOUND: 'Data tidak ditemukan.',
  CONFLICT: 'Data bentrok dengan data yang sudah ada.',
  PAYLOAD_TOO_LARGE: 'Data yang dikirim terlalu besar.',
  UNSUPPORTED_MEDIA_TYPE: 'Format data harus JSON.',
  VALIDATION_ERROR: 'Periksa kembali isian Anda.',
  RATE_LIMITED: 'Terlalu banyak permintaan. Coba lagi nanti.',
  INTERNAL_ERROR: 'Terjadi kesalahan. Coba lagi nanti.',
  SERVICE_UNAVAILABLE: 'Layanan ini belum tersedia. Coba lagi nanti.',
};

/** Throw from handlers/middleware to return a standard error body. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string = DEFAULT_ERROR_MESSAGES[code],
    readonly fields?: FieldError[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Writes `{ error: { code, message, fields? } }` with the status mapped from `code`.
 * `fields` is only sent with VALIDATION_ERROR. Errors are never cached.
 */
export function errorResponse(
  c: Context,
  code: ErrorCode,
  message: string = DEFAULT_ERROR_MESSAGES[code],
  fields?: FieldError[],
) {
  const withFields = code === 'VALIDATION_ERROR' && fields && fields.length > 0;
  const body: ApiError = { error: { code, message, ...(withFields ? { fields } : {}) } };
  c.header('Cache-Control', 'no-store');
  return c.json(body, ERROR_HTTP_STATUS[code] as ContentfulStatusCode);
}
