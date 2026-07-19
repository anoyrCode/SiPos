"use client";

import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateID } from "@/lib/format";

export type RiwayatPoinItem = {
  id: string;
  tipe: "POSITIF" | "NEGATIF";
  nilai_poin: number;
  tanggal_kejadian: string;
  catatan: string | null;
  nama_poin: string | null;
};

const PER_PAGE = 5;

export function RiwayatPoinList({ items }: { items: RiwayatPoinItem[] }) {
  const [page, setPage] = useState(1);

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Belum ada catatan poin.
        </CardContent>
      </Card>
    );
  }

  const totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PER_PAGE;
  const pageItems = items.slice(start, start + PER_PAGE);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {pageItems.map((t) => (
          <Card key={t.id}>
            <CardContent className="flex items-center justify-between gap-4 py-3.5">
              <div className="min-w-0">
                <p className="truncate font-medium">{t.nama_poin ?? "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateID(t.tanggal_kejadian)}
                  {t.catatan ? ` · ${t.catatan}` : ""}
                </p>
              </div>
              <Badge
                variant={t.tipe === "POSITIF" ? "positive" : "negative"}
                className="shrink-0 font-mono"
              >
                {t.tipe === "POSITIF" ? "+" : "−"}
                {t.nilai_poin}
              </Badge>
            </CardContent>
          </Card>
        ))}
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
