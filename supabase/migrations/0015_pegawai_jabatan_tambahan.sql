-- ============================================================
-- SIPOS — Jabatan tambahan pegawai (di luar jabatan utama).
-- `jabatan` tetap jabatan utama (tidak diubah, semua filter/logic
-- lama yang baca kolom ini tidak perlu disentuh). Kolom baru ini
-- cuma daftar jabatan tambahan opsional, mis. Musyrif (utama) yang
-- juga merangkap Guru Profesional (tambahan).
-- ============================================================

alter table public.pegawai
  add column jabatan_tambahan text[] not null default '{}';
