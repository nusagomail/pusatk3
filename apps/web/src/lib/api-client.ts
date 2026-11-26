// Pure API client for SSR pages (tested without the Workers runtime; `api.ts` wires `env`).

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number };

export interface ServiceBinding {
  fetch(request: Request): Promise<Response>;
}

export interface ApiRuntime {
  /** Deployed: service binding to the API Worker (ADR 0019). */
  API?: ServiceBinding;
  /** Local development and e2e only: base URL of the local API dev server. */
  API_ORIGIN?: string;
}

/** Any schema with Zod's `safeParse` (the web app does not depend on zod directly). */
export interface Schema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

/** Host is ignored by a service binding; only the path and query matter. */
const INTERNAL_ORIGIN = 'https://api.internal';
export const API_TIMEOUT_MS = 5000;

/**
 * Header carrying the visitor IP to the API over the service binding, for per-visitor rate
 * limits. The API trusts it only on requests without CF-Connecting-IP (ADR 0022).
 */
export const VISITOR_IP_HEADER = 'X-PusatK3-Visitor-IP';

function apiRequest(
  runtime: ApiRuntime,
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown; timeoutMs: number; visitorIp?: string | null },
): { request: Request; binding?: ServiceBinding } | null {
  const binding = runtime.API;
  const origin = binding ? INTERNAL_ORIGIN : runtime.API_ORIGIN;
  if (!origin) return null;
  const headers: Record<string, string> = { accept: 'application/json' };
  if (init.visitorIp) headers[VISITOR_IP_HEADER] = init.visitorIp;
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  const request = new Request(`${origin}/api/v1${path}`, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(init.timeoutMs),
  });
  return { request, binding };
}

/**
 * GET `/api/v1${path}`. Errors never throw: no route to the API → 503, API error → its status,
 * unexpected body → 502, network error or timeout → 503.
 */
export async function apiGetWith<T>(
  runtime: ApiRuntime,
  path: string,
  schema: Schema<T>,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = API_TIMEOUT_MS,
  visitorIp?: string | null,
): Promise<ApiResult<T>> {
  const prepared = apiRequest(runtime, path, { method: 'GET', timeoutMs, visitorIp });
  if (!prepared) return { ok: false, status: 503 };
  try {
    const { request, binding } = prepared;
    const res = binding ? await binding.fetch(request) : await fetchImpl(request);
    if (!res.ok) return { ok: false, status: res.status };
    const parsed = schema.safeParse(await res.json());
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, status: 502 };
  } catch {
    return { ok: false, status: 503 };
  }
}

/** Result of a POST: the API status, or 503 when the API cannot be reached. */
export interface ApiPostResult {
  status: number;
  /** Field errors of a 422 answer, for the form. */
  fields?: { path: string; message: string }[];
}

/** POST JSON to `/api/v1${path}`. Never throws (same rules as `apiGetWith`). */
export async function apiPostWith(
  runtime: ApiRuntime,
  path: string,
  body: unknown,
  { fetchImpl = fetch, visitorIp }: { fetchImpl?: typeof fetch; visitorIp?: string | null } = {},
): Promise<ApiPostResult> {
  const prepared = apiRequest(runtime, path, {
    method: 'POST',
    body,
    timeoutMs: API_TIMEOUT_MS,
    visitorIp,
  });
  if (!prepared) return { status: 503 };
  try {
    const { request, binding } = prepared;
    const res = binding ? await binding.fetch(request) : await fetchImpl(request);
    if (res.status !== 422) return { status: res.status };
    const error = (await res.json().catch(() => null)) as {
      error?: { fields?: { path: unknown; message: unknown }[] };
    } | null;
    const fields = (error?.error?.fields ?? [])
      .filter((f) => typeof f.path === 'string' && typeof f.message === 'string')
      .map((f) => ({ path: f.path as string, message: f.message as string }));
    return { status: 422, fields };
  } catch {
    return { status: 503 };
  }
}
