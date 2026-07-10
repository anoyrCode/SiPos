-- ============================================================
-- SIPOS — Hak akses granular: Lihat Dashboard (tanpa perlu
-- perm_master penuh). Pola sama seperti perm_santri/perm_pegawai
-- di 0010_perm_granular.sql.
-- ============================================================

alter table public.app_role
  add column perm_dashboard boolean not null default false;

create or replace function public.can_dashboard()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or coalesce((
    select r.perm_master or r.perm_dashboard
    from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id
    where pr.id = auth.uid()
  ), false);
$$;

-- Dashboard membaca santri/pegawai/santri_kelas/transaksi_poin (agregat) —
-- perluas SELECT staff supaya role perm_dashboard-only juga bisa baca
-- data yang dibutuhkan halaman itu, tanpa perlu perm_master penuh.
alter policy "santri_select_staff" on public.santri
  using (
    public.can_santri() or public.can_input_poin() or public.can_laporan()
    or public.can_kesehatan() or public.can_akun() or public.can_dashboard()
  );

alter policy "santri_kelas_select_staff" on public.santri_kelas
  using (
    public.can_santri() or public.can_input_poin() or public.can_laporan()
    or public.can_kesehatan() or public.can_akun() or public.can_dashboard()
  );

alter policy "transaksi_select_staff" on public.transaksi_poin
  using (
    public.can_santri() or public.can_input_poin() or public.can_laporan()
    or public.can_kesehatan() or public.can_akun() or public.can_dashboard()
  );

alter policy "pegawai_select_staff" on public.pegawai
  using (
    public.can_pegawai() or public.can_laporan() or public.can_kesehatan()
    or public.can_dashboard()
    or id = (select pegawai_id from public.profiles where id = auth.uid())
  );
