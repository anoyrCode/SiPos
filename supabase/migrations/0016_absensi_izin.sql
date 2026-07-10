-- ============================================================
-- SIPOS — Kategori Izin/Sakit/Cuti pada Absensi.
-- Pegawai bisa mengajukan sendiri (tanpa approval) utk 1 hari
-- atau rentang tanggal — baris `absensi` yang dihasilkan tidak
-- punya jam_masuk_aktual/jam_pulang_aktual (bukan clock in/out),
-- tapi kategori_absen terisi. computeDayStatus (lib/absensi-status.ts)
-- memprioritaskan kategori_absen di atas logic Alpa/Telat/dll.
-- ============================================================

alter table public.absensi
  add column kategori_absen text check (kategori_absen in ('izin', 'sakit', 'cuti')),
  add column keterangan text;
