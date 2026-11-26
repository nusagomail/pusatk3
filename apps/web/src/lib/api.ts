import { AsyncLocalStorage } from 'node:async_hooks';
import { env } from 'cloudflare:workers';
import {
  apiGetWith,
  apiPostWith,
  type ApiPostResult,
  type ApiResult,
  type ApiRuntime,
  type Schema,
} from './api-client';

// Server-side API access for SSR pages (rule 1: the web only calls the API). Deployed, the API is
// reached through the `API` service binding (ADR 0019): internal to Cloudflare, no public hop.
// Locally (no binding) it is reached over HTTP at `API_ORIGIN` (the local API dev server).

export type { ApiPostResult, ApiResult };

/**
 * The visitor of the request being rendered (set by the middleware), so every API call carries
 * the visitor IP for the API's per-visitor rate limits (ADR 0022) without passing it around.
 * Call the API from page/endpoint frontmatter (as all pages do): code that runs later while the
 * response streams may run outside this context, and then the API sees no visitor IP.
 */
export const visitorContext = new AsyncLocalStorage<{ ip: string | null }>();

/** Cloudflare's edge sets CF-Connecting-IP on every request from the internet. */
export function visitorIpOf(request: Request): string | null {
  return request.headers.get('CF-Connecting-IP');
}

const runtime = () => env as unknown as ApiRuntime;
const currentVisitorIp = () => visitorContext.getStore()?.ip ?? null;

export function apiGet<T>(
  path: string,
  schema: Schema<T>,
  { timeoutMs }: { timeoutMs?: number } = {},
): Promise<ApiResult<T>> {
  return apiGetWith(runtime(), path, schema, fetch, timeoutMs, currentVisitorIp());
}

export function apiPost(path: string, body: unknown): Promise<ApiPostResult> {
  return apiPostWith(runtime(), path, body, { visitorIp: currentVisitorIp() });
}
