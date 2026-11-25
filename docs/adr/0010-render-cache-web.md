# ADR 0010: Render dan cache halaman publik di Cloudflare

Status: diterima · 25 November 2026 · issue #5. Desain: `docs/superpowers/specs/2026-11-25-beranda-design.md`. Melanjutkan ADR 0001 dan 0009.

## Konteks
Aturan wajib 4: halaman publik bisa di-cache CDN dan tanpa login. Respons yang dibuat Worker (SSR) **tidak** otomatis tersimpan di cache CDN hanya karena header `Cache-Control`; aset statis Workers Static Assets tersimpan otomatis.

## Keputusan
- **Adapter `@astrojs/cloudflare`.** Halaman di-prerender (statis) secara bawaan dan disajikan dari CDN. Halaman yang butuh data segar memilih SSR dengan `export const prerender = false`.
- **Beranda (#5) di-prerender**: isinya statis (data contoh berlabel, opsi A pemilik). Lighthouse 100 di keempat kategori (HP dan desktop).
- **Header statis** di `apps/web/public/_headers`: keamanan untuk `/*` (nosniff, HSTS, `X-Frame-Options: DENY` + `frame-ancestors 'none'`, Referrer-Policy, Permissions-Policy) dan `Cache-Control: public, max-age=0, must-revalidate, s-maxage=3600, stale-while-revalidate=86400` per halaman publik. `Cache-Control` tidak dipasang di `/*` karena akan digabung dengan aturan `/_astro/*` (immutable) dari adapter.
- **CSP** lewat `security.csp` Astro (meta dengan hash setiap skrip/style) + hash eksplisit untuk skrip tema inline yang tidak di-hash Astro; aset tidak pernah di-inline sebagai `data:` (`assetsInlineLimit: 0`). Dijaga oleh tes hasil build.
- **Fase 1 (SSR + cache):** halaman yang memakai data API (hasil cari, detail jadwal, profil, kota × kategori) memakai SSR dengan header `s-maxage` + `stale-while-revalidate` **dan** Cache API (`caches.default`) atau Cache Rules di zona `pusatk3.id`, karena header saja tidak membuat respons Worker tersimpan. Purge per URL saat data berubah (`docs/arsitektur.md`). Diputuskan rinci di issue pertama yang membuat halaman SSR.
- **Dimatikan sampai dibutuhkan:** sesi Astro (`session: false`, menghindari KV otomatis), binding Images (`imageService: 'passthrough'`), observability Workers (log memuat URL lengkap; diputuskan di #7), `workers_dev`.
- **Video intro** tidak di-bundle: URL dari `PUBLIC_MEDIA_BASE_URL` (https, mis. bucket R2 `pusatk3-media` di #7). Tanpa URL: poster + transkrip, tanpa `VideoObject`.
- **Halaman internal** `/internal/komponen` hanya di-route saat `astro dev`.
- **React ditunda** ke Fase 2 (dashboard). Issue #5 menyebut integrasi React; dipasang saat ada komponen yang memakainya.

## Konsekuensi
- Setiap halaman publik prerender baru: tambahkan aturan `Cache-Control` di `public/_headers` dan path di `src/data/site.ts` (`PUBLIC_PAGES`, untuk sitemap).
- Prerender memakai runtime workerd; di lingkungan tanpa internet muncul pesan "Request was cancelled" (adapter mengambil contoh `request.cf`) tanpa menggagalkan build.
