# ADR 0019: Halaman direktori SSR dan akses web → API

Status: diterima · 26 November 2026 · issue #24 (PR pertama: `/cari`). Melanjutkan ADR 0010 dan 0018.

## Keputusan
- **Halaman direktori dirender saat diminta (SSR)**: `/cari` (PR ini), lalu `/jadwal/[id]` dan `/penyedia/[slug]`. Halaman lain (beranda, 404) tetap prerender.
- **Web membaca API lewat service binding `API`** saat di-deploy. Jalur ini internal di Cloudflare dan tidak melewati internet publik. Staging: `pusatk3-api-staging`. **Production belum diberi binding**: menambah binding production butuh persetujuan pemilik (CLAUDE.md) dan masuk checklist `/siapkan-rilis`. Tanpa binding, halaman menampilkan pesan "sedang tidak bisa dimuat" (503), bukan error.
- **Lokal (`pnpm dev`, e2e) memakai HTTP ke API lokal** (`API_ORIGIN = http://127.0.0.1:8787`, hanya di konfigurasi tingkat atas). Service binding antara dua proses `wrangler dev` (dev registry) terbukti tidak stabil ("Network connection lost"). `API_ORIGIN` tidak diwariskan ke staging/production (vars per environment), dan tesnya ada di `tests/wrangler-config.test.ts`.
- **`assets.run_worker_first: ["/cari", "/jadwal/*", "/penyedia/*"]`**: dengan `not_found_handling: "404-page"`, navigasi browser ke path yang bukan file statis langsung mendapat `404.html` tanpa menjalankan Worker. Jalur SSR harus didaftarkan di sini.
- **Middleware Astro** (`apps/web/src/middleware.ts`) memasang header keamanan yang sama dengan `public/_headers` pada respons SSR, karena `_headers` hanya berlaku untuk aset statis. Middleware juga memasang `frame-ancestors 'none'`, `X-Robots-Tag: noindex, nofollow` di luar production, dan `Cache-Control` (`s-maxage=300`, `stale-while-revalidate=600` bila sukses; `no-store` bila gagal).
- **Parameter halaman di-whitelist** (`src/lib/search-params.ts`) sebelum diteruskan ke API, dengan urutan tetap. `utm_*`/`fbclid` diabaikan. Isian yang tidak valid menghasilkan pesan di halaman (400), bukan error.
- **Konfigurasi hasil build pindah ke `dist/server/wrangler.json`** sejak ada halaman SSR. Ikut diperbarui:
  - hook pengaman (mengecek `dist/server` dan `dist/client`);
  - pengecekan nama worker di Workers Builds staging (ADR 0015);
  - `deploy-production.yml`;
  - e2e.

## Konsekuensi
- **Cache CDN belum efektif.** Header `s-maxage` saja tidak menyimpan respons Worker (ADR 0010), dan Cache API tidak tersedia di `*.workers.dev`. Setiap kunjungan staging memanggil API. Cache API dan purge dikerjakan di #29 setelah ada domain.
- Halaman SSR baru wajib ditambahkan ke `run_worker_first` (dijaga tes konfigurasi).
- e2e mengisi D1 lokal dengan data contoh (`pnpm db:migrate:local && pnpm db:import:local`) sebelum build dan tes. Jadwal contoh bertanggal Januari–Maret 2027 dan harus diperbarui sebelum itu, agar staging dan e2e tetap punya jadwal yang akan datang.
- Kartu hasil menautkan ke `/jadwal/[id]` dan `/penyedia/[slug]`. Kedua halaman itu dibuat di PR berikutnya (#24); sampai saat itu tautannya 404.
