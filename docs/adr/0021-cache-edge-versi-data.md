# ADR 0021: Cache edge dengan versi data (tanpa API purge)

Status: diterima · 26 November 2026 · issue #29. Melengkapi ADR 0010, 0018, dan 0019.

## Konteks
Respons Worker tidak masuk cache CDN hanya karena header `s-maxage` (ADR 0010). Halaman direktori (beranda, `/cari`, `/jadwal/:id`, `/penyedia/:slug`) dan API publik dirender di setiap kunjungan, sehingga setiap kunjungan menjalankan query D1. Purge per URL lewat API Cloudflare butuh zona `pusatk3.id` (domain belum dibeli) dan token API (secret). Selain itu, satu perubahan data mengubah banyak URL: hasil pencarian dengan berbagai query, profil, detail, beranda, dan nanti halaman kota × kategori.

## Keputusan
- **Cache API (`caches.default`) di kedua Worker.**
  - API: middleware `edgeCache` untuk `GET /search`, `/schedules/*`, `/providers/*`, `/cities`, `/categories` (`apps/api/src/middleware/edge-cache.ts`).
  - Web: `withPageCache` di middleware Astro untuk semua halaman SSR (`apps/web/src/lib/page-cache.ts`).
- **Yang disimpan:** hanya respons `200` dengan `Cache-Control: public…` dan tanpa `Set-Cookie`. Halaman yang turun mutu (API gagal atau daftar kosong) sudah `no-store` (ADR 0019), jadi tidak pernah tersimpan. Error, `HEAD`, `/health`, dan `/meta/data-version` tidak pernah disimpan.
- **Kunci cache = URL + `__cache=<versi data>.<versi aplikasi>`.**
  - Versi data ada di tabel `app_meta` (`data_version`).
  - Versi aplikasi = `APP_VERSION` (commit) di API dan id build di web.
  - Parameter `__cache` ditolak API bila dikirim klien (skema ketat → 422), sehingga klien tidak bisa menebak atau mengisi kunci.
- **"Purge" = versi data baru.** Setiap impor (`apps/api/scripts/import-sql.ts`, pernyataan terakhir) dan seed lokal menulis versi acak baru. Semua salinan lama tidak terjangkau lagi: tidak perlu API purge, zona, atau secret. Deploy baru mengganti versi aplikasi, jadi HTML lama tidak pernah merujuk aset `/_astro/*` yang sudah hilang (syarat ADR 0010). Di Fase 2, perubahan jadwal/profil oleh penyedia wajib menulis versi baru di transaksi yang sama.
- **Versi dibaca paling sering tiap 10 detik per isolate.**
  - API membacanya dari D1; web membacanya lewat `GET /api/v1/meta/data-version`.
  - Data baru terlihat paling lambat sekitar 10 detik setelah impor.
  - Bila versi tidak bisa dibaca, cache dilewati dan halaman dirender biasa (cache tidak pernah merusak halaman).
- **TTL salinan edge 1 jam** (`max-age=3600` pada salinan tersimpan). Klien tetap menerima `Cache-Control` aslinya. Header `X-Cache: HIT|MISS` untuk pemantauan.
- **Lighthouse ≥ 90** di keempat kategori pada beranda, pencarian, detail, dan profil (mobile dan desktop). Diukur 26 November 2026: semua 100, setelah font utama di-preload (pergeseran tata letak 0,196 di `/penyedia`).
  - Audit `is-crawlable` dilewati di luar production karena `noindex` memang disengaja (ADR 0011).
  - **Cek otomatis di CI menyusul:** paket `lighthouse` belum bisa dipasang karena aturan umur rilis pnpm (`minimumReleaseAge`). Penyebabnya adalah dependensi lain (`@cloudflare/workers-types` 5.20261125.1) yang ikut diperiksa ulang. Aturan itu tidak dilonggarkan; cek CI dipasang setelah versi itu berumur 3 hari (issue lanjutan).

## Konsekuensi
- **Di `*.workers.dev` (staging) Cache API tidak menyimpan apa pun**, jadi cache baru bekerja di zona `pusatk3.id`. Perilakunya diuji di workerd lokal (tes unit API, tes e2e API dan web).
- Setiap kunjungan tetap membaca versi data (memo 10 detik), dan query yang berbeda adalah kunci berbeda (mis. `/cari?q=…`). Cache tidak menggantikan rate limit: rate limit tetap wajib sebelum production (#28).
- Cache API bersifat per lokasi data center Cloudflare, bukan global. Kunjungan pertama di tiap lokasi tetap dirender.
- Data yang diubah langsung di database tanpa versi baru (mis. perbaikan manual) bisa tampil basi sampai 1 jam. Setiap jalur tulis wajib menulis versi baru.
- `createApp()` tanpa opsi tidak memakai cache. Tes yang memakai `SELF` (aplikasi yang dideploy) memakai cache dengan memo versi 10 detik.
