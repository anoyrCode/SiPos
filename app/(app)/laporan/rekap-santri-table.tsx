"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FileSpreadsheet, FileText } from "lucide-react";

import { DataTable, type Column } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadExcel } from "@/lib/export";
import { downloadPdfRekapSantri } from "@/lib/pdf";
import { parseClientPageParams, paginateArray } from "@/lib/list-params";

export type RekapSantriRow = {
  id: string;
  nama: string;
  kelas: string | null;
  pos: number;
  neg: number;
  net: number;
};

export function RekapSantriTable({
  rows,
  taLabel = "export",
}: {
  rows: RekapSantriRow[];
  taLabel?: string;
}) {
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");
  const [kelasFilter, setKelasFilter] = useState("semua");
  const [loadingPdf, setLoadingPdf] = useState(false);

  const kelasOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.kelas).filter((k): k is string => !!k))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [rows],
  );

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => {
      const matchNama = t ? r.nama.toLowerCase().includes(t) : true;
      const matchKelas = kelasFilter === "semua" ? true : r.kelas === kelasFilter;
      return matchNama && matchKelas;
    });
  }, [q, kelasFilter, rows]);

  const { page, perPage } = parseClientPageParams(searchParams);
  const paged = paginateArray(filtered, page, perPage);

  function handleExcelExport() {
    const data = filtered.map((r, i) => ({
      No: i + 1,
      "Nama Santri": r.nama,
      Kelas: r.kelas ?? "—",
      "Poin Positif": r.pos,
      "Poin Negatif": r.neg,
      "Net Skor": r.net,
      Status: r.net >= 0 ? "Baik" : "Perlu Perhatian",
    }));
    downloadExcel(`rekap-santri-${taLabel}.xlsx`, "Rekap Santri", data, [6, 28, 22, 14, 14, 12, 18]);
  }

  async function handlePdfExport() {
    setLoadingPdf(true);
    try {
      await downloadPdfRekapSantri(filtered, taLabel);
    } finally {
      setLoadingPdf(false);
    }
  }

  const columns: Column<RekapSantriRow>[] = [
    {
      key: "nama",
      header: "Santri",
      cell: (r) => (
        <Link
          href={`/santri/${r.id}`}
          className="font-medium text-primary hover:underline"
        >
          {r.nama}
        </Link>
      ),
    },
    {
      key: "kelas",
      header: "Kelas",
      cell: (r) => (
        <span className="text-muted-foreground">{r.kelas ?? "—"}</span>
      ),
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari santri…"
            />
          </div>
          <Select value={kelasFilter} onValueChange={setKelasFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Kelas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Kelas</SelectItem>
              {kelasOptions.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        getRowId={(r) => r.id}
        isFiltered={q.trim().length > 0 || kelasFilter !== "semua"}
        empty="Belum ada data poin pada tahun ajaran ini."
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
