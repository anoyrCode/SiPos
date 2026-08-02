-- ============================================================
-- SIPOS — Surat Peringatan berbasis level pelanggaran.
--
-- Sebelumnya ambang SP dihitung dari TOTAL seluruh poin negatif, jadi
-- pelanggaran sepele yang berulang (mis. terlambat 150 poin x2) bisa
-- memicu SP1. Kini hanya level yang dicentang admin (default: BERAT)
-- yang ikut dihitung, dan angka ambangnya bisa diubah admin.
--
-- Level TIDAK di-snapshot ke transaksi_poin — disengaja, supaya salah
-- set level di master bisa dikoreksi dan SP ikut terhitung ulang.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Flag: level mana yang ikut menghitung ambang SP.
--    Default false — level baru yang dibuat admin tidak diam-diam
--    ikut menghitung sampai dicentang eksplisit.
-- ------------------------------------------------------------
alter table public.master_level_poin
  add column if not exists hitung_sp boolean not null default false;

update public.master_level_poin
  set hitung_sp = true
  where tipe = 'NEGATIF' and nama = 'BERAT';

-- ------------------------------------------------------------
-- 2. Pengaturan ambang SP (singleton, pola sama absensi_pengaturan).
-- ------------------------------------------------------------
create table if not exists public.surat_panggilan_pengaturan (
  id         uuid primary key default gen_random_uuid(),
  ambang_sp1 int not null default 300,
  ambang_sp2 int not null default 600,
  ambang_sp3 int not null default 900,
  updated_at timestamptz not null default now()
);

insert into public.surat_panggilan_pengaturan (ambang_sp1, ambang_sp2, ambang_sp3)
select 300, 600, 900
where not exists (select 1 from public.surat_panggilan_pengaturan);

alter table public.surat_panggilan_pengaturan enable row level security;

-- Semua staff boleh baca (halaman SP & Dashboard perlu angkanya utk render),
-- hanya perm_master yang boleh ubah. Tidak ada policy insert/delete —
-- barisnya tetap satu selamanya.
create policy "sp_pengaturan_select_auth" on public.surat_panggilan_pengaturan
  for select to authenticated using (true);
create policy "sp_pengaturan_update_master" on public.surat_panggilan_pengaturan
  for update to authenticated
  using (public.can_master()) with check (public.can_master());

grant select, update on public.surat_panggilan_pengaturan to authenticated;

-- ------------------------------------------------------------
-- 3. RPC Surat Panggilan — total poin negatif per santri, DIBATASI
--    ke level ber-hitung_sp. Inner join membuat poin yang levelnya
--    kosong / tidak terdaftar otomatis gugur (keputusan desain).
--
--    Tetap security invoker: RLS transaksi_poin (pembatasan scope
--    kelas untuk musyrif) harus tetap berlaku.
-- ------------------------------------------------------------
create or replace function public.surat_panggilan_totals(
  p_ta uuid
)
returns table (santri_id uuid, total int)
language sql
stable
security invoker
set search_path = ''
as $$
  select tp.santri_id, coalesce(sum(tp.nilai_poin), 0)::int as total
  from public.transaksi_poin tp
  join public.master_poin mp on mp.id = tp.master_poin_id
  join public.master_level_poin mlp
    on mlp.tipe = 'NEGATIF' and mlp.nama = mp.level and mlp.hitung_sp
  where tp.tahun_ajaran_id = p_ta
    and tp.tipe = 'NEGATIF'
  group by tp.santri_id;
$$;

-- ------------------------------------------------------------
-- 4. RPC Dashboard — tambah field neg_sp di per_santri.
--
--    pos/neg SENGAJA tidak diubah: dashboard memakainya untuk peringkat
--    "Perlu Perhatian" dan skor bersih, yang tetap berbasis seluruh poin
--    negatif. Hanya widget "Perlu Tindakan" yang pindah ke neg_sp.
--
--    LEFT JOIN (bukan inner) supaya baris tanpa level tetap ikut
--    terhitung di pos/neg. master_poin unik per id dan master_level_poin
--    unik per (tipe, nama), jadi join tidak menggandakan baris.
-- ------------------------------------------------------------
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
        'santri_id', santri_id, 'pos', pos, 'neg', neg, 'neg_sp', neg_sp
      ))
      from (
        select tp.santri_id,
          coalesce(sum(tp.nilai_poin) filter (where tp.tipe = 'POSITIF'), 0) as pos,
          coalesce(sum(tp.nilai_poin) filter (where tp.tipe = 'NEGATIF'), 0) as neg,
          coalesce(sum(tp.nilai_poin) filter (
            where tp.tipe = 'NEGATIF' and mlp.hitung_sp
          ), 0) as neg_sp
        from public.transaksi_poin tp
        left join public.master_poin mp on mp.id = tp.master_poin_id
        left join public.master_level_poin mlp
          on mlp.tipe = 'NEGATIF' and mlp.nama = mp.level
        where (p_ta is null or tp.tahun_ajaran_id = p_ta)
        group by tp.santri_id
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

grant execute on function public.surat_panggilan_totals(uuid) to authenticated;
grant execute on function public.dashboard_stats(uuid, uuid) to authenticated;
