-- ============================================================
-- SIPOS — Tindak Lanjut Surat Panggilan.
--
-- Tabel status "sudah ditindak" per santri PER LEVEL SP (1/2/3) per
-- tahun ajaran — TIDAK menyentuh transaksi_poin sama sekali. Kalau
-- total negatif santri terus naik ke level SP berikutnya, kombinasi
-- (santri_id, tahun_ajaran_id, level_baru) belum punya tanda, jadi dia
-- otomatis muncul lagi di daftar (dianggap eskalasi/kejadian baru).
-- Reset otomatis tiap tahun ajaran krn tahun_ajaran_id ikut jadi kunci.
-- ============================================================

create table public.surat_panggilan_tindak_lanjut (
  id               uuid primary key default gen_random_uuid(),
  santri_id        uuid not null references public.santri (id) on delete cascade,
  tahun_ajaran_id  uuid not null references public.tahun_ajaran (id) on delete cascade,
  level            smallint not null check (level in (1, 2, 3)),
  ditandai_oleh    uuid references public.pegawai (id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (santri_id, tahun_ajaran_id, level)
);

-- Izin granular baru — independen dari perm_laporan, supaya role
-- SDM/Kesantrian bisa dikasih HANYA izin ini tanpa akses laporan penuh.
alter table public.app_role
  add column perm_tindak_lanjut_sp boolean not null default false;

create or replace function public.can_tindak_lanjut_sp()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or coalesce((
    select r.perm_master or r.perm_tindak_lanjut_sp
    from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id
    where pr.id = auth.uid()
  ), false);
$$;

alter table public.surat_panggilan_tindak_lanjut enable row level security;

-- SELECT: siapa pun yang bisa buka halaman (laporan ATAU izin baru ini)
-- perlu tahu status tanda, walau tidak semua boleh mengubahnya.
create policy "sp_tindak_lanjut_select" on public.surat_panggilan_tindak_lanjut
  for select using (public.can_laporan() or public.can_tindak_lanjut_sp());

-- INSERT/DELETE (tandai/batalkan): cuma pemegang izin khusus (atau master).
create policy "sp_tindak_lanjut_insert" on public.surat_panggilan_tindak_lanjut
  for insert with check (public.can_tindak_lanjut_sp());

create policy "sp_tindak_lanjut_delete" on public.surat_panggilan_tindak_lanjut
  for delete using (public.can_tindak_lanjut_sp());

grant select, insert, delete on public.surat_panggilan_tindak_lanjut to authenticated;

-- "Ditandai oleh {nama pegawai}" ditampilkan via join langsung ke
-- `pegawai` (pola sama seperti transaksi_poin.pegawai_id di Riwayat
-- Poin) — BUKAN via `profiles` (RLS profiles membatasi ke baris sendiri
-- + admin, jadi join ke situ akan diam-diam balikin null utk non-admin).
-- Perluas SELECT pegawai supaya role yang HANYA punya izin baru ini
-- (tanpa perm_laporan/perm_master) tetap bisa baca nama pemegang tanda.
-- Baseline di-copy dari versi TERBARU (0021_perm_rekap_absensi.sql) —
-- kalau ada migration lain yang mengubah policy ini setelah 0033,
-- sesuaikan baseline sebelum menjalankan alter ini.
alter policy "pegawai_select_staff" on public.pegawai
  using (
    public.can_pegawai() or public.can_laporan() or public.can_kesehatan()
    or public.can_dashboard() or public.can_rekap_absensi()
    or public.can_tindak_lanjut_sp()
    or id = (select pegawai_id from public.profiles where id = auth.uid())
  );
