-- ============================================================
-- SIPOS — Jadwal sementara pegawai (rentang tanggal), utk
-- penggantian sementara (mis. gantiin pegawai lain yang
-- berhalangan hadir). Berlaku universal — menang atas Jadwal
-- Tetap/Fleksibel/Beda-per-Hari/Shift-Ganda (lihat
-- resolveJadwalHari di lib/absensi-status.ts). Daftar/riwayat
-- (bisa banyak entri, tambah/hapus saja, tidak ada edit) — mirip
-- pola libur_khusus. Jadwal asli pegawai TIDAK disentuh sama
-- sekali; begitu tanggal_selesai lewat, otomatis balik pakai
-- jadwal asli tanpa perlu revert manual.
-- ============================================================

create table public.pegawai_jadwal_sementara (
  id              uuid primary key default gen_random_uuid(),
  pegawai_id      uuid not null references public.pegawai (id) on delete cascade,
  tanggal_mulai   date not null,
  tanggal_selesai date not null,
  jam_masuk       time not null,
  jam_pulang      time not null,
  keterangan      text,
  created_at      timestamptz not null default now()
);

create index idx_pegawai_jadwal_sementara_pegawai on public.pegawai_jadwal_sementara (pegawai_id);

alter table public.pegawai_jadwal_sementara enable row level security;

create policy "pegawai_jadwal_sementara_admin_all" on public.pegawai_jadwal_sementara
  for all to authenticated using (public.can_pegawai()) with check (public.can_pegawai());

create policy "pegawai_jadwal_sementara_select_staff" on public.pegawai_jadwal_sementara
  for select to authenticated using (
    public.can_pegawai() or public.can_laporan() or public.can_kesehatan()
    or pegawai_id = (select pegawai_id from public.profiles where id = auth.uid())
  );

grant select, insert, update, delete on public.pegawai_jadwal_sementara to authenticated;
