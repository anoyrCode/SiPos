export type AbsensiStatus =
  | "normal"
  | "telat"
  | "curang"
  | "telat_clock_out"
  | "belum_clock_out"
  | "alpa"
  | "libur"
  | "belum_absen"
  | "masuk_libur"
  | "izin"
  | "sakit"
  | "belum_mulai";

export type KategoriAbsen = "izin" | "sakit";

export type AbsensiRecord = {
  jam_masuk_aktual: string | null;
  jam_pulang_aktual: string | null;
  kategori_absen?: KategoriAbsen | null;
};

export type JadwalPegawai = {
  jam_masuk_jadwal: string | null;
  jam_pulang_jadwal: string | null;
  hari_libur: number | null;
};

/** Tanggal hari ini di zona waktu Jakarta (WIB), format YYYY-MM-DD. */
export function todayJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Hari dalam seminggu (0=Minggu..6=Sabtu) dari string tanggal YYYY-MM-DD. */
function dayOfWeek(tanggal: string): number {
  const [y, m, d] = tanggal.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Gabungkan tanggal + jam jadi instant absolut, asumsi WIB (UTC+7 tetap). */
function jakartaInstant(tanggal: string, time: string): Date {
  return new Date(`${tanggal}T${time}+07:00`);
}

export function computeStatusMasuk(
  tanggal: string,
  record: AbsensiRecord | null,
  jadwal: JadwalPegawai,
  toleransiMenit = 0,
): "normal" | "telat" | "belum_absen" {
  if (!record?.jam_masuk_aktual) return "belum_absen";
  if (!jadwal.jam_masuk_jadwal) return "normal";
  const jadwalMasuk = jakartaInstant(tanggal, jadwal.jam_masuk_jadwal);
  const batasToleransi = new Date(jadwalMasuk.getTime() + toleransiMenit * 60000);
  return new Date(record.jam_masuk_aktual) > batasToleransi ? "telat" : "normal";
}

/**
 * Menit keterlambatan clock-in dibanding jadwal (setelah dikurangi
 * toleransi), dibulatkan ke bawah. 0 bila tidak telat (termasuk masih
 * dalam toleransi), tidak ada record, atau jam_masuk_jadwal null.
 */
export function computeMenitTelatMasuk(
  tanggal: string,
  record: AbsensiRecord | null,
  jadwal: JadwalPegawai,
  toleransiMenit = 0,
): number {
  if (!record?.jam_masuk_aktual || !jadwal.jam_masuk_jadwal) return 0;
  const jadwalMasuk = jakartaInstant(tanggal, jadwal.jam_masuk_jadwal);
  const aktual = new Date(record.jam_masuk_aktual);
  const diffMs = aktual.getTime() - jadwalMasuk.getTime() - toleransiMenit * 60000;
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / 60000);
}

export function computeStatusPulang(
  tanggal: string,
  record: AbsensiRecord | null,
  jadwal: JadwalPegawai,
): "normal" | "curang" | "telat_clock_out" | "belum_absen" {
  if (!record?.jam_pulang_aktual) return "belum_absen";
  if (!jadwal.jam_pulang_jadwal) return "normal";
  const jadwalPulang = jakartaInstant(tanggal, jadwal.jam_pulang_jadwal);
  const aktual = new Date(record.jam_pulang_aktual);
  if (aktual < jadwalPulang) return "curang";
  const batasTelat = new Date(jadwalPulang.getTime() + 8 * 60 * 60 * 1000);
  if (aktual > batasTelat) return "telat_clock_out";
  return "normal";
}

/**
 * Menit clock-out lebih awal dari jadwal (curang), dibulatkan ke bawah.
 * 0 bila tidak lebih awal, tidak ada record, atau jam_pulang_jadwal null.
 */
export function computeMenitLebihAwalPulang(
  tanggal: string,
  record: AbsensiRecord | null,
  jadwal: JadwalPegawai,
): number {
  if (!record?.jam_pulang_aktual || !jadwal.jam_pulang_jadwal) return 0;
  const jadwalPulang = jakartaInstant(tanggal, jadwal.jam_pulang_jadwal);
  const aktual = new Date(record.jam_pulang_aktual);
  const diffMs = jadwalPulang.getTime() - aktual.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / 60000);
}

/**
 * Apakah tanggal ini hari libur bagi pegawai — hari libur tetap mingguan
 * (pegawai.hari_libur) ATAU hari libur khusus pondok (berlaku semua pegawai,
 * mis. libur nasional/acara pondok).
 */
export function isHariLiburPegawai(
  tanggal: string,
  jadwal: JadwalPegawai,
  liburKhususSet?: Set<string>,
): boolean {
  if (liburKhususSet?.has(tanggal)) return true;
  return jadwal.hari_libur !== null && dayOfWeek(tanggal) === jadwal.hari_libur;
}

/**
 * Status harian keseluruhan untuk 1 pegawai pada 1 tanggal.
 * Prioritas: libur > masuk_libur > alpa/belum_absen > belum_clock_out
 * > telat_clock_out > curang > telat > normal.
 * "masuk_libur" berlaku kalau tanggal ini hari libur pegawai TAPI ada
 * record (clock in dan/atau clock out) — menang atas semua evaluasi
 * telat/curang/belum_clock_out di bawahnya, karena di hari libur pegawai
 * tidak wajib mengikuti jadwal jam kerja normal sama sekali.
 * "alpa" hanya berlaku utk tanggal < hari ini (WIB); hari ini tanpa
 * record tampil "belum_absen" (harinya belum lewat). "belum_clock_out"
 * berlaku utk tanggal < hari ini yang sudah clock in tapi belum clock out
 * (lupa absen pulang) — dicek SEBELUM status telat/curang/normal biasa,
 * supaya lupa clock out tidak tersamar jadi "Normal".
 * "izin"/"sakit" (dari kategori_absen, diajukan sendiri pegawai)
 * MENANG atas semua status lain — pengajuan eksplisit lebih diutamakan
 * daripada evaluasi otomatis dari jam clock in/out.
 * "belum_mulai": tanggal sebelum `tanggalMulai` (tanggal sistem absensi
 * mulai dipakai, diatur admin) — MENANG atas SEMUA status lain termasuk
 * kategori_absen, supaya tanggal sebelum go-live tidak pernah tampil
 * Alpa/Libur/dll walau kebetulan ada data lama.
 */
/**
 * Semua status yang berlaku utk 1 pegawai pada 1 tanggal (bukan cuma yg
 * "menang"). Untuk hari kerja biasa (bukan libur/izin/dll), Telat (masuk)
 * dan Curang/Telat Clock Out (pulang) dicek independen — 1 hari BISA kena
 * keduanya sekaligus (mis. datang telat DAN pulang lebih awal), jadi array
 * ini bisa berisi lebih dari 1 elemen. Selain itu, selalu 1 elemen.
 * `computeDayStatus` (di bawah) cuma ambil elemen pertama (status prioritas
 * tertinggi) — dipakai di tempat yg cuma butuh 1 badge ringkasan.
 */
export function computeDayStatusList(
  tanggal: string,
  record: AbsensiRecord | null,
  jadwal: JadwalPegawai,
  toleransiMenit = 0,
  liburKhususSet?: Set<string>,
  tanggalMulai?: string | null,
): AbsensiStatus[] {
  if (tanggalMulai && tanggal < tanggalMulai) return ["belum_mulai"];
  if (record?.kategori_absen) return [record.kategori_absen];

  const isLibur = isHariLiburPegawai(tanggal, jadwal, liburKhususSet);
  const hasRecord = !!(record?.jam_masuk_aktual || record?.jam_pulang_aktual);
  const isPast = tanggal < todayJakarta();

  if (isLibur && !hasRecord) return ["libur"];
  if (isLibur && hasRecord) return ["masuk_libur"];
  if (!hasRecord) return [isPast ? "alpa" : "belum_absen"];

  if (isPast && record?.jam_masuk_aktual && !record?.jam_pulang_aktual) {
    return ["belum_clock_out"];
  }

  const statusMasuk = computeStatusMasuk(tanggal, record, jadwal, toleransiMenit);
  const statusPulang = computeStatusPulang(tanggal, record, jadwal);
  const statuses: AbsensiStatus[] = [];
  if (statusMasuk === "telat") statuses.push("telat");
  if (statusPulang === "telat_clock_out") statuses.push("telat_clock_out");
  else if (statusPulang === "curang") statuses.push("curang");
  return statuses.length > 0 ? statuses : ["normal"];
}

export function computeDayStatus(
  tanggal: string,
  record: AbsensiRecord | null,
  jadwal: JadwalPegawai,
  toleransiMenit = 0,
  liburKhususSet?: Set<string>,
  tanggalMulai?: string | null,
): AbsensiStatus {
  const statuses = computeDayStatusList(
    tanggal,
    record,
    jadwal,
    toleransiMenit,
    liburKhususSet,
    tanggalMulai,
  );
  // Prioritas kalau lebih dari 1: telat_clock_out/curang (pulang) menang
  // atas telat (masuk) — sama seperti urutan lama, cuma sekarang diturunkan
  // dari computeDayStatusList supaya 1 sumber kebenaran.
  return (
    statuses.find((s) => s === "telat_clock_out" || s === "curang") ??
    statuses[0]
  );
}

export const STATUS_LABEL: Record<AbsensiStatus, string> = {
  normal: "Normal",
  telat: "Terlambat",
  curang: "Pulang Sebelum Waktunya",
  telat_clock_out: "Terlambat Clock Out",
  belum_clock_out: "Belum Clock Out",
  alpa: "Alpa",
  libur: "Libur",
  belum_absen: "Belum Absen",
  masuk_libur: "Lembur",
  izin: "Izin",
  sakit: "Sakit",
  belum_mulai: "Belum Mulai",
};

/** Format timestamptz jadi "HH.mm" di zona waktu Jakarta, "—" bila kosong. */
export function formatJamWIB(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export type PengajuanStatus = "menunggu" | "disetujui" | "ditolak";

export const PENGAJUAN_STATUS_LABEL: Record<PengajuanStatus, string> = {
  menunggu: "Menunggu",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
};
