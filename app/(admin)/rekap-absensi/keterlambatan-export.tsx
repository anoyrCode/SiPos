"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { downloadExcelMultiSheet } from "@/lib/export";
import { formatDateID } from "@/lib/format";
import { formatJamWIB } from "@/lib/absensi-status";

type TelatMasukRow = {
  pegawaiId: string;
  nama: string;
  tanggal: string;
  sesi: 1 | 2;
  menitTelat: number;
};

type TelatKeluarRow = {
  pegawaiId: string;
  nama: string;
  tanggal: string;
  sesi: 1 | 2;
};

type CurangRow = {
  pegawaiId: string;
  nama: string;
  tanggal: string;
  sesi: 1 | 2;
  jamPulangJadwal: string | null;
  jamPulangAktual: string | null;
  menitLebihAwal: number;
};

export function KeterlambatanExport({
  dari,
  sampai,
  telatMasuk,
  telatKeluar,
  curang,
}: {
  dari: string;
  sampai: string;
  telatMasuk: TelatMasukRow[];
  telatKeluar: TelatKeluarRow[];
  curang: CurangRow[];
}) {
  function handleExport() {
    downloadExcelMultiSheet(`keterlambatan-${dari}_${sampai}.xlsx`, [
      {
        sheetName: "Terlambat Clock In",
        rows: telatMasuk.map((r) => ({
          Pegawai: r.nama,
          Sesi: r.sesi,
          Tanggal: formatDateID(r.tanggal),
          "Terlambat (menit)": r.menitTelat,
        })),
        colWidths: [28, 8, 14, 12],
      },
      {
        sheetName: "Terlambat Clock Out",
        rows: telatKeluar.map((r) => ({
          Pegawai: r.nama,
          Sesi: r.sesi,
          Tanggal: formatDateID(r.tanggal),
        })),
        colWidths: [28, 8, 14],
      },
      {
        sheetName: "Pulang Sebelum Waktunya",
        rows: curang.map((r) => ({
          Pegawai: r.nama,
          Sesi: r.sesi,
          Tanggal: formatDateID(r.tanggal),
          "Jadwal Pulang": r.jamPulangJadwal ?? "—",
          "Jam Clock Out": formatJamWIB(r.jamPulangAktual),
          "Menit Lebih Awal": r.menitLebihAwal,
        })),
        colWidths: [28, 8, 14, 14, 14, 14],
      },
    ]);
  }

  return (
    <Button size="sm" variant="outline" onClick={handleExport}>
      <Download data-icon="inline-start" />
      Excel
    </Button>
  );
}
