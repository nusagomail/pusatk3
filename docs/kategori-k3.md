# Kategori Sertifikasi K3

Daftar kategori yang dipakai di direktori, filter pencarian, halaman SEO kota × kategori, dan pengingat sertifikat. Disusun ulang 25 November 2026 berdasarkan **jabatan yang benar-benar memiliki sertifikat/lisensi resmi**, bukan sekadar populer.

**Ringkasan:** 14 bidang, 59 kategori sertifikasi. Sumber data mesin: [`docs/data/kategori-k3.csv`](data/kategori-k3.csv) (dipakai untuk seed `course_categories`).

## Aturan

1. **Dua tingkat:** bidang (menu, halaman SEO) → kategori sertifikasi (filter, jadwal). Kelas/tingkat (mis. Kelas I–III, Muda/Madya/Utama) **tidak** dijadikan kategori terpisah; simpan di kolom `level` pada jadwal.
2. **Penerbit adalah data, bukan kode.** Satu kategori bisa punya beberapa penerbit (Kemnaker, BNSP/LSP, PUPR/LPJK, ESDM, internasional). Kebijakan berubah: Menaker (Sep 2025) menyatakan sertifikasi Ahli K3 diarahkan kembali ke LSP.
3. **Kategori baru** hanya ditambahkan bila ada dasar regulasi atau skema sertifikasi yang bisa dirujuk, dan ditinjau Ahli K3 sebelum terbit.
4. **Masa berlaku** di tabel adalah nilai umum untuk pengingat; selalu tampilkan "cek dokumen Anda" karena bisa berbeda per skema/penerbit. Tanda `*` = umumnya, bergantung skema.
5. Pelatihan internal/umum tanpa sertifikat resmi (mis. "awareness K3") boleh tayang di jadwal, tetapi dengan label **Sertifikat pelatihan (bukan lisensi)**.
6. Status regulasi dicek ulang tiap 6 bulan di JDIH Kemnaker / peraturan.bpk.go.id. Contoh: Permenaker 8/2020 dicabut sebagian oleh Permenaker 11/2026.

## Kode penerbit

| Kode | Penerbit | Bentuk dokumen umum |
| --- | --- | --- |
| KEMNAKER | Kementerian Ketenagakerjaan (lewat PJK3 bidang pembinaan) | SKP (ahli), Lisensi K3/SIO (operator, teknisi), sertifikat |
| BNSP | BNSP lewat LSP berlisensi, uji di TUK | Sertifikat kompetensi |
| PUPR | Kementerian PU / LPJK lewat LSP konstruksi | SKK Konstruksi |
| ESDM | Kementerian ESDM / PPSDM / LSP sektor | Sertifikat kompetensi sektor |
| INTL | Lembaga internasional (sukarela) | Sertifikat skema |


## 1. K3 Umum & Sistem Manajemen

`k3-umum` · Dasar: UU 1/1970; Permenaker PER.02/MEN/1992 (Ahli K3); PP 50/2012 (SMK3); Permenaker 13/2025 (P2K3)

| Kategori | Penerbit | Dokumen | Berlaku | Catatan |
| --- | --- | --- | --- | --- |
| Ahli K3 Umum (AK3U) | Kemnaker | SKP + sertifikat | 3 th (SKP) | Pembinaan ±120 JP oleh PJK3; diarahkan ke LSP (Menaker, Sep 2025) |
| Auditor SMK3 | Kemnaker | Sertifikat | — | ±40 JP; audit PP 50/2012 |
| Ahli K3 Muda / Madya / Utama (SKKNI K3) | BNSP (LSP) | SERKOM | 3 th* | Lewat LSP berlisensi |
| Petugas / Supervisor / Officer K3 | BNSP (LSP) | SERKOM | 3 th* | Skema LSP; nama jabatan beragam |
| Auditor / Lead Auditor ISO 45001 | Internasional | Sertifikat | Skema | Sukarela (mis. skema CQI-IRCA); bukan kewajiban hukum RI |

## 2. Pesawat Angkat & Angkut

`pesawat-angkat-angkut` · Dasar: Permenaker 8/2020 (sebagian dicabut Permenaker 11/2026); Kepmenaker 46/2025 (KKNI PAA)

| Kategori | Penerbit | Dokumen | Berlaku | Catatan |
| --- | --- | --- | --- | --- |
| Ahli K3 Spesialis PAA | Kemnaker | SKP | 3 th | ±250 JP |
| Teknisi / Petugas Riksa Uji PAA | Kemnaker | LISENSI | 5 th | ±90 JP |
| Operator Crane (mobile, crawler, overhead, tower, gantry, dll.) | Kemnaker | LISENSI (SIO) | 5 th | Kelas I / II / III; ±30 jenis crane |
| Operator Forklift / Lift Truck / Reach Stacker / Telehandler | Kemnaker | LISENSI (SIO) | 5 th | Kelas I / II |
| Operator Alat Berat (excavator, loader, dozer, grader, roller, dump truck, dll.) | Kemnaker | LISENSI (SIO) | 5 th | ±40 JP; BNSP juga punya skema operator |
| Operator Gondola, Passenger Hoist, Manlift/Boomlift, Scissor Lift | Kemnaker | LISENSI (SIO) | 5 th | ±30 JP |
| Operator Conveyor (ban/sabuk/rantai berjalan) & Lier/Takel | Kemnaker | LISENSI (SIO) | 5 th | ±30 JP |
| Juru Ikat (Rigger) | Kemnaker | LISENSI | 5 th | ±30 JP |

## 3. Pesawat Uap & Bejana Tekanan

`pesawat-uap-bejana-tekanan` · Dasar: UU Uap 1930; Permenaker 37/2016 (Bejana Tekanan & Tangki Timbun)

| Kategori | Penerbit | Dokumen | Berlaku | Catatan |
| --- | --- | --- | --- | --- |
| Ahli K3 Spesialis PUBT | Kemnaker | SKP | 3 th | ±250 JP |
| Teknisi Riksa Uji Pesawat Uap | Kemnaker | LISENSI | 5 th | ±90 JP |
| Teknisi Riksa Uji Bejana Tekanan & Tangki Timbun | Kemnaker | LISENSI | 5 th | ±90 JP |
| Operator Pesawat Uap (Boiler) | Kemnaker | LISENSI (SIO) | 5 th | Kelas I / II |

## 4. Pesawat Tenaga & Produksi

`pesawat-tenaga-produksi` · Dasar: Permenaker 38/2016

| Kategori | Penerbit | Dokumen | Berlaku | Catatan |
| --- | --- | --- | --- | --- |
| Ahli K3 Spesialis PTP | Kemnaker | SKP | 3 th | ±250 JP |
| Teknisi Riksa Uji PTP | Kemnaker | LISENSI | 5 th | ±90 JP |
| Operator Mesin Produksi & Perkakas | Kemnaker | LISENSI (SIO) | 5 th | Kelas I / II |
| Operator Tanur | Kemnaker | LISENSI (SIO) | 5 th | Kelas I / II |
| Operator Penggerak Mula (diesel/genset) | Kemnaker | LISENSI (SIO) | 5 th | Kelas I / II |
| Juru Las (listrik, gas, karbit, termit) & Operator Mesin Las | Kemnaker | LISENSI | 5 th | Kelas I / II / III; BNSP juga punya skema pengelasan |

## 5. Listrik & Penyalur Petir

`listrik` · Dasar: Permenaker 12/2015 (K3 Listrik); Permenaker 31/2015 (penyalur petir)

| Kategori | Penerbit | Dokumen | Berlaku | Catatan |
| --- | --- | --- | --- | --- |
| Ahli K3 Spesialis Listrik | Kemnaker | SKP | 3 th | ±165 JP |
| Teknisi K3 Listrik | Kemnaker | LISENSI | 5 th | ±65 JP |
| Tenaga Teknik Ketenagalistrikan (SKTTK) | ESDM | SERKOM | 3 th* | Rezim ESDM, lewat LSK ketenagalistrikan |

## 6. Elevator & Eskalator

`elevator-eskalator` · Dasar: Permenaker 6/2017

| Kategori | Penerbit | Dokumen | Berlaku | Catatan |
| --- | --- | --- | --- | --- |
| Ahli K3 Spesialis Elevator & Eskalator | Kemnaker | SKP | 3 th | ±60 JP |
| Teknisi K3 Elevator & Eskalator | Kemnaker | LISENSI | 5 th | ±60 JP |
| Operator Elevator & Eskalator | Kemnaker | LISENSI | 5 th | ±60 JP |

## 7. Penanggulangan Kebakaran

`kebakaran` · Dasar: Kepmenaker KEP.186/MEN/1999

| Kategori | Penerbit | Dokumen | Berlaku | Catatan |
| --- | --- | --- | --- | --- |
| Ahli K3 Spesialis Penanggulangan Kebakaran (Kelas A) | Kemnaker | SKP | 3 th | ±60 JP |
| Koordinator Unit Penanggulangan Kebakaran (Kelas B) | Kemnaker | Sertifikat | — | ±60 JP |
| Regu Penanggulangan Kebakaran (Kelas C) | Kemnaker | Sertifikat | — | ±60 JP |
| Petugas Peran Kebakaran (Kelas D) | Kemnaker | Sertifikat | — | ±25 JP; rasio wajib per jumlah pekerja |

## 8. Kimia & Bahan Berbahaya

`kimia-b3` · Dasar: Kepmenaker KEP.187/MEN/1999

| Kategori | Penerbit | Dokumen | Berlaku | Catatan |
| --- | --- | --- | --- | --- |
| Ahli K3 Kimia | Kemnaker | SKP | 3 th | ±120 JP |
| Petugas K3 Kimia | Kemnaker | Sertifikat | — | ±78 JP |
| Petugas K3 Asbes | Kemnaker | Sertifikat | — | ±30 JP |
| Teknisi K3 Pestisida | Kemnaker | Sertifikat | — | ±28 JP |

## 9. Ruang Terbatas & Deteksi Gas

`ruang-terbatas` · Dasar: Permenaker 11/2023

| Kategori | Penerbit | Dokumen | Berlaku | Catatan |
| --- | --- | --- | --- | --- |
| Petugas K3 Ruang Terbatas (Madya / Utama) | Kemnaker | LISENSI | 5 th | ±28 / 46 JP |
| Petugas Penyelamat (Rescuer) Ruang Terbatas | Kemnaker | LISENSI | 5 th | ±30 JP |
| Teknisi K3 Deteksi Gas | Kemnaker | LISENSI | 5 th | ±20 JP |

## 10. Bekerja di Ketinggian

`ketinggian` · Dasar: Permenaker 9/2016

| Kategori | Penerbit | Dokumen | Berlaku | Catatan |
| --- | --- | --- | --- | --- |
| Tenaga Kerja Bangunan Tinggi (TKBT) Tingkat 1 / 2 | Kemnaker | LISENSI | 5 th | ±10 / 20 JP |
| Tenaga Kerja pada Ketinggian (TKPK) Tingkat 1 / 2 / 3 | Kemnaker | LISENSI | 5 th | ±30–35 JP; tingkat 3 = penyelia/rescue |
| Teknisi Perancah (Scaffolder) | Kemnaker | LISENSI | 5 th | ±45 JP |
| Supervisi Perancah | Kemnaker | LISENSI | 5 th | ±50 JP |

## 11. Konstruksi

`konstruksi` · Dasar: UU 2/2017 Jasa Konstruksi; Permen PUPR 10/2021 (SMKK); ketentuan Kemnaker

| Kategori | Penerbit | Dokumen | Berlaku | Catatan |
| --- | --- | --- | --- | --- |
| Ahli K3 Konstruksi Muda / Madya / Utama (Kemnaker) | Kemnaker | SKP | 3 th | ±50 / 90 / 120 JP |
| SKK Ahli K3 Konstruksi Muda / Madya / Utama | PUPR/LPJK (LSP) | SKK | 5 th* | Lewat LSP bidang konstruksi; dipakai untuk tender |
| SKK Petugas / Supervisor K3 Konstruksi | PUPR/LPJK (LSP) | SKK | 5 th* | Jenjang KKNI 3–6 |

## 12. Lingkungan Kerja, Higiene & Kesehatan Kerja

`lingkungan-kerja-kesehatan` · Dasar: Permenaker 5/2018; Permenakertrans PER.15/MEN/VIII/2008 (P3K); PER.03/MEN/1982

| Kategori | Penerbit | Dokumen | Berlaku | Catatan |
| --- | --- | --- | --- | --- |
| Ahli K3 Lingkungan Kerja Muda / Madya / Utama | Kemnaker | SKP | 3 th | ±40 JP per jenjang |
| Petugas K3 Pemantauan Lingkungan Kerja | Kemnaker | Sertifikat | — | ±44 JP |
| Hiperkes untuk Dokter Perusahaan | Kemnaker | Sertifikat | — | ±60 JP |
| Hiperkes untuk Paramedis | Kemnaker | Sertifikat | — | ±50 JP |
| Petugas P3K di Tempat Kerja | Kemnaker | Lisensi | — | ±30 JP; rasio wajib per jumlah pekerja |

## 13. Pertambangan & Migas (sektor khusus)

`pertambangan-migas` · Dasar: Permen ESDM 26/2018; Kepmen ESDM 1827 K/30/MEM/2018

| Kategori | Penerbit | Dokumen | Berlaku | Catatan |
| --- | --- | --- | --- | --- |
| Pengawas Operasional Pertama / Madya / Utama (POP/POM/POU) | ESDM | SERKOM | 3 th* | Wajib di IUP; lewat LSP/PPSDM |
| Sertifikasi kompetensi migas (operator, K3 migas) | ESDM | SERKOM | Skema | PPSDM Migas / LSP migas; verifikasi per skema |
| Offshore Survival (BOSIET/FOET, HUET) | Internasional | Sertifikat | 4 th* | Standar OPITO; syarat kerja lepas pantai |

## 14. Lingkungan Hidup (terkait K3)

`lingkungan-hidup` · Dasar: Regulasi KLH; skema BNSP bidang lingkungan

| Kategori | Penerbit | Dokumen | Berlaku | Catatan |
| --- | --- | --- | --- | --- |
| Penanggung Jawab Operasional Pengolahan Air Limbah (POPAL) | BNSP (LSP) | SERKOM | 3 th* |  |
| Penanggung Jawab Pengendalian Pencemaran Air (PPPA) | BNSP (LSP) | SERKOM | 3 th* |  |
| Penanggung Jawab Pengendalian Pencemaran Udara (PPPU / POIPPU) | BNSP (LSP) | SERKOM | 3 th* |  |
| Pengelolaan Limbah B3 / Non-B3 | BNSP (LSP) | SERKOM | 3 th* |  |

## Perubahan dari daftar lama

Daftar lama (8 kategori populer: Ahli K3 Umum, Operator Forklift, K3 Listrik, Petugas P3K, Operator Crane, Petugas Kebakaran, K3 Konstruksi, Ahli K3 Kimia) melewatkan antara lain: ruang terbatas, bekerja di ketinggian, perancah, pesawat uap & bejana tekanan, pesawat tenaga & produksi (juru las, tanur), elevator, lingkungan kerja & Hiperkes, Auditor SMK3, juru ikat (rigger), alat berat, serta sektor tambang/migas.

Beranda menampilkan 8 bidang dengan permintaan tertinggi; sisanya lewat "Semua bidang".

## Sumber

- Daftar jabatan & JP Serkom K3 Kemnaker: izinkonstruksi.id/serkom-k3-kemnaker
- Katalog program pelatihan K3 (pembanding pasar): atapi.or.id/layanan/pelatihan-k3
- Status Permenaker 8/2020: peraturan.bpk.go.id/details/163270
- Kepmenaker 46/2025 (KKNI bidang PAA): jdih.kemnaker.go.id/peraturan/detail/2645
- Arah sertifikasi Ahli K3 ke LSP: tirto.id (Sep 2025)
