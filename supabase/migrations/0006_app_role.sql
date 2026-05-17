-- ============================================================
-- SIPOS — Peran dinamis & hak akses (Tahap 1: fondasi)
-- Admin bisa membuat peran custom dengan kombinasi hak akses.
-- Peran wali TIDAK diubah (tetap via enum profiles.role = 'wali').
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabel peran custom
-- ------------------------------------------------------------
create table public.app_role (
  id              uuid primary key default gen_random_uuid(),
  nama            text not null unique,
  deskripsi       text,
  perm_input_poin boolean not null default false,
  perm_laporan    boolean not null default false,
  perm_master     boolean not null default false,
  perm_akun       boolean not null default false,
  scope_kelas     boolean not null default false, -- true: input poin hanya kelas yang ditugaskan
  is_super        boolean not null default false, -- akses penuh (administrator)
  is_aktif        boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. Tautan profil → peran
-- ------------------------------------------------------------
alter table public.profiles
  add column app_role_id uuid references public.app_role (id) on delete set null;

-- ------------------------------------------------------------
-- 3. Seed peran default
-- ------------------------------------------------------------
insert into public.app_role
  (nama, deskripsi, perm_input_poin, perm_laporan, perm_master, perm_akun, scope_kelas, is_super)
values
  ('Administrator', 'Akses penuh ke seluruh sistem.',
   true,  true,  true,  true,  false, true),
  ('Guru/Musyrif',  'Input poin santri pada kelas yang ditugaskan + lihat laporan.',
   true,  true,  false, false, true,  false),
  ('Pegawai',       'Hanya melihat riwayat & laporan.',
   false, true,  false, false, false, false)
on conflict (nama) do nothing;

-- ------------------------------------------------------------
-- 4. Migrasi akun lama → peran
-- ------------------------------------------------------------
update public.profiles
  set app_role_id = (select id from public.app_role where is_super limit 1)
  where role = 'admin' and app_role_id is null;
update public.profiles
  set app_role_id = (select id from public.app_role where nama = 'Pegawai' limit 1)
  where role = 'pegawai' and app_role_id is null;

-- ------------------------------------------------------------
-- 5. Helper hak akses (SECURITY DEFINER → tidak kena RLS)
-- ------------------------------------------------------------
-- Admin/super: dari peran is_super ATAU fallback enum lama 'admin'.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select r.is_super
    from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id
    where pr.id = auth.uid()
  ), false)
  or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Staff internal: punya peran ATAU fallback enum lama (admin/pegawai).
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (app_role_id is not null or role in ('admin', 'pegawai'))
  );
$$;

create or replace function public.can_master()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or coalesce((
    select r.perm_master
    from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id
    where pr.id = auth.uid()
  ), false);
$$;

create or replace function public.can_input_poin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or coalesce((
    select r.perm_input_poin
    from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id
    where pr.id = auth.uid()
  ), false);
$$;

create or replace function public.can_laporan()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or coalesce((
    select r.perm_laporan
    from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id
    where pr.id = auth.uid()
  ), false);
$$;

create or replace function public.can_akun()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or coalesce((
    select r.perm_akun
    from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id
    where pr.id = auth.uid()
  ), false);
$$;

-- ------------------------------------------------------------
-- 6. RLS: tulis master data kini berbasis can_master().
--    (select tetap terbuka untuk authenticated seperti sebelumnya)
-- ------------------------------------------------------------
alter policy "level_pendidikan_admin_all" on public.level_pendidikan
  using (public.can_master()) with check (public.can_master());
alter policy "tahun_ajaran_admin_all" on public.tahun_ajaran
  using (public.can_master()) with check (public.can_master());
alter policy "kelas_admin_all" on public.kelas
  using (public.can_master()) with check (public.can_master());
alter policy "master_poin_admin_all" on public.master_poin
  using (public.can_master()) with check (public.can_master());
alter policy "master_level_poin_admin_all" on public.master_level_poin
  using (public.can_master()) with check (public.can_master());
alter policy "pegawai_admin_all" on public.pegawai
  using (public.can_master()) with check (public.can_master());
alter policy "santri_admin_all" on public.santri
  using (public.can_master()) with check (public.can_master());
alter policy "santri_kelas_admin_all" on public.santri_kelas
  using (public.can_master()) with check (public.can_master());

-- Insert transaksi poin: berbasis can_input_poin() (kelas-scope di Tahap 3).
alter policy "transaksi_insert_staff" on public.transaksi_poin
  with check (public.can_input_poin());

-- ------------------------------------------------------------
-- 7. RLS untuk app_role: kelola butuh can_akun(); semua boleh baca.
-- ------------------------------------------------------------
alter table public.app_role enable row level security;

create policy "app_role_manage" on public.app_role
  for all to authenticated using (public.can_akun()) with check (public.can_akun());
create policy "app_role_select_auth" on public.app_role
  for select to authenticated using (true);

grant select, insert, update, delete on public.app_role to authenticated;
