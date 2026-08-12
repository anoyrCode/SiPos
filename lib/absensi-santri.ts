// Logika penentuan checkpoint & tanggal untuk Absensi Santri — dipakai baik
// oleh halaman input (musyrif) maupun server action penyimpanannya, supaya
// keduanya SELALU sepakat soal "tanggal apa yang berlaku sekarang" tanpa
// duplikasi rumus yang bisa diam-diam berbeda.

export type ShiftCheckpoint = { jam: string };

export function minutesOfDay(hhmmss: string): number {
  const [h, m] = hhmmss.split(":").map(Number);
  return h * 60 + m;
}

// Checkpoint yang PALING BARU TERLEWATI, bukan sekadar yang jaraknya
// paling dekat — musyrif ngisi absen SESUDAH checkpoint terjadi, bukan
// sebelumnya. Mis. jam 10:17 dgn checkpoint 09:00 & 11:20: nearest-by-
// distance akan pilih 11:20 (63 menit vs 77 menit) padahal 11:20 belum
// terjadi — yang benar tetap 09:00 (checkpoint yg baru saja lewat).
// `elapsed` dihitung melingkar (mod 1440) supaya shift 3 yg lewat tengah
// malam (21:00 → 04:50) tetap benar.
export function mostRecentCheckpointId<T extends ShiftCheckpoint & { id: string }>(
  checkpoints: T[],
  nowHHMM: string,
): string {
  const now = minutesOfDay(nowHHMM);
  let bestId = checkpoints[0].id;
  let bestElapsed = Infinity;
  for (const c of checkpoints) {
    const cm = minutesOfDay(c.jam);
    const elapsed = (((now - cm) % 1440) + 1440) % 1440;
    if (elapsed < bestElapsed) {
      bestElapsed = elapsed;
      bestId = c.id;
    }
  }
  return bestId;
}

// Tanggal MULAI malam jaga, bukan tanggal kalender saat menekan tombol.
// Shift 3 melewati tengah malam (21:00 → 04:50): tanpa penyesuaian ini,
// absen jam 01:00 tersimpan sebagai tanggal besoknya — satu malam terbelah
// jadi dua tanggal, carry-forward pengecualian putus tepat di tengah malam,
// dan rekap harian mencampur ekor malam kemarin dengan kepala malam ini.
//
// Patokannya JAM SEKARANG, bukan checkpoint yang sedang dipilih: musyrif
// bisa membuka kembali checkpoint 23:30 pada jam 01:15 untuk mengoreksi, dan
// itu tetap milik malam yang sama. Shift yang tidak melewati tengah malam
// (shift 1 & 2) tidak terpengaruh sama sekali.
//
// `checkpoints` HARUS sudah terurut `urutan` (bukan `jam` mentah) sebelum
// dipanggil — elemen pertama dianggap awal shift. Kolom `urutan` memang ada
// justru karena mengurutkan dari kolom `jam` mentah salah untuk shift
// lintas tengah malam.
export function tanggalShift(
  checkpoints: ShiftCheckpoint[],
  nowHHMM: string,
  todayISO: string,
): string {
  const mulai = minutesOfDay(checkpoints[0].jam);
  const lintasTengahMalam = checkpoints.some((c) => minutesOfDay(c.jam) < mulai);
  if (!lintasTengahMalam || minutesOfDay(nowHHMM) >= mulai) return todayISO;

  const d = new Date(`${todayISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
