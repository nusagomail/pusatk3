# ADR 0021: Cache edge dengan versi data (tanpa API purge)

Status: diterima · 26 November 2026 · issue #29. Melengkapi ADR 0010, 0018, dan 0019.

## Konteks
Respons Worker tidak masuk cache CDN hanya karena header `s-maxage` (ADR 0010). Halaman direktori (beranda, `/cari`, `/jadwal/:id`, `/penyedia/:slug`) dan API publik dirender di setiap kunjungan, sehingga setiap kunjungan menjalankan query D1. Purge per URL lewat API Cloudflare butuh zona `pusatk3.id` (domain belum dibeli) dan token API (secret). Selain itu, satu perubahan data mengubah banyak URL: hasil pencarian dengan berbagai query, profil, detail, beranda, dan nanti halaman kota × kategori.

## Keputusan
- **Cache API (`caches.default`) di kedua Worker.**
  - API: middleware `edgeCache` untuk `GET /search`, `/schedules/*`, `/providers/*`, `/cities`, `/categories` (`apps/api/src/middleware/edge-cache.ts`).
  - Web: `withPageCache` di middleware Astro untuk semua halaman SSR (`apps/web/src/lib/page-cache.ts`).
- **Yang disimpan:** hanya respons `200` dengan `Cache-Control: public…`, tanpa `Set-Cookie`, dan (web) tanpa cookie yang diset lewat `Astro.cookies`. Halaman yang turun mutu (API gagal atau daftar kosong) sudah `no-store` (ADR 0019), jadi tidak pernah tersimpan. Error, `HEAD`, `/health`, dan `/meta/data-version` tidak pernah disimpan.
- **Cache bersama hanya untuk anonim:** request dengan `Cookie` atau `Authorization` tidak membaca maupun mengisi cache, apa pun header route-nya (pengaman untuk sesi Fase 2).
- **Mati di lokal:** API dengan `APP_VERSION=dev` (`wrangler dev`, `pnpm dev`) dan web selain build production (`astro dev`) tidak memakai cache. E2E memberi API versi acak per run, jadi sisa cache di `.wrangler/state` tidak pernah tersaji.
- **Kunci cache = URL + `__cache=<versi>…<tanggal Jakarta>`.**
  - API: versi data (`app_meta.data_version`) + `APP_VERSION` (commit) + tanggal Asia/Jakarta (jadwal yang selesai hilang tepat tengah malam WIB).
  - Web: jawaban `/meta/data-version` (= versi data **dan** `APP_VERSION` API, jadi deploy atau rollback API saja juga mengganti kunci halaman) + id build web + tanggal Jakarta.
  - Web hanya memasukkan parameter yang dibaca halaman (whitelist `/cari`; halaman lain tanpa query), dengan urutan tetap: `utm_*`/`fbclid` tidak memecah cache.
  - Request yang membawa `__cache` dilewati cache sepenuhnya. API juga menolaknya (skema ketat → 422; `/schedules/:id` dan `/providers/:slug` kini juga menolak parameter query).
- **"Purge" = versi data baru.** Setiap impor (`apps/api/scripts/import-sql.ts`, pernyataan terakhir) dan seed lokal menulis versi acak baru. Semua salinan lama tidak terjangkau lagi: tidak perlu API purge, zona, atau secret. Deploy baru mengganti versi aplikasi, jadi HTML lama tidak pernah merujuk aset `/_astro/*` yang sudah hilang (syarat ADR 0010). Di Fase 2, perubahan jadwal/profil oleh penyedia wajib menulis versi baru di transaksi yang sama.
- **Membaca versi:**
  - API membaca versi data dari D1 **di setiap request** (lookup primary key). Dengan begitu API tidak pernah memakai versi yang lebih lama dari halaman web yang memanggilnya. Kalau tidak, halaman berkunci versi baru bisa terisi data API lama (temuan review #29).
  - Web memakai memo 10 detik per isolate, sehingga data baru terlihat di halaman paling lambat sekitar 10 detik setelah impor.
  - Bila versi tidak bisa dibaca, cache dilewati dan halaman dirender biasa. Kegagalan diingat 2 detik dan batas waktunya 1 detik, sehingga halaman tidak menunggu lama saat API bermasalah. Cache tidak pernah merusak halaman: semua error cache ditangkap.
- Penulisan cache berjalan setelah jawaban dikirim (`waitUntil`), jadi streaming SSR tidak tertahan.
- **TTL salinan edge 1 jam** (`max-age=3600` pada salinan tersimpan). Klien tetap menerima `Cache-Control` aslinya. Header `X-Cache: HIT|MISS` untuk pemantauan.
- **Lighthouse ≥ 90** di keempat kategori pada beranda, pencarian, detail, dan profil (mobile dan desktop). Diukur 26 November 2026: semua 100, setelah font utama di-preload (pergeseran tata letak 0,196 di `/penyedia`).
  - Audit `is-crawlable` dilewati di luar production karena `noindex` memang disengaja (ADR 0011).
  - **Cek otomatis di CI menyusul:** paket `lighthouse` belum bisa dipasang karena aturan umur rilis pnpm (`minimumReleaseAge`). Penyebabnya adalah dependensi lain (`@cloudflare/workers-types` 5.20261125.1) yang ikut diperiksa ulang. Aturan itu tidak dilonggarkan; cek CI dipasang setelah versi itu berumur 3 hari (#41).

## Konsekuensi
- **Di `*.workers.dev` (staging) Cache API tidak menyimpan apa pun**, jadi cache baru bekerja di zona `pusatk3.id`. Perilakunya diuji di workerd lokal (tes unit API, tes e2e API dan web).
- Setiap kunjungan tetap membaca versi data (memo 10 detik), dan query yang berbeda adalah kunci berbeda (mis. `/cari?q=…`). Cache tidak menggantikan rate limit: rate limit tetap wajib sebelum production (#28).
- Cache API bersifat per lokasi data center Cloudflare, bukan global. Kunjungan pertama di tiap lokasi tetap dirender.
- Data yang diubah langsung di database tanpa versi baru (mis. perbaikan manual) bisa tampil basi sampai 1 jam. **Setiap jalur tulis wajib menulis versi baru**: impor lewat `dataVersionStatement`, Cron `expired` lewat `expireFinishedSchedules` (perubahan status + versi baru dalam satu batch, versi diperbarui setiap hari, #57). Fase 2 menyusul: edit penyedia dan aksi admin (mis. badge dicabut, profil dibekukan). Sebaiknya lewat satu helper dengan tes penjaga.
- Fase 4: slot sponsor yang berotasi akan "membeku" per salinan cache; rotasi perlu dirender di luar cache halaman atau masuk kunci.
- Pemanggilan API dari web lewat service binding memakai host `api.internal`. Setelah rilis di zona production, cek bahwa API langsung (`https://pusatk3.id/api/v1/search?...`) juga menjawab `X-Cache: HIT` (checklist `/siapkan-rilis`).
- `createApp()` tanpa opsi tidak memakai cache. Tes yang memakai `SELF` berjalan dengan `APP_VERSION=dev`, jadi cache mati di sana.
