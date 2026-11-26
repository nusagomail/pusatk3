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
 * GET `/api/v1${path}`. Errors never throw: no route to the API → 503, API error → its status,
 * unexpected body → 502, network error or timeout → 503.
 */
export async function apiGetWith<T>(
  runtime: ApiRuntime,
  path: string,
  schema: Schema<T>,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = API_TIMEOUT_MS,
): Promise<ApiResult<T>> {
  const binding = runtime.API;
  const origin = binding ? INTERNAL_ORIGIN : runtime.API_ORIGIN;
  if (!origin) return { ok: false, status: 503 };
  const request = new Request(`${origin}/api/v1${path}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  try {
    const res = binding ? await binding.fetch(request) : await fetchImpl(request);
    if (!res.ok) return { ok: false, status: res.status };
    const parsed = schema.safeParse(await res.json());
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, status: 502 };
  } catch {
    return { ok: false, status: 503 };
  }
}
