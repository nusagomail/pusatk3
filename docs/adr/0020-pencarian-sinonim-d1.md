# ADR 0020: Pencarian dengan sinonim K3 di D1 (tanpa mesin pencari eksternal)

Status: diterima · 26 November 2026 · issue #26. Keputusan pemilik: **A** (D1 dulu).

## Konteks
Istilah K3 beragam: "AK3U" = "Ahli K3 Umum", "SIO forklift" = Operator Forklift, "scaffolding" = perancah. Sebelumnya `GET /search` mencocokkan seluruh teks sebagai satu potongan (`LIKE '%teks%'`), dan kolom `course_categories.synonyms` masih kosong. Pilihan yang ada: tetap di D1, atau memakai Meilisearch/Typesense (akun, biaya bulanan, secret, dan sinkronisasi index).

## Keputusan
- **Mesin pencari: D1.** Tidak ada layanan luar, biaya, atau secret baru. Volume Fase 1 (ratusan sampai beberapa ribu jadwal) cukup ditangani pemindaian tabel.
- **Sinonim** untuk ke-59 kategori disimpan di kolom `sinonim` pada `docs/data/kategori-k3.csv` (dipisah `;`, huruf kecil, maks 20 sinonim @ 60 karakter, wajib diisi). Sumbernya `docs/glosarium-k3.md`. Seed lokal dan impor staging menulisnya ke `course_categories.synonyms`. Sinonim adalah data bantu pencarian, bukan konten K3 yang diterbitkan; koreksi istilah cukup lewat PR ke CSV.
- **Pencocokan per kata:** teks dipecah menjadi kata (huruf/angka saja, tanpa duplikat, maks 6). **Setiap** kata harus menjadi awal kata di salah satu dari: judul jadwal, nama kategori, sinonim kategori, nama bidang, nama penyedia, nama kota. Huruf besar/kecil dan tanda baca diabaikan. Kata dicocokkan dari awal kata (`'% kata%'`), jadi "sio" tidak cocok dengan "operaSIOnal" dan "las" tidak cocok dengan "keLAS". Teks yang isinya hanya simbol tidak menemukan apa pun.
- **Urutan hasil tidak berubah:** tanggal terdekat atau harga (ADR 0018). Belum ada skor relevansi.
- **Sinkronisasi index tidak diperlukan:** pencarian membaca tabel D1 langsung, jadi perubahan jadwal/penyedia langsung terlihat (setelah cache CDN 5 menit). Antrean (Queues) untuk index baru dibutuhkan bila mesin pencari eksternal dipakai.
- Tanda baca yang diganti spasi ditulis sebagai konstanta di teks SQL (tidak di-bind). D1 hanya menerima 100 parameter per query, dan ekspresinya diulang untuk setiap kolom dan kata. Kata dari pengguna tetap di-bind dan hanya berisi huruf/angka.

## Konsekuensi
- Belum tahan salah ketik ("forklif" tetap cocok karena awal kata, tetapi "frklift" tidak) dan belum ada peringkat relevansi.
- Setiap pencarian memindai tabel dengan `replace()` bersarang; biaya CPU naik seiring jumlah jadwal. Rate limit dan cache API tetap wajib sebelum production (#28/#29).
- **Pindah ke Meilisearch/Typesense** bila salah satu terjadi: jadwal aktif lebih dari ±20.000, p95 `/search` di atas ±300 ms, atau dibutuhkan toleransi salah ketik/peringkat. Pindah butuh persetujuan pemilik (akun, biaya, secret) dan sinkronisasi lewat Queues saat jadwal/penyedia berubah.
- Kata umum seperti "k3" atau "pelatihan" cocok dengan hampir semua jadwal. Itu wajar, karena semua kata harus cocok, sehingga kata umum tidak mempersempit hasil.
