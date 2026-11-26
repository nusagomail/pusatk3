import type { MiddlewareHandler } from 'hono';
import type { AppEnv, RateLimitBindingName } from '../env';
import { AppError } from '../lib/errors';

// Per-visitor rate limits (#28, ADR 0022) with the Workers Rate Limiting binding.
// The key is the visitor IP that Cloudflare's edge puts in CF-Connecting-IP (clients cannot set
// it). Requests from the web app arrive over the service binding without a public IP: the web
// Worker limits those itself (it sees the visitor), so the API limits direct public calls only.
// Bindings exist in staging/production (wrangler.jsonc); local dev and tests run without them.

export function clientIp(request: Request): string | null {
  return request.headers.get('CF-Connecting-IP');
}

export function rateLimit(binding: RateLimitBindingName, scope: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const limiter = c.env[binding];
    const ip = clientIp(c.req.raw);
    if (limiter && ip) {
      const { success } = await limiter.limit({ key: `${scope}:${ip}` });
      if (!success) {
        c.header('Retry-After', '60');
        throw new AppError('RATE_LIMITED');
      }
    }
    await next();
  };
}
