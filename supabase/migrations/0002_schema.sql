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
