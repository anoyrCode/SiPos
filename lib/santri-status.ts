export type SantriStatusLevel =
  | "teladan"
  | "sangat_baik"
  | "terjaga_baik"
  | "perlu_perhatian"
  | "perlu_tindakan"
  | "kritis";

/** Ambang Surat Peringatan yang berlaku (dari `surat_panggilan_pengaturan`). */
export type SpAmbang = { sp1: number; sp3: number };

/**
 * Level 5-6 (perlu_tindakan/kritis) dicek dari poin negatif yang MENGHITUNG
 * ambang Surat Peringatan — yaitu hanya level pelanggaran yang dicentang
 * `master_level_poin.hitung_sp` (bawaan: BERAT) — bukan seluruh poin negatif.
 *
 * Sebelumnya fungsi ini memakai total seluruh negatif dengan ambang 300/900
 * yang dipaku di kode. Migrasi 0038 sudah mengubah Surat Peringatan agar
 * hanya menghitung level tertentu dengan ambang yang bisa diatur admin, tapi
 * badge ini tidak ikut diperbarui — akibatnya santri yang menumpuk
 * pelanggaran RINGAN ditandai "Perlu Tindakan" padahal Surat Peringatan tidak
 * akan pernah terbit untuknya.
 *
 * Level 1-4 tetap dievaluasi dari skor bersih SELURUH poin (positif dikurangi
 * negatif) — di situ pelanggaran ringan memang seharusnya ikut berpengaruh.
 */
export function computeSantriStatusLevel(
  netSkor: number,
  negatifSp: number,
  ambang: SpAmbang,
): SantriStatusLevel {
  if (negatifSp >= ambang.sp3) return "kritis";
  if (negatifSp >= ambang.sp1) return "perlu_tindakan";
  if (netSkor < 0) return "perlu_perhatian";
  if (netSkor >= 1500) return "teladan";
  if (netSkor >= 300) return "sangat_baik";
  return "terjaga_baik";
}

/** Nada warna senada utk elemen lain (mis. angka skor) di halaman yang sama. */
export function santriStatusTone(
  level: SantriStatusLevel,
): "positive" | "warning" | "negative" {
  if (level === "perlu_perhatian") return "warning";
  if (level === "perlu_tindakan" || level === "kritis") return "negative";
  return "positive";
}

export type SantriProgress =
  | { kind: "progress"; nextLevelLabel: string; pointsNeeded: number; percent: number }
  | { kind: "message"; text: string };

/**
 * Progress menuju level berikutnya, khusus utk tampilan UI (bukan aturan
 * skor baru). "perlu_tindakan"/"kritis" dihitung dari poin pelanggaran
 * ber-`hitung_sp` yang KUMULATIF dan tidak pernah berkurang sepanjang tahun
 * ajaran — jadi tidak ada progress bar yg jujur bisa ditunjukkan, diganti
 * pesan netral.
 * "teladan" adalah level tertinggi, tidak ada level di atasnya.
 * Batas bawah/atas per level (lower/upper) dipakai HANYA utk menghitung
 * persentase visual bar, bukan aturan penentuan level (itu tetap di
 * `computeSantriStatusLevel`).
 */
export function computeSantriProgress(
  netSkor: number,
  negatifSp: number,
  level: SantriStatusLevel,
): SantriProgress {
  if (level === "kritis" || level === "perlu_tindakan") {
    // Menyebut Surat Peringatan, bukan "poin negatif": angkanya kini hanya
    // pelanggaran yang menghitung ambang SP, jadi menyebutnya "poin negatif"
    // akan berbeda dari total negatif yang tertera di kartu sebelahnya.
    return {
      kind: "message",
      text: `Sudah mencapai ambang Surat Peringatan (−${negatifSp} poin)`,
    };
  }
  if (level === "teladan") {
    return { kind: "message", text: "Sudah mencapai level tertinggi 🏆" };
  }
  const RANGES: Record<
    "perlu_perhatian" | "terjaga_baik" | "sangat_baik",
    { lower: number; upper: number; nextLevelLabel: string }
  > = {
    perlu_perhatian: { lower: -300, upper: 0, nextLevelLabel: "Terjaga Baik" },
    terjaga_baik: { lower: 0, upper: 300, nextLevelLabel: "Sangat Baik" },
    sangat_baik: { lower: 300, upper: 1500, nextLevelLabel: "Teladan" },
  };
  const r = RANGES[level as "perlu_perhatian" | "terjaga_baik" | "sangat_baik"];
  const percent = Math.min(
    100,
    Math.max(0, ((netSkor - r.lower) / (r.upper - r.lower)) * 100),
  );
  const pointsNeeded = Math.max(0, r.upper - netSkor);
  return {
    kind: "progress",
    nextLevelLabel: r.nextLevelLabel,
    pointsNeeded,
    percent: Math.round(percent),
  };
}
