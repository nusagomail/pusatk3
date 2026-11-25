# ADR 0007: Fondasi `apps/api` — error standar, penjaga fail-closed, tes di runtime Workers

Status: diterima · 25 November 2026 · issue #3. Desain: `docs/superpowers/specs/2026-11-25-api-design.md`.

## Konteks
API adalah satu-satunya tempat logika bisnis (ADR 0001). Pola error, validasi, dan otorisasi yang dibuat sekarang akan disalin oleh setiap endpoint berikutnya. Auth baru ada di Fase 2.

## Keputusan
- **Penjaga peran fail-closed.** `requireUser`, `requireProviderRole`, `requireAdmin` selalu menolak 401 sampai auth dibuat. Disetujui pemilik (gerbang peran, opsi A). Melonggarkannya butuh persetujuan pemilik.
- **Error terpusat.** `notFound` + `onError` menjamin setiap respons error mengikuti `apiErrorSchema`; error tak terduga tidak membocorkan pesan/stack dan hanya dicatat sebagai request id + nama error (tanpa data pribadi). Nilai non-`Error` yang di-throw dinormalkan agar tetap tertangani.
- **Validasi lewat helper sendiri** (`validateJson`, `validateQuery`) di atas `hono/validator`, bukan `@hono/zod-validator`: tanpa dependensi tambahan, langsung menghasilkan `fields`.
- **Header keamanan** memakai `secureHeaders` bawaan Hono. **Request id** memakai middleware sendiri: selalu dibuat server (`crypto.randomUUID()`, id dari klien diabaikan) dan dipasang sesudah handler, sehingga ada di setiap respons. Respons disalin menjadi bisa diubah (`mutableResponse`) agar redirect/`fetch()` yang diteruskan tetap mendapat header.
- **Body JSON wajib `Content-Type: application/json`** (415 bila bukan), agar body tidak diabaikan diam-diam dan `text/plain` (permintaan CORS "simple") tidak bisa dipakai untuk CSRF.
- **Node.js API dimatikan.** Sejak compat date 2026-08-04 `nodejs_compat` aktif bawaan; `wrangler.jsonc` memakai `no_nodejs_compat` + `no_nodejs_compat_v2` (diverifikasi: `process`/`Buffer` tidak ada). ESLint melarang global Node serta import `node:*` dan `cloudflare:test` di `apps/api/src`. Konfigurasi hanya dari binding (`c.env`). Catatan: plugin tes Vitest selalu menyalakan `nodejs_compat`, jadi larangan ini dijaga lint, bukan tes.
- **Tes di runtime Workers** dengan `@cloudflare/vitest-plugin` (workerd lokal), bukan Node, agar perilaku sama dengan produksi dan siap untuk D1/KV.
- **Versi** dari var `APP_VERSION` (`dev` lokal; CI mengisi SHA commit, #8).

## Konsekuensi
- Endpoint yang butuh login belum bisa dibuat sampai Fase 2; endpoint publik bisa.
- `createApp({ extend })` hanya untuk tes (memasang rute uji di `/api/v1`).
- `Cross-Origin-Resource-Policy: same-origin` (bawaan `secureHeaders`) perlu ditinjau saat web memanggil API dari origin lain.
- Untuk #7/#8: `vars` tidak diwariskan ke `env.*` di wrangler, jadi `APP_VERSION` wajib diisi per lingkungan (tanpa itu `/health` 500); saat observability Workers diaktifkan, log invocation memuat URL + query string yang bisa berisi data pribadi.
- `workers_dev: false` sampai lingkungan disiapkan, agar `wrangler deploy` tak sengaja tidak membuat URL publik.
