-- ============================================================
-- SIPOS — RPC agregasi Dashboard.
--
-- MASALAH: Dashboard sebelumnya menarik SEMUA baris transaksi_poin
-- (belasan ribu) untuk tahun aktif + tahun sebelumnya ke JavaScript,
-- lalu menjumlahkan di sana. Setelah data tumbuh, ini bikin dashboard
-- ~23 detik dan sebagian query kena statement timeout (Oops) di
-- Supabase free-tier.
--
-- SOLUSI: pindahkan seluruh penjumlahan ke Postgres (GROUP BY pakai
-- index), balikin cuma hasil ringkas (bukan 16rb baris mentah).
--
-- SECURITY DEFINER + gate can_dashboard() di awal: aman karena setara
-- dgn yang sudah diizinkan RLS untuk pemirsa Dashboard (data global
-- agregat), dan menghindari biaya evaluasi RLS per-baris saat agregasi.
--
-- Nilai yang dikembalikan dipetakan 1:1 dari logika JS lama:
--   per_santri : sum(pos)/sum(neg) per santri  (utk peringkat & per-kelas)
--   per_poin   : count kejadian per master_poin (utk statistik)
--   per_month  : sum(pos)/sum(neg) per bulan    (utk chart perkembangan)
--   per_level  : count negatif per level pelanggaran (utk donut)
--   prev       : total pos/neg/jumlah tahun sebelumnya (utk perbandingan)
-- ============================================================

create or replace function public.dashboard_stats(
  p_ta uuid,
  p_ta_prev uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.can_dashboard() then
    raise exception 'akses ditolak' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'per_santri', coalesce((
      select jsonb_agg(jsonb_build_object(
        'santri_id', santri_id, 'pos', pos, 'neg', neg
      ))
      from (
        select santri_id,
          coalesce(sum(nilai_poin) filter (where tipe = 'POSITIF'), 0) as pos,
          coalesce(sum(nilai_poin) filter (where tipe = 'NEGATIF'), 0) as neg
        from public.transaksi_poin
        where (p_ta is null or tahun_ajaran_id = p_ta)
        group by santri_id
      ) s
    ), '[]'::jsonb),

    'per_poin', coalesce((
      select jsonb_agg(jsonb_build_object(
        'master_poin_id', master_poin_id, 'count', c
      ))
      from (
        select master_poin_id, count(*) as c
        from public.transaksi_poin
        where (p_ta is null or tahun_ajaran_id = p_ta)
        group by master_poin_id
      ) p
    ), '[]'::jsonb),

    'per_month', coalesce((
      select jsonb_agg(jsonb_build_object(
        'month', m, 'pos', pos, 'neg', neg
      ))
      from (
        select to_char(tanggal_kejadian, 'YYYY-MM') as m,
          coalesce(sum(nilai_poin) filter (where tipe = 'POSITIF'), 0) as pos,
          coalesce(sum(nilai_poin) filter (where tipe = 'NEGATIF'), 0) as neg
        from public.transaksi_poin
        where (p_ta is null or tahun_ajaran_id = p_ta)
        group by to_char(tanggal_kejadian, 'YYYY-MM')
      ) mo
    ), '[]'::jsonb),

    'per_level', coalesce((
      select jsonb_agg(jsonb_build_object(
        'level', lvl, 'count', c
      ))
      from (
        select coalesce(nullif(mp.level, ''), 'Lainnya') as lvl, count(*) as c
        from public.transaksi_poin tp
        join public.master_poin mp on mp.id = tp.master_poin_id
        where (p_ta is null or tp.tahun_ajaran_id = p_ta)
          and tp.tipe = 'NEGATIF'
        group by coalesce(nullif(mp.level, ''), 'Lainnya')
      ) l
    ), '[]'::jsonb),

    'prev', case when p_ta_prev is null then null else (
      select jsonb_build_object(
        'pos', coalesce(sum(nilai_poin) filter (where tipe = 'POSITIF'), 0),
        'neg', coalesce(sum(nilai_poin) filter (where tipe = 'NEGATIF'), 0),
        'count', count(*)
      )
      from public.transaksi_poin
      where tahun_ajaran_id = p_ta_prev
    ) end
  ) into result;

  return result;
end;
$$;

grant execute on function public.dashboard_stats(uuid, uuid) to authenticated;
