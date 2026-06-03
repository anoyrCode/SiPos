-- ============================================================
-- SIPOS — Rekam Medis UKS
-- Petugas UKS/admin mencatat kunjungan; wali lihat anaknya,
-- guru ber-scope lihat kelasnya. Menempel pada peran dinamis.
-- ============================================================

-- 1. Flag hak akses baru
alter table public.app_role
  add column if not exists perm_kesehatan boolean not null default false;

-- 2. Tabel log kunjungan UKS
create table public.rekam_medis (
  id              uuid primary key default gen_random_uuid(),
  santri_id       uuid not null references public.santri (id) on delete cascade,
  tanggal         date not null default current_date,
  keluhan         text not null,
  tindakan        text,
  obat            text,
  catatan         text,
  petugas_id      uuid references public.pegawai (id) on delete set null,
  tahun_ajaran_id uuid references public.tahun_ajaran (id),
  created_at      timestamptz not null default now()
);

create index idx_rekam_medis_santri on public.rekam_medis (santri_id);
create index idx_rekam_medis_ta     on public.rekam_medis (tahun_ajaran_id);

-- 3. Helper hak akses (SECURITY DEFINER)
create or replace function public.can_kesehatan()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or coalesce((
    select r.perm_kesehatan from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id
    where pr.id = auth.uid()
  ), false);
$$;

create or replace function public.is_wali_of(p_santri uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.wali_santri ws
    where ws.santri_id = p_santri
      and ws.wali_id = public.current_wali_id()
  );
$$;

-- Khusus cabang guru: HANYA peran scope_kelas + santri di kelas tugasnya.
-- (Sengaja tidak memakai santri_in_scope yang juga true utk admin/non-scope.)
create or replace function public.santri_in_assigned_kelas(p_santri uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select r.scope_kelas from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id
    where pr.id = auth.uid()
  ), false)
  and exists (
    select 1
    from public.profiles pr
    join public.guru_kelas gk on gk.pegawai_id = pr.pegawai_id
    join public.kelas k on k.id = gk.kelas_id
    join public.tahun_ajaran ta on ta.id = k.tahun_ajaran_id and ta.is_aktif
    join public.santri_kelas sk on sk.kelas_id = gk.kelas_id
    where pr.id = auth.uid() and sk.santri_id = p_santri
  );
$$;

create or replace function public.can_view_rekam(p_santri uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_kesehatan()
    or public.is_wali_of(p_santri)
    or public.santri_in_assigned_kelas(p_santri);
$$;

-- 4. RLS
alter table public.rekam_medis enable row level security;

create policy "rekam_medis_manage" on public.rekam_medis
  for all to authenticated
  using (public.can_kesehatan()) with check (public.can_kesehatan());
create policy "rekam_medis_select" on public.rekam_medis
  for select to authenticated using (public.can_view_rekam(santri_id));

grant select, insert, update, delete on public.rekam_medis to authenticated;
