# Arsitektur

## Prinsip

- **API-first:** semua logika bisnis di `apps/api`; web dan mobile hanya klien.
- **Edge-cache halaman publik:** sebagian besar trafik dilayani dari CDN; database hanya untuk yang dinamis.
- **Satu sumber data:** jadwal diperbarui sekali, tampil di direktori, profil, dan website instan.

## Struktur repo

```
apps/
  web/        Astro (SSR di Cloudflare) — halaman publik + dashboard (komponen React)
  api/        Hono di Cloudflare Workers — REST /api/v1
  mobile/     Expo (Fase 5)
packages/
  shared/     tipe, skema Zod, konstanta (peran, status, penerbit); kategori K3 ada di DB (seed)
  db/         skema Drizzle + migrasi D1
  ui/         design tokens + komponen (opsional, bila dipakai web & mobile)
docs/
.claude/
```

## Komponen Cloudflare

| Kebutuhan | Layanan |
| --- | --- |
| Web | Astro di Cloudflare (Workers) |
| API | Workers + Hono |
| Database | D1 (`pusatk3-staging`, `pusatk3-production`) via Drizzle |
| File & gambar | R2 + Cloudflare Images |
| Cache data ringan | KV (mis. query populer) |
| Proses latar | Queues (notifikasi lead), Cron Triggers (jadwal kedaluwarsa, pengingat) |
| Anti-bot | Turnstile di semua form |
| Keamanan | WAF, rate limiting |
| Website instan | Cloudflare for SaaS (Custom Hostnames) |

Layanan pihak ketiga: Meilisearch/Typesense (pencarian), Resend (email), Midtrans/Xendit (pembayaran, Fase 4), Sentry, PostHog.

## Alur cache halaman publik

1. Request ke halaman publik → cek cache CDN.
2. Miss → render SSR dengan data dari API → simpan dengan `stale-while-revalidate`.
3. Penyedia mengubah jadwal/profil → API memasukkan tugas ke Queue → purge URL terkait (profil, detail jadwal, halaman kota × kategori).

## Lingkungan

- `local`: wrangler dev + D1 lokal
- `staging`: deploy otomatis dari `main`
- `production`: deploy manual dengan persetujuan pemilik

## Keputusan

Lihat `docs/adr/`.
