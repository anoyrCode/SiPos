-- ============================================================
-- SIPOS — Absensi Pegawai (geofenced clock in/out)
-- Jadwal per pegawai + lokasi pondok admin-adjustable.
-- Status (Telat/Curang/Alpa/dll) DIHITUNG di aplikasi, tidak
-- disimpan di sini — tabel ini hanya menyimpan fakta mentah.
-- ============================================================

-- 1. Flag hak akses baru (independen, bisa dicentang di role manapun)
alter table public.app_role
  add column if not exists perm_absensi boolean not null default false;

-- 2. Jadwal per pegawai
alter table public.pegawai
  add column if not exists jam_masuk_jadwal time,
  add column if not exists jam_pulang_jadwal time,
  add column if not exists hari_libur smallint check (hari_libur between 0 and 6);

-- 3. Pengaturan lokasi pondok (selalu 1 baris)
create table public.absensi_pengaturan (
  id           uuid primary key default gen_random_uuid(),
  lokasi_lat   double precision,
  lokasi_long  double precision,
  radius_meter integer not null default 150,
  updated_at   timestamptz not null default now()
);
insert into public.absensi_pengaturan (radius_meter) values (150);

-- 4. Transaksi absensi harian
create table public.absensi (
  id                 uuid primary key default gen_random_uuid(),
  pegawai_id         uuid not null references public.pegawai (id) on delete cascade,
  tanggal            date not null,
  jam_masuk_aktual   timestamptz,
  jam_pulang_aktual  timestamptz,
  lokasi_masuk_lat   double precision,
  lokasi_masuk_long  double precision,
  lokasi_pulang_lat  double precision,
  lokasi_pulang_long double precision,
  created_at         timestamptz not null default now(),
  unique (pegawai_id, tanggal)
);
create index idx_absensi_pegawai on public.absensi (pegawai_id);
create index idx_absensi_tanggal on public.absensi (tanggal);

-- 5. Helper hak akses & kepemilikan (SECURITY DEFINER → tidak kena RLS)
create or replace function public.can_absensi()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or coalesce((
    select r.perm_absensi
    from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id
    where pr.id = auth.uid()
  ), false);
$$;

create or replace function public.current_pegawai_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select pegawai_id from public.profiles where id = auth.uid();
$$;

-- 6. RLS
alter table public.absensi_pengaturan enable row level security;
create policy "absensi_pengaturan_select_auth" on public.absensi_pengaturan
  for select to authenticated using (true);
create policy "absensi_pengaturan_update_admin" on public.absensi_pengaturan
  for update to authenticated using (public.can_master()) with check (public.can_master());

alter table public.absensi enable row level security;
create policy "absensi_select_own_or_admin" on public.absensi
  for select to authenticated
  using (pegawai_id = public.current_pegawai_id() or public.can_master());
create policy "absensi_insert_own" on public.absensi
  for insert to authenticated
  with check (public.can_absensi() and pegawai_id = public.current_pegawai_id());
create policy "absensi_update_own" on public.absensi
  for update to authenticated
  using (public.can_absensi() and pegawai_id = public.current_pegawai_id())
  with check (public.can_absensi() and pegawai_id = public.current_pegawai_id());

grant select, insert, update on public.absensi to authenticated;
grant select, update on public.absensi_pengaturan to authenticated;
