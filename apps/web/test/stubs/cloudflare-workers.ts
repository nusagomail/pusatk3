// Test stand-in for the Workers runtime module: no bindings, so apiGet() answers 503 and pages
// render their fallbacks (`apps/web/vitest.config.ts`).
export const env: Record<string, unknown> = {};
export function waitUntil(promise: Promise<unknown>): void {
  void promise;
}
