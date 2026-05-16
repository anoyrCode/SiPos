-- ============================================================
-- SIPOS — Fase 1: Auth & Role
-- Tabel `profiles` (1:1 dengan auth.users) + enum peran,
-- trigger auto-buat profil saat user dibuat, helper is_admin(), RLS.
-- ============================================================

-- Enum peran pengguna
create type public.user_role as enum ('admin', 'pegawai', 'wali');

-- Tabel profiles (1:1 dengan auth.users)
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  role        public.user_role not null default 'pegawai',
  -- Kolom relasi disiapkan; FK ke pegawai/wali ditambahkan di Fase 2
  -- setelah tabel `pegawai` dan `wali` dibuat.
  pegawai_id  uuid,
  wali_id     uuid,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'Profil akun + peran. Baris 1:1 dengan auth.users.';

-- ------------------------------------------------------------
-- Helper: apakah user saat ini admin.
-- SECURITY DEFINER → berjalan tanpa RLS sehingga aman dipakai
-- di dalam policy `profiles` tanpa menimbulkan rekursi.
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ------------------------------------------------------------
-- Trigger: buat baris profil otomatis saat auth.users baru dibuat.
-- Peran diambil dari metadata user (di-set admin saat generate akun),
-- default 'pegawai'.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_app_meta_data ->> 'role', '')::public.user_role,
      nullif(new.raw_user_meta_data ->> 'role', '')::public.user_role,
      'pegawai'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

-- Setiap user boleh membaca profilnya sendiri.
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- Admin boleh membaca semua profil.
create policy "profiles_select_admin"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- Admin boleh mengelola (insert/update/delete) semua profil.
create policy "profiles_admin_write"
  on public.profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Grants (RLS tetap menjadi gerbang utama).
grant select, insert, update, delete on public.profiles to authenticated;

-- ------------------------------------------------------------
-- Catatan: untuk menjadikan user pertama sebagai admin, jalankan
-- (setelah user dibuat via Supabase Dashboard > Authentication):
--   update public.profiles set role = 'admin' where email = 'admin@contoh.com';
-- ------------------------------------------------------------
