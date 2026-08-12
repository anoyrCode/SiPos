-- ============================================================
-- SIPOS — Sambungkan perm_absensi_santri & perm_rekap_absensi_santri ke
-- RLS SELECT tabel yang dibaca fitur Absensi Santri (guru_kelas,
-- santri_kelas, santri, pegawai).
--
-- Migrasi 0041 menambah kedua kolom perm ini tapi tidak pernah
-- menyambungkannya ke sini — cukup aman selama musyrif/admin yang pakai
-- fitur ini selalu punya izin lain juga (input_poin, master, dst) yang
-- menutupi celahnya, tapi peran SEMPIT yang cuma pegang salah satu perm ini
-- akan mentok data kosong walau sudah lolos gerbang halaman. Pola yang sama
-- sudah 2x kejadian di project ini (KPI Guru = 0 di migrasi 0036, redirect
-- loop perm_approve_absensi) — checklist "kalau nambah permission baru, cek
-- requireStaff + homePathForProfile + RLS select" ada di komentar
-- lib/auth/dal.ts, terlewat untuk 0041. Sisi kode (requireStaff,
-- homePathForProfile) diperbaiki bersamaan dengan migrasi ini.
-- ============================================================

-- 1. Helper 0-arg — beda dari can_absensi_santri(kelas_id, checkpoint_id)
--    yang sudah ada (dipakai untuk cek per-baris di absensi_santri sendiri).
--    Postgres membedakan lewat jumlah argumen (overload), bukan lewat nama.
--    Dipakai di SELECT policy tabel lain yang tidak scoped ke 1 kelas.
create or replace function public.can_absensi_santri()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or coalesce((
    select r.perm_master or r.perm_absensi_santri
    from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id
    where pr.id = auth.uid()
  ), false);
$$;

-- 2. guru_kelas — halaman Rekap Absensi Santri (admin) query SEMUA
--    guru_kelas (bukan cuma milik sendiri) untuk memetakan shift per kelas;
--    sebelumnya cuma can_master() atau baris milik sendiri yang lolos.
alter policy "guru_kelas_select_own" on public.guru_kelas
  using (
    (select public.can_master())
    or (select public.can_rekap_absensi_santri())
    or pegawai_id = (select pegawai_id from public.profiles where id = (select auth.uid()))
  );

-- 3. santri_kelas, santri, pegawai — dibaca baik oleh halaman input musyrif
--    (perm_absensi_santri) maupun rekap admin (perm_rekap_absensi_santri).
--    Broad-grant + scoping di query aplikasi (bukan RLS per-baris),
--    konsisten dengan cara can_input_poin() dkk sudah diperlakukan di
--    policy yang sama.
alter policy "santri_kelas_select_staff" on public.santri_kelas
  using (
    (select public.can_santri()) or (select public.can_input_poin())
    or (select public.can_laporan()) or (select public.can_kesehatan())
    or (select public.can_akun()) or (select public.can_dashboard())
    or (select public.can_absensi_santri()) or (select public.can_rekap_absensi_santri())
  );

alter policy "santri_select_staff" on public.santri
  using (
    (select public.can_santri()) or (select public.can_input_poin())
    or (select public.can_laporan()) or (select public.can_kesehatan())
    or (select public.can_akun_wali())
    or (select public.can_absensi_santri()) or (select public.can_rekap_absensi_santri())
  );

alter policy "pegawai_select_staff" on public.pegawai
  using (
    (select public.can_pegawai()) or (select public.can_laporan())
    or (select public.can_kesehatan()) or (select public.can_dashboard())
    or (select public.can_rekap_absensi()) or (select public.can_tindak_lanjut_sp())
    or (select public.can_rekap_absensi_santri())
    or id = (select pegawai_id from public.profiles where id = (select auth.uid()))
  );
