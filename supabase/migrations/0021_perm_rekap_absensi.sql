-- ============================================================
-- SIPOS — Hak akses granular: Lihat Rekap Kehadiran (Semua
-- Pegawai) tanpa perlu perm_master penuh. Dipisah dari
-- perm_approve_absensi (itu approve/tolak pengajuan, ini cuma
-- lihat rekap per tanggal/bulan termasuk laporan keterlambatan
-- bulanan utk HRD/SDM). Pola sama seperti perm_dashboard di
-- 0014_perm_dashboard.sql.
-- ============================================================

alter table public.app_role
  add column perm_rekap_absensi boolean not null default false;

create or replace function public.can_rekap_absensi()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or coalesce((
    select r.perm_master or r.perm_rekap_absensi
    from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id
    where pr.id = auth.uid()
  ), false);
$$;

-- Rekap Absensi (mode Per Tanggal/Per Bulan) membaca absensi & pegawai
-- SEMUA pegawai, bukan cuma baris sendiri — perluas SELECT supaya role
-- perm_rekap_absensi-only juga bisa baca tanpa perlu perm_master penuh.
alter policy "absensi_select_own_or_admin" on public.absensi
  using (
    pegawai_id = public.current_pegawai_id()
    or public.can_master()
    or public.can_rekap_absensi()
  );

alter policy "pegawai_select_staff" on public.pegawai
  using (
    public.can_pegawai() or public.can_laporan() or public.can_kesehatan()
    or public.can_dashboard() or public.can_rekap_absensi()
    or id = (select pegawai_id from public.profiles where id = auth.uid())
  );
