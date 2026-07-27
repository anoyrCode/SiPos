-- ============================================================
-- SIPOS — Optimasi RLS: bungkus pemanggilan fungsi dengan (select ...).
--
-- MASALAH (akar lambatnya Riwayat Poin / Laporan / Surat Peringatan):
-- Semua policy RLS selama ini memanggil helper secara telanjang, mis.
--   using (public.can_laporan() or public.can_dashboard() or ...)
-- PostgreSQL memperlakukan pemanggilan seperti itu sebagai ekspresi
-- per-baris, jadi fungsinya dijalankan ULANG UNTUK SETIAP BARIS yang
-- dipindai. Di `transaksi_poin` (16 ribu+ baris) satu query biasa jadi
-- memicu puluhan ribu pemanggilan fungsi — masing-masing melakukan join
-- ke profiles + app_role — sampai menembus statement timeout 8 detik.
--
-- Bukti pendukung dari sesi optimasi sebelumnya: Dashboard menjadi cepat
-- setelah memakai RPC `dashboard_stats` yang SECURITY DEFINER (melewati
-- RLS sepenuhnya), sementara Laporan & Surat Peringatan yang RPC-nya
-- SECURITY INVOKER (tetap lewat RLS) dan Riwayat Poin yang query langsung
-- tetap lambat. Pembeda satu-satunya adalah evaluasi RLS ini.
--
-- SOLUSI: bungkus tiap pemanggilan fungsi tanpa argumen dengan
-- `(select ...)`. PostgreSQL lalu mengangkatnya menjadi InitPlan —
-- dievaluasi SEKALI per query, bukan sekali per baris. Ini optimasi resmi
-- yang direkomendasikan Supabase untuk RLS.
--
-- SEMANTIK TIDAK BERUBAH SAMA SEKALI. Hasil boolean tiap policy persis
-- sama; yang berubah hanya kapan ia dihitung. Tidak ada hak akses yang
-- dilonggarkan atau diperketat di migration ini.
--
-- Fungsi yang menerima argumen dari baris (mis. can_input_for_santri(
-- santri_id), can_view_rekam(santri_id)) SENGAJA dibiarkan apa adanya —
-- hasilnya memang bergantung baris, jadi tidak bisa (dan tidak boleh)
-- diangkat jadi InitPlan.
--
-- Tabel kecil (libur_khusus, jabatan, app_role, level_pendidikan,
-- tahun_ajaran, kelas, absensi_pengaturan, pegawai_jadwal_*) sengaja
-- tidak disentuh: jumlah barisnya sedikit sehingga evaluasi per-baris
-- di sana tidak berdampak, dan membiarkannya mengurangi risiko salah
-- transkripsi policy.
-- ============================================================

-- ------------------------------------------------------------
-- transaksi_poin — tabel terbesar, sumber utama lambatnya aplikasi.
-- ------------------------------------------------------------
alter policy "transaksi_admin_all" on public.transaksi_poin
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

alter policy "transaksi_select_staff" on public.transaksi_poin
  using (
    (select public.can_santri()) or (select public.can_input_poin())
    or (select public.can_laporan()) or (select public.can_kesehatan())
    or (select public.can_akun()) or (select public.can_dashboard())
  );

alter policy "transaksi_select_wali" on public.transaksi_poin
  using (
    exists (
      select 1 from public.wali_santri ws
      where ws.santri_id = transaksi_poin.santri_id
        and ws.wali_id = (select public.current_wali_id())
    )
  );

-- ------------------------------------------------------------
-- santri
-- ------------------------------------------------------------
alter policy "santri_admin_all" on public.santri
  using ((select public.can_santri()))
  with check ((select public.can_santri()));

alter policy "santri_select_staff" on public.santri
  using (
    (select public.can_santri()) or (select public.can_input_poin())
    or (select public.can_laporan()) or (select public.can_kesehatan())
    or (select public.can_akun_wali())
  );

alter policy "santri_select_wali" on public.santri
  using (
    exists (
      select 1 from public.wali_santri ws
      where ws.santri_id = santri.id
        and ws.wali_id = (select public.current_wali_id())
    )
  );

-- ------------------------------------------------------------
-- santri_kelas
-- ------------------------------------------------------------
alter policy "santri_kelas_admin_all" on public.santri_kelas
  using ((select public.can_master()))
  with check ((select public.can_master()));

alter policy "santri_kelas_select_staff" on public.santri_kelas
  using (
    (select public.can_santri()) or (select public.can_input_poin())
    or (select public.can_laporan()) or (select public.can_kesehatan())
    or (select public.can_akun()) or (select public.can_dashboard())
  );

alter policy "santri_kelas_select_wali" on public.santri_kelas
  using (
    exists (
      select 1 from public.wali_santri ws
      where ws.santri_id = santri_kelas.santri_id
        and ws.wali_id = (select public.current_wali_id())
    )
  );

-- ------------------------------------------------------------
-- wali_santri
-- ------------------------------------------------------------
alter policy "wali_santri_admin_all" on public.wali_santri
  using ((select public.can_akun_wali()))
  with check ((select public.can_akun_wali()));

alter policy "wali_santri_select_staff" on public.wali_santri
  using (
    (select public.can_santri()) or (select public.can_input_poin())
    or (select public.can_laporan()) or (select public.can_kesehatan())
    or (select public.can_akun_wali())
  );

alter policy "wali_santri_select_wali" on public.wali_santri
  using (wali_id = (select public.current_wali_id()));

-- ------------------------------------------------------------
-- wali
-- ------------------------------------------------------------
alter policy "wali_admin_all" on public.wali
  using ((select public.can_akun_wali()))
  with check ((select public.can_akun_wali()));

alter policy "wali_select_staff" on public.wali
  using ((select public.can_akun_wali()));

alter policy "wali_select_own" on public.wali
  using (id = (select public.current_wali_id()));

-- ------------------------------------------------------------
-- pegawai
-- ------------------------------------------------------------
alter policy "pegawai_admin_all" on public.pegawai
  using ((select public.can_pegawai()))
  with check ((select public.can_pegawai()));

alter policy "pegawai_select_staff" on public.pegawai
  using (
    (select public.can_pegawai()) or (select public.can_laporan())
    or (select public.can_kesehatan()) or (select public.can_dashboard())
    or (select public.can_rekap_absensi()) or (select public.can_tindak_lanjut_sp())
    or id = (select pegawai_id from public.profiles where id = (select auth.uid()))
  );

-- ------------------------------------------------------------
-- master_poin (di-join di Riwayat Poin & Surat Peringatan)
-- ------------------------------------------------------------
alter policy "master_poin_admin_all" on public.master_poin
  using ((select public.can_master()))
  with check ((select public.can_master()));

-- ------------------------------------------------------------
-- guru_kelas (dibaca tiap halaman utk peran ter-scope kelas)
-- ------------------------------------------------------------
alter policy "guru_kelas_manage" on public.guru_kelas
  using ((select public.can_master()))
  with check ((select public.can_master()));

alter policy "guru_kelas_select_own" on public.guru_kelas
  using (
    (select public.can_master())
    or pegawai_id = (select pegawai_id from public.profiles where id = (select auth.uid()))
  );

-- ------------------------------------------------------------
-- absensi (tumbuh tiap hari — rekap per rentang memindai banyak baris)
-- ------------------------------------------------------------
alter policy "absensi_select_own_or_admin" on public.absensi
  using (
    pegawai_id = (select public.current_pegawai_id())
    or (select public.can_master())
    or (select public.can_rekap_absensi())
  );

alter policy "absensi_insert_own" on public.absensi
  with check (
    (select public.can_absensi())
    and pegawai_id = (select public.current_pegawai_id())
  );

alter policy "absensi_update_own" on public.absensi
  using (
    (select public.can_absensi())
    and pegawai_id = (select public.current_pegawai_id())
  )
  with check (
    (select public.can_absensi())
    and pegawai_id = (select public.current_pegawai_id())
  );

alter policy "absensi_delete_approver" on public.absensi
  using ((select public.can_approve_absensi()));

-- ------------------------------------------------------------
-- absensi_pengajuan
-- ------------------------------------------------------------
alter policy "absensi_pengajuan_select_own" on public.absensi_pengajuan
  using (
    pegawai_id = (select pegawai_id from public.profiles where id = (select auth.uid()))
  );

alter policy "absensi_pengajuan_select_approver" on public.absensi_pengajuan
  using ((select public.can_approve_absensi()));

alter policy "absensi_pengajuan_insert_own" on public.absensi_pengajuan
  with check (
    pegawai_id = (select pegawai_id from public.profiles where id = (select auth.uid()))
  );

alter policy "absensi_pengajuan_update_approver" on public.absensi_pengajuan
  using ((select public.can_approve_absensi()));

-- ------------------------------------------------------------
-- rekam_medis (rekam_medis_select pakai can_view_rekam(santri_id) —
-- bergantung baris, sengaja tidak diubah)
-- ------------------------------------------------------------
alter policy "rekam_medis_manage" on public.rekam_medis
  using ((select public.can_kesehatan()))
  with check ((select public.can_kesehatan()));

-- ------------------------------------------------------------
-- surat_panggilan_tindak_lanjut (0034)
-- ------------------------------------------------------------
alter policy "sp_tindak_lanjut_select" on public.surat_panggilan_tindak_lanjut
  using ((select public.can_laporan()) or (select public.can_tindak_lanjut_sp()));

alter policy "sp_tindak_lanjut_insert" on public.surat_panggilan_tindak_lanjut
  with check ((select public.can_tindak_lanjut_sp()));

alter policy "sp_tindak_lanjut_delete" on public.surat_panggilan_tindak_lanjut
  using ((select public.can_tindak_lanjut_sp()));

-- ------------------------------------------------------------
-- profiles (dibaca tiap request lewat getProfile())
-- ------------------------------------------------------------
alter policy "profiles_select_own" on public.profiles
  using ((select auth.uid()) = id);

alter policy "profiles_select_admin" on public.profiles
  using ((select public.is_admin()));

alter policy "profiles_admin_write" on public.profiles
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
