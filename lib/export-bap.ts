// Export Excel BERFORMAT khusus Rekap BAP.
//
// Berkas terpisah dari `lib/export.ts` yang memakai SheetJS (`xlsx`): build
// komunitas SheetJS tidak bisa menulis gaya sel sama sekali — tidak ada
// warna, tebal, bungkus teks, maupun baris beku. Tanpa bungkus teks, satu sel
// berisi belasan nama santri memanjang menabrak kolom sebelahnya, dan tanpa
// pembeda warna baris antar tanggal terbaca menyatu.
//
// ExcelJS dipakai HANYA di sini. Export lain (Rekap Absensi Santri, Laporan,
// Keterlambatan) tetap memakai `lib/export.ts` — semuanya sudah berjalan
// benar dan tidak ada alasan mengusiknya.
//
// Dimuat dinamis, sama seperti `xlsx` dan `jsPDF`, supaya tidak ikut
// ke-bundle ke JS halaman bagi pengguna yang tidak pernah menekan tombolnya.

const BRAND = "FF0092B7";
const PUTIH = "FFFFFFFF";
const BAND = "FFF1F5F9"; // selang-seling lembut antar blok tanggal
const GARIS = "FFE2E8F0";
const GARIS_PEMISAH = "FF94A3B8"; // batas tegas saat tanggal berganti
const MERAH = "FFE11D48";
const TEKS = "FF3D4A5C";
const REDUP = "FF64748B";

export type BapExcelMeta = {
  rentang: string;
  shift: string;
  jenisKelamin: string;
  dicetak: string;
};

export type BapExcelRow = {
  tanggal: string; // "YYYY-MM-DD"
  kelas: string;
  shift: number;
  musyrif: string;
  hadir: number;
  seharusnya: number;
  tidakHadir: number;
  namaTidakHadir: string;
  catatan: string;
  jamTerisi: number;
  jamTotal: number;
};

// Lebar sudah memperhitungkan panah filter otomatis yang menutupi ~3 karakter
// terakhir judul kolom — dengan lebar pas-pasan, "Kelengkapan" terbaca
// "Kelengkapar" dan "Hadir" terpotong.
const KOLOM: { judul: string; lebar: number; bungkus?: boolean }[] = [
  { judul: "Tanggal", lebar: 14 },
  { judul: "Kelas", lebar: 15 },
  { judul: "Shift", lebar: 8 },
  { judul: "Musyrif", lebar: 26 },
  { judul: "Hadir", lebar: 10 },
  { judul: "Seharusnya", lebar: 13 },
  { judul: "Tidak Hadir", lebar: 13 },
  { judul: "Santri Tidak Hadir", lebar: 58, bungkus: true },
  { judul: "Catatan Pengawasan", lebar: 52, bungkus: true },
  { judul: "Kelengkapan", lebar: 14 },
];

/** Tanggal ISO → objek Date berbasis UTC. */
function tanggalUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  // Dibangun lewat Date.UTC, bukan `new Date("...")`: konstruktor string
  // menafsirkannya sebagai waktu lokal, sedangkan ExcelJS menuliskan serial
  // tanggal berbasis UTC — selisihnya bisa menggeser tanggal satu hari.
  return new Date(Date.UTC(y, m - 1, d));
}

export async function downloadExcelBapRekap(
  filename: string,
  meta: BapExcelMeta,
  rows: BapExcelRow[],
) {
  const ExcelJS = (await import("exceljs")).default;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Rekap BAP");

  KOLOM.forEach((k, i) => {
    ws.getColumn(i + 1).width = k.lebar;
  });

  // --- Blok keterangan ---
  const judul = ws.addRow(["REKAP BERITA ACARA PENGAWASAN"]);
  judul.getCell(1).font = { bold: true, size: 14, color: { argb: BRAND } };

  for (const [label, nilai] of [
    ["Rentang", meta.rentang],
    ["Shift", meta.shift],
    ["Jenis Kelamin Kelas", meta.jenisKelamin],
    ["Dicetak", meta.dicetak],
  ]) {
    const r = ws.addRow([label, nilai]);
    r.getCell(1).font = { color: { argb: REDUP }, size: 10 };
    r.getCell(2).font = { bold: true, color: { argb: TEKS }, size: 10 };
  }
  ws.addRow([]);

  // --- Header tabel ---
  const barisHeader = ws.addRow(KOLOM.map((k) => k.judul));
  barisHeader.height = 22;
  barisHeader.eachCell((cell, col) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.font = { bold: true, color: { argb: PUTIH }, size: 10 };
    cell.alignment = {
      vertical: "middle",
      horizontal: col >= 5 && col <= 7 ? "center" : "left",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: BRAND } },
      bottom: { style: "thin", color: { argb: BRAND } },
      left: { style: "thin", color: { argb: PUTIH } },
      right: { style: "thin", color: { argb: PUTIH } },
    };
  });
  const nomorHeader = barisHeader.number;

  // Header dibekukan supaya tetap terlihat saat menggulir ribuan baris, dan
  // diberi filter otomatis supaya bisa disaring per kelas/shift langsung.
  //
  // Dua kolom pertama ikut dibekukan (`xSplit`): kolom Santri Tidak Hadir dan
  // Catatan Pengawasan lebar, jadi begitu digulir ke kanan pembaca kehilangan
  // jejak baris ini milik tanggal dan kelas mana.
  ws.views = [{ state: "frozen", xSplit: 2, ySplit: nomorHeader }];
  ws.autoFilter = {
    from: { row: nomorHeader, column: 1 },
    to: { row: nomorHeader, column: KOLOM.length },
  };

  // --- Isi ---
  let tanggalSebelumnya: string | null = null;
  let bandAktif = false;

  for (const r of rows) {
    const gantiTanggal = r.tanggal !== tanggalSebelumnya;
    if (gantiTanggal) {
      // Warna selang-seling berganti per TANGGAL, bukan per baris — supaya
      // satu tanggal terbaca sebagai satu blok utuh dan tidak menyatu dengan
      // tanggal berikutnya.
      bandAktif = !bandAktif;
      tanggalSebelumnya = r.tanggal;
    }

    const belumLengkap = r.jamTerisi < r.jamTotal;
    const baris = ws.addRow([
      tanggalUtc(r.tanggal),
      r.kelas,
      r.shift,
      r.musyrif,
      r.hadir,
      r.seharusnya,
      r.tidakHadir,
      r.namaTidakHadir,
      r.catatan,
      `${r.jamTerisi}/${r.jamTotal}`,
    ]);

    baris.eachCell((cell, col) => {
      const spek = KOLOM[col - 1];
      cell.font = { size: 10, color: { argb: TEKS } };
      cell.alignment = {
        vertical: "top",
        horizontal: col >= 3 && col <= 7 ? "center" : "left",
        wrapText: spek?.bungkus ?? false,
      };
      if (bandAktif) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BAND } };
      }
      cell.border = {
        top: gantiTanggal
          ? { style: "thin", color: { argb: GARIS_PEMISAH } }
          : { style: "hair", color: { argb: GARIS } },
        bottom: { style: "hair", color: { argb: GARIS } },
        left: { style: "hair", color: { argb: GARIS } },
        right: { style: "hair", color: { argb: GARIS } },
      };
    });

    baris.getCell(1).numFmt = "dd mmm yyyy";

    // Dua penanda yang paling dicari pembaca: ada yang tidak hadir, dan
    // absensinya belum lengkap.
    if (r.tidakHadir > 0) {
      baris.getCell(7).font = { size: 10, bold: true, color: { argb: MERAH } };
    }
    baris.getCell(10).font = {
      size: 10,
      bold: belumLengkap,
      color: { argb: belumLengkap ? MERAH : REDUP },
    };
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
