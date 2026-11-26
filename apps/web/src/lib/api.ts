import { env } from 'cloudflare:workers';

// Server-side API access for SSR pages (rule 1: the web only calls the API). Deployed, the API is
// reached through the `API` service binding (ADR 0019): internal to Cloudflare, no public hop.
// Locally (no binding) it is reached over HTTP at `API_ORIGIN` (the local API dev server).
// Responses are parsed with the shared output schemas; anything unexpected is treated as an error.

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number };

interface ServiceBinding {
  fetch(request: Request): Promise<Response>;
}

/** Host is ignored by a service binding; only the path and query matter. */
const INTERNAL_ORIGIN = 'https://api.internal';

/** Any schema with Zod's `safeParse` (the web app does not depend on zod directly). */
interface Schema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

export async function apiGet<T>(path: string, schema: Schema<T>): Promise<ApiResult<T>> {
  const runtime = env as unknown as { API?: ServiceBinding; API_ORIGIN?: string };
  // Deployed: service binding. Local development and e2e: HTTP to the local API (wrangler.jsonc).
  const send = runtime.API
    ? (request: Request) => (runtime.API as ServiceBinding).fetch(request)
    : runtime.API_ORIGIN
      ? (request: Request) => fetch(request)
      : null;
  if (!send) return { ok: false, status: 503 };
  const origin = runtime.API ? INTERNAL_ORIGIN : (runtime.API_ORIGIN as string);
  try {
    const res = await send(
      new Request(`${origin}/api/v1${path}`, { headers: { accept: 'application/json' } }),
    );
    if (!res.ok) return { ok: false, status: res.status };
    const parsed = schema.safeParse(await res.json());
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, status: 502 };
  } catch {
    return { ok: false, status: 503 };
  }
}
