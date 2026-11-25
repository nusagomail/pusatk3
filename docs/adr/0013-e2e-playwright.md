# ADR 0013: Tes end-to-end dengan Playwright

Status: diterima · 25 November 2026 · issue #9. Desain: `docs/superpowers/specs/2026-11-25-e2e-design.md`.

## Keputusan
- **Uji hasil build asli secara lokal (pilihan pemilik A).** `pnpm test:e2e` mem-build web lewat turbo, lalu Playwright menyalakan dua server:
  - web hasil build dengan `wrangler dev -c dist/client/wrangler.json` di `127.0.0.1:4322`. Ini workerd yang sama dengan Cloudflare: `_headers`, CSP, dan halaman 404 ikut teruji.
  - API dengan `wrangler dev` di `127.0.0.1:8787`.

  Hanya binding lokal yang dipakai, tanpa token dan tanpa resource remote. Kami tidak memakai `astro dev`, karena hasilnya berbeda dengan yang di-deploy. Situs staging juga tidak diuji di sini; uji asapnya sudah ada di `deploy-staging.yml`.
- **`@playwright/test` dikunci persis ke `1.63.0`** (rilis 4 September 2026). Versi ini cocok dengan Chromium yang sudah terpasang di sesi cloud Claude Code, sehingga sesi tidak perlu mengunduh browser. CI memasang browser yang cocok dengan `playwright install --with-deps chromium`. Hanya Chromium yang dipakai.
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
- `reuseExistingServer` aktif di luar CI. Hentikan `pnpm dev` sebelum `pnpm test:e2e`, agar tes tidak memakai server lama.
- Tes e2e untuk fitur Fase 1 (pencarian, detail jadwal) ditambahkan di issue masing-masing.
