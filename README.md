# PusatK3

Direktori independen pelatihan & sertifikasi K3 di Indonesia — [pusatk3.id](https://pusatk3.id).

> Status: Fase 0 (fondasi). Kerangka monorepo sudah ada; aplikasi belum dibuat.

## Mulai dari mana

- Gambaran produk: [`docs/prd.md`](docs/prd.md)
- Rencana kerja: [`docs/roadmap.md`](docs/roadmap.md)
- Arsitektur: [`docs/arsitektur.md`](docs/arsitektur.md)
- **Setup pertama kali:** [`docs/setup-claude-code.md`](docs/setup-claude-code.md)
- **Cloudflare (domain, resource production, secret):** [`docs/setup-cloudflare.md`](docs/setup-cloudflare.md)
- Cara kerja dengan Claude Code: [`docs/workflow.md`](docs/workflow.md) dan [`CLAUDE.md`](CLAUDE.md)
- Model bisnis: [`docs/bisnis.md`](docs/bisnis.md)
- Tampilan: [`docs/ui-halaman.md`](docs/ui-halaman.md), mockup di [`docs/mockup/`](docs/mockup/), logo di [`brand/`](brand/)

## Menjalankan proyek

Prasyarat: **Node 22.23.4 atau lebih baru di seri 22** (lihat `.nvmrc`) dan **pnpm**. Cara termudah memasang pnpm: `corepack enable` (bawaan Node), yang otomatis memakai versi terkunci di `packageManager`.

```bash
pnpm install     # pasang dependensi
pnpm dev         # jalankan semua app lokal
pnpm lint        # cek kualitas kode dan format
pnpm typecheck   # cek tipe TypeScript
pnpm test        # jalankan tes
pnpm build       # build semua app
pnpm db:migrate:local && pnpm db:seed:local   # siapkan database lokal
```

Struktur: `apps/` (aplikasi: web, api) dan `packages/` (kode bersama). Detail di [`docs/arsitektur.md`](docs/arsitektur.md).

## Stack

Astro + Hono di Cloudflare Workers, D1 + Drizzle, monorepo pnpm + Turborepo.
