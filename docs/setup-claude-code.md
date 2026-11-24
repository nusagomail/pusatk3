# Setup Claude Code untuk PusatK3

Panduan sekali jalan untuk pemilik. Tidak perlu paham teknis; ikuti berurutan.

## 1. Pasang alat di komputer

1. **Git** dan **Node.js 22+** (unduh dari situs resminya).
2. **pnpm:** di terminal jalankan `npm install -g pnpm`.
3. **jq** (dipakai hook pengaman):
   - macOS: `brew install jq`
   - Windows: `winget install jqlang.jq`
   - Linux: `sudo apt install jq`
4. **Claude Code:** ikuti petunjuk di https://code.claude.com/docs/en/overview, lalu masuk dengan akun Claude Anda.

## 2. Ambil repo

```bash
git clone https://github.com/nusagomail/pusatk3.git
cd pusatk3
claude
```

Saat Claude Code menanyakan apakah folder ini dipercaya, pilih **Yes**. Tanpa itu, pengaturan proyek (izin dan plugin) tidak aktif.

## 3. Pasang plugin (sekali saja)

Di dalam Claude Code, ketik satu per satu:

```text
/plugin install superpowers@claude-plugins-official
/plugin install frontend-design@claude-plugins-official
```

Untuk setiap plugin pilih **Install for all collaborators on this repository (project scope)**.

Plugin Cloudflare: ketik `/plugin`, cari "cloudflare" di tab **Discover**, lalu pasang dengan scope yang sama. Jika tidak muncul, lewati dulu.

Cek: ketik `/` dan pastikan ada perintah yang diawali `superpowers:`.

## 4. Hubungkan GitHub (review otomatis)

Di Claude Code jalankan:

```text
/install-github-app
```

Ikuti langkahnya (Anda harus admin repo). Setelah selesai, Anda bisa menulis `@claude` di komentar issue atau PR untuk meminta bantuan atau review. Pemakaian ini dihitung ke kuota/biaya akun Anda.

## 5. Mulai bekerja

1. Buat issue di GitHub dengan template **Fitur**.
2. Di Claude Code: `Kerjakan issue #1.`
3. Baca rencana yang diajukan. Jawab "setuju" atau minta perubahan.
4. Tunggu PR dibuka, cek ringkasan dan hasil tes, lalu merge di GitHub.
5. Untuk tugas berikutnya, ketik `/clear` dulu.

Untuk rilis ke production: `/siapkan-rilis`, baca ringkasannya, lalu beri perintah eksplisit.

## Jika ada masalah

- Ketik `/status` untuk melihat pengaturan mana yang aktif.
- Jika Claude Code menolak sebuah perintah dengan pesan "Diblokir", itu hook pengaman yang bekerja. Baca alasannya; biasanya tindakan itu memang harus Anda lakukan sendiri.
