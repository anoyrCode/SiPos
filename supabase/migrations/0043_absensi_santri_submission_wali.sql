-- ============================================================
-- SIPOS — Absensi Santri: wali baca log submission checkpoint kelas anaknya.
--
-- Diperlukan supaya kartu "Kehadiran" wali bisa tampilkan riwayat LENGKAP
-- (termasuk Hadir) mirip format Riwayat Poin, bukan cuma pengecualian
-- (izin/sakit/alpa) — dengan cara menggabungkan checkpoint yang sudah
-- disubmit musyrif (tabel ini) dengan pengecualian milik santri (tabel
-- absensi_santri, sudah bisa dibaca wali sejak 0042).
--
-- Wali TIDAK dibatasi ke kelas_id spesifik di policy ini (tidak ada
-- kolom santri_id di tabel submission) — cukup exists() lewat
-- santri_kelas ke anaknya sendiri, mirror pola wali_santri yang sudah
-- ada (lihat 0035_rls_initplan_optimization.sql).
-- ============================================================

create policy "absensi_santri_submission_select_wali" on public.absensi_santri_submission
  for select to authenticated
  using (
    exists (
      select 1
      from public.santri_kelas sk
      join public.wali_santri ws on ws.santri_id = sk.santri_id
      where sk.kelas_id = absensi_santri_submission.kelas_id
        and ws.wali_id = (select public.current_wali_id())
    )
  );
