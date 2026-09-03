import { describe, expect, it } from "vitest";
import {
  computeSantriProgress,
  computeSantriStatusLevel,
  santriStatusTone,
  type SpAmbang,
} from "./santri-status";

const AMBANG: SpAmbang = { sp1: 300, sp3: 900 };

describe("computeSantriStatusLevel", () => {
  it("negatifSp >= sp3 -> kritis, walau skor bersih tinggi", () => {
    // Ini persis kasus yang diperbaiki: dulu status ini dihitung dari
    // TOTAL poin negatif, bukan cuma yang menghitung ambang SP.
    expect(computeSantriStatusLevel(5000, 900, AMBANG)).toBe("kritis");
  });

  it("negatifSp tepat di ambang sp3 -> kritis (batas inklusif)", () => {
    expect(computeSantriStatusLevel(0, 900, AMBANG)).toBe("kritis");
  });

  it("negatifSp 1 di bawah ambang sp3 -> bukan kritis", () => {
    expect(computeSantriStatusLevel(0, 899, AMBANG)).not.toBe("kritis");
  });

  it("negatifSp >= sp1 (tapi < sp3) -> perlu_tindakan", () => {
    expect(computeSantriStatusLevel(0, 300, AMBANG)).toBe("perlu_tindakan");
    expect(computeSantriStatusLevel(0, 899, AMBANG)).toBe("perlu_tindakan");
  });

  it("negatifSp 1 di bawah ambang sp1 -> jatuh ke evaluasi skor bersih", () => {
    expect(computeSantriStatusLevel(0, 299, AMBANG)).toBe("terjaga_baik");
  });

  it("pelanggaran RINGAN yang tertumpuk (negatifSp=0) tidak pernah jadi perlu_tindakan/kritis", () => {
    // Poin utama fitur: santri dgn banyak poin negatif ringan (tidak
    // hitung_sp) tapi skor bersih masih positif tetap dianggap wajar.
    expect(computeSantriStatusLevel(50, 0, AMBANG)).toBe("terjaga_baik");
  });

  it("negatifSp=0, skor bersih negatif -> perlu_perhatian", () => {
    expect(computeSantriStatusLevel(-1, 0, AMBANG)).toBe("perlu_perhatian");
  });

  it("negatifSp=0, skor bersih 0 -> terjaga_baik (bukan perlu_perhatian)", () => {
    expect(computeSantriStatusLevel(0, 0, AMBANG)).toBe("terjaga_baik");
  });

  it("skor bersih >= 300 -> sangat_baik", () => {
    expect(computeSantriStatusLevel(299, 0, AMBANG)).toBe("terjaga_baik");
    expect(computeSantriStatusLevel(300, 0, AMBANG)).toBe("sangat_baik");
  });

  it("skor bersih >= 1500 -> teladan", () => {
    expect(computeSantriStatusLevel(1499, 0, AMBANG)).toBe("sangat_baik");
    expect(computeSantriStatusLevel(1500, 0, AMBANG)).toBe("teladan");
  });
});

describe("santriStatusTone", () => {
  it("perlu_perhatian -> warning", () => {
    expect(santriStatusTone("perlu_perhatian")).toBe("warning");
  });

  it("perlu_tindakan & kritis -> negative", () => {
    expect(santriStatusTone("perlu_tindakan")).toBe("negative");
    expect(santriStatusTone("kritis")).toBe("negative");
  });

  it("level baik lainnya -> positive", () => {
    expect(santriStatusTone("terjaga_baik")).toBe("positive");
    expect(santriStatusTone("sangat_baik")).toBe("positive");
    expect(santriStatusTone("teladan")).toBe("positive");
  });
});

describe("computeSantriProgress", () => {
  it("kritis/perlu_tindakan -> pesan netral menyebut poin SP, bukan progress bar", () => {
    const p = computeSantriProgress(0, 900, "kritis");
    expect(p.kind).toBe("message");
    if (p.kind === "message") expect(p.text).toContain("900");
  });

  it("teladan -> pesan level tertinggi, tanpa progress bar", () => {
    const p = computeSantriProgress(2000, 0, "teladan");
    expect(p).toEqual({ kind: "message", text: expect.stringContaining("tertinggi") });
  });

  it("perlu_perhatian di tengah rentang -> progress 50% menuju Terjaga Baik", () => {
    const p = computeSantriProgress(-150, 0, "perlu_perhatian");
    expect(p).toMatchObject({
      kind: "progress",
      nextLevelLabel: "Terjaga Baik",
      pointsNeeded: 150,
      percent: 50,
    });
  });

  it("terjaga_baik di tengah rentang -> progress 50% menuju Sangat Baik", () => {
    const p = computeSantriProgress(150, 0, "terjaga_baik");
    expect(p).toMatchObject({
      kind: "progress",
      nextLevelLabel: "Sangat Baik",
      pointsNeeded: 150,
      percent: 50,
    });
  });

  it("sangat_baik di tengah rentang -> progress 50% menuju Teladan", () => {
    const p = computeSantriProgress(900, 0, "sangat_baik");
    expect(p).toMatchObject({
      kind: "progress",
      nextLevelLabel: "Teladan",
      pointsNeeded: 600,
      percent: 50,
    });
  });

  it("persentase dijepit ke 0 kalau skor di bawah batas bawah rentang", () => {
    const p = computeSantriProgress(-500, 0, "perlu_perhatian");
    expect(p).toMatchObject({ kind: "progress", percent: 0 });
  });
});
