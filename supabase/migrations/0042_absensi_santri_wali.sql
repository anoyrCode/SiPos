-- ============================================================
-- SIPOS — Absensi Santri: akses baca untuk wali (anaknya sendiri).
--
-- Mirror pola RLS wali yang sudah ada di transaksi_poin/santri/santri_kelas
-- (lihat 0035_rls_initplan_optimization.sql) — exists() ke wali_santri,
-- current_wali_id() dibungkus (select ...) supaya InitPlan (dievaluasi
-- sekali per query, bukan per baris).
--
-- Kolom `jam`/`shift` checkpoint sudah bisa dibaca wali lewat policy
-- absensi_santri_checkpoint_select_auth (semua authenticated, dari
-- migrasi 0041) — tidak perlu policy tambahan untuk tabel itu.
-- ============================================================

create policy "absensi_santri_select_wali" on public.absensi_santri
  for select to authenticated
  using (
    exists (
      select 1 from public.wali_santri ws
      where ws.santri_id = absensi_santri.santri_id
        and ws.wali_id = (select public.current_wali_id())
    )
  );
