# Roadmap

Setiap fase dipecah menjadi issue GitHub (label `fase-0` … `fase-5`). Claude Code mengerjakan satu issue per sesi. Fase berikutnya dimulai setelah kriteria selesai terpenuhi.

## Fase 0 — Fondasi

- [x] Monorepo pnpm + Turborepo: `apps/web`, `apps/api`, `packages/shared`
- [x] TypeScript strict, ESLint, Prettier, Vitest, Playwright
- [x] Astro di Cloudflare (`apps/web`), Hono di Workers (`apps/api`), contoh endpoint `/api/v1/health`
- [x] D1 + Drizzle: konfigurasi, migrasi pertama (tabel dasar)
- [x] Lingkungan `staging` dan `production` di wrangler; resource bernama `pusatk3-*`
- [x] GitHub Actions: lint, typecheck, test di setiap PR; deploy staging dari `main`; deploy production manual
- [x] Design tokens + komponen dasar (tombol, input, kartu, badge, header, footer) sesuai `docs/design-tokens.md`
- [x] Isi bagian "Perintah" di `CLAUDE.md`

**Selesai bila:** PR contoh lolos CI, staging menampilkan halaman beranda statis dan `/api/v1/health` merespons.

Status: Fase 0 **belum selesai**. Semua butir sudah dikerjakan; e2e lulus lokal dan dijalankan CI di PR issue #9. Tampilan beranda dan health **di staging** menunggu pemilik mengatur environment GitHub dan token Cloudflare (`docs/setup-cloudflare.md` langkah 4); setelah itu deploy staging pertama otomatis berjalan dan diuji asap.

## Fase 1 — Direktori publik

- [ ] Skema: penyedia, cabang, kategori pelatihan, jadwal, legalitas
- [ ] Skrip impor data hasil kurasi (CSV → D1) dengan deduplikasi
- [ ] Halaman: beranda, hasil pencarian, detail jadwal, profil penyedia
- [ ] Pencarian dengan filter + sinonim K3; sinkronisasi index
- [ ] Halaman SEO kota × jenis pelatihan (hanya terbit jika data cukup), sitemap, schema.org
- [ ] Pencatatan lead (klik WA, form pertanyaan) dengan Turnstile
- [ ] Cache edge + purge saat data berubah

**Selesai bila:** data contoh 1 wilayah tampil lengkap, Lighthouse ≥ 90 di halaman publik, lead tercatat.

## Fase 2 — Akun & klaim

- [ ] Auth tanpa password: Google + email OTP; sesi; 2FA untuk penyedia/admin
- [ ] Alur klaim profil + antrean verifikasi admin
- [ ] Dashboard penyedia: ringkasan, jadwal (CRUD), lead, edit profil & cabang, tim & peran, pengaturan akun
- [ ] Verifikasi ulang saat nomor WA atau data legalitas berubah
- [ ] Dashboard user: jadwal tersimpan, riwayat pertanyaan, pengaturan, hapus akun
- [ ] Admin: verifikasi, moderasi, "lihat sebagai" dengan log audit

**Selesai bila:** tes hak akses lintas penyedia lulus semua; penyedia bisa klaim → diverifikasi → kelola jadwal.

## Fase 3 — Siap luncur

- [ ] Halaman legal (privasi, S&K, syarat penyedia, disclaimer, cookie, cara mengurutkan hasil), FAQ
- [ ] Hardening: WAF, rate limiting, header keamanan, review keamanan menyeluruh
- [ ] Pentest eksternal, perbaikan temuan
- [ ] Analytics, pemantauan error (Sentry), alert
- [ ] GEO: robots untuk crawler AI, data terstruktur lengkap
- [ ] Badan usaha, pendaftaran PSE, review hukum

**Selesai bila:** checklist `docs/keamanan.md` terpenuhi dan pemilik menyetujui peluncuran.

## Fase 4 — Monetisasi

- [ ] Paket & langganan (Midtrans/Xendit), invoice, upgrade/downgrade, coba gratis 14 hari
- [ ] Slot sponsor berlabel di kota/kategori
- [ ] Statistik lead lengkap untuk penyedia

## Fase 5 — Pertumbuhan

- [ ] E-course (konten ditinjau Ahli K3)
- [ ] Website instan: subdomain lalu custom domain (Cloudflare for SaaS)
- [ ] Pengingat sertifikat dan mode perusahaan (HR)
- [ ] PWA, lalu aplikasi Expo
- [ ] Laporan data orisinal untuk GEO (mis. kisaran biaya per kota)
