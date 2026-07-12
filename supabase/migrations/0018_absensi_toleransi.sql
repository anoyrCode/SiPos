-- Toleransi keterlambatan clock-in (menit) — dapat diatur admin, dipakai
-- utk status "Telat" dan laporan HRD (menit yg dilaporkan sudah dikurangi
-- toleransi ini).
alter table public.absensi_pengaturan
  add column toleransi_menit integer not null default 5
    constraint absensi_pengaturan_toleransi_check check (toleransi_menit >= 0);
