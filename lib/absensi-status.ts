export type AbsensiStatus =
  | "normal"
  | "telat"
  | "curang"
  | "telat_clock_out"
  | "alpa"
  | "libur"
  | "belum_absen";

export type AbsensiRecord = {
  jam_masuk_aktual: string | null;
  jam_pulang_aktual: string | null;
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
): "normal" | "telat" | "belum_absen" {
  if (!record?.jam_masuk_aktual) return "belum_absen";
  if (!jadwal.jam_masuk_jadwal) return "normal";
  const jadwalMasuk = jakartaInstant(tanggal, jadwal.jam_masuk_jadwal);
  return new Date(record.jam_masuk_aktual) > jadwalMasuk ? "telat" : "normal";
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
 * Status harian keseluruhan untuk 1 pegawai pada 1 tanggal.
 * Prioritas: libur > alpa/belum_absen > telat_clock_out > curang > telat > normal.
 * "alpa" hanya berlaku utk tanggal < hari ini (WIB); hari ini tanpa
 * record tampil "belum_absen" (harinya belum lewat).
 */
export function computeDayStatus(
  tanggal: string,
  record: AbsensiRecord | null,
  jadwal: JadwalPegawai,
): AbsensiStatus {
  const isLibur =
    jadwal.hari_libur !== null && dayOfWeek(tanggal) === jadwal.hari_libur;
  const hasRecord = !!(record?.jam_masuk_aktual || record?.jam_pulang_aktual);
  const isPast = tanggal < todayJakarta();

  if (isLibur && !hasRecord) return "libur";
  if (!hasRecord) return isPast ? "alpa" : "belum_absen";

  const statusMasuk = computeStatusMasuk(tanggal, record, jadwal);
  const statusPulang = computeStatusPulang(tanggal, record, jadwal);
  if (statusPulang === "telat_clock_out") return "telat_clock_out";
  if (statusPulang === "curang") return "curang";
  if (statusMasuk === "telat") return "telat";
  return "normal";
}

export const STATUS_LABEL: Record<AbsensiStatus, string> = {
  normal: "Normal",
  telat: "Telat",
  curang: "Curang",
  telat_clock_out: "Telat Clock Out",
  alpa: "Alpa",
  libur: "Libur",
  belum_absen: "Belum Absen",
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
