import type { MiddlewareHandler } from 'hono';
import type { AppEnv, RateLimitBindingName } from '../env';
import { AppError } from '../lib/errors';

// Per-visitor rate limits (#28, ADR 0022) with the Workers Rate Limiting binding.
// The visitor IP comes from CF-Connecting-IP, which Cloudflare's edge sets on every request from
// the internet (clients cannot set or remove it). Requests from the web app arrive over the
// service binding without it; the web Worker then passes the visitor IP in VISITOR_IP_HEADER.
// That header is trusted ONLY when CF-Connecting-IP is absent, so a client on the internet can
// never choose its own key. Bindings exist in staging/production; local dev and tests have none.

export const VISITOR_IP_HEADER = 'X-PusatK3-Visitor-IP';

/** IPv6 addresses are grouped by /64 (one home or phone gets a whole /64 to rotate through). */
export function rateLimitKey(ip: string): string {
  if (!ip.includes(':')) return ip;
  const [head = '', tail = ''] = ip.toLowerCase().split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = ip.includes('::')
    ? [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
    : left;
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`;
}

export function visitorIp(request: Request): { ip: string; source: 'edge' | 'web' } | null {
  const edge = request.headers.get('CF-Connecting-IP');
  if (edge) return { ip: edge, source: 'edge' };
  const forwarded = request.headers.get(VISITOR_IP_HEADER);
  return forwarded ? { ip: forwarded, source: 'web' } : null;
}

/** Which source supplied the key, logged once per isolate (no IP): checks ADR 0022's assumption. */
const reportedSources = new Set<string>();

export function rateLimit(binding: RateLimitBindingName, scope: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const limiter = c.env[binding];
    const visitor = visitorIp(c.req.raw);
    if (limiter) {
      const source = visitor?.source ?? 'none';
      if (!reportedSources.has(source)) {
        reportedSources.add(source);
        console.log(JSON.stringify({ event: 'rate-limit-key-source', source }));
      }
    }
    if (limiter && visitor) {
      const { success } = await limiter.limit({ key: `${scope}:${rateLimitKey(visitor.ip)}` });
      if (!success) {
        c.header('Retry-After', '60');
        throw new AppError('RATE_LIMITED');
      }
    }
    await next();
  };
}
