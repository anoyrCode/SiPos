-- ============================================================
-- SIPOS — Jadwal Fleksibel utk pegawai (mis. satpam) yang tidak
-- terikat jam masuk/pulang tetap. Kalau true, halaman Absensi
-- self-service tetap izinkan clock in/out walau jam_masuk_jadwal/
-- jam_pulang_jadwal kosong — computeStatusMasuk/Pulang (lib/
-- absensi-status.ts) memang sudah balikin "normal" kalau jadwal
-- kosong, jadi ini cuma perlu buka gerbang UI-nya saja.
-- ============================================================

alter table public.pegawai
  add column jadwal_fleksibel boolean not null default false;
