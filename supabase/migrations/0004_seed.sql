-- ============================================================
-- SIPOS — Fase 2: Seed data awal (idempoten, aman dijalankan ulang).
-- ============================================================

-- Level pendidikan
insert into public.level_pendidikan (nama, urutan)
select v.nama, v.urutan
from (values ('SD', 1), ('MTS', 2), ('SMA', 3)) as v(nama, urutan)
where not exists (
  select 1 from public.level_pendidikan l where l.nama = v.nama
);

-- Tahun ajaran aktif (trigger akan menon-aktifkan yang lain bila ada).
insert into public.tahun_ajaran (tahun, tanggal_mulai, tanggal_selesai, is_aktif)
values ('2026/2027', '2026-07-01', '2027-06-30', true)
on conflict (tahun) do nothing;

-- Contoh master poin (positif & negatif).
insert into public.master_poin
  (kode_poin, tipe, nama_poin, deskripsi_poin, nilai_poin, level)
values
  ('P-001', 'POSITIF', 'Membantu teman',        'Membantu teman/guru tanpa diminta',          5,  'PERUNGGU'),
  ('P-002', 'POSITIF', 'Juara lomba kecamatan',  'Meraih juara lomba tingkat kecamatan',       25, 'PERAK'),
  ('P-003', 'POSITIF', 'Hafalan satu juz',       'Menyelesaikan hafalan satu juz',             50, 'EMAS'),
  ('N-001', 'NEGATIF', 'Terlambat',              'Terlambat masuk kelas/kegiatan',             5,  'RINGAN'),
  ('N-002', 'NEGATIF', 'Tidak shalat berjamaah', 'Tidak mengikuti shalat berjamaah tanpa uzur',15, 'SEDANG'),
  ('N-003', 'NEGATIF', 'Keluar tanpa izin',      'Keluar lingkungan pesantren tanpa izin',     50, 'BERAT')
on conflict (kode_poin) do nothing;
