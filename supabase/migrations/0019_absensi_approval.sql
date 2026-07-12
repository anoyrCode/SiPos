-- Approval izin/sakit/cuti + bukti surat dokter.
create table public.absensi_pengajuan (
  id                uuid primary key default gen_random_uuid(),
  pegawai_id        uuid not null references public.pegawai (id) on delete cascade,
  kategori          text not null check (kategori in ('izin', 'sakit', 'cuti')),
  tanggal_mulai     date not null,
  tanggal_selesai   date not null,
  keterangan        text,
  bukti_url         text,
  status            text not null default 'menunggu'
                       check (status in ('menunggu', 'disetujui', 'ditolak')),
  alasan_penolakan  text,
  diproses_oleh     uuid references public.profiles (id) on delete set null,
  diproses_at       timestamptz,
  created_at        timestamptz not null default now()
);

alter table public.absensi
  add column pengajuan_id uuid references public.absensi_pengajuan (id) on delete cascade;

alter table public.app_role
  add column perm_approve_absensi boolean not null default false;

create or replace function public.can_approve_absensi()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or coalesce((
    select r.perm_master or r.perm_approve_absensi
    from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id
    where pr.id = auth.uid()
  ), false);
$$;

alter table public.absensi_pengajuan enable row level security;

create policy "absensi_pengajuan_select_own" on public.absensi_pengajuan
  for select using (
    pegawai_id = (select pegawai_id from public.profiles where id = auth.uid())
  );
create policy "absensi_pengajuan_select_approver" on public.absensi_pengajuan
  for select using (public.can_approve_absensi());
create policy "absensi_pengajuan_insert_own" on public.absensi_pengajuan
  for insert with check (
    pegawai_id = (select pegawai_id from public.profiles where id = auth.uid())
  );
create policy "absensi_pengajuan_update_approver" on public.absensi_pengajuan
  for update using (public.can_approve_absensi());

grant select, insert, update on public.absensi_pengajuan to authenticated;

-- absensi belum punya policy DELETE sama sekali (0011) — approver butuh ini
-- utk menghapus baris terkait saat menolak pengajuan.
create policy "absensi_delete_approver" on public.absensi
  for delete to authenticated
  using (public.can_approve_absensi());
grant delete on public.absensi to authenticated;

-- Storage bucket privat utk bukti surat dokter/izin/cuti.
insert into storage.buckets (id, name, public)
values ('bukti-absensi', 'bukti-absensi', false)
on conflict (id) do nothing;

create policy "bukti_absensi_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'bukti-absensi'
    and (storage.foldername(name))[1] = (
      select pegawai_id::text from public.profiles where id = auth.uid()
    )
  );
create policy "bukti_absensi_select_own_or_approver" on storage.objects
  for select using (
    bucket_id = 'bukti-absensi'
    and (
      (storage.foldername(name))[1] = (
        select pegawai_id::text from public.profiles where id = auth.uid()
      )
      or public.can_approve_absensi()
    )
  );
