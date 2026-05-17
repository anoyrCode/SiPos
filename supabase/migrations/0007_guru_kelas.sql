-- ============================================================
-- SIPOS — Penugasan guru ↔ kelas + input poin ter-scope (Tahap 3)
-- Peran dengan scope_kelas hanya boleh input poin untuk santri
-- di kelas yang ditugaskan ke pegawai-nya (tahun ajaran aktif).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabel penugasan
-- ------------------------------------------------------------
create table public.guru_kelas (
  id         uuid primary key default gen_random_uuid(),
  pegawai_id uuid not null references public.pegawai (id) on delete cascade,
  kelas_id   uuid not null references public.kelas (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (pegawai_id, kelas_id)
);

create index idx_guru_kelas_pegawai on public.guru_kelas (pegawai_id);
create index idx_guru_kelas_kelas   on public.guru_kelas (kelas_id);

-- ------------------------------------------------------------
-- 2. Helper: boleh input poin untuk santri tertentu?
--    - admin/super: selalu boleh
--    - peran non-scope: boleh semua (asal punya hak input)
--    - peran scope_kelas: santri harus di kelas yang ditugaskan (TA aktif)
-- ------------------------------------------------------------
create or replace function public.can_input_for_santri(p_santri uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_input_poin() and (
    public.is_admin()
    or not coalesce((
      select r.scope_kelas
      from public.profiles pr
      join public.app_role r on r.id = pr.app_role_id
      where pr.id = auth.uid()
    ), false)
    or exists (
      select 1
      from public.profiles pr
      join public.guru_kelas gk on gk.pegawai_id = pr.pegawai_id
      join public.kelas k on k.id = gk.kelas_id
      join public.tahun_ajaran ta
        on ta.id = k.tahun_ajaran_id and ta.is_aktif
      join public.santri_kelas sk on sk.kelas_id = gk.kelas_id
      where pr.id = auth.uid() and sk.santri_id = p_santri
    )
  );
$$;

-- ------------------------------------------------------------
-- 3. Insert transaksi poin: ter-scope per santri.
-- ------------------------------------------------------------
alter policy "transaksi_insert_staff" on public.transaksi_poin
  with check (public.can_input_for_santri(santri_id));

-- ------------------------------------------------------------
-- 4. RLS guru_kelas: admin/master kelola; guru baca penugasannya sendiri.
-- ------------------------------------------------------------
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
