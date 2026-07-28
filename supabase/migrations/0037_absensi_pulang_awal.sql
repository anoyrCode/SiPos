-- ============================================================
-- SIPOS — Izin Pulang Awal.
--
-- Kategori ketiga untuk pengajuan absensi: pegawai yang perlu pulang
-- lebih awal karena keperluan resmi (dinas luar, urusan mendesak yang
-- sudah disetujui). Tanpa ini, kepulangan tsb selalu tercatat
-- "Pulang Sebelum Waktunya" dan ikut masuk tabel pelanggaran HRD.
--
-- BEDA PENTING dari 'izin'/'sakit': kategori ini TIDAK membuat baris
-- `absensi` apa pun. Pegawainya tetap clock in & clock out seperti
-- biasa; pengajuan ini hanya dibaca saat status dihitung. Karena itu
-- tabel `absensi` sama sekali tidak disentuh di migration ini —
-- termasuk constraint `absensi_kategori_absen_check` yang tetap
-- ('izin','sakit').
--
-- Cakupan satu hari: tanggal_mulai & tanggal_selesai diisi tanggal
-- yang sama, sehingga seluruh kueri rentang yang sudah ada tetap jalan.
-- ============================================================

alter table public.absensi_pengajuan
  drop constraint absensi_pengajuan_kategori_check,
  add constraint absensi_pengajuan_kategori_check
    check (kategori in ('izin', 'sakit', 'pulang_awal'));
