# ADR 0002: Cloudflare D1 + Drizzle ORM

Status: diterima · 25 November 2026

## Konteks
Data relatif kecil (ribuan penyedia, puluhan ribu jadwal). Beban baca utama ditanggung cache edge.

## Keputusan
D1 sebagai database utama, diakses lewat Drizzle ORM. Migrasi dibuat dengan drizzle-kit dan dijalankan ke remote hanya lewat CI.

## Alternatif
PostgreSQL (Neon/Supabase) via Hyperdrive: lebih kaya fitur (PostGIS, full-text), tapi menambah vendor dan biaya.

## Konsekuensi
- Fitur "terdekat" memakai perhitungan latitude/longitude.
- Pencarian teks memakai Meilisearch/Typesense, bukan database.
- Drizzle menjaga jalan pindah ke PostgreSQL tetap terbuka.
