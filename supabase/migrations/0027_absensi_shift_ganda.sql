-- ============================================================
-- SIPOS — Shift ganda dalam 1 hari (mis. pegawai kerja pagi
-- 06:00-12:00 lalu malam 19:00-21:00). Independen dari jadwal
-- tetap/fleksibel/jadwal-beda-per-hari yang sudah ada — dipakai
-- hanya kalau shift_ganda=true (mutually exclusive dgn
-- jadwal_fleksibel DAN jadwal_harian_berbeda, di-enforce di app
-- layer). Sesi 1 tetap pakai jam_masuk_jadwal/jam_pulang_jadwal
-- (pegawai) & jam_masuk_aktual/jam_pulang_aktual dkk (absensi)
-- yang sudah ada — cuma Sesi 2 yang baru.
-- ============================================================

alter table public.pegawai
  add column shift_ganda boolean not null default false,
  add column jam_masuk_jadwal_2 time,
  add column jam_pulang_jadwal_2 time;

alter table public.absensi
  add column jam_masuk_aktual_2 timestamptz,
  add column jam_pulang_aktual_2 timestamptz,
  add column lokasi_masuk_2_lat double precision,
  add column lokasi_masuk_2_long double precision,
  add column lokasi_pulang_2_lat double precision,
  add column lokasi_pulang_2_long double precision,
  add column override_lokasi_2 boolean not null default false,
  add column override_alasan_2 text;
