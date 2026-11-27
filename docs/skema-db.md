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
| `providers` **[dibuat]** | slug (unik), name, type (pjk3/lsp/tuk), description, logo_key, whatsapp (format `62…`), email, phone, website (https), status (unclaimed/claimed/closed, bawaan unclaimed), verification_status (none/pending/verified/suspended, bawaan none), verified_at, plan (free/pro/business, bawaan free), is_sample (bawaan false) | Dibuat dari data publik bila belum diklaim. `plan` tidak pernah memengaruhi badge atau urutan organik. `is_sample` = data contoh (staging/lokal), selalu berlabel "Contoh" di UI |
| `provider_members` | provider_id, user_id, role (owner/admin/staff) | Tepat satu owner per penyedia |
| `provider_claims` | provider_id, user_id, status (pending/approved/rejected), evidence_keys, reviewed_by, reviewed_at, note | |
| `provider_licenses` **[dibuat]** | provider_id, kind (izin_pjk3/lisensi_lsp/tuk), number, issuer (teks bebas), document_key, valid_until (tanggal, nullable) | Perubahan → verification_status = pending (ditegakkan di API, Fase 2). Unik per (penyedia, kind, number) |
| `branches` **[dibuat]** | provider_id, name, city_id → cities, address, lat, lng (nullable, diisi bersamaan, dalam rentang peta), is_main (bawaan false) | Nama cabang unik per penyedia (kunci impor) |

## Katalog & jadwal

| Tabel | Kolom utama | Catatan |
| --- | --- | --- |
| `app_meta` **[dibuat]** | key (PK), value, updated_at | Status aplikasi kunci/nilai. `data_version` = versi data publik, ditulis ulang setiap impor/seed; kunci cache edge memakainya (ADR 0021) |
| `cities` **[dibuat]** | slug (unik), name, province | Daftar rujukan `docs/data/kota.csv` (65 kota/kabupaten, #54), dipakai seed lokal dan impor; `SAMPLE_CITIES` (8 kota, bagian dari daftar itu) hanya untuk tes. `GET /cities` hanya menampilkan kota yang punya cabang penyedia |
| `course_fields` **[dibuat]** | slug (unik), name, sort_order | Bidang (14), lihat `docs/kategori-k3.md`; `sort_order` = urutan di CSV |
| `course_categories` **[dibuat]** | field_id → course_fields, slug (unik), name, issuers (kemnaker/bnsp/pupr/esdm/intl, array JSON), document_type, typical_validity_years (nullable), regulation_ref, synonyms (array JSON, bawaan `[]`) | Seed dari `docs/data/kategori-k3.csv` (`pnpm db:seed:local`, upsert per slug); sinonim dari kolom `sinonim` CSV, dipakai `GET /search` (ADR 0020) |
| `schedules` **[dibuat]** | provider_id, branch_id (wajib untuk offline, kosong untuk online; harus cabang milik penyedia yang sama), category_id → course_categories, title, issuer (kemnaker/bnsp/pupr/esdm/intl), mode (offline/online), start_date, end_date (tanggal, end ≥ start), price_idr (nullable, ≥ 0), quota (nullable, ≥ 1), description, requirements, level (nullable, mis. Kelas I / Madya), certificate_kind (official/training_only), status (draft/published/expired, bawaan draft) | Expired otomatis lewat Cron. Indeks: (status, start_date), provider_id, category_id, branch_id. Unik per (provider_id, category_id, start_date, title) = kunci impor |
| `saved_schedules` | user_id, schedule_id | |

## Lead & ulasan

| Tabel | Kolom utama | Catatan |
| --- | --- | --- |
| `leads` **[dibuat]** | provider_id, schedule_id (nullable: klik dari profil), user_id (nullable, Fase 2), channel (whatsapp/form), name, phone (`62…`), email, message, consent_at, anonymized_at, status (new/contacted/registered/closed, bawaan new) | UU PDP (ADR 0022): klik WhatsApp tanpa data pribadi (dijaga CHECK); form wajib persetujuan + nama + pesan + HP/email; data pribadi dikosongkan 12 bulan setelah `created_at` (Cron harian). Indeks: (provider_id, created_at), schedule_id, created_at |
| `profile_views` **[dibuat]** | provider_id, schedule_id (`''` untuk profil), day (tanggal Jakarta), count (≥ 0) | Agregat harian, tanpa data pengunjung; unik per (provider_id, schedule_id, day); diisi Fase 2 bersama statistik dasbor (ADR 0022) |
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
- Nilai enum di tabel ini juga ada sebagai konstanta di `packages/shared/src/constants.ts`; ubah keduanya bersama. Kolom `issuer` di `provider_licenses` adalah **teks bebas** (mis. "Kemnaker RI", atau nama LSP untuk TUK); `cert_reminders.issuer` diputuskan saat tabelnya dibuat.
- Kolom enum dijaga `CHECK` di database (dibangun dari konstanta yang sama), selain validasi Zod.
- Tanggal kalender (jadwal, masa berlaku izin) disimpan sebagai teks `YYYY-MM-DD` (hari menurut Asia/Jakarta, tanpa zona waktu); waktu kejadian tetap integer milidetik UTC (ADR 0014).
- Skema input data direktori (`providerInputSchema`, `branchInputSchema`, `licenseInputSchema`, `scheduleInputSchema` di `packages/shared`) tidak pernah menerima status, verifikasi, atau paket.
- Hapus akun user: soft delete + anonimisasi data pribadi di `leads` sesuai kebijakan retensi.
- Tidak ada kolom untuk menyimpan scan sertifikat user.
