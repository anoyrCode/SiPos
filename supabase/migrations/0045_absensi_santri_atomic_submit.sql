-- ============================================================
-- SIPOS — Simpan absensi santri secara atomik (1 transaksi)
--
-- submitAbsensiSantri() sebelumnya menjalankan 3 pernyataan terpisah lewat
-- Supabase JS client (upsert submission → delete pengecualian lama → insert
-- pengecualian baru). Kalau pernyataan terakhir gagal (RLS/jaringan/
-- timeout/tabrakan unique), checkpoint sudah terlanjur tertandai "sudah
-- diisi" padahal catatan lamanya sudah terhapus — rekap melaporkan semua
-- hadir walau sebenarnya ada yg izin/sakit.
--
-- Fungsi ini membungkus ketiganya jadi satu pemanggilan (1 transaksi
-- implisit) — kalau ada yang gagal di tengah, semuanya dibatalkan, tidak
-- ada keadaan setengah-tersimpan.
--
-- `security definer` (pola sama seperti fungsi RLS helper lain di project
-- ini) — karena itu, izin akses divalidasi ULANG manual di dalam via
-- can_absensi_santri(), bukan mengandalkan RLS tabel yg dilewati DEFINER.
-- `dicatat_oleh` diambil dari current_pegawai_id() (identitas pemanggil),
-- BUKAN parameter dari klien — supaya klien tidak bisa menyamarkan
-- penyimpanan seolah dicatat oleh musyrif lain.
-- ============================================================

create or replace function public.submit_absensi_santri(
  p_kelas_id uuid,
  p_checkpoint_id uuid,
  p_tanggal date,
  p_pengecualian jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_absensi_santri(p_kelas_id, p_checkpoint_id) then
    raise exception 'Tidak diizinkan.' using errcode = '42501';
  end if;

  insert into public.absensi_santri_submission
    (checkpoint_id, kelas_id, tanggal, dicatat_oleh, updated_at)
  values
    (p_checkpoint_id, p_kelas_id, p_tanggal, public.current_pegawai_id(), now())
  on conflict (checkpoint_id, kelas_id, tanggal)
  do update set dicatat_oleh = excluded.dicatat_oleh, updated_at = excluded.updated_at;

  delete from public.absensi_santri
  where checkpoint_id = p_checkpoint_id
    and kelas_id = p_kelas_id
    and tanggal = p_tanggal;

  -- `on conflict ... do update` (bukan insert polos): constraint unique-nya
  -- (santri_id, checkpoint_id, tanggal) TIDAK dibatasi per kelas — kalau
  -- seorang santri kebetulan tercatat di kelas lain utk checkpoint/tanggal
  -- yg sama (mis. sempat terdaftar di 2 kelas), baris lama itu dipindah
  -- kepemilikannya ke kelas ini, bukan gagal dgn error 23505 di tengah
  -- transaksi (yg akan membatalkan seluruh penyimpanan checkpoint ini).
  insert into public.absensi_santri
    (santri_id, checkpoint_id, kelas_id, tanggal, status, catatan)
  select
    (elem->>'santri_id')::uuid,
    p_checkpoint_id,
    p_kelas_id,
    p_tanggal,
    elem->>'status',
    elem->>'catatan'
  from jsonb_array_elements(p_pengecualian) as elem
  on conflict (santri_id, checkpoint_id, tanggal)
  do update set
    kelas_id = excluded.kelas_id,
    status = excluded.status,
    catatan = excluded.catatan;
end;
$$;

grant execute on function public.submit_absensi_santri(uuid, uuid, date, jsonb) to authenticated;
