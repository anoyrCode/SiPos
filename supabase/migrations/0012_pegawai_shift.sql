-- ============================================================
-- SIPOS — Shift musyrif (informasi/laporan saja, tidak memengaruhi
-- hak akses input poin/scope_kelas). Shift melekat pada pegawai
-- (satu musyrif = satu shift tetap), bukan per penugasan kelas —
-- musyrif shift 3 (jaga malam, semua santri) tetap bisa ditugaskan
-- ke banyak kelas seperti biasa lewat guru_kelas.
-- ============================================================

alter table public.pegawai
  add column shift smallint
  constraint pegawai_shift_check check (shift in (1, 2, 3));
