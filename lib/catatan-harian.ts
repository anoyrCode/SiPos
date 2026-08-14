// Label, warna, dan hitungan jarak hari untuk Catatan Harian — dipakai
// halaman musyrif dan portal wali, supaya keduanya tidak menyimpan salinan
// yang bisa diam-diam berbeda.

export type JenisCatatan = "baik" | "perhatian" | "info";

export const JENIS_LABEL: Record<JenisCatatan, string> = {
  baik: "Kabar Baik",
  perhatian: "Perlu Perhatian",
  info: "Informasi",
};

export const JENIS_VARIANT: Record<JenisCatatan, "positive" | "warning" | "primary"> = {
  baik: "positive",
  perhatian: "warning",
  info: "primary",
};

/** Urutan tampil tombol pilihan jenis. */
export const JENIS_URUT: JenisCatatan[] = ["baik", "perhatian", "info"];

/**
 * Selisih hari antara `tanggal` dan hari ini, keduanya "YYYY-MM-DD".
 * Dihitung lewat UTC midnight supaya tidak terpengaruh zona waktu mesin
 * yang menjalankan — kedua tanggal sudah dalam kalender WIB saat masuk.
 */
export function jarakHari(tanggal: string, todayISO: string): number {
  const a = Date.parse(`${tanggal}T00:00:00Z`);
  const b = Date.parse(`${todayISO}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * "hari ini" / "kemarin" / "8 hari lalu". Dihitung dari kolom `tanggal`
 * (tanggal kejadian), BUKAN `created_at` — kalau musyrif menuliskan kejadian
 * tiga hari lalu pada hari ini, yang relevan bagi wali kapan kejadiannya.
 */
export function labelJarakHari(tanggal: string, todayISO: string): string {
  const n = jarakHari(tanggal, todayISO);
  if (n <= 0) return "hari ini";
  if (n === 1) return "kemarin";
  return `${n} hari lalu`;
}
