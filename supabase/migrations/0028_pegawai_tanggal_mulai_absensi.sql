-- ============================================================
-- SIPOS — Tanggal mulai absensi per pegawai (opsional, fallback
-- ke tanggal mulai global `absensi_pengaturan.tanggal_mulai`).
-- Dipakai utk pegawai yang mulai memakai absensi belakangan
-- (staggered onboarding) supaya hari sebelum dia mulai tidak
-- keliru dihitung Alpa.
-- ============================================================

alter table public.pegawai
  add column tanggal_mulai_absensi date;
