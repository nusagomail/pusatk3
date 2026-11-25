# Skema database (draf)

Sumber kebenaran skema. Setiap perubahan skema di kode wajib memperbarui file ini di PR yang sama. Semua tabel punya `id` (ULID teks), `created_at`, `updated_at`. Waktu disimpan UTC sebagai integer milidetik (epoch). Array disimpan sebagai teks JSON. Status per tabel: **[dibuat]** = sudah ada di `packages/db/src/schema/` dan migrasi; lainnya masih rencana.

## Identitas & akses

| Tabel | Kolom utama | Catatan |
| --- | --- | --- |
| `users` | email, name, phone, locale (id/en), deleted_at | Satu akun untuk user dan anggota penyedia |
| `auth_accounts` | user_id, provider (google/email), provider_account_id | Dikelola library auth |
| `sessions` | user_id, expires_at, ip, user_agent | Untuk "perangkat yang sedang masuk" |
| `user_two_factor` | user_id, secret (terenkripsi), backup_codes (hash), enabled_at | Wajib untuk penyedia/admin |
| `admin_roles` | user_id, role (super_admin/curator/moderator/support) | |
| `audit_logs` | actor_user_id, action, target_type, target_id, metadata, ip | Termasuk "lihat sebagai" |

## Penyedia

| Tabel | Kolom utama | Catatan |
| --- | --- | --- |
| `providers` | slug, name, type (pjk3/lsp/tuk), description, logo_key, whatsapp, email, phone, website, status (unclaimed/claimed/closed), verification_status (none/pending/verified/suspended), verified_at, plan | Dibuat dari data publik bila belum diklaim |
| `provider_members` | provider_id, user_id, role (owner/admin/staff) | Tepat satu owner per penyedia |
| `provider_claims` | provider_id, user_id, status (pending/approved/rejected), evidence_keys, reviewed_by, reviewed_at, note | |
| `provider_licenses` | provider_id, kind (izin_pjk3/lisensi_lsp/tuk), number, issuer, document_key, valid_until | Perubahan → verification_status = pending |
| `branches` | provider_id, name, city_id, address, lat, lng, is_main | |

## Katalog & jadwal

| Tabel | Kolom utama | Catatan |
| --- | --- | --- |
| `cities` **[dibuat]** | slug (unik), name, province | Seed lokal: 8 kota contoh (`SAMPLE_CITIES`), bukan daftar kurasi |
| `course_fields` **[dibuat]** | slug (unik), name, sort_order | Bidang (14), lihat `docs/kategori-k3.md`; `sort_order` = urutan di CSV |
| `course_categories` **[dibuat]** | field_id → course_fields, slug (unik), name, issuers (kemnaker/bnsp/pupr/esdm/intl, array JSON), document_type, typical_validity_years (nullable), regulation_ref, synonyms (array JSON, bawaan `[]`) | Seed dari `docs/data/kategori-k3.csv` (`pnpm db:seed:local`, upsert per slug); sinonim diisi Fase 1 |
| `schedules` | provider_id, branch_id, category_id, title, issuer (kemnaker/bnsp/pupr/esdm/intl), mode (offline/online), start_date, end_date, price_idr (nullable), quota, description, requirements, level (nullable, mis. Kelas I / Madya), certificate_kind (official/training_only), status (draft/published/expired) | Expired otomatis lewat Cron |
| `saved_schedules` | user_id, schedule_id | |

## Lead & ulasan

| Tabel | Kolom utama | Catatan |
| --- | --- | --- |
| `leads` | provider_id, schedule_id, user_id (nullable), channel (whatsapp/form), name, phone, email, message, status (new/contacted/registered/closed) | Data pribadi: patuhi UU PDP |
| `profile_views` | provider_id, schedule_id, day, count | Agregat harian, bukan per pengunjung |
| `reviews` | provider_id, user_id, schedule_id, body, status (pending/published/hidden), provider_reply | Hanya dari peserta terverifikasi |

## Langganan (Fase 4)

| Tabel | Kolom utama |
| --- | --- |
| `plans` | code (free/pro/business), name, price_idr_monthly, limits (json) |
| `subscriptions` | provider_id, plan_code, status, trial_ends_at, current_period_end, gateway, gateway_ref |
| `invoices` | subscription_id, amount_idr, status, issued_at, paid_at |
| `sponsor_slots` | provider_id, city_id, category_id, starts_at, ends_at |

## User (Fase 5)

| Tabel | Kolom utama |
| --- | --- |
| `cert_reminders` | user_id, name, issuer, valid_until, notify_days_before |
| `courses`, `lessons`, `lesson_progress` | konten e-course + progres |

## Aturan
- Nilai enum di tabel ini juga ada sebagai konstanta di `packages/shared/src/constants.ts`; ubah keduanya bersama. Kolom `issuer` di `provider_licenses` dan `cert_reminders` belum ditetapkan apakah enum atau teks bebas (mis. nama LSP untuk TUK); putuskan saat tabelnya dibuat.
- Hapus akun user: soft delete + anonimisasi data pribadi di `leads` sesuai kebijakan retensi.
- Tidak ada kolom untuk menyimpan scan sertifikat user.
