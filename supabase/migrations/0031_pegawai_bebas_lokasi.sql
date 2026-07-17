-- ============================================================
-- SIPOS — Pengecualian cek lokasi absensi per pegawai
-- Utk pegawai yg memang kerja di luar radius pondok (bukan
-- curang) — skip total pengecekan geofence saat clock in/out.
-- ============================================================

alter table public.pegawai
  add column if not exists bebas_lokasi boolean not null default false;
