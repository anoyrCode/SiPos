-- ============================================================
-- SIPOS — Musyrif boleh edit/hapus transaksi poin miliknya sendiri,
-- dibatasi ke hari yang sama transaksi itu diinput (WIB).
--
-- PRD lama: "hanya admin boleh override". Diperluas secara sadar — musyrif
-- sekarang juga boleh, TAPI hanya untuk transaksi miliknya sendiri, dan
-- hanya sampai akhir hari yang sama transaksi itu dibuat (created_at,
-- BUKAN tanggal_kejadian yang bisa backdate).
--
-- Policy admin (transaksi_admin_all) TIDAK diubah — admin tetap bebas
-- kapan saja. Asia/Jakarta tidak punya DST, jadi perbandingan tanggal
-- lewat `at time zone` aman dipakai langsung di SQL.
-- ============================================================

create policy "transaksi_update_own_today" on public.transaksi_poin
  for update to authenticated
  using (
    pegawai_id = public.current_pegawai_id()
    and (created_at at time zone 'Asia/Jakarta')::date
      = (now() at time zone 'Asia/Jakarta')::date
  )
  with check (
    pegawai_id = public.current_pegawai_id()
    and (created_at at time zone 'Asia/Jakarta')::date
      = (now() at time zone 'Asia/Jakarta')::date
  );

create policy "transaksi_delete_own_today" on public.transaksi_poin
  for delete to authenticated
  using (
    pegawai_id = public.current_pegawai_id()
    and (created_at at time zone 'Asia/Jakarta')::date
      = (now() at time zone 'Asia/Jakarta')::date
  );
