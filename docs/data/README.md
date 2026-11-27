# Data PusatK3 (CSV)

| File / folder | Isi | Dipakai oleh |
| --- | --- | --- |
| `kategori-k3.csv` | 14 bidang dan 59 kategori sertifikasi K3 resmi; kolom `sinonim` = istilah pencarian dipisah `;` (wajib, maks 20, ADR 0020) | `pnpm db:seed:local`, impor (data referensi) |
| `kota.csv` | Daftar kota rujukan untuk impor (65 kota: ibu kota 38 provinsi + kota industri utama; #54). Kota baru ditambahkan di sini | impor (data referensi) |
| `template/` | Empat CSV kosong (baris judul saja) untuk mulai mengisi data asli | tim kurasi ([`panduan-kurasi.md`](panduan-kurasi.md)) |
| `contoh/` | Data **contoh** fiktif satu wilayah (Jabodetabek): 4 penyedia, 5 cabang, 4 legalitas, 14 jadwal | `pnpm db:import:local`, deploy staging (ADR 0017) |

Data penyedia asli memakai format yang sama di folder terpisah, **tanpa** tanda contoh (`--sample`), setelah ditinjau pemilik. Panduan untuk tim kurasi: [`panduan-kurasi.md`](panduan-kurasi.md). Cek tanpa menulis apa pun: `pnpm data:check <folder>`.

## Format impor direktori

Empat file CSV (UTF-8, dipisah koma, teks berkoma ditulis dalam tanda kutip). Baris pertama adalah header yang **persis** seperti di bawah. Kolom opsional boleh kosong.

### `penyedia.csv`

| Kolom | Wajib | Isi |
| --- | --- | --- |
| `slug` | ya | Alamat unik, huruf kecil dan tanda hubung (mis. `pt-mitra-k3`) |
| `nama` | ya | Nama penyedia; tidak boleh sama dengan penyedia lain (huruf besar-kecil dan spasi diabaikan) |
| `jenis` | ya | `pjk3`, `lsp`, atau `tuk` |
| `deskripsi` | | Teks bebas (boleh beberapa baris dalam tanda kutip) |
| `whatsapp` | | Nomor Indonesia, mis. `0812-3456-7890` (disimpan sebagai `62…`) |
| `email`, `telepon` | | |
| `website` | | Hanya `https://` ke domain sungguhan |

### `cabang.csv`

| Kolom | Wajib | Isi |
| --- | --- | --- |
| `penyedia_slug` | ya | `slug` dari `penyedia.csv` |
| `nama` | ya | Unik per penyedia (dipakai `jadwal.csv`) |
| `kota_slug` | ya | Kota yang dikenal (saat ini kota contoh: `jakarta`, `bekasi`, `tangerang`, …) |
| `alamat` | ya | |
| `lat`, `lng` | | Diisi berdua atau dikosongkan berdua |
| `kantor_pusat` | | `ya` atau `tidak` (kosong = `tidak`); paling banyak satu `ya` per penyedia |

### `legalitas.csv`

| Kolom | Wajib | Isi |
| --- | --- | --- |
| `penyedia_slug` | ya | |
| `jenis` | ya | `izin_pjk3`, `lisensi_lsp`, atau `tuk` |
| `nomor` | ya | Satu nomor per jenis hanya boleh dimiliki satu penyedia |
| `penerbit` | ya | Teks bebas, mis. `Kemnaker RI`, `BNSP`, atau nama LSP untuk TUK |
| `berlaku_sampai` | | `YYYY-MM-DD` |

### `jadwal.csv`

| Kolom | Wajib | Isi |
| --- | --- | --- |
| `penyedia_slug` | ya | |
| `kategori_slug` | ya | `slug` dari `kategori-k3.csv` |
| `cabang` | offline: ya | Nama cabang dari `cabang.csv`; **kosong** untuk jadwal online |
| `judul` | ya | |
| `penerbit` | ya | Harus salah satu penerbit kategori itu: `kemnaker`, `bnsp`, `pupr`, `esdm`, `intl` |
| `metode` | ya | `offline` atau `online` |
| `mulai`, `selesai` | ya | `YYYY-MM-DD`, selesai ≥ mulai |
| `harga` | | Rupiah bulat, `4500000` atau `4.500.000` (tanpa desimal) |
| `kuota` | | Bilangan ≥ 1 |
| `deskripsi`, `syarat`, `level` | | |
| `sertifikat` | ya | `official` (sertifikat/lisensi resmi) atau `training_only` (sertifikat pelatihan) |
| `status` | | `draft` atau `published` (kosong = `draft`) |

Satu jadwal dikenali dari (penyedia, kategori, tanggal mulai, judul): impor ulang memperbarui jadwal itu, bukan membuat yang baru.

## Aturan impor

- **Semua atau tidak sama sekali:** satu baris salah atau duplikat → impor dibatalkan dan laporannya menyebut file serta nomor baris.
- **Idempoten:** aman diulang; baris yang sudah ada diperbarui, ID tetap.
- **Tidak pernah menghapus:** baris yang tidak ada di CSV dibiarkan.
- **Tidak pernah mengubah** status, verifikasi, atau paket penyedia, dan hanya memperbarui penyedia yang **belum diklaim**. Data contoh tidak pernah menimpa data asli, dan sebaliknya.
- **Jadwal `expired` tidak disentuh** (status itu diatur otomatis).
- **Huruf besar-kecil:** duplikat di CSV dicek tanpa membedakan huruf besar-kecil, tetapi impor berikutnya mencocokkan persis. Jangan mengganti kapitalisasi nama cabang, nomor izin, atau judul jadwal yang sudah diimpor, karena itu membuat baris baru.
- **Aturan 6:** bila penyedia yang sudah terverifikasi berubah nomor WhatsApp atau data legalitasnya, statusnya kembali `pending` (verifikasi ulang).
