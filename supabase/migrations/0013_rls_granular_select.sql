-- ============================================================
-- SIPOS — Perketat SELECT policy staff dari is_staff() (true utk
-- SIAPAPUN yang punya app_role apapun) ke helper granular per tabel.
-- Sebelumnya, peran sempit yang cuma py perm_absensi/perm_akun_staff/
-- perm_input_poin bisa baca SELURUH tabel pegawai/santri/santri_kelas/
-- wali_santri/transaksi_poin lewat REST API Supabase langsung, walau
-- UI-nya tidak pernah menampilkan itu ke mereka.
--
-- Kombinasi hak akses di bawah dipetakan dari pemakaian nyata tiap
-- tabel di kode (join/embed lintas fitur), bukan cuma nama halaman:
--   - pegawai: dikelola (can_pegawai), ditampilkan sbg "dicatat oleh"
--     di Laporan/Riwayat Poin (can_laporan) & "petugas" di UKS
--     (can_kesehatan), atau baris sendiri (utk Absensi & kartu profil).
--   - santri/santri_kelas/wali_santri/transaksi_poin: dipakai lintas
--     modul Santri, Input Poin, Laporan, UKS, dan Akun Wali.
-- ============================================================

alter policy "pegawai_select_staff" on public.pegawai
  using (
    public.can_pegawai() or public.can_laporan() or public.can_kesehatan()
    or id = (select pegawai_id from public.profiles where id = auth.uid())
  );

alter policy "santri_select_staff" on public.santri
  using (
    public.can_santri() or public.can_input_poin() or public.can_laporan()
    or public.can_kesehatan() or public.can_akun()
  );

alter policy "santri_kelas_select_staff" on public.santri_kelas
  using (
    public.can_santri() or public.can_input_poin() or public.can_laporan()
    or public.can_kesehatan() or public.can_akun()
  );

alter policy "wali_santri_select_staff" on public.wali_santri
  using (
    public.can_santri() or public.can_input_poin() or public.can_laporan()
    or public.can_kesehatan() or public.can_akun()
  );

alter policy "transaksi_select_staff" on public.transaksi_poin
  using (
    public.can_santri() or public.can_input_poin() or public.can_laporan()
    or public.can_kesehatan() or public.can_akun()
  );
