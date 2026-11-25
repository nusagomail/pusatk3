# ADR 0016: Tetap di akun Cloudflare yang dipakai bersama selfgrow

Status: diterima · 25 November 2026 · keputusan pemilik (#32). Melengkapi ADR 0011 dan ADR 0015.

## Konteks
Semua resource PusatK3 (`pusatk3-*`) ada di akun Cloudflare yang juga berisi proyek selfgrow. Izin token Cloudflare untuk Workers dan D1 berlaku untuk seluruh akun; Cloudflare tidak bisa membatasi token ke worker atau database tertentu. Token build Workers Builds (ADR 0015) tersedia selama install, build, dan deploy setiap commit di `main`.

Pilihan yang dipertimbangkan: (A) akun Cloudflare baru khusus PusatK3 sebelum production; (B) tetap satu akun dengan jaring pengaman. Pemilik memilih **B**: kedua proyek miliknya sendiri, dan datanya sudah terpisah.

## Keputusan
PusatK3 tetap di akun bersama. Data tetap terpisah (database, worker, dan bucket sendiri, semuanya bernama `pusatk3-*`); **akses tidak terpisah**.

Jaring pengaman (status terkini di `docs/akses.md`):
1. pnpm hanya me-resolve rilis npm berumur ≥ 3 hari (`minimumReleaseAge: 4320` di `pnpm-workspace.yaml`, dijaga `tests/workspace.test.ts`). Berlaku saat menambah/memperbarui paket; perubahan `pnpm-lock.yaml` tetap direview di PR. Pengecualian untuk patch keamanan mendesak lewat `minimumReleaseAgeExclude`, dengan persetujuan pemilik.
2. Hanya `main` yang di-build; `main` dilindungi ruleset (PR + dua cek CI wajib, tanpa force push, tanpa bypass). Saat developer pertama bergabung: *Require approvals = 1*.
3. Token production terpisah, hanya di environment GitHub `production` dengan persetujuan pemilik (ADR 0012).
4. Cadangan D1 production (Time Travel + ekspor berkala ke luar akun) dan notifikasi email untuk setiap deploy: disiapkan menjelang rilis production.
5. 2FA untuk akun Cloudflare dan GitHub pemilik, dan wajib untuk anggota.

## Konsekuensi
- **Risiko yang diterima:** kode yang berjalan dalam build staging (skrip build, dependensi npm) dan siapa pun yang bisa me-merge ke `main` secara teknis bisa mengubah atau menghapus resource production PusatK3 dan resource selfgrow. Jaring pengaman mengurangi peluang dan mempercepat pemulihan, tetapi tidak menghapus risikonya.
- Anggota akun Cloudflare melihat kedua proyek; akses Cloudflare untuk karyawan diberikan seminimal mungkin (`docs/akses.md`).
- Kuota paket gratis Workers dihitung per akun dan dipakai bersama selfgrow.
- Keputusan ini ditinjau ulang bila PusatK3 punya karyawan IT sendiri, menerima pembayaran, atau menyimpan data pribadi dalam jumlah besar. Pindah ke akun terpisah nanti tetap mungkin: buat resource baru, ekspor-impor D1 dan R2, sambungkan ulang Workers Builds, dan ganti token.
