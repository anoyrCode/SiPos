"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadExcel } from "@/lib/export";
import { downloadPdfRekapKelas } from "@/lib/pdf";

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
  const [loadingPdf, setLoadingPdf] = useState(false);

  function handleExcelExport() {
    const data = rows.map((r) => ({
      Kelas: r.nama,
      "Jumlah Santri": r.count,
      "Poin Positif": r.pos,
      "Poin Negatif": r.neg,
      "Net Skor": r.net,
    }));
    downloadExcel(`rekap-kelas-${taLabel}.xlsx`, "Rekap Kelas", data, [28, 16, 14, 14, 12]);
  }

  async function handlePdfExport() {
    setLoadingPdf(true);
    try {
      await downloadPdfRekapKelas(rows, taLabel);
    } finally {
      setLoadingPdf(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button variant="secondary" size="sm" onClick={handleExcelExport} disabled={rows.length === 0}>
        <FileSpreadsheet data-icon="inline-start" />
        Excel
      </Button>
      <Button variant="secondary" size="sm" onClick={handlePdfExport} disabled={rows.length === 0 || loadingPdf}>
        <FileText data-icon="inline-start" />
        {loadingPdf ? "Memproses…" : "PDF"}
      </Button>
    </div>
  );
}
