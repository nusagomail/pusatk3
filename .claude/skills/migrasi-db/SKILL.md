---
name: migrasi-db
description: Prosedur perubahan skema database PusatK3 (D1 + Drizzle). Gunakan setiap kali menambah/mengubah tabel atau kolom.
paths: packages/db/**
---

1. Ubah skema Drizzle di `packages/db/src/schema/`.
2. Perbarui `docs/skema-db.md` di perubahan yang sama.
3. Jalankan `pnpm db:generate`, lalu periksa file SQL migrasi yang dihasilkan baris demi baris.
4. Jika migrasi **menghapus atau mengubah kolom/tabel berisi data**: berhenti dan minta persetujuan pemilik, sertakan rencana pemindahan data.
5. Terapkan ke lokal: `pnpm db:migrate:local`, jalankan tes.
6. Jangan pernah menjalankan migrasi ke D1 remote dari sesi ini; staging dan production hanya lewat CI.
7. Tambahkan seed/fixture bila tes membutuhkan data baru.
