import { describe, expect, it } from "vitest";
import {
  isCheckpointBelumTerjadi,
  isCheckpointTerlaluAwal,
  jamMulaiBolehSimpan,
  lintasTengahMalam,
  menitSebelumCheckpoint,
  minutesOfDay,
  mostRecentCheckpointId,
  tanggalShift,
  TOLERANSI_SIMPAN_AWAL_MENIT,
} from "./absensi-santri";

// Jadwal checkpoint asli (seed migrasi 0041), urutan sudah benar.
const SHIFT1 = [
  { jam: "05:15" },
  { jam: "06:00" },
  { jam: "06:55" },
  { jam: "09:00" },
  { jam: "11:20" },
  { jam: "12:00" },
];
const SHIFT3 = [
  { jam: "21:00" },
  { jam: "22:00" },
  { jam: "23:30" },
  { jam: "01:00" },
  { jam: "03:00" },
  { jam: "04:00" },
  { jam: "04:50" },
];
const SHIFT1_WITH_ID = SHIFT1.map((c, i) => ({ ...c, id: `s1-${i}` }));
const SHIFT3_WITH_ID = SHIFT3.map((c, i) => ({ ...c, id: `s3-${i}` }));

describe("minutesOfDay", () => {
  it("mengubah HH:MM(:SS) jadi menit sejak tengah malam", () => {
    expect(minutesOfDay("00:00")).toBe(0);
    expect(minutesOfDay("01:00")).toBe(60);
    expect(minutesOfDay("23:59")).toBe(1439);
    expect(minutesOfDay("09:00:00")).toBe(540);
  });
});

describe("lintasTengahMalam", () => {
  it("shift 1 (pagi-siang, tidak lintas tengah malam) -> false", () => {
    expect(lintasTengahMalam(SHIFT1)).toBe(false);
  });

  it("shift 3 (21:00 -> 04:50, lintas tengah malam) -> true", () => {
    expect(lintasTengahMalam(SHIFT3)).toBe(true);
  });
});

describe("mostRecentCheckpointId", () => {
  it("pilih checkpoint yang BARU LEWAT, bukan yang jaraknya terdekat", () => {
    // Dari komentar kode: jam 10:17 antara checkpoint 09:00 & 11:20 --
    // nearest-by-distance akan salah pilih 11:20 (belum terjadi).
    expect(mostRecentCheckpointId(SHIFT1_WITH_ID, "10:17")).toBe("s1-3"); // 09:00
  });

  it("shift non-lintas-tengah-malam dibuka SEBELUM checkpoint pertama -> pilih checkpoint pertama", () => {
    // Kasus nyata: musyrif shift 1 buka halaman jam 04:30 (sebelum 05:15).
    // Perhitungan melingkar polos akan salah pilih checkpoint TERAKHIR
    // (12:00) karena "berputar" ke hari sebelumnya.
    expect(mostRecentCheckpointId(SHIFT1_WITH_ID, "04:30")).toBe("s1-0"); // 05:15
  });

  it("shift lintas tengah malam: jam 02:00 -> checkpoint 01:00 (bukan 21:00 hari sebelumnya)", () => {
    expect(mostRecentCheckpointId(SHIFT3_WITH_ID, "02:00")).toBe("s3-3"); // 01:00
  });

  it("shift lintas tengah malam: jam 21:30 (baru mulai) -> checkpoint 21:00", () => {
    expect(mostRecentCheckpointId(SHIFT3_WITH_ID, "21:30")).toBe("s3-0"); // 21:00
  });
});

describe("tanggalShift", () => {
  it("shift non-lintas-tengah-malam selalu tanggal hari ini, jam berapa pun", () => {
    expect(tanggalShift(SHIFT1, "04:30", "2026-08-12")).toBe("2026-08-12");
    expect(tanggalShift(SHIFT1, "23:00", "2026-08-12")).toBe("2026-08-12");
  });

  it("shift lintas tengah malam, jam SUDAH lewat jam mulai -> tanggal hari ini", () => {
    expect(tanggalShift(SHIFT3, "22:00", "2026-08-12")).toBe("2026-08-12");
  });

  it("shift lintas tengah malam, jam BELUM sampai jam mulai (dini hari) -> tanggal kemarin", () => {
    // Bug asli yang diperbaiki: absen jam 01:00 harus jatuh ke malam
    // SEBELUMNYA, bukan tanggal kalender saat tombol ditekan.
    expect(tanggalShift(SHIFT3, "01:15", "2026-08-12")).toBe("2026-08-11");
  });

  it("mundur tanggal tetap benar lintas bulan", () => {
    expect(tanggalShift(SHIFT3, "01:15", "2026-03-01")).toBe("2026-02-28");
  });

  it("mundur tanggal tetap benar lintas tahun", () => {
    expect(tanggalShift(SHIFT3, "01:15", "2026-01-01")).toBe("2025-12-31");
  });

  it("musyrif buka ulang checkpoint 23:30 pada jam 01:15 -- tetap milik malam yang sama", () => {
    // Patokannya jam SEKARANG (01:15), bukan checkpoint yang dipilih (23:30).
    expect(tanggalShift(SHIFT3, "01:15", "2026-08-12")).toBe("2026-08-11");
  });
});

describe("menitSebelumCheckpoint", () => {
  it("tanggal simpan bukan hari ini -> selalu 0 (checkpoint sudah pasti lewat)", () => {
    expect(menitSebelumCheckpoint("12:00", "10:00", "2026-08-11", "2026-08-12")).toBe(0);
  });

  it("checkpoint belum terjadi hari ini -> menit tersisa", () => {
    expect(menitSebelumCheckpoint("12:00", "11:50", "2026-08-12", "2026-08-12")).toBe(10);
  });

  it("checkpoint sudah lewat hari ini -> 0, bukan negatif", () => {
    expect(menitSebelumCheckpoint("12:00", "12:05", "2026-08-12", "2026-08-12")).toBe(0);
  });
});

describe("isCheckpointBelumTerjadi / isCheckpointTerlaluAwal", () => {
  it("dalam toleransi (<=15 menit lebih awal) -> belum terjadi tapi TIDAK terlalu awal", () => {
    expect(isCheckpointBelumTerjadi("12:00", "11:50", "2026-08-12", "2026-08-12")).toBe(true);
    expect(isCheckpointTerlaluAwal("12:00", "11:50", "2026-08-12", "2026-08-12")).toBe(false);
  });

  it("tepat di batas toleransi (15 menit) -> belum terlalu awal", () => {
    expect(isCheckpointTerlaluAwal("12:00", "11:45", "2026-08-12", "2026-08-12")).toBe(false);
  });

  it("melewati batas toleransi (16 menit) -> terlalu awal", () => {
    expect(isCheckpointTerlaluAwal("12:00", "11:44", "2026-08-12", "2026-08-12")).toBe(true);
  });

  it("kasus nyata: isi seluruh jadwal jam 00:20 -> ditolak (terlalu awal)", () => {
    expect(isCheckpointTerlaluAwal("12:00", "00:20", "2026-08-12", "2026-08-12")).toBe(true);
  });

  it("checkpoint sudah lewat -> tidak 'belum terjadi' dan tidak 'terlalu awal'", () => {
    expect(isCheckpointBelumTerjadi("12:00", "12:05", "2026-08-12", "2026-08-12")).toBe(false);
    expect(isCheckpointTerlaluAwal("12:00", "12:05", "2026-08-12", "2026-08-12")).toBe(false);
  });
});

describe("jamMulaiBolehSimpan", () => {
  it("mengurangi TOLERANSI_SIMPAN_AWAL_MENIT dari jam checkpoint", () => {
    expect(TOLERANSI_SIMPAN_AWAL_MENIT).toBe(15);
    expect(jamMulaiBolehSimpan("12:00")).toBe("11:45");
  });

  it("membungkus ke hari sebelumnya kalau hasilnya negatif", () => {
    expect(jamMulaiBolehSimpan("00:05")).toBe("23:50");
  });
});
