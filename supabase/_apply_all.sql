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
-- ============================================================
-- SIPOS — Fase 2: Database & Migrations (skema)
-- Enum + 10 tabel master/transaksi + constraint + index + trigger.
-- (RLS di 0003_rls.sql, seed di 0004_seed.sql.)
-- ============================================================

-- ------------------------------------------------------------
-- Enum
-- ------------------------------------------------------------
create type public.jenis_kelamin as enum ('L', 'P');
create type public.santri_status as enum ('aktif', 'lulus', 'keluar');
create type public.hubungan_wali as enum ('ayah', 'ibu', 'wali');
create type public.poin_tipe     as enum ('POSITIF', 'NEGATIF');

-- ------------------------------------------------------------
-- level_pendidikan
-- ------------------------------------------------------------
create table public.level_pendidikan (
  id      uuid primary key default gen_random_uuid(),
  nama    text not null,
  urutan  int  not null default 0
);

-- ------------------------------------------------------------
-- tahun_ajaran (hanya satu boleh is_aktif = true)
-- ------------------------------------------------------------
create table public.tahun_ajaran (
  id              uuid primary key default gen_random_uuid(),
  tahun           text not null unique,
  tanggal_mulai   date,
  tanggal_selesai date,
  is_aktif        boolean not null default false
);

-- Jaminan keras: maksimal satu baris aktif.
create unique index uniq_tahun_ajaran_satu_aktif
  on public.tahun_ajaran (is_aktif)
  where is_aktif;

-- ------------------------------------------------------------
-- pegawai
-- ------------------------------------------------------------
create table public.pegawai (
  id            uuid primary key default gen_random_uuid(),
  nip           text unique,
  nama          text not null,
  email         text,
  alamat        text,
  tempat_lahir  text,
  tanggal_lahir date,
  jenis_kelamin public.jenis_kelamin,
  telp          text,
  jabatan       text,
  user_id       uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- kelas (terikat ke tahun ajaran; wali kelas = pegawai)
-- ------------------------------------------------------------
create table public.kelas (
  id                  uuid primary key default gen_random_uuid(),
  nama_kelas          text not null,
  level_pendidikan_id uuid references public.level_pendidikan (id),
  tahun_ajaran_id     uuid references public.tahun_ajaran (id),
  wali_id             uuid references public.pegawai (id) on delete set null,
  created_at          timestamptz not null default now()
);

create index idx_kelas_tahun_ajaran on public.kelas (tahun_ajaran_id);
create index idx_kelas_level         on public.kelas (level_pendidikan_id);

-- ------------------------------------------------------------
-- santri
-- ------------------------------------------------------------
create table public.santri (
  id            uuid primary key default gen_random_uuid(),
  nis           text unique,
  nisn          text,
  nama          text not null,
  email         text,
  jenis_kelamin public.jenis_kelamin,
  nama_ayah     text,
  nama_ibu      text,
  nama_wali     text,
  no_telp_wali  text,
  status        public.santri_status not null default 'aktif',
  created_at    timestamptz not null default now()
);

create index idx_santri_no_telp_wali on public.santri (no_telp_wali);

-- ------------------------------------------------------------
-- santri_kelas (penempatan; satu santri satu kelas per tahun ajaran)
-- ------------------------------------------------------------
create table public.santri_kelas (
  id         uuid primary key default gen_random_uuid(),
  santri_id  uuid not null references public.santri (id) on delete cascade,
  kelas_id   uuid not null references public.kelas (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (santri_id, kelas_id)
);

create index idx_santri_kelas_santri on public.santri_kelas (santri_id);
create index idx_santri_kelas_kelas  on public.santri_kelas (kelas_id);

-- ------------------------------------------------------------
-- wali (akun wali santri; username = no_telp)
-- ------------------------------------------------------------
create table public.wali (
  id         uuid primary key default gen_random_uuid(),
  nama       text,
  no_telp    text not null unique,
  user_id    uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- wali_santri (relasi wali ↔ anak)
-- ------------------------------------------------------------
create table public.wali_santri (
  id        uuid primary key default gen_random_uuid(),
  wali_id   uuid not null references public.wali (id)   on delete cascade,
  santri_id uuid not null references public.santri (id) on delete cascade,
  hubungan  public.hubungan_wali,
  unique (wali_id, santri_id)
);

create index idx_wali_santri_wali   on public.wali_santri (wali_id);
create index idx_wali_santri_santri on public.wali_santri (santri_id);

-- ------------------------------------------------------------
-- master_poin (gabungan poin positif & negatif via kolom tipe)
-- nilai_poin = magnitudo (selalu >= 0); tanda diturunkan dari tipe.
-- ------------------------------------------------------------
create table public.master_poin (
  id             uuid primary key default gen_random_uuid(),
  kode_poin      text not null unique,
  tipe           public.poin_tipe not null,
  nama_poin      text not null,
  deskripsi_poin text,
  nilai_poin     int  not null check (nilai_poin >= 0),
  level          text,
  keterangan     text,
  is_aktif       boolean not null default true,
  created_at     timestamptz not null default now()
);

create index idx_master_poin_tipe on public.master_poin (tipe);

-- ------------------------------------------------------------
-- transaksi_poin (riwayat input poin — modul inti)
-- tipe & nilai_poin = snapshot saat dicatat.
-- ------------------------------------------------------------
create table public.transaksi_poin (
  id               uuid primary key default gen_random_uuid(),
  santri_id        uuid not null references public.santri (id),
  master_poin_id   uuid not null references public.master_poin (id),
  pegawai_id       uuid references public.pegawai (id) on delete set null,
  tipe             public.poin_tipe not null,
  nilai_poin       int  not null check (nilai_poin >= 0),
  is_override      boolean not null default false,
  tanggal_kejadian date not null default current_date,
  catatan          text,
  tahun_ajaran_id  uuid references public.tahun_ajaran (id),
  created_at       timestamptz not null default now()
);

create index idx_transaksi_santri        on public.transaksi_poin (santri_id);
create index idx_transaksi_ta_tipe        on public.transaksi_poin (tahun_ajaran_id, tipe);
create index idx_transaksi_master_poin    on public.transaksi_poin (master_poin_id);
create index idx_transaksi_tanggal        on public.transaksi_poin (tanggal_kejadian);

-- ------------------------------------------------------------
-- FK profiles → pegawai/wali (kolomnya dibuat di Fase 1, constraint ditunda).
-- ------------------------------------------------------------
alter table public.profiles
  add constraint profiles_pegawai_id_fkey
    foreign key (pegawai_id) references public.pegawai (id) on delete set null,
  add constraint profiles_wali_id_fkey
    foreign key (wali_id) references public.wali (id) on delete set null;

-- ------------------------------------------------------------
-- Trigger: set satu tahun ajaran aktif → otomatis non-aktifkan yang lain.
-- ------------------------------------------------------------
create or replace function public.enforce_single_active_tahun_ajaran()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_aktif then
    update public.tahun_ajaran
      set is_aktif = false
      where is_aktif = true and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger trg_single_active_tahun_ajaran
  before insert or update on public.tahun_ajaran
  for each row execute function public.enforce_single_active_tahun_ajaran();

-- ------------------------------------------------------------
-- Trigger: satu santri tidak boleh ada di dua kelas pada tahun ajaran sama.
-- ------------------------------------------------------------
create or replace function public.enforce_one_kelas_per_tahun_ajaran()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tahun_ajaran_id uuid;
begin
  select tahun_ajaran_id into v_tahun_ajaran_id
    from public.kelas where id = new.kelas_id;

  if exists (
    select 1
    from public.santri_kelas sk
    join public.kelas k on k.id = sk.kelas_id
    where sk.santri_id = new.santri_id
      and k.tahun_ajaran_id is not distinct from v_tahun_ajaran_id
      and sk.id <> new.id
  ) then
    raise exception
      'Santri sudah terdaftar di kelas lain pada tahun ajaran yang sama';
  end if;

  return new;
end;
$$;

create trigger trg_one_kelas_per_tahun_ajaran
  before insert or update on public.santri_kelas
  for each row execute function public.enforce_one_kelas_per_tahun_ajaran();
-- ============================================================
-- SIPOS — Fase 2: RLS untuk semua tabel (baseline per PRD §7).
-- Admin: full. Pegawai: read master + read/insert transaksi.
-- Wali: read-only data anaknya saja. Audit final di Fase 10.
-- ============================================================

-- ------------------------------------------------------------
-- Helper (SECURITY DEFINER → tidak kena RLS, hindari rekursi policy)
-- ------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'pegawai')
  );
$$;

-- wali_id milik user saat ini (null bila bukan wali).
create or replace function public.current_wali_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select wali_id from public.profiles where id = auth.uid();
$$;

-- ------------------------------------------------------------
-- Aktifkan RLS
-- ------------------------------------------------------------
alter table public.level_pendidikan enable row level security;
alter table public.tahun_ajaran     enable row level security;
alter table public.pegawai          enable row level security;
alter table public.kelas            enable row level security;
alter table public.santri           enable row level security;
alter table public.santri_kelas     enable row level security;
alter table public.wali             enable row level security;
alter table public.wali_santri      enable row level security;
alter table public.master_poin      enable row level security;
alter table public.transaksi_poin   enable row level security;

-- ------------------------------------------------------------
-- Tabel referensi: admin full, semua authenticated boleh baca.
-- (level_pendidikan, tahun_ajaran, kelas, master_poin)
-- ------------------------------------------------------------
create policy "level_pendidikan_admin_all" on public.level_pendidikan
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "level_pendidikan_select_auth" on public.level_pendidikan
  for select to authenticated using (true);

create policy "tahun_ajaran_admin_all" on public.tahun_ajaran
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "tahun_ajaran_select_auth" on public.tahun_ajaran
  for select to authenticated using (true);

create policy "kelas_admin_all" on public.kelas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "kelas_select_auth" on public.kelas
  for select to authenticated using (true);

create policy "master_poin_admin_all" on public.master_poin
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "master_poin_select_auth" on public.master_poin
  for select to authenticated using (true);

-- ------------------------------------------------------------
-- pegawai: admin full, staff (admin+pegawai) boleh baca.
-- ------------------------------------------------------------
create policy "pegawai_admin_all" on public.pegawai
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "pegawai_select_staff" on public.pegawai
  for select to authenticated using (public.is_staff());

-- ------------------------------------------------------------
-- santri: admin full, staff baca semua, wali baca anaknya saja.
-- ------------------------------------------------------------
create policy "santri_admin_all" on public.santri
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "santri_select_staff" on public.santri
  for select to authenticated using (public.is_staff());
create policy "santri_select_wali" on public.santri
  for select to authenticated using (
    exists (
      select 1 from public.wali_santri ws
      where ws.santri_id = santri.id
        and ws.wali_id = public.current_wali_id()
    )
  );

-- ------------------------------------------------------------
-- santri_kelas: admin full, staff baca, wali baca penempatan anaknya.
-- ------------------------------------------------------------
create policy "santri_kelas_admin_all" on public.santri_kelas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "santri_kelas_select_staff" on public.santri_kelas
  for select to authenticated using (public.is_staff());
create policy "santri_kelas_select_wali" on public.santri_kelas
  for select to authenticated using (
    exists (
      select 1 from public.wali_santri ws
      where ws.santri_id = santri_kelas.santri_id
        and ws.wali_id = public.current_wali_id()
    )
  );

-- ------------------------------------------------------------
-- wali: admin full, wali baca barisnya sendiri.
-- ------------------------------------------------------------
create policy "wali_admin_all" on public.wali
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "wali_select_own" on public.wali
  for select to authenticated using (id = public.current_wali_id());

-- ------------------------------------------------------------
-- wali_santri: admin full, staff baca, wali baca relasinya sendiri.
-- ------------------------------------------------------------
create policy "wali_santri_admin_all" on public.wali_santri
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "wali_santri_select_staff" on public.wali_santri
  for select to authenticated using (public.is_staff());
create policy "wali_santri_select_wali" on public.wali_santri
  for select to authenticated using (wali_id = public.current_wali_id());

-- ------------------------------------------------------------
-- transaksi_poin: admin full; pegawai read + insert (tanpa update/delete);
-- wali read transaksi anaknya saja.
-- ------------------------------------------------------------
create policy "transaksi_admin_all" on public.transaksi_poin
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "transaksi_select_staff" on public.transaksi_poin
  for select to authenticated using (public.is_staff());
create policy "transaksi_insert_staff" on public.transaksi_poin
  for insert to authenticated with check (public.is_staff());
create policy "transaksi_select_wali" on public.transaksi_poin
  for select to authenticated using (
    exists (
      select 1 from public.wali_santri ws
      where ws.santri_id = transaksi_poin.santri_id
        and ws.wali_id = public.current_wali_id()
    )
  );

-- ------------------------------------------------------------
-- Grants (RLS tetap menjadi gerbang utama).
-- ------------------------------------------------------------
grant select, insert, update, delete on public.level_pendidikan to authenticated;
grant select, insert, update, delete on public.tahun_ajaran     to authenticated;
grant select, insert, update, delete on public.pegawai          to authenticated;
grant select, insert, update, delete on public.kelas            to authenticated;
grant select, insert, update, delete on public.santri           to authenticated;
grant select, insert, update, delete on public.santri_kelas     to authenticated;
grant select, insert, update, delete on public.wali             to authenticated;
grant select, insert, update, delete on public.wali_santri      to authenticated;
grant select, insert, update, delete on public.master_poin      to authenticated;
grant select, insert, update, delete on public.transaksi_poin   to authenticated;
-- ============================================================
-- SIPOS — Fase 2: Seed data awal (idempoten, aman dijalankan ulang).
-- ============================================================

-- Level pendidikan
insert into public.level_pendidikan (nama, urutan)
select v.nama, v.urutan
from (values ('SD', 1), ('MTS', 2), ('SMA', 3)) as v(nama, urutan)
where not exists (
  select 1 from public.level_pendidikan l where l.nama = v.nama
);

-- Tahun ajaran aktif (trigger akan menon-aktifkan yang lain bila ada).
insert into public.tahun_ajaran (tahun, tanggal_mulai, tanggal_selesai, is_aktif)
values ('2026/2027', '2026-07-01', '2027-06-30', true)
on conflict (tahun) do nothing;

-- Contoh master poin (positif & negatif).
insert into public.master_poin
  (kode_poin, tipe, nama_poin, deskripsi_poin, nilai_poin, level)
values
  ('P-001', 'POSITIF', 'Membantu teman',        'Membantu teman/guru tanpa diminta',          5,  'PERUNGGU'),
  ('P-002', 'POSITIF', 'Juara lomba kecamatan',  'Meraih juara lomba tingkat kecamatan',       25, 'PERAK'),
  ('P-003', 'POSITIF', 'Hafalan satu juz',       'Menyelesaikan hafalan satu juz',             50, 'EMAS'),
  ('N-001', 'NEGATIF', 'Terlambat',              'Terlambat masuk kelas/kegiatan',             5,  'RINGAN'),
  ('N-002', 'NEGATIF', 'Tidak shalat berjamaah', 'Tidak mengikuti shalat berjamaah tanpa uzur',15, 'SEDANG'),
  ('N-003', 'NEGATIF', 'Keluar tanpa izin',      'Keluar lingkungan pesantren tanpa izin',     50, 'BERAT')
on conflict (kode_poin) do nothing;
-- ============================================================
-- SIPOS — Master Level Poin (level custom untuk poin positif & negatif)
-- ============================================================

create table public.master_level_poin (
  id         uuid primary key default gen_random_uuid(),
  tipe       public.poin_tipe not null,
  nama       text not null,
  urutan     int  not null default 0,
  created_at timestamptz not null default now(),
  unique (tipe, nama)
);

create index idx_master_level_poin_tipe on public.master_level_poin (tipe);

alter table public.master_level_poin enable row level security;

create policy "master_level_poin_admin_all" on public.master_level_poin
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "master_level_poin_select_auth" on public.master_level_poin
  for select to authenticated using (true);

grant select, insert, update, delete on public.master_level_poin to authenticated;

insert into public.master_level_poin (tipe, nama, urutan)
select v.tipe::public.poin_tipe, v.nama, v.urutan
from (values
  ('POSITIF', 'PERUNGGU', 1),
  ('POSITIF', 'PERAK',    2),
  ('POSITIF', 'EMAS',     3),
  ('NEGATIF', 'RINGAN',   1),
  ('NEGATIF', 'SEDANG',   2),
  ('NEGATIF', 'BERAT',    3)
) as v(tipe, nama, urutan)
on conflict (tipe, nama) do nothing;
-- ============================================================
-- SIPOS — Peran dinamis & hak akses (Tahap 1)
-- ============================================================

create table public.app_role (
  id              uuid primary key default gen_random_uuid(),
  nama            text not null unique,
  deskripsi       text,
  perm_input_poin boolean not null default false,
  perm_laporan    boolean not null default false,
  perm_master     boolean not null default false,
  perm_akun       boolean not null default false,
  scope_kelas     boolean not null default false,
  is_super        boolean not null default false,
  is_aktif        boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table public.profiles
  add column app_role_id uuid references public.app_role (id) on delete set null;

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

update public.profiles
  set app_role_id = (select id from public.app_role where is_super limit 1)
  where role = 'admin' and app_role_id is null;
update public.profiles
  set app_role_id = (select id from public.app_role where nama = 'Pegawai' limit 1)
  where role = 'pegawai' and app_role_id is null;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select r.is_super from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id
    where pr.id = auth.uid()
  ), false)
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

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
    select r.perm_master from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id where pr.id = auth.uid()
  ), false);
$$;

create or replace function public.can_input_poin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or coalesce((
    select r.perm_input_poin from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id where pr.id = auth.uid()
  ), false);
$$;

create or replace function public.can_laporan()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or coalesce((
    select r.perm_laporan from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id where pr.id = auth.uid()
  ), false);
$$;

create or replace function public.can_akun()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or coalesce((
    select r.perm_akun from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id where pr.id = auth.uid()
  ), false);
$$;

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

alter policy "transaksi_insert_staff" on public.transaksi_poin
  with check (public.can_input_poin());

alter table public.app_role enable row level security;
create policy "app_role_manage" on public.app_role
  for all to authenticated using (public.can_akun()) with check (public.can_akun());
create policy "app_role_select_auth" on public.app_role
  for select to authenticated using (true);
grant select, insert, update, delete on public.app_role to authenticated;
-- ============================================================
-- SIPOS — Penugasan guru ↔ kelas + input poin ter-scope (Tahap 3)
-- ============================================================

create table public.guru_kelas (
  id         uuid primary key default gen_random_uuid(),
  pegawai_id uuid not null references public.pegawai (id) on delete cascade,
  kelas_id   uuid not null references public.kelas (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (pegawai_id, kelas_id)
);

create index idx_guru_kelas_pegawai on public.guru_kelas (pegawai_id);
create index idx_guru_kelas_kelas   on public.guru_kelas (kelas_id);

create or replace function public.can_input_for_santri(p_santri uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_input_poin() and (
    public.is_admin()
    or not coalesce((
      select r.scope_kelas from public.profiles pr
      join public.app_role r on r.id = pr.app_role_id
      where pr.id = auth.uid()
    ), false)
    or exists (
      select 1
      from public.profiles pr
      join public.guru_kelas gk on gk.pegawai_id = pr.pegawai_id
      join public.kelas k on k.id = gk.kelas_id
      join public.tahun_ajaran ta on ta.id = k.tahun_ajaran_id and ta.is_aktif
      join public.santri_kelas sk on sk.kelas_id = gk.kelas_id
      where pr.id = auth.uid() and sk.santri_id = p_santri
    )
  );
$$;

alter policy "transaksi_insert_staff" on public.transaksi_poin
  with check (public.can_input_for_santri(santri_id));

alter table public.guru_kelas enable row level security;
create policy "guru_kelas_manage" on public.guru_kelas
  for all to authenticated
  using (public.can_master()) with check (public.can_master());
create policy "guru_kelas_select_own" on public.guru_kelas
  for select to authenticated using (
    public.can_master()
    or pegawai_id = (select pegawai_id from public.profiles where id = auth.uid())
  );
grant select, insert, update, delete on public.guru_kelas to authenticated;
-- ============================================================
-- SIPOS — Scope tampilan riwayat/laporan (Tahap 3 lanjutan)
-- ============================================================

create or replace function public.santri_in_scope(p_santri uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin()
    or not coalesce((
      select r.scope_kelas from public.profiles pr
      join public.app_role r on r.id = pr.app_role_id
      where pr.id = auth.uid()
    ), false)
    or exists (
      select 1
      from public.profiles pr
      join public.guru_kelas gk on gk.pegawai_id = pr.pegawai_id
      join public.kelas k on k.id = gk.kelas_id
      join public.tahun_ajaran ta on ta.id = k.tahun_ajaran_id and ta.is_aktif
      join public.santri_kelas sk on sk.kelas_id = gk.kelas_id
      where pr.id = auth.uid() and sk.santri_id = p_santri
    );
$$;

create or replace function public.can_input_for_santri(p_santri uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_input_poin() and public.santri_in_scope(p_santri);
$$;

create or replace function public.can_view_for_santri(p_santri uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_laporan() and public.santri_in_scope(p_santri);
$$;

alter policy "transaksi_select_staff" on public.transaksi_poin
  using (public.can_view_for_santri(santri_id));
-- ============================================================
-- SIPOS — Rekam Medis UKS
-- ============================================================

alter table public.app_role
  add column if not exists perm_kesehatan boolean not null default false;

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

alter table public.rekam_medis enable row level security;
create policy "rekam_medis_manage" on public.rekam_medis
  for all to authenticated
  using (public.can_kesehatan()) with check (public.can_kesehatan());
create policy "rekam_medis_select" on public.rekam_medis
  for select to authenticated using (public.can_view_rekam(santri_id));

-- ============================================================
-- Hak akses granular: Santri, Pegawai, Akun Staff
-- ============================================================

alter table public.app_role
  add column perm_santri     boolean not null default false,
  add column perm_pegawai    boolean not null default false,
  add column perm_akun_staff boolean not null default false;

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

alter policy "santri_admin_all" on public.santri
  using (public.can_santri()) with check (public.can_santri());
alter policy "pegawai_admin_all" on public.pegawai
  using (public.can_pegawai()) with check (public.can_pegawai());
grant select, insert, update, delete on public.rekam_medis to authenticated;
