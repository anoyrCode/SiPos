import { describe, expect, it } from "vitest";
import {
  combineSesiStatuses,
  computeDayStatus,
  computeDayStatusList,
  computeMenitLebihAwalPulang,
  computeMenitTelatMasuk,
  computeStatusMasuk,
  computeStatusPulang,
  effectiveTanggalMulai,
  formatJamWIB,
  formatSesiStatusLabel,
  isHariLiburPegawai,
  jadwalPulangInstant,
  resolveJadwalHari,
  todayJakarta,
  type JadwalPegawai,
} from "./absensi-status";

const JADWAL_TETAP: JadwalPegawai = {
  jam_masuk_jadwal: "08:00",
  jam_pulang_jadwal: "16:00",
  hari_libur: null,
};

// 2026-08-12 = Rabu, 2026-08-09 = Minggu.
const RABU = "2026-08-12";
const MINGGU = "2026-08-09";

describe("effectiveTanggalMulai", () => {
  it("keduanya null -> null (tidak ada batas)", () => {
    expect(effectiveTanggalMulai(null, null)).toBeNull();
  });

  it("cuma salah satu diisi -> pakai yang diisi", () => {
    expect(effectiveTanggalMulai("2026-01-01", null)).toBe("2026-01-01");
    expect(effectiveTanggalMulai(null, "2026-02-01")).toBe("2026-02-01");
  });

  it("keduanya diisi -> ambil yang LEBIH TELAT, bukan yang per-pegawai selalu menang", () => {
    // Mencegah admin salah input tanggal pegawai lebih awal dari tanggal
    // sistem absensi sendiri baru diluncurkan.
    expect(effectiveTanggalMulai("2026-02-01", "2026-01-01")).toBe("2026-02-01");
    expect(effectiveTanggalMulai("2026-01-01", "2026-02-01")).toBe("2026-02-01");
  });
});

describe("jadwalPulangInstant", () => {
  it("shift normal (pulang > masuk) -> jadwal pulang di tanggal yang sama", () => {
    const d = jadwalPulangInstant(RABU, "08:00", "16:00");
    expect(d.toISOString()).toBe(new Date(`${RABU}T16:00:00+07:00`).toISOString());
  });

  it("shift lintas tengah malam (pulang <= masuk) -> jadwal pulang di tanggal+1", () => {
    // Bug asli: dulu dianggap tanggal yang sama, bikin pegawai shift malam
    // yang clock out tepat waktu malah ke-anggap "Telat Clock Out".
    const d = jadwalPulangInstant(RABU, "21:00", "05:00");
    expect(d.toISOString()).toBe(new Date("2026-08-13T05:00:00+07:00").toISOString());
  });

  it("tidak ada jam masuk jadwal (jadwal fleksibel/harian kosong) -> dianggap tidak lintas tengah malam", () => {
    const d = jadwalPulangInstant(RABU, null, "05:00");
    expect(d.toISOString()).toBe(new Date(`${RABU}T05:00:00+07:00`).toISOString());
  });
});

describe("resolveJadwalHari", () => {
  it("tidak ada jadwal_sementara/jadwal_harian -> fallback ke jadwal tetap", () => {
    expect(resolveJadwalHari(RABU, JADWAL_TETAP)).toEqual({
      jam_masuk_jadwal: "08:00",
      jam_pulang_jadwal: "16:00",
    });
  });

  it("jadwal_harian punya entry utk hari itu -> menang atas jadwal tetap", () => {
    const jadwal: JadwalPegawai = {
      ...JADWAL_TETAP,
      jadwal_harian: { 3: { jam_masuk: "13:00", jam_pulang: "21:00" } }, // Rabu
    };
    expect(resolveJadwalHari(RABU, jadwal)).toEqual({
      jam_masuk_jadwal: "13:00",
      jam_pulang_jadwal: "21:00",
    });
  });

  it("jadwal_sementara yang cakup tanggal -> menang atas jadwal_harian DAN jadwal tetap", () => {
    const jadwal: JadwalPegawai = {
      ...JADWAL_TETAP,
      jadwal_harian: { 3: { jam_masuk: "13:00", jam_pulang: "21:00" } },
      jadwal_sementara: [
        {
          tanggal_mulai: "2026-08-10",
          tanggal_selesai: "2026-08-14",
          jam_masuk: "06:00",
          jam_pulang: "14:00",
        },
      ],
    };
    expect(resolveJadwalHari(RABU, jadwal)).toEqual({
      jam_masuk_jadwal: "06:00",
      jam_pulang_jadwal: "14:00",
    });
  });

  it("jadwal_sementara TIDAK cakup tanggal -> tidak berlaku", () => {
    const jadwal: JadwalPegawai = {
      ...JADWAL_TETAP,
      jadwal_sementara: [
        {
          tanggal_mulai: "2026-01-01",
          tanggal_selesai: "2026-01-31",
          jam_masuk: "06:00",
          jam_pulang: "14:00",
        },
      ],
    };
    expect(resolveJadwalHari(RABU, jadwal)).toEqual({
      jam_masuk_jadwal: "08:00",
      jam_pulang_jadwal: "16:00",
    });
  });
});

describe("computeStatusMasuk", () => {
  it("tidak ada record -> belum_absen", () => {
    expect(computeStatusMasuk(RABU, null, JADWAL_TETAP)).toBe("belum_absen");
  });

  it("jam_masuk_jadwal null (fleksibel) -> selalu normal", () => {
    const jadwal: JadwalPegawai = { ...JADWAL_TETAP, jam_masuk_jadwal: null };
    const record = { jam_masuk_aktual: `${RABU}T23:00:00+07:00`, jam_pulang_aktual: null };
    expect(computeStatusMasuk(RABU, record, jadwal)).toBe("normal");
  });

  it("clock in tepat waktu atau lebih awal -> normal", () => {
    const record = { jam_masuk_aktual: `${RABU}T07:55:00+07:00`, jam_pulang_aktual: null };
    expect(computeStatusMasuk(RABU, record, JADWAL_TETAP)).toBe("normal");
  });

  it("clock in melewati jadwal -> telat", () => {
    const record = { jam_masuk_aktual: `${RABU}T08:00:01+07:00`, jam_pulang_aktual: null };
    expect(computeStatusMasuk(RABU, record, JADWAL_TETAP)).toBe("telat");
  });

  it("tepat di batas toleransi -> normal; 1 detik lewat batas -> telat", () => {
    const tepatBatas = { jam_masuk_aktual: `${RABU}T08:05:00+07:00`, jam_pulang_aktual: null };
    const lewatBatas = { jam_masuk_aktual: `${RABU}T08:05:01+07:00`, jam_pulang_aktual: null };
    expect(computeStatusMasuk(RABU, tepatBatas, JADWAL_TETAP, 5)).toBe("normal");
    expect(computeStatusMasuk(RABU, lewatBatas, JADWAL_TETAP, 5)).toBe("telat");
  });
});

describe("computeMenitTelatMasuk", () => {
  it("tidak telat -> 0", () => {
    const record = { jam_masuk_aktual: `${RABU}T07:00:00+07:00`, jam_pulang_aktual: null };
    expect(computeMenitTelatMasuk(RABU, record, JADWAL_TETAP)).toBe(0);
  });

  it("dibulatkan ke BAWAH, bukan dibulatkan biasa", () => {
    const record = { jam_masuk_aktual: `${RABU}T08:10:30+07:00`, jam_pulang_aktual: null };
    expect(computeMenitTelatMasuk(RABU, record, JADWAL_TETAP)).toBe(10);
  });

  it("toleransi dikurangkan dari menit yang dilaporkan, bukan cuma dari status", () => {
    const record = { jam_masuk_aktual: `${RABU}T08:10:00+07:00`, jam_pulang_aktual: null };
    expect(computeMenitTelatMasuk(RABU, record, JADWAL_TETAP, 5)).toBe(5);
  });
});

describe("computeStatusPulang", () => {
  it("tidak ada record -> belum_absen", () => {
    expect(computeStatusPulang(RABU, null, JADWAL_TETAP)).toBe("belum_absen");
  });

  it("jam_pulang_jadwal null (fleksibel) -> selalu normal", () => {
    const jadwal: JadwalPegawai = { ...JADWAL_TETAP, jam_pulang_jadwal: null };
    const record = { jam_masuk_aktual: null, jam_pulang_aktual: `${RABU}T01:00:00+07:00` };
    expect(computeStatusPulang(RABU, record, jadwal)).toBe("normal");
  });

  it("clock out sebelum jadwal (tanpa izin) -> curang", () => {
    const record = { jam_masuk_aktual: null, jam_pulang_aktual: `${RABU}T15:00:00+07:00` };
    expect(computeStatusPulang(RABU, record, JADWAL_TETAP)).toBe("curang");
  });

  it("clock out sebelum jadwal DENGAN pengajuan pulang-awal disetujui -> pulang_awal_izin, bukan curang", () => {
    const record = {
      jam_masuk_aktual: null,
      jam_pulang_aktual: `${RABU}T15:00:00+07:00`,
      izin_pulang_awal: true,
    };
    expect(computeStatusPulang(RABU, record, JADWAL_TETAP)).toBe("pulang_awal_izin");
  });

  it("clock out tepat di jadwal -> normal (bukan curang)", () => {
    const record = { jam_masuk_aktual: null, jam_pulang_aktual: `${RABU}T16:00:00+07:00` };
    expect(computeStatusPulang(RABU, record, JADWAL_TETAP)).toBe("normal");
  });

  it("clock out lebih dari 8 jam setelah jadwal -> telat_clock_out", () => {
    // 2026-08-13T00:00:01, lebih dari 8 jam setelah jadwal 2026-08-12T16:00.
    const record = { jam_masuk_aktual: null, jam_pulang_aktual: "2026-08-13T00:00:01+07:00" };
    expect(computeStatusPulang(RABU, record, JADWAL_TETAP)).toBe("telat_clock_out");
  });

  it("shift lintas tengah malam, clock out TEPAT WAKTU -> normal (regresi bug lama)", () => {
    // Sebelum jadwalPulangInstant diperbaiki, kasus ini salah dianggap
    // "Telat Clock Out" karena jadwal pulang dihitung di tanggal yang sama
    // dgn jam masuk, bukan tanggal+1.
    const jadwal: JadwalPegawai = {
      ...JADWAL_TETAP,
      jam_masuk_jadwal: "21:00",
      jam_pulang_jadwal: "05:00",
    };
    const record = {
      jam_masuk_aktual: `${RABU}T21:00:00+07:00`,
      jam_pulang_aktual: "2026-08-13T05:00:00+07:00",
    };
    expect(computeStatusPulang(RABU, record, jadwal)).toBe("normal");
  });
});

describe("computeMenitLebihAwalPulang", () => {
  it("tidak lebih awal -> 0", () => {
    const record = { jam_masuk_aktual: null, jam_pulang_aktual: `${RABU}T16:00:00+07:00` };
    expect(computeMenitLebihAwalPulang(RABU, record, JADWAL_TETAP)).toBe(0);
  });

  it("dibulatkan ke bawah", () => {
    const record = { jam_masuk_aktual: null, jam_pulang_aktual: `${RABU}T15:49:30+07:00` };
    expect(computeMenitLebihAwalPulang(RABU, record, JADWAL_TETAP)).toBe(10);
  });

  it("berizin pulang awal -> 0, walau pulang jauh lebih awal (dikecualikan dari laporan HRD)", () => {
    const record = {
      jam_masuk_aktual: null,
      jam_pulang_aktual: `${RABU}T10:00:00+07:00`,
      izin_pulang_awal: true,
    };
    expect(computeMenitLebihAwalPulang(RABU, record, JADWAL_TETAP)).toBe(0);
  });
});

describe("isHariLiburPegawai", () => {
  it("hari_libur mingguan cocok -> true", () => {
    const jadwal: JadwalPegawai = { ...JADWAL_TETAP, hari_libur: 0 };
    expect(isHariLiburPegawai(MINGGU, jadwal)).toBe(true);
    expect(isHariLiburPegawai(RABU, jadwal)).toBe(false);
  });

  it("libur khusus pondok berlaku walau bukan hari libur mingguannya", () => {
    const jadwal: JadwalPegawai = { ...JADWAL_TETAP, hari_libur: 0 };
    expect(isHariLiburPegawai(RABU, jadwal, new Set([RABU]))).toBe(true);
  });
});

describe("computeDayStatusList", () => {
  it("tanggal sebelum tanggal_mulai -> belum_mulai, menang atas kategori_absen sekalipun", () => {
    const record = { jam_masuk_aktual: null, jam_pulang_aktual: null, kategori_absen: "izin" as const };
    expect(
      computeDayStatusList(RABU, record, JADWAL_TETAP, 0, undefined, "2026-09-01"),
    ).toEqual(["belum_mulai"]);
  });

  it("kategori_absen menang atas evaluasi telat/curang otomatis", () => {
    const record = {
      jam_masuk_aktual: `${RABU}T10:00:00+07:00`,
      jam_pulang_aktual: null,
      kategori_absen: "sakit" as const,
    };
    expect(computeDayStatusList(RABU, record, JADWAL_TETAP)).toEqual(["sakit"]);
  });

  it("hari libur tanpa record -> libur", () => {
    const jadwal: JadwalPegawai = { ...JADWAL_TETAP, hari_libur: 0 };
    expect(computeDayStatusList(MINGGU, null, jadwal)).toEqual(["libur"]);
  });

  it("hari libur DENGAN record -> masuk_libur, menang atas telat/curang", () => {
    const jadwal: JadwalPegawai = { ...JADWAL_TETAP, hari_libur: 0 };
    const record = {
      // Datang sangat telat DAN pulang sangat awal -- tetap harus masuk_libur.
      jam_masuk_aktual: `${MINGGU}T23:00:00+07:00`,
      jam_pulang_aktual: `${MINGGU}T23:30:00+07:00`,
    };
    expect(computeDayStatusList(MINGGU, record, jadwal)).toEqual(["masuk_libur"]);
  });

  it("tanggal lampau tanpa record -> alpa; hari ini tanpa record -> belum_absen", () => {
    expect(computeDayStatusList("2000-01-01", null, JADWAL_TETAP)).toEqual(["alpa"]);
    const hariIni = todayJakarta();
    expect(computeDayStatusList(hariIni, null, JADWAL_TETAP)).toEqual(["belum_absen"]);
  });

  it("tanggal lampau: sudah clock in tapi belum clock out -> belum_clock_out", () => {
    const record = { jam_masuk_aktual: "2000-01-01T08:00:00+07:00", jam_pulang_aktual: null };
    expect(computeDayStatusList("2000-01-01", record, JADWAL_TETAP)).toEqual([
      "belum_clock_out",
    ]);
  });

  it("hari kerja normal, tepat waktu -> normal", () => {
    const record = {
      jam_masuk_aktual: `${RABU}T07:55:00+07:00`,
      jam_pulang_aktual: `${RABU}T16:00:00+07:00`,
    };
    expect(computeDayStatusList(RABU, record, JADWAL_TETAP)).toEqual(["normal"]);
  });

  it("telat DAN curang di hari yang sama -> keduanya muncul (bukan cuma salah satu)", () => {
    const record = {
      jam_masuk_aktual: `${RABU}T09:00:00+07:00`,
      jam_pulang_aktual: `${RABU}T15:00:00+07:00`,
    };
    expect(computeDayStatusList(RABU, record, JADWAL_TETAP)).toEqual(["telat", "curang"]);
  });
});

describe("computeDayStatus", () => {
  it("ambil status tunggal langsung", () => {
    const record = {
      jam_masuk_aktual: `${RABU}T07:55:00+07:00`,
      jam_pulang_aktual: `${RABU}T16:00:00+07:00`,
    };
    expect(computeDayStatus(RABU, record, JADWAL_TETAP)).toBe("normal");
  });

  it("kalau telat & curang sekaligus, curang (pulang) yang jadi status ringkasan", () => {
    const record = {
      jam_masuk_aktual: `${RABU}T09:00:00+07:00`,
      jam_pulang_aktual: `${RABU}T15:00:00+07:00`,
    };
    expect(computeDayStatus(RABU, record, JADWAL_TETAP)).toBe("curang");
  });
});

describe("combineSesiStatuses", () => {
  it("kedua sesi sama & bukan status per-sesi -> digabung tanpa label sesi", () => {
    expect(combineSesiStatuses(["libur"], ["libur"])).toEqual([{ sesi: 1, status: "libur" }]);
  });

  it("sesi lain masih 'belum_absen' (belum waktunya) TIDAK menutupi sesi yang sudah normal", () => {
    // Bug asli: Sesi 1 sudah Normal, tapi Sesi 2 (jamnya belum lewat)
    // menyurfacekan "Belum Absen" dan menutupi status Sesi 1.
    expect(combineSesiStatuses(["normal"], ["belum_absen"])).toEqual([
      { sesi: 1, status: "normal" },
    ]);
  });

  it("status per-sesi (telat/curang/dll) tetap disurfacekan dgn label sesi masing-masing", () => {
    expect(combineSesiStatuses(["telat"], ["curang"])).toEqual([
      { sesi: 1, status: "telat" },
      { sesi: 2, status: "curang" },
    ]);
  });

  it("alpa TETAP disurfacekan walau sesi lain cuma belum_absen (beda dari belum_absen)", () => {
    expect(combineSesiStatuses(["alpa"], ["belum_absen"])).toEqual([
      { sesi: 1, status: "alpa" },
    ]);
  });

  it("kedua sesi sama-sama belum_absen -> diteruskan apa adanya (bukan di-normal-kan)", () => {
    // Sama seperti kasus "libur"/"libur" di atas -- status hari-level yang
    // IDENTIK di kedua sesi diteruskan langsung tanpa label sesi, karena
    // memang belum ada satu pun sesi yang punya catatan.
    expect(combineSesiStatuses(["belum_absen"], ["belum_absen"])).toEqual([
      { sesi: 1, status: "belum_absen" },
    ]);
  });
});

describe("formatSesiStatusLabel", () => {
  it("status per-sesi -> ada sufiks (Sesi N)", () => {
    expect(formatSesiStatusLabel({ sesi: 2, status: "telat" })).toBe("Terlambat (Sesi 2)");
  });

  it("status hari-level -> tanpa sufiks sesi", () => {
    expect(formatSesiStatusLabel({ sesi: 2, status: "libur" })).toBe("Libur");
  });
});

describe("formatJamWIB", () => {
  it("null -> tanda strip", () => {
    expect(formatJamWIB(null)).toBe("—");
  });

  it("mengonversi ke WIB, bukan menampilkan jam UTC mentah", () => {
    // 02:00 UTC = 09:00 WIB (UTC+7).
    expect(formatJamWIB("2026-08-12T02:00:00Z")).toBe("09.00");
  });
});
