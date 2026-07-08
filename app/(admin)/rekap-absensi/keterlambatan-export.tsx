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
  menitTelat: number;
};

type TelatKeluarRow = {
  pegawaiId: string;
  nama: string;
  tanggal: string;
};

type CurangRow = {
  pegawaiId: string;
  nama: string;
  tanggal: string;
  jamPulangJadwal: string | null;
  jamPulangAktual: string | null;
  menitLebihAwal: number;
};

export function KeterlambatanExport({
  bulan,
  telatMasuk,
  telatKeluar,
  curang,
}: {
  bulan: string;
  telatMasuk: TelatMasukRow[];
  telatKeluar: TelatKeluarRow[];
  curang: CurangRow[];
}) {
  function handleExport() {
    downloadExcelMultiSheet(`keterlambatan-${bulan}.xlsx`, [
      {
        sheetName: "Telat Clock In",
        rows: telatMasuk.map((r) => ({
          Pegawai: r.nama,
          Tanggal: formatDateID(r.tanggal),
          "Telat (menit)": r.menitTelat,
        })),
        colWidths: [28, 14, 12],
      },
      {
        sheetName: "Telat Clock Out",
        rows: telatKeluar.map((r) => ({
          Pegawai: r.nama,
          Tanggal: formatDateID(r.tanggal),
        })),
        colWidths: [28, 14],
      },
      {
        sheetName: "Curang",
        rows: curang.map((r) => ({
          Pegawai: r.nama,
          Tanggal: formatDateID(r.tanggal),
          "Jadwal Pulang": r.jamPulangJadwal ?? "—",
          "Jam Clock Out": formatJamWIB(r.jamPulangAktual),
          "Menit Lebih Awal": r.menitLebihAwal,
        })),
        colWidths: [28, 14, 14, 14, 14],
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
