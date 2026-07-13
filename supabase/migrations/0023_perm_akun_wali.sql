-- ============================================================
-- SIPOS — Hak akses granular baru: "Kelola Akun Wali saja"
-- (independen dari perm_akun penuh, pola sama seperti perm_akun_staff).
--
-- Sekaligus perbaiki gap yang ditemukan: tabel `wali` belum ada SELECT
-- policy utk staff sama sekali (cuma wali_admin_all is_admin()-only +
-- wali_select_own), dan write policy wali/wali_santri (admin_all) masih
-- is_admin()-only — akibatnya peran custom dgn perm_akun=true (tapi
-- bukan super admin) sebenarnya TIDAK BISA kelola Akun Wali sama sekali
-- walau lolos gerbang app-layer (requirePerm("akun")), krn RLS menolak
-- diam-diam. Diperbaiki sekalian di sini pakai helper granular baru.
-- ============================================================

alter table public.app_role
  add column perm_akun_wali boolean not null default false;

create or replace function public.can_akun_wali()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or coalesce((
    select r.perm_akun or r.perm_akun_wali
    from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id
    where pr.id = auth.uid()
  ), false);
$$;

-- wali: tambah SELECT staff (sebelumnya tidak ada sama sekali), write
-- (admin_all) diganti dari is_admin() ke can_akun_wali().
create policy "wali_select_staff" on public.wali
  for select to authenticated using (public.can_akun_wali());
alter policy "wali_admin_all" on public.wali
  using (public.can_akun_wali()) with check (public.can_akun_wali());

-- wali_santri: write (admin_all) diganti ke can_akun_wali(); select_staff
-- yg sudah ada (dari 0013, pakai can_akun()) diperluas ke can_akun_wali()
-- (superset, mencakup can_akun() + perm_akun_wali baru).
alter policy "wali_santri_admin_all" on public.wali_santri
  using (public.can_akun_wali()) with check (public.can_akun_wali());
alter policy "wali_santri_select_staff" on public.wali_santri
  using (
    public.can_santri() or public.can_input_poin() or public.can_laporan()
    or public.can_kesehatan() or public.can_akun_wali()
  );

-- santri: select_staff (dipakai searchSantriForWali utk tautkan santri
-- ke wali) diperluas serupa.
alter policy "santri_select_staff" on public.santri
  using (
    public.can_santri() or public.can_input_poin() or public.can_laporan()
    or public.can_kesehatan() or public.can_akun_wali()
  );
