# ADR 0013: Tes end-to-end dengan Playwright

Status: diterima · 25 November 2026 · issue #9. Desain: `docs/superpowers/specs/2026-11-25-e2e-design.md`.

## Keputusan
- **Uji hasil build asli secara lokal (pilihan pemilik A).** `pnpm test:e2e` mem-build web lewat turbo, lalu Playwright menyalakan dua server:
  - web hasil build dengan `wrangler dev -c dist/server/wrangler.json` (sejak #24 ada halaman SSR; sebelumnya `dist/client/`) di `127.0.0.1:4322`. Ini workerd yang sama dengan Cloudflare: `_headers`, CSP, dan halaman 404 ikut teruji.
  - API dengan `wrangler dev` di `127.0.0.1:8787`.

  Hanya binding lokal yang dipakai, tanpa token dan tanpa resource remote. Kami tidak memakai `astro dev`, karena hasilnya berbeda dengan yang di-deploy. Situs staging juga tidak diuji di sini (staging di-deploy Workers Builds, ADR 0015).
- **`@playwright/test` dikunci persis ke `1.63.0`** (rilis 4 September 2026). Versi ini cocok dengan Chromium yang sudah terpasang di sesi cloud Claude Code, sehingga sesi tidak perlu mengunduh browser. CI memasang browser yang cocok dengan `playwright install --with-deps --only-shell chromium` (semua tes headless). Hanya Chromium yang dipakai.
- **Isi tes** (`e2e/`):
  - beranda tampil tanpa login dan label "Contoh tampilan" terlihat;
  - tidak ada error konsol atau exception (pelanggaran CSP ikut tertangkap);
  - build non-production mengirim `X-Robots-Tag: noindex`;
  - path yang tidak dikenal mendapat 404 beserta halaman 404;
  - `/api/v1/health` mengembalikan `ok`.
- **CI:** job `e2e` terpisah di `ci.yml`, berjalan sejajar dengan job pemeriksaan, tanpa secret. Laporan HTML tidak diunggah (tanpa action tambahan); keluaran `list` sudah cukup. Trace mati.
- Struktur ini dijaga oleh `tests/e2e-setup.test.ts`.

## Konsekuensi
- Menaikkan versi Playwright berarti versi baru tidak lagi cocok dengan browser bawaan sesi cloud. Saat menaikkan, pilih versi berumur ≥ 2 minggu dan perbarui tes struktur. Di sesi cloud, jalankan dengan `executablePath` `/opt/pw-browsers/chromium` bila versinya berbeda.
- Server selalu dinyalakan baru (`reuseExistingServer: false`, telemetri wrangler mati): bila port 4322/8787 terpakai (mis. `pnpm dev` masih jalan), tes gagal dengan jelas, bukan diam-diam menguji server lama.
- Sejak ADR 0015, deploy staging tidak menunggu CI; e2e menjaga PR sebelum di-merge. `retries: 1` di CI bisa menutupi tes yang tidak stabil; periksa tanda *flaky* di keluaran.
- Tes e2e untuk fitur Fase 1 (pencarian, detail jadwal) ditambahkan di issue masing-masing.
