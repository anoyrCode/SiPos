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
