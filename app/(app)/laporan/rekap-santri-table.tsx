"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";

import { DataTable, type Column } from "@/components/shared/data-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { downloadExcel } from "@/lib/export";

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
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => r.nama.toLowerCase().includes(t)) : rows;
  }, [q, rows]);

  function handleExport() {
    const data = filtered.map((r, i) => ({
      No: i + 1,
      "Nama Santri": r.nama,
      Kelas: r.kelas ?? "—",
      "Poin Positif": r.pos,
      "Poin Negatif": r.neg,
      "Net Skor": r.net,
      Status: r.net >= 0 ? "Baik" : "Perlu Perhatian",
    }));
    downloadExcel(
      `rekap-santri-${taLabel}.xlsx`,
      "Rekap Santri",
      data,
      [6, 28, 22, 14, 14, 12, 18],
    );
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
        <div className="relative w-full sm:w-64">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari santri…"
          />
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
          <Download data-icon="inline-start" />
          Unduh Excel
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={filtered}
        getRowId={(r) => r.id}
        empty="Belum ada data poin pada tahun ajaran ini."
      />
    </div>
  );
}
