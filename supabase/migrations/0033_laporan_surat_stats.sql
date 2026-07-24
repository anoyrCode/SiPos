-- ============================================================
-- SIPOS — RPC agregasi untuk Laporan & Surat Panggilan.
--
-- Pola & alasan sama seperti 0032_dashboard_stats: halaman ini
-- sebelumnya menarik SEMUA transaksi_poin 1 tahun ajaran ke JS lalu
-- menjumlahkan di sana → lambat / statement timeout begitu data besar.
-- Pindahkan penjumlahan ke Postgres (GROUP BY pakai index), balikin
-- cuma hasil ringkas per santri.
--
-- BEDA dari dashboard_stats: fungsi ini SECURITY INVOKER (bukan
-- DEFINER) — sengaja tetap tunduk ke RLS transaksi_poin, supaya
-- pembatasan scope (mis. musyrif hanya kelasnya, lewat filter
-- p_santri_ids yang dikirim aplikasi) & hak akses tetap terjaga.
-- Fungsi helper RLS-nya STABLE, jadi predikatnya dievaluasi sekali
-- per query (bukan per baris) — agregasi tetap cepat.
-- ============================================================

-- Laporan: total poin positif & negatif per santri untuk 1 tahun ajaran.
-- p_santri_ids opsional: kalau diisi, batasi ke santri tsb (dipakai utk
-- peran ter-scope). Kalau null, semua santri di tahun ajaran itu.
create or replace function public.laporan_sum_per_santri(
  p_ta uuid,
  p_santri_ids uuid[] default null
)
returns table (santri_id uuid, pos int, neg int)
language sql
stable
security invoker
set search_path = ''
as $$
  select santri_id,
    coalesce(sum(nilai_poin) filter (where tipe = 'POSITIF'), 0)::int as pos,
    coalesce(sum(nilai_poin) filter (where tipe = 'NEGATIF'), 0)::int as neg
  from public.transaksi_poin
  where tahun_ajaran_id = p_ta
    and (p_santri_ids is null or santri_id = any(p_santri_ids))
  group by santri_id;
$$;

-- Surat Panggilan: total poin negatif per santri untuk 1 tahun ajaran.
-- Aplikasi lalu memfilter yang >= ambang SP (>=300) dan hanya mengambil
-- rincian pelanggaran untuk santri tsb (jauh lebih sedikit).
create or replace function public.surat_panggilan_totals(
  p_ta uuid
)
returns table (santri_id uuid, total int)
language sql
stable
security invoker
set search_path = ''
as $$
  select santri_id, coalesce(sum(nilai_poin), 0)::int as total
  from public.transaksi_poin
  where tahun_ajaran_id = p_ta
    and tipe = 'NEGATIF'
  group by santri_id;
$$;

grant execute on function public.laporan_sum_per_santri(uuid, uuid[]) to authenticated;
grant execute on function public.surat_panggilan_totals(uuid) to authenticated;
