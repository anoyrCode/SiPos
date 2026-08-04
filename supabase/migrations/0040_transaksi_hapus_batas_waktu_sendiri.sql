-- ============================================================
-- SIPOS — Cabut batas waktu edit/hapus poin sendiri (revisi 0039).
--
-- 0039 membatasi musyrif cuma bisa edit/hapus transaksi miliknya sendiri
-- di HARI YANG SAMA transaksi itu dibuat. Atas keputusan sadar user
-- (dikonfirmasi eksplisit, termasuk risikonya: tanpa audit log, ini
-- berarti poin lama bisa diubah/dihapus kapan saja tanpa jejak sama
-- sekali) — batas waktu itu dicabut. Kepemilikan
-- (pegawai_id = current_pegawai_id()) tetap satu-satunya syarat.
--
-- Nama policy dibiarkan sama (bukan "own_today" lagi secara harfiah)
-- supaya tidak perlu drop+create ulang — cukup ganti kondisinya.
-- ============================================================

alter policy "transaksi_update_own_today" on public.transaksi_poin
  using (pegawai_id = public.current_pegawai_id())
  with check (pegawai_id = public.current_pegawai_id());

alter policy "transaksi_delete_own_today" on public.transaksi_poin
  using (pegawai_id = public.current_pegawai_id());
