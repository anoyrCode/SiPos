"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateID } from "@/lib/format";
import { JENIS_LABEL, JENIS_VARIANT, type JenisCatatan } from "@/lib/catatan-harian";

export type KabarItem = {
  id: string;
  tanggal: string;
  jenis: JenisCatatan;
  isi: string;
  penulis: string | null;
};

const PER_PAGE = 5;

export function CatatanHarianList({ items }: { items: KabarItem[] }) {
  const [page, setPage] = useState(1);

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Belum ada kabar harian untuk ananda.
      </p>
    );
  }

  const totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PER_PAGE;
  const pageItems = items.slice(start, start + PER_PAGE);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {pageItems.map((k) => (
          <div
            key={k.id}
            className="rounded-xl border border-border/70 bg-card p-3 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={JENIS_VARIANT[k.jenis]}>{JENIS_LABEL[k.jenis]}</Badge>
              <span className="text-xs text-muted-foreground">
                {formatDateID(k.tanggal)}
              </span>
            </div>
            <p className="mt-1.5 text-sm">{k.isi}</p>
            {k.penulis && (
              <p className="mt-1 text-xs text-muted-foreground">— {k.penulis}</p>
            )}
          </div>
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
