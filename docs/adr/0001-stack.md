# ADR 0001: Astro + Hono di Cloudflare, monorepo, API-first

Status: diterima · 25 November 2026

## Konteks
Pemilik sudah terbiasa dengan Astro, GitHub, dan Cloudflare. Platform butuh halaman publik yang cepat dan SEO-friendly, dashboard dinamis, dan rencana aplikasi mobile.

## Keputusan
- Monorepo pnpm + Turborepo.
- `apps/web`: Astro di Cloudflare; dashboard memakai komponen React.
- `apps/api`: Hono di Cloudflare Workers. Semua logika bisnis di sini.
- `packages/shared`: tipe dan skema Zod dipakai web, API, dan mobile.
- Mobile: PWA dulu, lalu Expo yang memakai API yang sama.

## Konsekuensi
- Tidak ada logika bisnis di Astro; perubahan aturan cukup di satu tempat.
- Aplikasi mobile tidak memerlukan backend baru.
