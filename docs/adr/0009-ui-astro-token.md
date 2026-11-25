# ADR 0009: Komponen Astro tanpa JS, token CSS yang dites, font disimpan sendiri

Status: diterima · 25 November 2026 · issue #6. Desain: `docs/superpowers/specs/2026-11-25-ui-design.md`.

## Keputusan
- **Token warna** sebagai custom property di `apps/web/src/styles/tokens.css` (terang di `:root`, gelap lewat `prefers-color-scheme` atau `data-theme`). Nilainya dikunci ke tabel di `docs/design-tokens.md` dan setiap pasangan teks/latar yang dipakai komponen dites kontras WCAG ≥ 4.5:1 (`apps/web/test/tokens.test.ts`). Menambah token = ubah dokumen + CSS di PR yang sama.
- **Komponen Astro tanpa JavaScript** untuk halaman publik (target Lighthouse ≥ 90). Satu-satunya skrip: tombol mode gelap (+ skrip inline kecil di `<head>` agar tidak berkedip). Dashboard React kelak memakai token/kelas yang sama.
- **Font** Plus Jakarta Sans disimpan sendiri lewat `@fontsource-variable/plus-jakarta-sans`: tanpa permintaan ke server Google (lebih cepat, tidak mengirim data pengunjung ke pihak ketiga).
- **Logo** dirender inline dari geometri `brand/logo-horizontal.svg` (dites sama) agar warna ikut tema dan huruf termuat; titik pusat selalu oranye.
- **Aksesibilitas dicek lint** (`eslint-plugin-jsx-a11y-x`, fork yang mendukung ESLint 10) dan tes (label, `aria-describedby`, target 44 px). Navigasi HP memakai `<details>` (tanpa JS).

## Konsekuensi
- Skrip inline tema perlu hash di CSP saat CSP web dipasang (#5).
- `packages/ui` belum dibuat; token dipindah ke paket bersama bila aplikasi mobile dimulai.
- Tes komponen merender HTML (Astro Container API); tampilan nyata dicek dengan tangkapan layar Chromium. E2E Playwright otomatis di #9.
