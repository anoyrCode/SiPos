-- Hari libur khusus pondok (libur nasional/acara), berlaku utk SEMUA pegawai
-- (menang atas hari_libur mingguan per-pegawai), dikelola manual oleh admin.
create table public.libur_khusus (
  tanggal     date primary key,
  keterangan  text not null,
  created_at  timestamptz not null default now()
);

alter table public.libur_khusus enable row level security;

create policy "libur_khusus_select_auth" on public.libur_khusus
  for select to authenticated using (true);
create policy "libur_khusus_insert_master" on public.libur_khusus
  for insert to authenticated with check (public.can_master());
create policy "libur_khusus_update_master" on public.libur_khusus
  for update to authenticated using (public.can_master()) with check (public.can_master());
create policy "libur_khusus_delete_master" on public.libur_khusus
  for delete to authenticated using (public.can_master());

grant select, insert, update, delete on public.libur_khusus to authenticated;
