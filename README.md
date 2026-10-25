# PayRoll WhatsApp Manager 💼

Aplikasi web Node.js untuk mengelola data karyawan, mengunggah slip gaji PDF, dan mengirimkan slip gaji secara otomatis melalui WhatsApp menggunakan Fonnte API.

---

## 🚀 Fitur Utama

- **Login Admin** — Autentikasi aman berbasis session & bcrypt
- **Dashboard** — Statistik karyawan, slip gaji, dan pengiriman
- **Manajemen Karyawan** — CRUD karyawan lengkap dengan validasi
- **Upload Slip Gaji** — Upload multi-file PDF dengan drag & drop
- **Preview PDF** — Tampilkan PDF langsung di browser tanpa download
- **Filter Periode** — Filter slip gaji berdasarkan bulan dan tahun
- **Kirim WhatsApp Massal** — Kirim slip gaji ke semua karyawan sekali klik via Fonnte API
- **Template Pesan Formal** — Pesan profesional dengan nama, tanggal, dan tautan PDF
- **Tautan PDF Aman** — Token sementara dengan masa berlaku
- **Retry Pengiriman** — Kirim ulang slip yang gagal
- **Riwayat Pengiriman** — Catat semua aktivitas pengiriman

---

## 📦 Instalasi

### Prasyarat

- **Node.js** v16 atau lebih baru
- **npm** (sudah termasuk bersama Node.js)

### Langkah Instalasi

1. **Masuk ke folder proyek:**
   ```bash
   cd "D:\Program Skripsi Grace\wasender"
   ```

2. **Install dependency:**
   ```bash
   npm install
   ```

3. **Buat file `.env`:**
   ```bash
   copy .env.example .env
   ```
   Lalu edit `.env` dan isi:
   ```env
   PORT=3000
   SESSION_SECRET=string_rahasia_panjang_dan_acak
   FONNTE_TOKEN=token_fonnte_anda
   APP_BASE_URL=http://localhost:3000
   ```

4. **Jalankan server:**
   ```bash
   npm start
   ```

5. **Buka browser:**
   ```
   http://localhost:3000
   ```

---

## 🔐 Login Default

| Username | Password |
|----------|----------|
| `admin`  | `admin123` |

> ⚠️ **Segera ganti password** setelah login pertama melalui menu **Ganti Password**.

---

## ⚙️ Konfigurasi

### File `.env`

| Variabel | Keterangan |
|----------|------------|
| `PORT` | Port server (default: 3000) |
| `SESSION_SECRET` | String rahasia untuk enkripsi session (wajib diganti) |
| `FONNTE_TOKEN` | Token API Fonnte untuk mengirim WhatsApp |
| `APP_BASE_URL` | URL publik aplikasi (wajib HTTPS untuk link WhatsApp) |
| `PDF_TOKEN_EXPIRY` | Masa berlaku token PDF dalam detik (default: 604800 = 7 hari) |
| `SEND_DELAY_MS` | Jeda antar pengiriman WhatsApp dalam milidetik (default: 2000) |
| `MAX_FILE_SIZE` | Ukuran maksimal upload dalam bytes (default: 10485760 = 10MB) |

---

## 📱 Konfigurasi Fonnte API

1. Daftar di [https://fonnte.com](https://fonnte.com)
2. Hubungkan nomor WhatsApp Anda
3. Salin token API dari dashboard Fonnte
4. Isi `FONNTE_TOKEN=token_anda` di file `.env`

### Endpoint Fonnte yang Digunakan

```
POST https://api.fonnte.com/send
Header: Authorization: <token>
Body: { target, message, countryCode }
```

---

## 🌐 Penggunaan URL HTTPS untuk WhatsApp

Tautan PDF yang dikirimkan via WhatsApp harus dapat diakses dari internet. Untuk pengembangan lokal, gunakan ngrok atau layanan tunnel lainnya:

```bash
# Install ngrok
npm install -g ngrok

# Jalankan tunnel
ngrok http 3000
```

Salin URL HTTPS yang diberikan ngrok (contoh: `https://abc123.ngrok.io`) dan isi ke `APP_BASE_URL` di `.env`.

---

## 📂 Format Nama File Slip Gaji

Format yang didukung:

```
NamaKaryawan_Bulan_Tahun.pdf
```

Contoh:
- `Grace_Oktober_2026.pdf`
- `Budi_Santoso_September_2026.pdf`
- `Siti_Rahayu_November_2026.pdf`

Jika nama file tidak sesuai format, admin dapat memilih karyawan secara manual saat upload.

---

## 🗂️ Struktur Folder

```
wasender/
├── server.js              # Entry point
├── package.json
├── .env                   # Konfigurasi rahasia (jangan di-commit)
├── .env.example           # Template konfigurasi
├── .gitignore
├── routes/
│   ├── auth.js            # Login, logout, ganti password
│   ├── karyawan.js        # CRUD karyawan
│   ├── slipgaji.js        # Upload, preview, download, hapus PDF
│   └── pengiriman.js      # Kirim massal, retry, riwayat
├── services/
│   ├── fonnteService.js   # Integrasi Fonnte API
│   └── slipGajiService.js # Token PDF, template pesan
├── middleware/
│   └── authMiddleware.js  # Proteksi rute
├── utils/
│   └── dataStore.js       # JSON read/write aman (atomic)
├── views/
│   ├── login.html
│   ├── dashboard.html
│   ├── karyawan.html
│   └── slipgaji.html
├── public/
│   ├── css/style.css
│   └── js/app.js
├── data/
│   ├── admin.json         # Data admin (dibuat otomatis)
│   ├── karyawan.json      # Data karyawan
│   ├── slipgaji.json      # Metadata slip gaji
│   └── pengiriman.json    # Riwayat pengiriman
└── uploads/
    └── slipgaji/          # File PDF tersimpan
```

---

## 🔌 REST API Endpoints

### Auth
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| `POST` | `/api/auth/login` | Login admin |
| `POST` | `/api/auth/logout` | Logout |
| `GET`  | `/api/auth/me` | Info user |
| `POST` | `/api/auth/change-password` | Ganti password |

### Karyawan
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| `GET`    | `/api/karyawan` | Semua karyawan |
| `GET`    | `/api/karyawan/:id` | Detail karyawan |
| `POST`   | `/api/karyawan` | Tambah karyawan |
| `PUT`    | `/api/karyawan/:id` | Update karyawan |
| `DELETE` | `/api/karyawan/:id` | Hapus karyawan |

### Slip Gaji
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| `GET`    | `/api/slipgaji?bulan=10&tahun=2026` | List slip (filter) |
| `POST`   | `/api/slipgaji/upload` | Upload PDF |
| `GET`    | `/api/slipgaji/:id/preview` | Preview PDF (inline) |
| `GET`    | `/api/slipgaji/:id/download` | Download PDF |
| `DELETE` | `/api/slipgaji/:id` | Hapus slip |
| `GET`    | `/api/slipgaji/stats` | Statistik |

### Pengiriman
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| `POST` | `/api/slipgaji/kirim` | Kirim massal |
| `GET`  | `/api/pengiriman/:jobId` | Status job |
| `GET`  | `/api/pengiriman` | Riwayat pengiriman |
| `POST` | `/api/pengiriman/:slipId/retry` | Kirim ulang |

### Tautan PDF (untuk WhatsApp)
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| `GET`  | `/file/:token` | Akses PDF via token sementara |

---

## 🧪 Pengujian API dengan Postman

### 1. Login

```json
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

### 2. Tambah Karyawan

```json
POST http://localhost:3000/api/karyawan
Content-Type: application/json

{
  "nama": "Grace",
  "nomor_whatsapp": "6281234567890"
}
```

### 3. Upload PDF

```
POST http://localhost:3000/api/slipgaji/upload
Content-Type: multipart/form-data

files: [file.pdf]
bulan: 10
tahun: 2026
```

### 4. Kirim Massal

```json
POST http://localhost:3000/api/slipgaji/kirim
Content-Type: application/json

{
  "bulan": 10,
  "tahun": 2026,
  "tanggalPembayaran": "25 Oktober 2026"
}
```

> **Catatan Postman:** Pastikan cookie session tersimpan. Gunakan fitur "Cookie Manager" atau atur Postman environment untuk menyimpan cookie setelah login.

---

## 📋 Template Pesan WhatsApp

```
Yth. Bapak/Ibu {Nama Karyawan},

Dengan hormat,

Kami informasikan bahwa pembayaran gaji untuk tanggal {Tanggal} telah diproses.
Mohon memeriksa informasi slip gaji yang disampaikan melalui pesan ini.

Apabila terdapat pertanyaan atau ketidaksesuaian terkait informasi gaji,
silakan menghubungi bagian administrasi.

Demikian informasi ini kami sampaikan. Terima kasih atas perhatian dan kerja sama Anda.

Hormat kami,
Bagian Administrasi

Tautan Slip Gaji: {URL_SLIP_GAJI}
```

---

## 🔒 Keamanan

- Password di-hash menggunakan **bcrypt** (salt rounds: 12)
- Session menggunakan **httpOnly cookie**
- Tautan PDF menggunakan **token acak** dengan masa berlaku
- **Path traversal protection** pada akses file
- Semua API dilindungi autentikasi
- Token Fonnte disimpan di **environment variable** (tidak di kode)
- File PDF disimpan dengan **nama acak** (bukan nama asli)

---

## ❓ FAQ

**Q: Bagaimana jika Fonnte token belum diisi?**  
A: Pengiriman akan gagal dengan pesan error yang informatif. Isi `FONNTE_TOKEN` di `.env`.

**Q: Apakah bisa digunakan tanpa internet?**  
A: Bisa untuk semua fitur kecuali pengiriman WhatsApp yang membutuhkan koneksi ke Fonnte API.

**Q: Bagaimana jika nama karyawan tidak ditemukan saat upload?**  
A: Pilih karyawan secara manual menggunakan dropdown di form upload.

**Q: Data tersimpan di mana?**  
A: Semua data tersimpan di folder `data/` dalam format JSON, dan PDF di `uploads/slipgaji/`.

---

*Dibuat dengan ❤️ menggunakan Node.js + Express.js*
