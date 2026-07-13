-- Tanggal mulai sistem absensi digunakan (opsional). Tanggal sebelum ini
-- selalu berstatus "Belum Mulai", menang atas Alpa/Libur/dll — supaya
-- tanggal sebelum go-live tidak salah tampil "Alpa" krn belum ada yg absen.
-- Null = perilaku lama (tidak ada pengecualian).
alter table public.absensi_pengaturan
  add column tanggal_mulai date;
