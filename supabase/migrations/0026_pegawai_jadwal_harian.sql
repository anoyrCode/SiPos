-- ============================================================
-- SIPOS — Jadwal beda per hari utk pegawai (mis. Senin-Minggu
-- pagi-siang, Selasa siang-malam). Independen dari
-- jam_masuk_jadwal/jam_pulang_jadwal tunggal yang sudah ada —
-- dipakai hanya kalau jadwal_harian_berbeda=true (mutually
-- exclusive dgn jadwal_fleksibel, di-enforce di app layer).
-- hari_libur TETAP terpisah (tidak digabung ke tabel ini),
-- tetap selalu menang atas jadwal jam apa pun (tidak berubah).
-- ============================================================

alter table public.pegawai
  add column jadwal_harian_berbeda boolean not null default false;

create table public.pegawai_jadwal_harian (
  pegawai_id  uuid not null references public.pegawai (id) on delete cascade,
  hari        smallint not null check (hari between 0 and 6),
  jam_masuk   time,
  jam_pulang  time,
  primary key (pegawai_id, hari)
);

alter table public.pegawai_jadwal_harian enable row level security;

create policy "pegawai_jadwal_harian_admin_all" on public.pegawai_jadwal_harian
  for all to authenticated using (public.can_pegawai()) with check (public.can_pegawai());

create policy "pegawai_jadwal_harian_select_staff" on public.pegawai_jadwal_harian
  for select to authenticated using (
    public.can_pegawai() or public.can_laporan() or public.can_kesehatan()
    or pegawai_id = (select pegawai_id from public.profiles where id = auth.uid())
  );

grant select, insert, update, delete on public.pegawai_jadwal_harian to authenticated;
