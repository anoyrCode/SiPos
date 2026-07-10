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
