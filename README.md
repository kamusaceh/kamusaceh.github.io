# Kamus Aceh–Indonesia

Aplikasi web statis (HTML/JS, jalan langsung di browser tanpa server) untuk
mengelola kamus Aceh–Indonesia. Database disimpan sebagai file teks (JSON)
di sebuah repo GitHub. Situs dipisah jadi dua:

- **`index.html`** — situs publik untuk pengunjung baca-baca. Tidak perlu
  token, cuma membaca file JSON langsung dari GitHub. Punya URL cantik
  per kata: `/entri/<kata>`.
- **`admin.html`** — panel kontrol untuk tambah/edit/hapus kata. Perlu
  Personal Access Token, memakai GitHub REST API (baca sekaligus tulis).

## Struktur folder aplikasi ini

```
kamus-aceh/
├── index.html          # situs publik (daftar kata + halaman /entri/<kata>)
├── admin.html          # panel admin (token, tambah/edit/hapus, riwayat)
├── 404.html             # trik routing GitHub Pages agar /entri/<kata> tidak 404
├── css/
│   └── style.css        # semua styling (dipakai index & admin)
├── js/
│   ├── public.js         # logika situs publik: routing, baca data, render entri
│   ├── github-api.js     # wrapper GitHub Contents API & Commits API (dipakai admin)
│   ├── diff.js            # mesin diff baris (LCS) untuk tampilan riwayat (admin)
│   └── admin.js            # logika admin: CRUD kata, form dinamis, undo
└── README.md
```

## Cara kerja URL `/entri/<kata>` di GitHub Pages

GitHub Pages tidak punya server yang bisa mengarahkan URL secara dinamis,
jadi dipakai trik umum: kalau pengunjung membuka `/entri/rumoh` langsung
(bukan lewat klik di dalam situs), GitHub Pages akan menyajikan `404.html`.
File itu menyimpan path yang diminta lalu mengalihkan ke `/`; `index.html`
kemudian membaca path tersimpan itu dan menampilkan entri yang benar,
tanpa pengunjung sadar sempat "nyasar" ke 404.

Kalau repo **bukan** `<owner>.github.io` (jadi situsnya berada di
`namauser.github.io/nama-repo/`), buka `js/public.js` dan isi
`SITE.basePath` dengan `"/nama-repo"`.

## Catatan soal cache

Halaman publik mengambil data lewat `raw.githubusercontent.com`, yang
dilayani CDN dan bisa nge-cache isi file selama beberapa menit. Jadi
setelah admin menyimpan perubahan di `admin.html`, perubahan di situs
publik bisa muncul dengan sedikit jeda (biasanya tidak sampai 5 menit),
bukan langsung detik itu juga.

## Struktur data di repo GitHub (yang dikonfigurasi di form)

Prefix folder data bisa diatur di form (`Folder data (prefix)`, default `data`).

```
data/
├── index.json            # daftar ringkas SEMUA kata, untuk pencarian & daftar
│                          # bentuk: [{ "slug", "word", "pos", "arti_singkat" }, ...]
└── kata/
    ├── rumoh.json         # satu file JSON penuh per kata
    ├── ie.json
    └── ...
```

Kenapa dipisah begini, bukan satu file besar:
- `index.json` tetap kecil walau kamus sudah ribuan kata (cuma kata + arti
  singkat), jadi daftar & pencarian tetap ringan.
- Edit satu kata cuma mengunduh/mengunggah **satu file kecil**
  (`data/kata/<slug>.json`), bukan seluruh database.
- Riwayat tambah/edit/hapus **tidak perlu sistem log tambahan** — otomatis
  mengikuti riwayat commit Git file tersebut. Klik "Lihat perubahan" di
  panel riwayat untuk membuka diff ala Wikipedia (baris ditambah/dihapus).

### Skema satu file kata (`data/kata/<slug>.json`)

```json
{
  "word": "rumoh",
  "pos": "n",
  "pronunciation": "",
  "definitions": [
    {
      "arti": "rumah, tempat tinggal",
      "examples": [
        { "aceh": "Rumoh nyan raya that.", "indonesia": "Rumah itu besar sekali." }
      ]
    }
  ],
  "sinonim": [],
  "rujukan": [],
  "catatan": ""
}
```

## Dua lapis riwayat di aplikasi

1. **Riwayat kata (permanen)** — panel "Riwayat kata ini", diambil langsung
   dari riwayat commit Git file kata tersebut. Ini sumber kebenaran utama,
   tetap ada walau tab browser ditutup.
2. **Riwayat aksi sesi (sementara)** — panel "Riwayat aksi (sesi ini)",
   cuma untuk tombol Undo cepat selama tab masih terbuka (misal salah
   hapus kata barusan). Hilang saat halaman direfresh — bukan pengganti
   riwayat commit di atas.

## Catatan keamanan

Personal Access Token tidak disimpan di file mana pun — hanya ada di
memori tab browser selama sesi berjalan, dan hilang saat halaman
direfresh. Jangan menaruh token langsung sebagai `value` di HTML kalau
file ini akan diunggah ke tempat yang bisa dilihat orang lain.
