# Desain: `apps/api` — Hono di Workers dengan `/api/v1/health` (issue #3)

Status: disetujui pemilik, 25 November 2026 (opsi A untuk penjaga peran).

## Maksud

Fondasi API, satu-satunya tempat logika bisnis (ADR 0001): routing `/api/v1`, format error standar, request id, header keamanan, dan pola penjaga peran yang dipakai issue berikutnya.

## Tujuan

- `apps/api` (Hono di Workers), basis `/api/v1`, jalan lokal lewat `pnpm dev`.
- `GET /api/v1/health` → `{ status: 'ok', version }`, `Cache-Control: no-store`.
- Error selalu `apiErrorSchema` (`@pusatk3/shared`): 404 rute tak dikenal, 400 JSON rusak, 422 validasi Zod dengan `fields`, 500 tanpa detail internal.
- `X-Request-Id` di setiap respons; header keamanan (`nosniff`, `Referrer-Policy`, HSTS, CSP `default-src 'none'; frame-ancestors 'none'`, `X-Frame-Options: DENY`).
- Penjaga `requireUser`, `requireProviderRole(roles)`, `requireAdmin(roles)` yang **selalu menolak 401** sampai auth ada (Fase 2). Gerbang peran disetujui pemilik (opsi A).

## Bukan tujuan

Auth/sesi, D1, env staging/production (#7), CORS, rate limiting, deploy.

## Pendekatan

| Pilihan | Keputusan |
| --- | --- |
| A. Penjaga selalu menolak (fail-closed) + tes | **Dipilih pemilik** |
| B. Tanpa penjaga sampai Fase 2 | Ditolak: tidak ada pola untuk issue berikutnya |
| Tes di runtime Workers (`@cloudflare/vitest-pool-workers`) vs Node `app.request()` | Workers dipilih: sama dengan produksi, siap untuk D1 |
| Validator: helper sendiri di atas `hono/validator` vs `@hono/zod-validator` | Helper sendiri: tanpa dependensi tambahan, format error kita |

## Keputusan builder

- Versi dari var `APP_VERSION` (lokal `dev`; CI mengisi SHA commit di #8).
- Log error hanya request id + nama error; tanpa body/header/data pribadi.
- `X-Request-Id` dari klien dipakai hanya bila cocok pola aman bawaan Hono; selain itu dibuat baru.
