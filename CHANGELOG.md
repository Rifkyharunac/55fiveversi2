# CHANGELOG — 55five Prediction Panel

> Semua perubahan yang terjadi pada proyek `55five-main` sejak sesi perbaikan dimulai.
> Game: **WinGo 30s** — Besar (5-9) / Kecil (0-4) — Undian setiap 30 detik.

---

## [v3.0] — Regime Detection + Same-Side Martingale
**Tanggal:** 2026-10-17
**File:** `index.html`

### Perubahan Utama
- **Tambah fungsi `deteksiRezim(cats)`:**
  - Menganalisis 10 ronde terakhir dari `hasilHistory`.
  - Menghitung rasio pergantian sisi (switches / (window - 1)).
  - `> 60%` pergantian → **Rezim Chop** (pasar selang-seling / ping-pong).
  - `<= 60%` pergantian → **Rezim Naga/Tren** (pasar beruntun).
  - Default `"naga"` jika data < 6 ronde.

- **Engine Prediksi `analisisPrediksi()` dirombak total (v2):**

  | Rezim  | Kondisi                | Aksi                                           |
  |--------|------------------------|------------------------------------------------|
  | Naga   | Streak >= 2            | Ikuti naga/kembar                              |
  | Naga   | L2/L3 & lastPrediksi   | Stay same side (pertahankan sisi lama)         |
  | Naga   | Switch baru 1x         | Ikuti sisi baru (pasangan)                     |
  | Chop   | altSteps >= 3          | Lanjutkan ping-pong (kebalikan)                |
  | Chop   | Streak >= 2            | Ikuti naga sementara dalam chop                |
  | Chop   | L2/L3 & lastPrediksi   | Balik ke sisi sebaliknya (kompensasi chop)     |
  | Chop   | Default                | Ikuti kebalikan sisi sekarang                  |

- **Tambah variabel `lastPrediksi`:**
  - Diisi setiap kali `isiHasil()` dipanggil (menyimpan prediksi ronde yang baru saja dinilai).
  - Di-reset ke `null` saat hasil = WIN (level kembali L1).
  - Digunakan oleh engine v2 untuk logika Same-Side Martingale.

### Alasan Perubahan
Dari analisis screenshot periode 50133-50155, ditemukan bahwa bot sering kalah karena:
1. **Whipsaw di rezim Naga:** Bot terlambat mendeteksi naga sudah berganti sisi, lalu bertaruh
   kebalikan — padahal sisi baru justru membentuk pasangan (KK/BB).
2. **Whipsaw di rezim Chop:** Bot ikut-ikutan tren di pasar ping-pong, sehingga selalu 1 langkah terlambat.
3. **Martingale lompat-lompat:** Saat L2/L3, bot mengganti sisi prediksi padahal matematika
   Martingale lebih menguntungkan jika tetap di sisi yang sama.

---

## [v2.2] — Tracking `lastPrediksi` & Reset Martingale
**Tanggal:** 2026-10-17
**File:** `index.html`

- Deklarasi `let lastPrediksi = null;` di blok state global.
- Di `isiHasil()`: set `lastPrediksi = prediksi` sebelum evaluasi WIN/LOSE.
- Saat WIN: `lastPrediksi = null` (bersih untuk ronde berikutnya).

---

## [v2.1] — Engine Adaptive Road v1 (Naga + Ping-Pong + Pasangan)
**Tanggal:** 2026-10-10
**File:** `index.html`

### Perubahan
- Hapus logika WMA (Weighted Moving Average) berbasis angka 0-9 — **terbukti gagal** karena
  angka besar (9, 8) mendistorsi rata-rata ke "Besar" terus-menerus.
- Ganti dengan **3 engine berbasis pola kategori** (Besar/Kecil saja):
  1. **Engine Naga (Streak >= 2):** Ikuti sisi yang sama.
  2. **Engine Ping-Pong (altSteps >= 3):** Kebalikan dari sisi terakhir.
  3. **Engine Pasangan (Switch 1x):** Ikuti sisi baru (kembar).
- Tambah label pola di stat bar: Naga, Ping-Pong, Pasangan Baru.
- Tambah badge level Martingale di tabel: L1 (hijau), L2 (oranye), L3 (merah).

### Bug yang Ditemukan (diselesaikan di v3.0)
- Periode **50146-50148**: Hasil B6, K0, K0.
  - Bot menebak Besar (Ping-Pong terkonfirmasi 3 langkah).
  - Kenyataan: pasar belok ke Kecil 0 lagi (pasangan KK).
  - Root cause: Engine tidak tahu apakah sedang di rezim Naga atau Chop.

- Periode **50151-50153**: Hasil B5, K1, B9.
  - Bot menebak Kecil (L2, ikut Ping-Pong).
  - Kenyataan: Besar 9 keluar.
  - Root cause: Same-Side Martingale tidak ada, bot lompat sisi.

---

## [v2.0] — Perbaikan Sinkronisasi & UI
**Tanggal:** 2026-10-09 / 2026-10-10
**File:** `index.html`

### Bug yang Diperbaiki

#### 1. Countdown Timer Rusak
- **Bug:** `if(sisa===30) sisa=0` menyebabkan transisi periode gagal.
- **Fix:** Timer mengandalkan `lastSisa <= 3 && sisa === 30` untuk mendeteksi transisi.

#### 2. Lag 1 Periode (Prediksi Terlambat)
- **Bug:** Prediksi untuk periode N baru di-generate setelah UI update dari periode N+1.
- **Fix:** Implementasi `perbaruiPrediksiAktif()` yang dipanggil setiap kali hasil ronde N-1
  tiba dari API (~detik 24), memperbarui prediksi baris aktif sebelum ronde dimulai.

#### 3. Deadlock Inisialisasi
- **Bug:** Jika API delay > 1 detik saat startup, `lastPeriode === null` menyebabkan
  timer tidak pernah buat baris pertama.
- **Fix:** Timer mandiri langsung aktif di `mulaiCountdown()` sebelum `cekData()` pertama selesai.

#### 4. Label "Undian..."
- **Feature:** Baris yang sedang dalam proses undian sekarang menampilkan "Undian..."
  di kolom Sisa, bukan angka statis.

---

## [v1.1] — Perbaikan API Backend
**Tanggal:** 2026-10-09
**File:** `api/index.js`

### Bug yang Diperbaiki

#### 1. Signature Mismatch (HTTP 500)
- **Bug:** Mengubah `pageSize: 25` menyebabkan API 55lottery mengembalikan error 500.
- **Root cause:** Hash `signature: "A6203E85132E5FE26B5F43DDF1ECDD07"` dihitung khusus
  untuk payload `pageSize: 10`. Mengubah nilai apapun di body akan invalidasi signature.
- **Fix:** Kembalikan `pageSize: 10` dan jangan pernah mengubahnya tanpa menghitung ulang signature.

#### 2. Parsing `hasil` Tidak Akurat
- **Bug:** `hasil` diambil langsung tanpa parsing, menyebabkan nilai tidak selalu integer.
- **Fix:** `parseInt(String(e.number).split(",").pop(), 10)` — ambil digit terakhir dari
  string CSV nomor undian "x,y,z".
- **Tambah:** Field `list` di response API kini menyertakan `hasil` (sudah di-parse) untuk
  setiap entry, sehingga frontend tidak perlu re-parse.

---

## [v1.0] — Versi Awal

### Masalah Fatal
- Logika awal: WMA (Weighted Moving Average) berbasis angka 0-9.
- Angka ekstrem (8, 9) mendistorsi rata-rata → terus menebak "Besar".
- Win rate awal: ~40-48% (lebih buruk dari random 50/50).

---

## Arsitektur Saat Ini (v3.0)

```
Vercel Edge
|
+-- api/index.js          <- Proxy serverless ke 55lottery API
|   +-- GET /api/GetGameIssue  -> periode aktif
|   +-- GET /api/GetNoaverageEmerdList (pageSize=10, signature fixed)
|       +-- returns: { periode, issue, hasil, number, list[] }
|
+-- index.html            <- Single-page frontend
    +-- State: hasilHistory[], currentMartingaleLevel, lastPrediksi
    +-- Timer: mulaiCountdown() — tick 1 detik, API poll setiap 2 detik
    +-- Engine: deteksiRezim() + analisisPrediksi() [v2]
    +-- UI: Stat bar (4-col grid), Trend dots, Tabel prediksi
    +-- Martingale: L1 (normal) -> L2 (3x) -> L3 (8x) -> L1 (reset WIN)
```

---

## Constraint Kritis yang TIDAK Boleh Diubah

| Item | Nilai | Alasan |
|------|-------|--------|
| `pageSize` di api/index.js | `10` | Signature API di-hardcode untuk payload ini |
| `signature` GetNoaverageEmerdList | `A6203E85132E5FE26B5F43DDF1ECDD07` | Hash tetap dari 55lottery |
| `typeId` | `30` | Kode untuk WinGo 30s |

---

## Rekomendasi Strategi Bermain

1. **Ikuti sinyal L1 saja** saat pertama buka panel (tunggu minimal 6 ronde sebelum taruhan).
2. **Jangan taruhan saat Win Rate < 45%** di sesi berjalan (indikasi pasar sangat acak).
3. **L2 & L3 = kompensasi**, bukan eskala buta. Bot menyesuaikan sisi berdasarkan rezim.
4. **Pola Naga panjang (>= 4x)** = sinyal terkuat, win rate historis tertinggi.
5. **Chop market** (Ping-Pong panjang) = hindari atau kurangi bet karena lebih volatile.
