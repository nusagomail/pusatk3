import type { ErrorCode } from '@pusatk3/shared';
import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../env';
import { AppError, errorResponse } from '../lib/errors';

const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
};

export const notFound: NotFoundHandler<AppEnv> = (c) => errorResponse(c, 'NOT_FOUND');

export const onError: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof AppError) return errorResponse(c, err.code, err.message, err.fields);

  if (err instanceof HTTPException) {
    // Hono's own messages are not shown. Any other client error (4xx) is a 400, never a 500.
    const code = CODE_BY_STATUS[err.status] ?? (err.status < 500 ? 'BAD_REQUEST' : undefined);
    if (code) return errorResponse(c, code);
  }

  // Unexpected: log only the request id and error name (no message: may contain PII or SQL).
  const name = err instanceof Error ? err.name : typeof err;
  console.error(JSON.stringify({ level: 'error', requestId: c.get('requestId'), error: name }));
  return errorResponse(c, 'INTERNAL_ERROR');
};
