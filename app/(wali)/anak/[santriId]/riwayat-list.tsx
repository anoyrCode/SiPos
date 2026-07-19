"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateID } from "@/lib/format";

export type RiwayatItem = {
  id: string;
  tipe: "POSITIF" | "NEGATIF";
  nilai_poin: number;
  tanggal_kejadian: string;
  catatan: string | null;
  nama_poin: string | null;
};

const PER_PAGE = 5;

export function RiwayatList({ items }: { items: RiwayatItem[] }) {
  const [page, setPage] = useState(1);

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Belum ada catatan poin.
      </p>
    );
  }

  const totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PER_PAGE;
  const pageItems = items.slice(start, start + PER_PAGE);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {pageItems.map((t) => {
          const isPos = t.tipe === "POSITIF";
          return (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-lg border-l-2 px-3 py-2 transition-colors hover:bg-muted/50"
              style={{
                borderColor: isPos ? "var(--chart-pos)" : "var(--chart-neg)",
              }}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium leading-tight">
                  {t.nama_poin ?? "—"}
                </p>
                <p className="truncate text-[0.7rem] text-muted-foreground">
                  {formatDateID(t.tanggal_kejadian)}
                  {t.catatan ? ` · ${t.catatan}` : ""}
                </p>
              </div>
              <Badge
                variant={isPos ? "positive" : "negative"}
                className="shrink-0 font-mono text-[0.7rem]"
              >
                {isPos ? "+" : "−"}
                {t.nilai_poin}
              </Badge>
            </div>
          );
        })}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Halaman {currentPage} dari {totalPages}
          </p>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Sebelumnya
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
