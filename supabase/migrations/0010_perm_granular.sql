-- ============================================================
-- SIPOS — Hak akses granular: Santri, Pegawai, Akun Staff
-- Memungkinkan peran custom yang HANYA boleh kelola salah satu
-- dari Santri / Pegawai / Akun Staff, tanpa perlu perm_master
-- (semua master data) atau perm_akun (semua akun & peran) penuh.
-- ============================================================

alter table public.app_role
  add column perm_santri     boolean not null default false,
  add column perm_pegawai    boolean not null default false,
  add column perm_akun_staff boolean not null default false;

-- ------------------------------------------------------------
-- Helper hak akses baru (pola sama seperti can_master()/can_akun()).
-- perm_master/perm_akun tetap memberi akses penuh (superset) —
-- flag baru ini hanya menambah akses sempit tanpa flag besar tsb.
-- ------------------------------------------------------------
create or replace function public.can_santri()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or coalesce((
    select r.perm_master or r.perm_santri
    from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id
    where pr.id = auth.uid()
  ), false);
$$;

create or replace function public.can_pegawai()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or coalesce((
    select r.perm_master or r.perm_pegawai
    from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id
    where pr.id = auth.uid()
  ), false);
$$;

create or replace function public.can_akun_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or coalesce((
    select r.perm_akun or r.perm_akun_staff
    from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id
    where pr.id = auth.uid()
  ), false);
$$;

-- ------------------------------------------------------------
-- RLS tulis: santri & pegawai kini pakai fungsi granular di atas
-- (menggantikan can_master() agar peran sempit bisa menulis
-- tanpa perm_master). Select tetap terbuka seperti sebelumnya.
-- ------------------------------------------------------------
alter policy "santri_admin_all" on public.santri
  using (public.can_santri()) with check (public.can_santri());
alter policy "pegawai_admin_all" on public.pegawai
  using (public.can_pegawai()) with check (public.can_pegawai());

-- Akun Staff dikelola lewat service-role (admin client) di server
-- action, bukan RLS langsung — pengecekan dilakukan di app layer
-- (canAkunStaff()) plus pembatasan agar peran sempit ini tidak bisa
-- membuat/mengubah akun ber-peran admin atau perm_akun.
