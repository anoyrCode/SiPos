// Logika penentuan checkpoint & tanggal untuk Absensi Santri — dipakai baik
// oleh halaman input (musyrif) maupun server action penyimpanannya, supaya
// keduanya SELALU sepakat soal "tanggal apa yang berlaku sekarang" tanpa
// duplikasi rumus yang bisa diam-diam berbeda.

export type ShiftCheckpoint = { jam: string };

export function minutesOfDay(hhmmss: string): number {
  const [h, m] = hhmmss.split(":").map(Number);
  return h * 60 + m;
}

// Apakah jadwal shift ini melewati tengah malam (mis. shift 3: 21:00 →
// 04:50). Dideteksi dari adanya checkpoint yang jamnya lebih awal dari
// checkpoint PERTAMA menurut `urutan` — karena itu `checkpoints` harus
// sudah terurut `urutan`, bukan `jam` mentah.
export function lintasTengahMalam(checkpoints: ShiftCheckpoint[]): boolean {
  const mulai = minutesOfDay(checkpoints[0].jam);
  return checkpoints.some((c) => minutesOfDay(c.jam) < mulai);
}

// Checkpoint yang PALING BARU TERLEWATI, bukan sekadar yang jaraknya
// paling dekat — musyrif ngisi absen SESUDAH checkpoint terjadi, bukan
// sebelumnya. Mis. jam 10:17 dgn checkpoint 09:00 & 11:20: nearest-by-
// distance akan pilih 11:20 (63 menit vs 77 menit) padahal 11:20 belum
// terjadi — yang benar tetap 09:00 (checkpoint yg baru saja lewat).
// `elapsed` dihitung melingkar (mod 1440) supaya shift 3 yg lewat tengah
// malam (21:00 → 04:50) tetap benar.
//
// PENGECUALIAN untuk shift yang TIDAK lintas tengah malam (shift 1 & 2):
// perhitungan melingkar itu ikut "berputar" ke hari sebelumnya kalau jam
// sekarang masih SEBELUM checkpoint pertama, sehingga memilih checkpoint
// TERAKHIR shift itu — padahal `tanggalShift()` tetap mengembalikan HARI
// INI untuk shift semacam ini, jadi pasangan (checkpoint, tanggal) yang
// dihasilkan menunjuk jam yang belum terjadi. Nyata terjadi: musyrif shift
// 1 membuka halaman jam 04:30 lalu menyimpan, dan di rekap admin muncul
// sebagai "12:00 sudah diisi". Untuk kasus itu pilih checkpoint PERTAMA
// (yang akan segera datang), bukan yang terakhir.
export function mostRecentCheckpointId<T extends ShiftCheckpoint & { id: string }>(
  checkpoints: T[],
  nowHHMM: string,
): string {
  const now = minutesOfDay(nowHHMM);
  const mulai = minutesOfDay(checkpoints[0].jam);
  if (!lintasTengahMalam(checkpoints) && now < mulai) return checkpoints[0].id;

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
  if (!lintasTengahMalam(checkpoints) || minutesOfDay(nowHHMM) >= mulai) return todayISO;

  const d = new Date(`${todayISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Berapa menit lagi sampai jam checkpoint yang sedang dipilih, pada tanggal
// yang akan disimpan. 0 kalau jamnya sudah lewat.
//
// Hanya berlaku kalau tanggal simpan = hari ini. Untuk shift lintas tengah
// malam yang tanggalnya sudah dimundurkan (`tanggal` = kemarin), semua
// checkpoint-nya memang sudah lewat, jadi tidak pernah "masa depan".
export function menitSebelumCheckpoint(
  jam: string,
  nowHHMM: string,
  tanggal: string,
  todayISO: string,
): number {
  if (tanggal !== todayISO) return 0;
  return Math.max(0, minutesOfDay(jam) - minutesOfDay(nowHHMM));
}

// Sejauh mana musyrif boleh menyimpan LEBIH AWAL dari jam checkpoint.
// Mengisi beberapa menit sebelum jamnya berbunyi itu kebiasaan wajar
// (terpantau di data: mayoritas 1–10 menit lebih awal), jadi tidak dilarang.
// Yang dilarang menyimpan jauh sebelum waktunya — pernah terjadi satu kelas
// terisi untuk SELURUH jadwal sehari pada jam 00:20, sebelum satu pun
// checkpoint-nya terjadi.
export const TOLERANSI_SIMPAN_AWAL_MENIT = 15;

// Jam checkpoint belum tiba (perlu diperingatkan), tapi masih dalam batas
// yang diizinkan untuk disimpan.
export function isCheckpointBelumTerjadi(
  jam: string,
  nowHHMM: string,
  tanggal: string,
  todayISO: string,
): boolean {
  return menitSebelumCheckpoint(jam, nowHHMM, tanggal, todayISO) > 0;
}

// Terlalu jauh sebelum waktunya — penyimpanan ditolak.
export function isCheckpointTerlaluAwal(
  jam: string,
  nowHHMM: string,
  tanggal: string,
  todayISO: string,
): boolean {
  return (
    menitSebelumCheckpoint(jam, nowHHMM, tanggal, todayISO) > TOLERANSI_SIMPAN_AWAL_MENIT
  );
}

// Jam paling awal absensi checkpoint ini boleh disimpan (HH:MM), untuk
// ditampilkan ke musyrif supaya dia tahu kapan harus kembali.
export function jamMulaiBolehSimpan(jam: string): string {
  const m = minutesOfDay(jam) - TOLERANSI_SIMPAN_AWAL_MENIT;
  const wrapped = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  return `${String(h).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}
