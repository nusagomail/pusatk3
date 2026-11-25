import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';

export const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * Assigns a fresh request id (never taken from the client, so logs cannot be spoofed or
 * injected) and sets it on the final response, whatever the handler returned.
 */
export const requestId: MiddlewareHandler<AppEnv> = async (c, next) => {
  const id = crypto.randomUUID();
  c.set('requestId', id);
  await next();
  c.res.headers.set(REQUEST_ID_HEADER, id);
};

/**
 * Replaces the response with a copy whose headers can be changed (e.g. `Response.redirect()`
 * or a forwarded `fetch()` response), so outer middleware can always add headers.
 */
export const mutableResponse: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  c.res = new Response(c.res.body, c.res);
};
