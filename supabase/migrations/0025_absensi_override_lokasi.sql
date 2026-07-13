-- Izinkan clock in/out di luar radius dgn pernyataan jujur + alasan wajib
-- (utk device yg GPS-nya bermasalah). Dicatat eksplisit supaya admin bisa
-- lihat & audit pola penyalahgunaan di Rekap Absensi.
alter table public.absensi
  add column override_lokasi boolean not null default false,
  add column override_alasan text;
