-- ============================================================
-- SIPOS — Catatan Pengawasan untuk BAP (Berita Acara Pengawasan)
--
-- BAP sendiri TIDAK disimpan — angkanya (Seharusnya / Jumlah santri /
-- Tidak Hadir / Yakni) dihitung saat dibuka dari santri_kelas dan
-- absensi_santri yang sudah ada. Satu-satunya data baru adalah catatan
-- bebas yang ditulis musyrif sepanjang shift.
--
-- Catatan terikat ke (kelas, tanggal, shift) dan BUKAN ke checkpoint:
-- jam kejadian bebas (mis. 05:20, 08:28) dan tidak jatuh tepat di jam
-- pengecekan. Mengikatkannya ke checkpoint akan memaksa musyrif
-- membulatkan jam kejadian, yang merusak akurasi laporan.
-- ============================================================

create table public.absensi_santri_catatan (
  id           uuid primary key default gen_random_uuid(),
  kelas_id     uuid not null references public.kelas (id) on delete cascade,
  -- Untuk shift 3 ini tanggal MULAI malam jaga (lihat tanggalShift() di
  -- lib/absensi-santri.ts), bukan tanggal kalender saat menulis — supaya
  -- catatan jam 01:00 jatuh di malam yang sama dengan baris absensinya.
  tanggal      date not null,
  shift        smallint not null check (shift in (1, 2, 3)),
  jam          time not null,
  isi          text not null check (length(trim(isi)) > 0),
  dicatat_oleh uuid references public.pegawai (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Tanpa unique constraint: satu shift wajar punya banyak catatan,
-- termasuk beberapa pada jam yang sama.
create index idx_absensi_santri_catatan_kelas_tanggal_shift
  on public.absensi_santri_catatan (kelas_id, tanggal, shift);

-- can_absensi_santri(kelas, checkpoint) yang sudah ada mencocokkan shift
-- LEWAT checkpoint. Catatan tidak punya checkpoint, jadi butuh varian yang
-- mencocokkan shift langsung. Namanya sengaja dibedakan (bukan overload
-- ketiga) — migrasi 0046 sudah menambah overload 0-argumen, dan menambah
-- satu lagi membuat resolusi fungsi sulit dibaca.
create or replace function public.can_absensi_santri_shift(p_kelas_id uuid, p_shift smallint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or public.can_master() or (
    coalesce((
      select r.perm_master or r.perm_absensi_santri
      from public.profiles pr
      join public.app_role r on r.id = pr.app_role_id
      where pr.id = auth.uid()
    ), false)
    and exists (
      select 1 from public.guru_kelas gk
      where gk.pegawai_id = public.current_pegawai_id() and gk.kelas_id = p_kelas_id
    )
    and exists (
      select 1 from public.pegawai p
      where p.id = public.current_pegawai_id() and p.shift = p_shift
    )
  );
$$;

alter table public.absensi_santri_catatan enable row level security;

create policy "absensi_santri_catatan_select" on public.absensi_santri_catatan
  for select to authenticated
  using (
    public.can_absensi_santri_shift(kelas_id, shift)
    or public.can_rekap_absensi_santri()
  );

create policy "absensi_santri_catatan_insert" on public.absensi_santri_catatan
  for insert to authenticated
  with check (public.can_absensi_santri_shift(kelas_id, shift));

create policy "absensi_santri_catatan_update" on public.absensi_santri_catatan
  for update to authenticated
  using (public.can_absensi_santri_shift(kelas_id, shift))
  with check (public.can_absensi_santri_shift(kelas_id, shift));

create policy "absensi_santri_catatan_delete" on public.absensi_santri_catatan
  for delete to authenticated
  using (public.can_absensi_santri_shift(kelas_id, shift));

grant select, insert, update, delete on public.absensi_santri_catatan to authenticated;
