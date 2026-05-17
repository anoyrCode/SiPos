-- ============================================================
-- SIPOS — Scope tampilan riwayat/laporan (Tahap 3 lanjutan)
-- Peran scope_kelas kini juga hanya MELIHAT transaksi poin
-- untuk santri di kelas yang ditugaskan (bukan hanya input).
-- ============================================================

-- Helper bersama: apakah santri masuk dalam scope user saat ini?
-- (admin/super: ya; peran non-scope: ya; peran scope_kelas: hanya kelas tugas)
create or replace function public.santri_in_scope(p_santri uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin()
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
      join public.tahun_ajaran ta on ta.id = k.tahun_ajaran_id and ta.is_aktif
      join public.santri_kelas sk on sk.kelas_id = gk.kelas_id
      where pr.id = auth.uid() and sk.santri_id = p_santri
    );
$$;

-- Input poin (pakai helper bersama).
create or replace function public.can_input_for_santri(p_santri uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_input_poin() and public.santri_in_scope(p_santri);
$$;

-- Lihat transaksi (riwayat/laporan).
create or replace function public.can_view_for_santri(p_santri uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_laporan() and public.santri_in_scope(p_santri);
$$;

-- Select transaksi oleh staff kini ter-scope per santri.
alter policy "transaksi_select_staff" on public.transaksi_poin
  using (public.can_view_for_santri(santri_id));

