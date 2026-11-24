---
name: halaman-seo
description: Prosedur membuat atau mengubah halaman publik PusatK3 (direktori, kota × pelatihan, profil, jadwal) agar cepat, bisa di-cache, dan optimal untuk SEO serta pencarian AI (GEO).
paths: apps/web/src/pages/**
---

Setiap halaman publik wajib:

1. **Tanpa login** dan dirender di server, dengan header cache `s-maxage` + `stale-while-revalidate`.
2. **Meta:** `<title>` unik, meta description, canonical, `hreflang` id/en bila ada versi Inggris, Open Graph.
3. **Data terstruktur schema.org (JSON-LD):** `Course` + `CourseInstance` untuk jadwal, `Organization`/`LocalBusiness` untuk penyedia, `FAQPage` untuk FAQ, `BreadcrumbList`.
4. **Mudah dikutip AI:** kalimat jawaban singkat di atas, lalu tabel jadwal/harga/syarat dalam HTML biasa.
5. **Aturan halaman tipis:** halaman kota × kategori hanya diterbitkan (dan masuk sitemap) bila punya minimal jumlah jadwal aktif yang ditetapkan di konfigurasi; jika tidak, `noindex`.
6. **Performa:** gambar lewat Cloudflare Images dengan ukuran eksplisit, JS seminimal mungkin (island hanya bila perlu), target Lighthouse ≥ 90.
7. **Aksesibilitas:** heading berurutan, label form, kontras sesuai `docs/design-tokens.md`, target sentuh 44 px.
8. Tambahkan URL ke sitemap dan daftar purge cache.
9. Tambahkan e2e Playwright: halaman tampil, JSON-LD valid, tidak ada error konsol.
