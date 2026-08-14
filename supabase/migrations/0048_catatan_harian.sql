-- ============================================================
-- SIPOS — Catatan Harian Santri (kabar untuk wali)
--
-- Portal wali sudah menampilkan Riwayat Poin, Kehadiran, dan Rekam Medis.
-- Ketiganya kejadian administratif — pelanggaran, ketidakhadiran, sakit.
-- Tabel ini memberi musyrif jalan mengabarkan keadaan anak sehari-hari,
-- termasuk kabar baik, sehingga wali tidak hanya mendengar saat ada masalah.
--
-- Berbeda dari absensi santri, catatan ini TIDAK terikat shift/checkpoint,
-- jadi tidak ada persoalan malam jaga yang melewati tengah malam —
-- `tanggal` cukup tanggal kalender WIB biasa.
-- ============================================================

alter table public.app_role
  add column perm_catatan_harian boolean not null default false;

create table public.catatan_harian (
  id           uuid primary key default gen_random_uuid(),
  santri_id    uuid not null references public.santri (id) on delete cascade,
  -- Snapshot kelas saat ditulis (pola sama seperti absensi_santri &
  -- transaksi_poin) — dipakai RLS untuk cek penugasan satu langkah, dan
  -- tetap akurat historis kalau santri pindah kelas.
  kelas_id     uuid not null references public.kelas (id) on delete cascade,
  tanggal      date not null,
  jenis        text not null check (jenis in ('baik', 'perhatian', 'info')),
  isi          text not null check (length(trim(isi)) > 0),
  dicatat_oleh uuid references public.pegawai (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Tanpa unique: satu santri wajar mendapat lebih dari satu catatan sehari.
create index idx_catatan_harian_santri_tanggal
  on public.catatan_harian (santri_id, tanggal desc);
create index idx_catatan_harian_kelas_tanggal
  on public.catatan_harian (kelas_id, tanggal desc);

-- Punya izin menulis catatan harian sama sekali?
create or replace function public.can_catatan_harian()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or coalesce((
    select r.perm_master or r.perm_catatan_harian
    from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id
    where pr.id = auth.uid()
  ), false);
$$;

-- Boleh menulis catatan untuk santri di KELAS INI?
create or replace function public.can_catatan_harian_kelas(p_kelas_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or public.can_master() or (
    coalesce((
      select r.perm_master or r.perm_catatan_harian
      from public.profiles pr
      join public.app_role r on r.id = pr.app_role_id
      where pr.id = auth.uid()
    ), false)
    and exists (
      select 1 from public.guru_kelas gk
      where gk.pegawai_id = public.current_pegawai_id() and gk.kelas_id = p_kelas_id
    )
  );
$$;

alter table public.catatan_harian enable row level security;

-- Baca: penulis yang mengampu kelasnya, admin, atau wali santri ybs.
-- `(select public.current_wali_id())` dibungkus select — pola InitPlan dari
-- migrasi 0035, supaya dievaluasi sekali per query, bukan sekali per baris.
create policy "catatan_harian_select" on public.catatan_harian
  for select to authenticated
  using (
    public.can_catatan_harian_kelas(kelas_id)
    or exists (
      select 1 from public.wali_santri ws
      where ws.santri_id = catatan_harian.santri_id
        and ws.wali_id = (select public.current_wali_id())
    )
  );

create policy "catatan_harian_insert" on public.catatan_harian
  for insert to authenticated
  with check (public.can_catatan_harian_kelas(kelas_id));

-- Ubah & hapus: HANYA catatan sendiri, DAN masih berhak atas kelas itu.
-- Kepemilikan saja tidak cukup: kalau syaratnya cuma dicatat_oleh = saya,
-- orang yang izinnya sudah dicabut atau sudah tidak ditugaskan ke kelas itu
-- tetap bisa mengubah catatan lamanya. Konsekuensi yang diterima: musyrif
-- yang pindah kelas kehilangan hak memperbaiki catatan lama, koreksi lewat
-- admin. Mencabut izin harus benar-benar mencabut.
create policy "catatan_harian_update_own" on public.catatan_harian
  for update to authenticated
  using (
    public.can_master()
    or (
      public.can_catatan_harian_kelas(kelas_id)
      and dicatat_oleh = (select public.current_pegawai_id())
    )
  )
  with check (
    public.can_master()
    or (
      public.can_catatan_harian_kelas(kelas_id)
      and dicatat_oleh = (select public.current_pegawai_id())
    )
  );

create policy "catatan_harian_delete_own" on public.catatan_harian
  for delete to authenticated
  using (
    public.can_master()
    or (
      public.can_catatan_harian_kelas(kelas_id)
      and dicatat_oleh = (select public.current_pegawai_id())
    )
  );

grant select, insert, update, delete on public.catatan_harian to authenticated;
