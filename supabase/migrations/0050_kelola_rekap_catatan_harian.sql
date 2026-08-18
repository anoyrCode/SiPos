-- ============================================================
-- SIPOS — Kelola Rekap Catatan Harian
--
-- Sebelumnya halaman rekap catatan harian digerbangi perm_master dan
-- baca-saja. Akibatnya catatan yang tidak pantas hanya bisa dikoreksi lewat
-- SQL Editor, dan pemantauan tidak bisa didelegasikan tanpa memberi akses
-- Master Data penuh.
--
-- PERINGATAN: kolom `disunting_oleh` membuat catatan_harian punya DUA foreign
-- key ke pegawai. Embed polos `pegawai:pegawai(nama)` menjadi ambigu dan
-- ditolak PostgREST — kode yang memakainya HARUS sudah menyebut kolomnya
-- eksplisit sebelum migrasi ini dijalankan di produksi.
-- ============================================================

alter table public.app_role
  add column perm_rekap_catatan_harian boolean not null default false;

-- Jejak penyuntingan oleh orang lain. Keduanya nullable — catatan yang belum
-- pernah disentuh orang lain bernilai null, dan itu keadaan mayoritas.
alter table public.catatan_harian
  add column disunting_oleh uuid references public.pegawai (id) on delete set null,
  add column disunting_at   timestamptz;

create or replace function public.can_rekap_catatan_harian()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or coalesce((
    select r.perm_master or r.perm_rekap_catatan_harian
    from public.profiles pr
    join public.app_role r on r.id = pr.app_role_id
    where pr.id = auth.uid()
  ), false);
$$;

-- ------------------------------------------------------------
-- Perluasan RLS.
--
-- Tanpa ini peran baru yang bukan Master Data tidak mendapat satu baris pun,
-- dan halamannya tampil kosong TANPA pesan error — pola gagal-diam yang sudah
-- dua kali terjadi di project ini.
--
-- `alter policy ... using` MENGGANTI predikat secara total. Basis di bawah
-- disalin utuh dari migrasi 0048, lalu ditambah satu syarat.
-- ------------------------------------------------------------
alter policy "catatan_harian_select" on public.catatan_harian
  using (
    public.can_catatan_harian_kelas(kelas_id)
    or public.can_rekap_catatan_harian()
    or exists (
      select 1 from public.wali_santri ws
      where ws.santri_id = catatan_harian.santri_id
        and ws.wali_id = (select public.current_wali_id())
    )
  );

alter policy "catatan_harian_update_own" on public.catatan_harian
  using (
    public.can_master()
    or public.can_rekap_catatan_harian()
    or (
      public.can_catatan_harian_kelas(kelas_id)
      and dicatat_oleh = (select public.current_pegawai_id())
    )
  )
  with check (
    public.can_master()
    or public.can_rekap_catatan_harian()
    or (
      public.can_catatan_harian_kelas(kelas_id)
      and dicatat_oleh = (select public.current_pegawai_id())
    )
  );

alter policy "catatan_harian_delete_own" on public.catatan_harian
  using (
    public.can_master()
    or public.can_rekap_catatan_harian()
    or (
      public.can_catatan_harian_kelas(kelas_id)
      and dicatat_oleh = (select public.current_pegawai_id())
    )
  );

-- `catatan_harian_insert` sengaja TIDAK diubah: izin ini untuk memantau dan
-- mengoreksi, bukan menulis catatan baru atas nama santri yang bukan
-- tanggung jawabnya.
