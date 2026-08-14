-- ============================================================
-- SIPOS — Perbaikan akses baca untuk peran Catatan Harian.
--
-- Migrasi 0048 menambahkan izin `perm_catatan_harian` dan fungsi
-- `can_catatan_harian()`, TAPI tidak pernah mendaftarkan fungsi itu ke
-- policy SELECT tabel yang dibaca halamannya. Akibatnya peran yang HANYA
-- punya izin ini:
--   - daftar kelas muncul (guru_kelas boleh baca baris sendiri),
--   - tapi roster santri kosong,
--   - dan setiap penyimpanan gagal ("Santri ini bukan anggota kelas yang
--     Anda ampu"), karena pencarian kelas santri tidak mengembalikan apa pun.
-- Fiturnya praktis mati untuk semua orang kecuali admin.
--
-- Dijadikan migrasi terpisah dari 0048 supaya tetap bisa dijalankan baik
-- 0048 sudah terlanjur dieksekusi maupun belum.
--
-- PENTING: `alter policy ... using` mengganti predikat secara TOTAL, bukan
-- menambah. Daftar di bawah menyalin utuh keadaan terakhir tiap policy
-- (migrasi 0046) lalu menambahkan satu syarat baru. Perhatikan keduanya
-- TIDAK identik: santri_kelas memakai can_akun(), sedangkan santri memakai
-- can_akun_wali(). Jangan diseragamkan.
-- ============================================================

alter policy "santri_kelas_select_staff" on public.santri_kelas
  using (
    (select public.can_santri()) or (select public.can_input_poin())
    or (select public.can_laporan()) or (select public.can_kesehatan())
    or (select public.can_akun()) or (select public.can_dashboard())
    or (select public.can_absensi_santri()) or (select public.can_rekap_absensi_santri())
    or (select public.can_catatan_harian())
  );

alter policy "santri_select_staff" on public.santri
  using (
    (select public.can_santri()) or (select public.can_input_poin())
    or (select public.can_laporan()) or (select public.can_kesehatan())
    or (select public.can_akun_wali()) or (select public.can_dashboard())
    or (select public.can_absensi_santri()) or (select public.can_rekap_absensi_santri())
    or (select public.can_catatan_harian())
  );
