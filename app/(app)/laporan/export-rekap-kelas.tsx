"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadExcel } from "@/lib/export";

type KelasRekapRow = {
  key: string;
  nama: string;
  count: number;
  pos: number;
  neg: number;
  net: number;
};

export function ExportRekapKelas({
  rows,
  taLabel,
}: {
  rows: KelasRekapRow[];
  taLabel: string;
}) {
  function handleExport() {
    const data = rows.map((r) => ({
      Kelas: r.nama,
      "Jumlah Santri": r.count,
      "Poin Positif": r.pos,
      "Poin Negatif": r.neg,
      "Net Skor": r.net,
    }));
    downloadExcel(
      `rekap-kelas-${taLabel}.xlsx`,
      "Rekap Kelas",
      data,
      [28, 16, 14, 14, 12],
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleExport}
      disabled={rows.length === 0}
    >
      <Download data-icon="inline-start" />
      Unduh Excel
    </Button>
  );
}
