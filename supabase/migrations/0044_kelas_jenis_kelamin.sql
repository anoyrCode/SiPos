-- ============================================================
-- SIPOS — Jenis kelamin kelas (Putra/Putri)
-- Ditentukan admin per kelas. Nullable: kelas lama tetap jalan
-- tanpa gender dan tidak divalidasi sampai admin mengisinya.
-- ============================================================

alter table public.kelas
  add column if not exists jenis_kelamin public.jenis_kelamin;

comment on column public.kelas.jenis_kelamin is
  'Putra (L) / Putri (P). NULL = belum ditandai, tidak divalidasi.';
