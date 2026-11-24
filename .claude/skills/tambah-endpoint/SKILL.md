---
name: tambah-endpoint
description: Prosedur menambah atau mengubah endpoint API PusatK3 di apps/api (Hono), termasuk skema Zod, otorisasi, dan tes hak akses. Gunakan setiap kali menyentuh route API.
paths: apps/api/**
---

Saat menambah atau mengubah endpoint:

1. **Kontrak dulu.** Tambahkan/ubah baris di `docs/api-contract.md` (metode, path, peran).
2. **Skema Zod** input dan output di `packages/shared/src/schemas/`. Output selalu eksplisit; jangan mengembalikan baris database mentah.
3. **Route** di `apps/api/src/routes/`. Urutan middleware: rate limit (jika sensitif) → auth → validasi → otorisasi → handler.
4. **Otorisasi:** gunakan `requireUser`, `requireProviderRole`, atau `requireAdmin`. Ambil `providerId` dari record di database (mis. jadwal → penyedia pemiliknya), bukan dari body/query.
5. **Error** memakai format `{ error: { code, message } }`.
6. **Tes** di `apps/api/test/`: sukses untuk peran berhak; ditolak untuk anonim, user biasa, dan penyedia lain; input invalid → 422.
7. Jika endpoint publik dan dapat di-cache, set header cache dan daftarkan URL yang perlu di-purge saat data berubah.
8. Centang checklist di `docs/keamanan.md`.
