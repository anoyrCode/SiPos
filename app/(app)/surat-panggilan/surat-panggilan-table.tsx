"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";

import { DataTable, type Column } from "@/components/shared/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orDash } from "@/lib/format";
import { downloadSuratPanggilan, type PelanggaranItem } from "@/lib/pdf";

const SP_LEVELS = [
  { level: 1, ambang: 300 },
  { level: 2, ambang: 600 },
  { level: 3, ambang: 900 },
];

function spLevelFor(totalNegatif: number) {
  let level: number | null = null;
  for (const sp of SP_LEVELS) {
    if (totalNegatif >= sp.ambang) level = sp.level;
  }
  return level;
}

export type SuratPanggilanRow = {
  id: string;
  nama: string;
  nis: string | null;
  kelas: string | null;
  namaWali: string | null;
  noTelpWali: string | null;
  totalNegatif: number;
  pelanggaran: PelanggaranItem[];
};

export function SuratPanggilanTable({
  rows,
  taLabel,
}: {
  rows: SuratPanggilanRow[];
  taLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [sp, setSp] = useState(() => {
    const fromUrl = Number(searchParams.get("sp"));
    return SP_LEVELS.some((l) => l.level === fromUrl) ? fromUrl : 1;
  });
  const ambang = SP_LEVELS.find((l) => l.level === sp)?.ambang ?? 300;
  const [q, setQ] = useState("");
  const [printingId, setPrintingId] = useState<string | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (sp !== 1) params.set("sp", String(sp));
      else params.delete("sp");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows
      .filter((r) => r.totalNegatif >= ambang)
      .filter((r) => (t ? r.nama.toLowerCase().includes(t) : true));
  }, [rows, ambang, q]);

  async function handlePrint(row: SuratPanggilanRow) {
    setPrintingId(row.id);
    try {
      await downloadSuratPanggilan({
        santri: { nama: row.nama, nis: row.nis, kelas: row.kelas },
        wali: { nama: row.namaWali, noTelp: row.noTelpWali },
        pelanggaran: row.pelanggaran,
        totalNegatif: row.totalNegatif,
        ambangBatas: ambang,
        taLabel,
      });
    } finally {
      setPrintingId(null);
    }
  }

  const columns: Column<SuratPanggilanRow>[] = [
    {
      key: "nama",
      header: "Santri",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.nama}</p>
          <p className="text-xs text-muted-foreground">{orDash(r.nis)}</p>
        </div>
      ),
    },
    {
      key: "kelas",
      header: "Kelas",
      cell: (r) => <span className="text-muted-foreground">{orDash(r.kelas)}</span>,
    },
    {
      key: "wali",
      header: "Wali",
      cell: (r) => (
        <div>
          <p>{orDash(r.namaWali)}</p>
          <p className="text-xs text-muted-foreground">{orDash(r.noTelpWali)}</p>
        </div>
      ),
    },
    {
      key: "total",
      header: "Poin Negatif",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Badge variant="negative" className="font-mono">
            −{r.totalNegatif}
          </Badge>
          {spLevelFor(r.totalNegatif) && (
            <Badge variant="outline">SP {spLevelFor(r.totalNegatif)}</Badge>
          )}
        </div>
      ),
    },
    {
      key: "aksi",
      header: "",
      cell: (r) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => handlePrint(r)}
          disabled={printingId === r.id}
        >
          <FileText data-icon="inline-start" />
          {printingId === r.id ? "Memproses…" : "Cetak Surat"}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-card border border-border/70 bg-card p-3 shadow-sm">
        <div className="space-y-1">
          <Label htmlFor="ambang" className="text-xs">
            Ambang batas poin negatif
          </Label>
          <Select
            value={String(sp)}
            onValueChange={(v) => setSp(Number(v))}
          >
            <SelectTrigger id="ambang" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SP_LEVELS.map((l) => (
                <SelectItem key={l.level} value={String(l.level)}>
                  SP {l.level} (≥ {l.ambang} poin)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-48 flex-1 space-y-1">
          <Label htmlFor="q" className="text-xs">
            Cari santri
          </Label>
          <Input
            id="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama santri…"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        getRowId={(r) => r.id}
        isFiltered={q.trim().length > 0}
        empty={`Tidak ada santri dengan poin negatif ≥ ${ambang} pada tahun ajaran ini.`}
      />
    </div>
  );
}
