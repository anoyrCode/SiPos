-- ============================================================
-- SIPOS — Jabatan sbg master data dinamis
-- Daftar "dikenal" utk dropdown/filter/KPI Dashboard. Kolom
-- pegawai.jabatan/jabatan_tambahan TETAP teks biasa (bukan FK)
-- supaya kompatibel dgn data lama & pola "Lainnya" (custom text).
-- ============================================================

create table public.jabatan (
  id         uuid primary key default gen_random_uuid(),
  nama       text not null unique,
  is_aktif   boolean not null default true,
  is_guru    boolean not null default false,
  created_at timestamptz not null default now()
);

-- Seed 21 preset yang sebelumnya hardcoded di pegawai-form.tsx.
-- is_guru = true HANYA utk yg match regex lama (/guru|musyrif/i) —
-- supaya KPI Dashboard "Guru Laki-laki/Perempuan" tidak berubah hasil
-- begitu migrasi ini jalan.
insert into public.jabatan (nama, is_guru) values
  ('Musyrif', true),
  ('Musyrifah', true),
  ('Kesantrian Akhwat', false),
  ('Kesantrian Ikhwan', false),
  ('Humas', false),
  ('Tim Media', false),
  ('IT Support (TU)', false),
  ('IT Development', false),
  ('Tim Keamanan', false),
  ('Guru Profesional', true),
  ('Tim Kurikulum', false),
  ('Administrasi', false),
  ('SDM', false),
  ('Tim Kesehatan', false),
  ('Tim Kepala Sekolah', false),
  ('Tim Maintenance Umum', false),
  ('Tim Maintenance AC', false),
  ('Tim Maintenance Kelistrikan', false),
  ('Bagian Dapur/Konsumsi', false),
  ('Bagian Kantin', false),
  ('Tim Percetakan', false);

alter table public.jabatan enable row level security;

create policy "jabatan_select_staff" on public.jabatan
  for select to authenticated using (public.can_pegawai());

create policy "jabatan_insert_pegawai" on public.jabatan
  for insert to authenticated with check (public.can_pegawai());

create policy "jabatan_update_pegawai" on public.jabatan
  for update to authenticated using (public.can_pegawai()) with check (public.can_pegawai());

grant select, insert, update on public.jabatan to authenticated;
