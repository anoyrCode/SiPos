"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";

import { DataTable, type Column } from "@/components/shared/data-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type RekapSantriRow = {
  id: string;
  nama: string;
  kelas: string | null;
  pos: number;
  neg: number;
  net: number;
};

export function RekapSantriTable({ rows }: { rows: RekapSantriRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => r.nama.toLowerCase().includes(t)) : rows;
  }, [q, rows]);

  function exportCsv() {
    const header = "Nama,Kelas,Positif,Negatif,Net";
    const lines = filtered.map(
      (r) =>
        `"${r.nama.replace(/"/g, '""')}","${r.kelas ?? ""}",${r.pos},${r.neg},${r.net}`,
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rekap-santri.csv";
    a.click();
    URL.revokeObjectURL(url);
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
        <Button variant="secondary" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download data-icon="inline-start" />
          Unduh CSV
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
