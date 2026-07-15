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
  /**
   * Override jadwal per hari (0=Minggu..6=Sabtu) — dipakai kalau pegawai
   * pakai jadwal beda per hari (bukan jadwal tetap tunggal). Hari yang
   * tidak ada entrynya (atau entry dgn jam_masuk & jam_pulang null)
   * fallback ke jam_masuk_jadwal/jam_pulang_jadwal biasa.
   */
  jadwal_harian?: Record<
    number,
    { jam_masuk: string | null; jam_pulang: string | null }
  > | null;
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

/** Tambah/kurang N hari dari tanggal "YYYY-MM-DD", hasil "YYYY-MM-DD". */
function addDaysToTanggal(tanggal: string, days: number): string {
  const [y, m, d] = tanggal.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Instant absolut jadwal pulang utk 1 tanggal masuk. Kalau jam pulang <=
 * jam masuk (shift lintas tengah malam, mis. masuk 21:00 pulang 05:00),
 * jadwal pulang jatuh di TANGGAL+1, bukan tanggal yang sama dgn jam masuk
 * — sebelumnya ini salah dihitung sbg tanggal yang sama, bikin pegawai
 * shift malam yg clock out tepat waktu malah ke-anggap "Telat Clock Out".
 */
export function jadwalPulangInstant(
  tanggal: string,
  jamMasukJadwal: string | null,
  jamPulangJadwal: string,
): Date {
  const lintasTengahMalam = !!jamMasukJadwal && jamPulangJadwal <= jamMasukJadwal;
  const tanggalPulang = lintasTengahMalam
    ? addDaysToTanggal(tanggal, 1)
    : tanggal;
  return jakartaInstant(tanggalPulang, jamPulangJadwal);
}

/**
 * Jam masuk/pulang efektif utk 1 tanggal tertentu — pakai override
 * `jadwal.jadwal_harian` (kalau pegawai pakai jadwal beda per hari & ada
 * entry utk hari itu), kalau tidak fallback ke jam_masuk_jadwal/
 * jam_pulang_jadwal biasa. Dipanggil internal oleh computeStatusMasuk/
 * Pulang/computeMenitTelatMasuk/computeMenitLebihAwalPulang di bawah —
 * juga aman dipanggil langsung oleh caller (mis. utk tampilan
 * "Jadwal: HH:mm–HH:mm" yg harus reflect jadwal hari itu spesifik).
 */
export function resolveJadwalHari(
  tanggal: string,
  jadwal: JadwalPegawai,
): { jam_masuk_jadwal: string | null; jam_pulang_jadwal: string | null } {
  const entry = jadwal.jadwal_harian?.[dayOfWeek(tanggal)];
  if (entry) {
    return {
      jam_masuk_jadwal: entry.jam_masuk,
      jam_pulang_jadwal: entry.jam_pulang,
    };
  }
  return {
    jam_masuk_jadwal: jadwal.jam_masuk_jadwal,
    jam_pulang_jadwal: jadwal.jam_pulang_jadwal,
  };
}

export function computeStatusMasuk(
  tanggal: string,
  record: AbsensiRecord | null,
  jadwal: JadwalPegawai,
  toleransiMenit = 0,
): "normal" | "telat" | "belum_absen" {
  if (!record?.jam_masuk_aktual) return "belum_absen";
  const { jam_masuk_jadwal } = resolveJadwalHari(tanggal, jadwal);
  if (!jam_masuk_jadwal) return "normal";
  const jadwalMasuk = jakartaInstant(tanggal, jam_masuk_jadwal);
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
  const { jam_masuk_jadwal } = resolveJadwalHari(tanggal, jadwal);
  if (!record?.jam_masuk_aktual || !jam_masuk_jadwal) return 0;
  const jadwalMasuk = jakartaInstant(tanggal, jam_masuk_jadwal);
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
  const { jam_masuk_jadwal, jam_pulang_jadwal } = resolveJadwalHari(tanggal, jadwal);
  if (!jam_pulang_jadwal) return "normal";
  const jadwalPulang = jadwalPulangInstant(tanggal, jam_masuk_jadwal, jam_pulang_jadwal);
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
  const { jam_masuk_jadwal, jam_pulang_jadwal } = resolveJadwalHari(tanggal, jadwal);
  if (!record?.jam_pulang_aktual || !jam_pulang_jadwal) return 0;
  const jadwalPulang = jadwalPulangInstant(tanggal, jam_masuk_jadwal, jam_pulang_jadwal);
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

export type SesiStatus = { sesi: 1 | 2; status: AbsensiStatus };

/**
 * Status yang murni berlaku per-sesi (bukan hari-level) — dipakai utk
 * menentukan sufiks "(Sesi N)" pada label & shortcut penggabungan di
 * `combineSesiStatuses`. Status lain (Normal, Libur, Lembur, Alpa, Belum
 * Absen, Izin, Sakit, Belum Mulai) berlaku hari-level, tidak per sesi.
 */
const SESI_SPECIFIC_STATUS: ReadonlySet<AbsensiStatus> = new Set([
  "telat",
  "curang",
  "telat_clock_out",
  "belum_clock_out",
]);

/**
 * Gabungkan status Sesi 1 & Sesi 2 (masing-masing dihasilkan
 * `computeDayStatusList` dipanggil terpisah dgn record/jadwal per sesi)
 * utk pegawai shift-ganda. `computeDayStatusList` SENDIRI TIDAK DIUBAH —
 * fungsi ini murni menggabung hasilnya. Kalau kedua sesi menghasilkan
 * status hari-level yang SAMA (mis. sama-sama "libur", karena hari_libur
 * dibagi kedua sesi), digabung jadi 1 elemen tanpa sufiks sesi. Selain
 * itu, tiap status non-"normal" ditandai sesi asalnya — 1 hari bisa
 * berisi masalah di kedua sesi sekaligus (mis. Terlambat di Sesi 1 DAN
 * Curang di Sesi 2).
 */
export function combineSesiStatuses(
  statusesSesi1: AbsensiStatus[],
  statusesSesi2: AbsensiStatus[],
): SesiStatus[] {
  const s1 = statusesSesi1[0] ?? "normal";
  const s2 = statusesSesi2[0] ?? "normal";
  if (!SESI_SPECIFIC_STATUS.has(s1) && s1 === s2) {
    return [{ sesi: 1, status: s1 }];
  }

  const results: SesiStatus[] = [];
  for (const s of statusesSesi1) {
    if (s !== "normal") results.push({ sesi: 1, status: s });
  }
  for (const s of statusesSesi2) {
    if (s !== "normal") results.push({ sesi: 2, status: s });
  }
  return results.length > 0 ? results : [{ sesi: 1, status: "normal" }];
}

/** Label tampilan 1 SesiStatus — tambah sufiks "(Sesi N)" hanya utk status per-sesi. */
export function formatSesiStatusLabel(s: SesiStatus): string {
  const label = STATUS_LABEL[s.status];
  return SESI_SPECIFIC_STATUS.has(s.status) ? `${label} (Sesi ${s.sesi})` : label;
}

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
