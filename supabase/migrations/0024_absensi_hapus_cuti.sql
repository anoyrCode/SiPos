-- Hapus kategori "cuti" dari fitur izin/sakit/cuti absensi — hanya
-- Izin & Sakit yang tersedia. Tidak ada data kategori 'cuti' yang perlu
-- dibersihkan (dikonfirmasi belum pernah dipakai selain testing).
alter table public.absensi
  drop constraint absensi_kategori_absen_check,
  add constraint absensi_kategori_absen_check
    check (kategori_absen in ('izin', 'sakit'));

alter table public.absensi_pengajuan
  drop constraint absensi_pengajuan_kategori_check,
  add constraint absensi_pengajuan_kategori_check
    check (kategori in ('izin', 'sakit'));
