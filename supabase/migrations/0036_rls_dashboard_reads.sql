-- ============================================================
-- SIPOS — Perbaiki RLS untuk tabel yang dibaca Dashboard.
--
-- GEJALA: KPI "Guru Laki-laki"/"Guru Perempuan" di Dashboard tampil 0
-- untuk akun non-admin, padahal benar saat dibuka admin.
--
-- SEBAB: Dashboard menghitung guru dengan membaca tabel `jabatan`
-- (mengambil daftar nama jabatan yang is_guru = true), lalu mencocokkan
-- ke kolom jabatan/jabatan_tambahan tiap pegawai. Policy `jabatan`
-- hanya mengizinkan can_pegawai() (admin / perm_master / perm_pegawai),
-- sehingga akun lain menerima 0 baris → daftar nama jabatan-guru kosong
-- → tidak ada pegawai yang cocok → hasilnya 0. Bukan data tidak sinkron;
-- barisnya memang tersaring RLS.
--
-- SEKALIAN: `santri_select_staff` kehilangan can_dashboard() saat
-- ditulis ulang di 0023 (0014 sudah memasukkannya, 0023 fokus memperluas
-- untuk akun wali dan tampaknya tidak sengaja menghapusnya). Akibatnya
-- peran yang HANYA punya perm_dashboard melihat Total Santri Aktif = 0
-- dan nama di daftar peringkat jadi "?". Dikembalikan di sini.
--
-- Semua tabel lain yang dibaca Dashboard sudah benar: pegawai (0034),
-- santri_kelas & transaksi_poin (0014), master_poin & tahun_ajaran
-- (select terbuka untuk semua authenticated).
--
-- Penulisan memakai bungkus (select ...) mengikuti 0035 supaya tetap
-- dievaluasi sekali per query (InitPlan), bukan per baris.
-- ============================================================

-- jabatan: Dashboard perlu membacanya untuk menentukan jabatan mana yang
-- dihitung sebagai guru. Hak menulis (insert/update) TIDAK diubah —
-- tetap khusus can_pegawai().
alter policy "jabatan_select_staff" on public.jabatan
  using ((select public.can_pegawai()) or (select public.can_dashboard()));

-- santri: kembalikan can_dashboard() yang hilang sejak 0023.
alter policy "santri_select_staff" on public.santri
  using (
    (select public.can_santri()) or (select public.can_input_poin())
    or (select public.can_laporan()) or (select public.can_kesehatan())
    or (select public.can_akun_wali()) or (select public.can_dashboard())
  );
