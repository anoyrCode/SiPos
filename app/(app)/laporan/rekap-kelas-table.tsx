"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileSpreadsheet, FileText } from "lucide-react";

import { DataTable, type Column } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { downloadExcel } from "@/lib/export";
import { downloadPdfRekapKelas } from "@/lib/pdf";
import { parseClientPageParams, paginateArray } from "@/lib/list-params";

export type RekapKelasRow = {
  key: string;
  nama: string;
  count: number;
  pos: number;
  neg: number;
  net: number;
};

export function RekapKelasTable({
  rows,
  taLabel = "export",
}: {
  rows: RekapKelasRow[];
  taLabel?: string;
}) {
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");
  const [loadingPdf, setLoadingPdf] = useState(false);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => r.nama.toLowerCase().includes(t)) : rows;
  }, [q, rows]);

  const { page, perPage } = parseClientPageParams(searchParams);
  const paged = paginateArray(filtered, page, perPage);

  function handleExcelExport() {
    const data = filtered.map((r) => ({
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
      await downloadPdfRekapKelas(filtered, taLabel);
    } finally {
      setLoadingPdf(false);
    }
  }

  const columns: Column<RekapKelasRow>[] = [
    {
      key: "nama",
      header: "Kelas",
      cell: (r) => <span className="font-medium">{r.nama}</span>,
    },
    {
      key: "count",
      header: "Jml Santri",
      cell: (r) => <span className="tabular-nums text-muted-foreground">{r.count}</span>,
    },
    {
      key: "pos",
      header: "Positif",
      cell: (r) => <span className="font-mono tabular-nums text-positive">+{r.pos}</span>,
    },
    {
      key: "neg",
      header: "Negatif",
      cell: (r) => <span className="font-mono tabular-nums text-negative">−{r.neg}</span>,
    },
    {
      key: "net",
      header: "Net",
      cell: (r) => (
        <Badge variant={r.net >= 0 ? "positive" : "negative"} className="font-mono">
          {r.net > 0 ? "+" : ""}
          {r.net}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-64">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari kelas…"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={handleExcelExport} disabled={filtered.length === 0}>
            <FileSpreadsheet data-icon="inline-start" />
            Excel
          </Button>
          <Button variant="secondary" size="sm" onClick={handlePdfExport} disabled={filtered.length === 0 || loadingPdf}>
            <FileText data-icon="inline-start" />
            {loadingPdf ? "Memproses…" : "PDF"}
          </Button>
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={paged.rows}
        getRowId={(r) => r.key}
        isFiltered={q.trim().length > 0}
        empty="Belum ada data."
      />
      <Pagination
        page={paged.page}
        perPage={perPage}
        totalPages={paged.totalPages}
        totalItems={paged.totalItems}
      />
    </div>
  );
}
