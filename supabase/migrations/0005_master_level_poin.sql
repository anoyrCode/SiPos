-- ============================================================
-- SIPOS — Master Level Poin (level custom untuk poin positif & negatif)
-- Sebelumnya level di-hardcode (PERUNGGU/PERAK/EMAS, RINGAN/SEDANG/BERAT).
-- Kini dikelola admin lewat tabel ini. Kolom master_poin.level tetap text
-- (snapshot nama level), jadi tidak ada perubahan pada tabel lain.
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

-- ------------------------------------------------------------
-- RLS: admin full, semua authenticated boleh baca (sama seperti master lain).
-- ------------------------------------------------------------
alter table public.master_level_poin enable row level security;

create policy "master_level_poin_admin_all" on public.master_level_poin
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "master_level_poin_select_auth" on public.master_level_poin
  for select to authenticated using (true);

grant select, insert, update, delete on public.master_level_poin to authenticated;

-- ------------------------------------------------------------
-- Seed: level default yang sudah dipakai sebelumnya (idempoten).
-- ------------------------------------------------------------
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
