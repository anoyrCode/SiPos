-- ============================================================
-- SIPOS — Absensi Kehadiran Santri (multi-checkpoint per shift).
--
-- Beda total dari Absensi Pegawai (tabel `absensi`/`absensi_pengaturan`,
-- migrasi 0011) — itu kehadiran musyrif SENDIRI (clock in/out 1x/hari).
-- Ini musyrif mencatat kehadiran SANTRI, berkali-kali sehari sesuai
-- checkpoint shift-nya. Tidak ada relasi ke tabel absensi pegawai sama
-- sekali.
--
-- Prinsip: simpan PENGECUALIAN saja (izin/sakit/alpa) — hadir = default,
-- tidak ada baris. Supaya "checkpoint belum diisi" vs "checkpoint sudah
-- diisi, semua hadir" bisa dibedakan (keduanya sama-sama nol baris
-- pengecualian), ada tabel log submission terpisah.
-- ============================================================

-- 1. Permission baru, independen (pola sama perm_absensi/perm_rekap_absensi).
alter table public.app_role
  add column perm_absensi_santri boolean not null default false,
  add column perm_rekap_absensi_santri boolean not null default false;

-- 2. Master jam checkpoint per shift, admin-adjustable.
create table public.absensi_santri_checkpoint (
  id         uuid primary key default gen_random_uuid(),
  shift      smallint not null check (shift in (1, 2, 3)),
  jam        time not null,
  urutan     int not null default 0,
  created_at timestamptz not null default now(),
  unique (shift, jam)
);

-- Seed jadwal awal (idempoten). `urutan` WAJIB dipakai untuk urutkan
-- tampilan — shift 3 melewati tengah malam (21:00 → 04:50), jadi kalau
-- diurutkan dari kolom `jam` mentah, 01:00 akan terlihat "sebelum" 21:00.
insert into public.absensi_santri_checkpoint (shift, jam, urutan)
select v.shift, v.jam::time, v.urutan
from (values
  (1, '05:15', 1), (1, '06:00', 2), (1, '06:55', 3),
  (1, '09:00', 4), (1, '11:20', 5), (1, '12:00', 6),
  (2, '13:00', 1), (2, '14:30', 2), (2, '15:30', 3),
  (2, '17:00', 4), (2, '18:00', 5), (2, '20:15', 6), (2, '21:00', 7),
  (3, '21:00', 1), (3, '22:00', 2), (3, '23:30', 3),
  (3, '01:00', 4), (3, '03:00', 5), (3, '04:00', 6), (3, '04:50', 7)
) as v(shift, jam, urutan)
on conflict (shift, jam) do nothing;

-- 3. Log "checkpoint X untuk kelas Y tanggal Z sudah diisi".
create table public.absensi_santri_submission (
  id            uuid primary key default gen_random_uuid(),
  checkpoint_id uuid not null references public.absensi_santri_checkpoint (id) on delete cascade,
  kelas_id      uuid not null references public.kelas (id) on delete cascade,
  tanggal       date not null,
  dicatat_oleh  uuid references public.pegawai (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (checkpoint_id, kelas_id, tanggal)
);
create index idx_absensi_santri_submission_kelas_tanggal
  on public.absensi_santri_submission (kelas_id, tanggal);

-- 4. Pengecualian kehadiran santri (BUKAN hadir — hadir tidak pernah
--    masuk tabel ini). `kelas_id` snapshot langsung (bukan cuma via
--    santri_kelas) supaya RLS gampang dicek 1 langkah & tetap akurat
--    historis kalau santri pindah kelas belakangan.
create table public.absensi_santri (
  id            uuid primary key default gen_random_uuid(),
  santri_id     uuid not null references public.santri (id) on delete cascade,
  checkpoint_id uuid not null references public.absensi_santri_checkpoint (id) on delete cascade,
  kelas_id      uuid not null references public.kelas (id) on delete cascade,
  tanggal       date not null,
  status        text not null check (status in ('izin', 'sakit', 'alpa')),
  catatan       text,
  created_at    timestamptz not null default now(),
  unique (santri_id, checkpoint_id, tanggal)
);
create index idx_absensi_santri_kelas_checkpoint_tanggal
  on public.absensi_santri (kelas_id, checkpoint_id, tanggal);

-- 5. Helper RLS.
create or replace function public.can_absensi_santri(p_kelas_id uuid, p_checkpoint_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or public.can_master() or (
    coalesce((
      select r.perm_master or r.perm_absensi_santri
      from public.profiles pr
      join public.app_role r on r.id = pr.app_role_id
      where pr.id = auth.uid()
    ), false)
    and exists (
      select 1 from public.guru_kelas gk
      where gk.pegawai_id = public.current_pegawai_id() and gk.kelas_id = p_kelas_id
    )
    and exists (
      select 1 from public.pegawai p
      join public.absensi_santri_checkpoint c on c.shift = p.shift
      where p.id = public.current_pegawai_id() and c.id = p_checkpoint_id
    )
  );
$$;

create or replace function public.can_rekap_absensi_santri()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or coalesce((
    select r.perm_master or r.perm_rekap_absensi_santri
    from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id
    where pr.id = auth.uid()
  ), false);
$$;

-- 6. RLS.
alter table public.absensi_santri_checkpoint enable row level security;
create policy "absensi_santri_checkpoint_select_auth" on public.absensi_santri_checkpoint
  for select to authenticated using (true);
create policy "absensi_santri_checkpoint_admin_all" on public.absensi_santri_checkpoint
  for all to authenticated using (public.can_master()) with check (public.can_master());

alter table public.absensi_santri_submission enable row level security;
create policy "absensi_santri_submission_select" on public.absensi_santri_submission
  for select to authenticated
  using (public.can_absensi_santri(kelas_id, checkpoint_id) or public.can_rekap_absensi_santri());
create policy "absensi_santri_submission_insert" on public.absensi_santri_submission
  for insert to authenticated
  with check (public.can_absensi_santri(kelas_id, checkpoint_id));
create policy "absensi_santri_submission_update" on public.absensi_santri_submission
  for update to authenticated
  using (public.can_absensi_santri(kelas_id, checkpoint_id))
  with check (public.can_absensi_santri(kelas_id, checkpoint_id));

alter table public.absensi_santri enable row level security;
create policy "absensi_santri_select" on public.absensi_santri
  for select to authenticated
  using (public.can_absensi_santri(kelas_id, checkpoint_id) or public.can_rekap_absensi_santri());
create policy "absensi_santri_insert" on public.absensi_santri
  for insert to authenticated
  with check (public.can_absensi_santri(kelas_id, checkpoint_id));
create policy "absensi_santri_delete" on public.absensi_santri
  for delete to authenticated
  using (public.can_absensi_santri(kelas_id, checkpoint_id));

grant select, insert, update, delete on public.absensi_santri_checkpoint to authenticated;
grant select, insert, update on public.absensi_santri_submission to authenticated;
grant select, insert, delete on public.absensi_santri to authenticated;
