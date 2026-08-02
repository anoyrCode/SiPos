/**
 * Ambang & penentuan level Surat Peringatan (SP).
 *
 * Angkanya bisa diubah admin lewat tabel `surat_panggilan_pengaturan`,
 * jadi logika ini TIDAK boleh disalin ulang per halaman — tiga salinan
 * sebelumnya (halaman SP, tabel SP, dashboard) pasti melenceng begitu
 * angkanya jadi data.
 *
 * File ini diimpor client component, jadi HARUS bebas dari import
 * server-only (Supabase server client, "use server", dll).
 */
export type SpAmbang = {
  ambang_sp1: number;
  ambang_sp2: number;
  ambang_sp3: number;
};

/** Dipakai kalau baris pengaturan belum ada (mis. migrasi 0038 belum jalan). */
export const DEFAULT_AMBANG: SpAmbang = {
  ambang_sp1: 300,
  ambang_sp2: 600,
  ambang_sp3: 900,
};

/** Daftar level SP terurut dari SP1 ke SP3. */
export function spLevels(ambang: SpAmbang): { level: number; ambang: number }[] {
  return [
    { level: 1, ambang: ambang.ambang_sp1 },
    { level: 2, ambang: ambang.ambang_sp2 },
    { level: 3, ambang: ambang.ambang_sp3 },
  ];
}

/** Level SP tertinggi yang dicapai `total`, atau null kalau belum menembus SP1. */
export function spLevelFor(total: number, ambang: SpAmbang): number | null {
  let level: number | null = null;
  for (const sp of spLevels(ambang)) {
    if (total >= sp.ambang) level = sp.level;
  }
  return level;
}
