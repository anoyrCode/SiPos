export type SantriStatusLevel =
  | "teladan"
  | "sangat_baik"
  | "terjaga_baik"
  | "perlu_perhatian"
  | "perlu_tindakan"
  | "kritis";

/**
 * Level 5-6 (perlu_tindakan/kritis) dicek dari total poin negatif dulu
 * (selaras ambang SP1/SP2/SP3 di Surat Panggilan) — menang atas skor
 * bersih, karena akumulasi pelanggaran tetap jadi perhatian walau
 * santri sempat menebus lewat banyak poin positif. Level 1-4 baru
 * dievaluasi dari skor bersih (poin positif dikurangi negatif).
 */
export function computeSantriStatusLevel(
  netSkor: number,
  totalNegatif: number,
): SantriStatusLevel {
  if (totalNegatif >= 900) return "kritis";
  if (totalNegatif >= 300) return "perlu_tindakan";
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
 * skor baru). "perlu_tindakan"/"kritis" dihitung dari total poin negatif
 * KUMULATIF yg tidak pernah berkurang sepanjang tahun ajaran — jadi tidak
 * ada progress bar yg jujur bisa ditunjukkan, diganti pesan netral.
 * "teladan" adalah level tertinggi, tidak ada level di atasnya.
 * Batas bawah/atas per level (lower/upper) dipakai HANYA utk menghitung
 * persentase visual bar, bukan aturan penentuan level (itu tetap di
 * `computeSantriStatusLevel`).
 */
export function computeSantriProgress(
  netSkor: number,
  totalNegatif: number,
  level: SantriStatusLevel,
): SantriProgress {
  if (level === "kritis" || level === "perlu_tindakan") {
    return { kind: "message", text: `Sudah −${totalNegatif} poin negatif tahun ini` };
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
