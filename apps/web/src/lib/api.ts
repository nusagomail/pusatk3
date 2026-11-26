import { env } from 'cloudflare:workers';
import { apiGetWith, type ApiResult, type ApiRuntime, type Schema } from './api-client';

// Server-side API access for SSR pages (rule 1: the web only calls the API). Deployed, the API is
// reached through the `API` service binding (ADR 0019): internal to Cloudflare, no public hop.
// Locally (no binding) it is reached over HTTP at `API_ORIGIN` (the local API dev server).

export type { ApiResult };

export function apiGet<T>(path: string, schema: Schema<T>): Promise<ApiResult<T>> {
  return apiGetWith(env as unknown as ApiRuntime, path, schema);
}
