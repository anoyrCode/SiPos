# PRD — SIPOS (Sistem Informasi Poin Santri)

**Versi:** 1.1
**Tipe Aplikasi:** Web App (admin panel + modul input poin + portal wali)
**Tujuan:** Aplikasi untuk mencatat, mengelola, dan memonitor poin **positif** dan **negatif** santri di pesantren, dengan master data terpusat, dashboard analitik, dan portal khusus wali santri.

> Keputusan desain:
> - Stack mengikuti pola proyekmu sebelumnya: **Next.js App Router + Tailwind CSS + Supabase + Directus** (satu PostgreSQL).
> - Menu "Poin Positif" & "Poin Negatif" **disatukan** ke satu tabel `master_poin` dengan kolom `tipe`. Di UI tetap dua menu (hasil filter `tipe`).
> - Ada **3 peran**: **Admin** (kelola semua master data), **Pegawai/Guru** (input poin + lihat data), **Wali Santri** (portal read-only poin anak). Modul Master Data = admin-only.

---

## 1. Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Charting | Recharts |
| Auth | Supabase Auth + RLS |
| Database | PostgreSQL (dipakai bersama Supabase & Directus) |
| Admin/CMS data | Directus (di atas PostgreSQL yang sama) |
| Tabel & form | TanStack Table + React Hook Form + Zod |
| Import CSV | papaparse |

**Pembagian peran tools:**
- **Supabase** → auth, RLS, API data untuk frontend Next.js.
- **Directus** → admin CRUD master data (maintenance cepat tanpa coding tambahan).
- **Next.js** → seluruh UI (admin, pegawai, wali).

---

## 2. Peran & Hak Akses

| Peran | Akses |
|---|---|
| **Admin** | Semua master data, manajemen akun wali, dashboard penuh, semua laporan, dan input poin. Boleh override nilai poin saat input. |
| **Pegawai/Guru** | Input poin santri, lihat riwayat poin, lihat data santri & daftar poin, lihat laporan kelas yang ia jadi wali. Tidak edit master data. Tidak boleh override nilai poin. |
| **Wali Santri** | Portal **read-only**: lihat poin & riwayat anak(-anak)nya, skor total, tren. Login pakai **no WA/telp** sebagai username. |

---

## 3. Model Data (Database Schema)

### 3.1 `profiles` (akun + peran)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | = `auth.users.id` |
| email | text | email asli (pegawai/admin) atau email sintetis (wali) |
| role | enum(`admin`,`pegawai`,`wali`) | |
| pegawai_id | uuid (FK → pegawai) nullable | jika role pegawai |
| wali_id | uuid (FK → wali) nullable | jika role wali |
| created_at | timestamptz | |

### 3.2 `level_pendidikan`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| nama | text | SD / MTS / SMA |
| urutan | int | untuk sorting |

### 3.3 `tahun_ajaran`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| tahun | text | mis. `2026/2027` |
| tanggal_mulai | date | |
| tanggal_selesai | date | |
| is_aktif | boolean | **hanya satu** boleh aktif |

### 3.4 `kelas`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| nama_kelas | text | mis. `7A`, `XI IPA 1` |
| level_pendidikan_id | uuid (FK) | |
| tahun_ajaran_id | uuid (FK) | kelas terikat ke tahun ajaran |
| wali_id | uuid (FK → pegawai) nullable | wali kelas |
| created_at | timestamptz | |

### 3.5 `pegawai`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| nip | text (unique) | |
| nama | text | |
| email | text | |
| alamat | text | |
| tempat_lahir | text | |
| tanggal_lahir | date | |
| jenis_kelamin | enum(`L`,`P`) | |
| telp | text | |
| jabatan | text | mis. Guru, Wali Kelas, Pengasuh, TU |
| user_id | uuid (FK → auth) nullable | jika punya akun login |
| created_at | timestamptz | |

### 3.6 `santri`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| nis | text (unique) | |
| nisn | text | |
| nama | text | |
| email | text | |
| jenis_kelamin | enum(`L`,`P`) | |
| nama_ayah | text | |
| nama_ibu | text | |
| nama_wali | text | nama wali (default: salah satu ortu) |
| no_telp_wali | text | **no WA/telp wali → dipakai sbg username akun wali** |
| status | enum(`aktif`,`lulus`,`keluar`) | default `aktif` |
| created_at | timestamptz | |

> Relasi santri ↔ kelas ada di `santri_kelas` (mendukung histori antar tahun ajaran).

### 3.7 `santri_kelas` (penempatan / distribusi)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| santri_id | uuid (FK) | |
| kelas_id | uuid (FK) | kelas sudah memuat tahun ajaran |
| created_at | timestamptz | |

Constraint: `UNIQUE(santri_id, kelas_id)`. Kelas aktif = row yang `kelas.tahun_ajaran.is_aktif = true`.

### 3.8 `wali` (akun wali santri)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| nama | text | |
| no_telp | text (unique) | **username login** (no WA/telp) |
| user_id | uuid (FK → auth) nullable | akun Supabase |
| created_at | timestamptz | |

### 3.9 `wali_santri` (relasi wali ↔ anak)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| wali_id | uuid (FK) | |
| santri_id | uuid (FK) | |
| hubungan | enum(`ayah`,`ibu`,`wali`) nullable | |

Constraint: `UNIQUE(wali_id, santri_id)`. Satu wali bisa punya banyak anak (kakak-adik dengan no telp sama).

### 3.10 `master_poin` (gabungan Poin Positif & Negatif)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| kode_poin | text (unique) | |
| tipe | enum(`POSITIF`,`NEGATIF`) | |
| nama_poin | text | |
| deskripsi_poin | text | |
| nilai_poin | int | magnitudo (selalu positif), tanda diturunkan dari `tipe` |
| level | text | `level_penghargaan` jika POSITIF; `level_pelanggaran` jika NEGATIF |
| keterangan | text | |
| is_aktif | boolean | default true |
| created_at | timestamptz | |

**Saran nilai `level`:**
- POSITIF (penghargaan): `PERUNGGU` / `PERAK` / `EMAS`
- NEGATIF (pelanggaran): `RINGAN` / `SEDANG` / `BERAT`

### 3.11 `transaksi_poin` (riwayat input poin — modul inti)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid (PK) | |
| santri_id | uuid (FK) | |
| master_poin_id | uuid (FK) | |
| pegawai_id | uuid (FK) | pencatat |
| tipe | enum(`POSITIF`,`NEGATIF`) | snapshot |
| nilai_poin | int | snapshot saat dicatat (bisa beda dari master jika admin override) |
| is_override | boolean | default false; true jika nilai diubah manual oleh admin |
| tanggal_kejadian | date | |
| catatan | text nullable | |
| tahun_ajaran_id | uuid (FK) | scoping laporan |
| created_at | timestamptz | |

Index disarankan: `(santri_id)`, `(tahun_ajaran_id, tipe)`, `(master_poin_id)`, `(tanggal_kejadian)`.

**Skor santri (turunan):** `skor_total = SUM(nilai positif) − SUM(nilai negatif)` dalam tahun ajaran aktif.

---

## 4. Struktur Halaman (App Router)

```
/login

/(admin)/dashboard
/(admin)/master/santri              # + import CSV
/(admin)/master/pegawai             # + import CSV
/(admin)/master/poin-positif        # filter tipe=POSITIF
/(admin)/master/poin-negatif        # filter tipe=NEGATIF
/(admin)/master/kelas
/(admin)/master/level-pendidikan
/(admin)/master/tahun-ajaran
/(admin)/master/kelas-wali          # distribusi santri & wali kelas
/(admin)/master/akun-wali           # generate & kelola akun wali santri

/(app)/input-poin                   # modul inti (admin & pegawai)
/(app)/riwayat-poin
/(app)/laporan
/(app)/santri/[id]                  # detail santri + riwayat

/(wali)/anak                        # daftar anak (portal wali)
/(wali)/anak/[santriId]             # detail poin & riwayat anak
```

---

## 5. Modul & Fitur

### 5.1 Auth
- **Admin & Pegawai:** login email/password (Supabase).
- **Wali Santri:** login pakai **no WA/telp** sebagai username.
  - Implementasi: nomor dipetakan ke email sintetis `{no_telp}@wali.sipos.local` + password (Supabase Auth berbasis email). Alternatif: Supabase Phone Auth/OTP (butuh SMS provider berbayar).
  - Password awal di-set admin saat generate akun (mis. default = NIS anak / tanggal lahir), dan diminta ganti saat login pertama.
- Redirect by role: admin → dashboard, pegawai → input-poin, wali → /anak.
- Middleware proteksi route per role.

### 5.2 Dashboard (admin)
**Cards (atas):**
- Total Santri (status aktif)
- Guru Laki-laki (count pegawai `jabatan ILIKE '%guru%'` & `jenis_kelamin = L`)
- Guru Perempuan (count pegawai `jabatan ILIKE '%guru%'` & `jenis_kelamin = P`)

**Layout 4 chart (grid 2×2):**

| Posisi | Chart | Data |
|---|---|---|
| Kiri atas | **Statistik Poin** (toggle Positif/Negatif) | Top poin berdasarkan **jumlah kejadian**: negatif paling sering dilanggar / positif paling sering dilakukan. |
| Kanan atas | **Perkembangan Poin** (line, **per bulan**) | Agregasi **bulanan** dalam tahun ajaran aktif, 2 garis: total positif & total negatif. |
| Kiri bawah | **Peringkat Poin Negatif** (bar) | Top N santri dengan total poin negatif terbanyak. |
| Kanan bawah | **Peringkat Poin Positif** (bar) | Top N santri dengan total poin positif terbanyak. |

**Recent Activity:** 10–20 entri `transaksi_poin` terbaru.

### 5.3 Master Data — Data Santri
- Tabel: NIS, Nama, NISN, Kelas (aktif), Email, Jenis Kelamin, Nama Ayah, Nama Ibu, Nama Wali, No Telp Wali.
- CRUD penuh. Search + filter (kelas, jenis kelamin, status).
- **Import CSV (v1):** upload file → preview/validasi (cek NIS duplikat, format) → commit. Template CSV disediakan.

### 5.4 Master Data — Poin Positif & Poin Negatif
- Dua halaman, sumber sama (`master_poin`) difilter `tipe`.
- Field: Kode Poin, Nama, Deskripsi, Nilai Poin, Level, Keterangan, Aktif.
- Validasi `kode_poin` unik.

### 5.5 Master Data — Data Pegawai
- Field: NIP, Nama, Email, Alamat, Tempat Lahir, Tanggal Lahir, Jenis Kelamin, Telp, Jabatan.
- CRUD + opsi "buatkan akun login" (user Supabase + `profiles.role = pegawai`).
- **Import CSV (v1):** sama seperti santri (preview + validasi NIP duplikat).

### 5.6 Master Data — Kelas
- Field: Nama Kelas, Level Pendidikan, Tahun Ajaran, Wali Kelas. Filter per tahun ajaran & level.

### 5.7 Master Data — Level Pendidikan
- CRUD sederhana (SD, MTS, SMA) + urutan.

### 5.8 Master Data — Tahun Ajaran
- CRUD. Toggle `is_aktif` (set satu aktif → otomatis non-aktifkan yang lain).

### 5.9 Master Data — Kelas dan Wali (Distribusi)
- Pilih tahun ajaran → pilih kelas → atur:
  - **Wali kelas** (pilih pegawai → `kelas.wali_id`).
  - **Daftar santri** kelas tsb: tambah/keluarkan santri (insert/delete `santri_kelas`).
- Tampilkan santri yang belum punya kelas di tahun ajaran aktif.

### 5.10 Manajemen Akun Wali
- **Generate akun otomatis** dari data santri: ambil `no_telp_wali` unik → buat 1 akun `wali` per nomor → link semua santri dengan nomor itu ke `wali_santri`.
- Tabel akun wali: nama, no telp (username), jumlah anak terhubung, status akun (aktif/belum dibuat).
- Aksi: buat akun, reset password, nonaktifkan, edit relasi anak.
- Jika satu nomor dipakai beberapa santri (kakak-adik) → satu akun melihat semua anaknya.

### 5.11 Input Poin (modul inti — admin & pegawai)
Form:
1. Pilih santri (search NIS/nama; tampilkan kelas).
2. Pilih jenis poin (Positif/Negatif).
3. Pilih poin dari `master_poin` (filter tipe + `is_aktif`).
4. Nilai poin **terisi otomatis & terkunci** dari master. **Admin** boleh override (set `is_override = true`); **pegawai tidak bisa**.
5. Tanggal kejadian (default hari ini).
6. Catatan (opsional).
7. Submit → insert `transaksi_poin` (snapshot tipe & nilai, `pegawai_id` & `tahun_ajaran_id` aktif).

Opsi: input batch (beberapa santri sekaligus untuk satu jenis poin).

### 5.12 Riwayat Poin
- Tabel `transaksi_poin` + filter: santri, kelas, tipe, rentang tanggal, tahun ajaran.
- Pegawai read-only; admin bisa edit/hapus.

### 5.13 Detail Santri (`/santri/[id]`)
- Profil + kelas + skor total (positif, negatif, net).
- Timeline riwayat poin + mini-chart tren.

### 5.14 Laporan / Rekap
- Rekap per santri / per kelas / per tahun ajaran (total positif, negatif, net).
- Export PDF/Excel (fase lanjutan).

### 5.15 Portal Wali (read-only)
- `/anak`: daftar anak terhubung (`wali_santri`) → kartu ringkas tiap anak (nama, kelas, skor total).
- `/anak/[santriId]`: skor total, tren bulanan, timeline riwayat poin (tanggal, jenis, nama poin, nilai, catatan).
- Tidak ada aksi tulis. Hanya bisa lihat anak miliknya (dijaga RLS).

---

## 6. Aturan Bisnis (Business Rules)

1. `kode_poin` unik di seluruh `master_poin`.
2. Hanya satu `tahun_ajaran.is_aktif = true`.
3. Input poin default memakai tahun ajaran aktif.
4. `nilai_poin` disimpan sebagai magnitudo positif; tanda dari `tipe`. Skor net = Σpositif − Σnegatif.
5. Nilai poin **terkunci** dari master; hanya **admin** boleh override (ditandai `is_override`).
6. Satu santri satu kelas per tahun ajaran (`UNIQUE(santri_id, kelas_id)` + validasi tidak dua kelas di tahun ajaran yang sama).
7. Satu kelas satu wali kelas (`kelas.wali_id`).
8. Hapus master poin yang sudah dipakai → **soft delete** (`is_aktif = false`); histori transaksi aman karena snapshot.
9. **Akun wali:** username = `no_telp` unik. Satu nomor = satu akun, bisa terhubung ke ≥1 santri.
10. Pegawai hanya insert transaksi; tidak edit/hapus master data.

---

## 7. RLS (Row Level Security) — garis besar

- `profiles`: user baca dirinya; admin baca semua.
- Master data: admin write; pegawai read.
- `transaksi_poin`: admin full; pegawai insert + read (tidak update/delete).
- **Wali:** hanya read `santri` & `transaksi_poin` untuk `santri_id` yang ada di `wali_santri` miliknya. Tidak ada akses tulis.

---

## 8. Roadmap Implementasi (per fase untuk Claude Code)

**Fase 0 — Setup:** Next.js + Tailwind + shadcn/ui + Supabase + Directus. Env & struktur folder.

**Fase 1 — Auth & Role:** Supabase Auth, `profiles`, middleware, redirect by role (admin/pegawai/wali).

**Fase 2 — Database & Migrations:** Semua tabel + enum + constraint + index. Seed: level pendidikan, tahun ajaran aktif, contoh master poin.

**Fase 3 — Master Data CRUD:** Santri, Pegawai, Poin, Kelas, Level Pendidikan, Tahun Ajaran. Komponen tabel + form reusable.

**Fase 4 — Import CSV:** Import santri & pegawai (preview + validasi + commit), template CSV.

**Fase 5 — Kelas & Wali (Distribusi):** Penempatan santri + set wali kelas.

**Fase 6 — Input Poin (inti):** Form input (+ override admin, + batch) & riwayat poin.

**Fase 7 — Manajemen & Portal Wali:** Generate akun wali dari `no_telp_wali`, relasi `wali_santri`, portal read-only.

**Fase 8 — Dashboard & Charts:** Cards (guru by jabatan) + 4 chart (line bulanan) + recent activity. View/RPC PostgreSQL untuk agregasi.

**Fase 9 — Laporan & Detail Santri:** Rekap per kelas/santri, detail santri, export (opsional).

**Fase 10 — Polish:** RLS final, validasi Zod, empty/loading states, responsive, audit.

---

## 9. Non-Functional Requirements
- Responsive (desktop utama; mobile untuk input poin cepat & portal wali).
- Bahasa UI: Indonesia.
- Performa: pagination & server-side filtering untuk tabel besar.
- Keamanan: RLS aktif, validasi server (Zod), proteksi role di middleware.
- Audit: `created_at` + `pegawai_id` pada transaksi.

---

## 10. Keputusan yang Sudah Final
1. Card "Guru" = pegawai dengan **jabatan guru** (filter `jabatan ILIKE '%guru%'`).
2. Nilai poin **terkunci** dari master; **admin boleh override**, pegawai tidak.
3. Line chart perkembangan poin = agregasi **bulanan**.
4. Tambah peran **Wali Santri** (bukan santri). Login pakai **no WA/telp** dari data santri (`no_telp_wali`). Portal read-only untuk lihat poin anak.
5. **Import CSV** santri & pegawai masuk di **v1**.
