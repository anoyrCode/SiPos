"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";

import { formatDateID } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type KehadiranItem = {
  id: string;
  tanggal: string;
  jam: string;
  status: "hadir" | "izin" | "sakit" | "alpa";
  catatan: string | null;
};

const STATUS_LABEL: Record<KehadiranItem["status"], string> = {
  hadir: "Hadir",
  izin: "Izin",
  sakit: "Sakit",
  alpa: "Alpa",
};
const STATUS_VARIANT: Record<
  KehadiranItem["status"],
  "positive" | "warning" | "primary" | "negative"
> = {
  hadir: "positive",
  izin: "warning",
  sakit: "primary",
  alpa: "negative",
};

const PER_PAGE = 5;

export function KehadiranList({ items }: { items: KehadiranItem[] }) {
  const [page, setPage] = useState(1);

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Belum ada catatan kehadiran 30 hari terakhir.
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
            className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-sm"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[k.status]}>{STATUS_LABEL[k.status]}</Badge>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="size-3" />
                  {formatDateID(k.tanggal)} · {k.jam.slice(0, 5)}
                </span>
              </div>
              {k.catatan && (
                <p className="mt-1.5 text-xs italic text-muted-foreground">
                  “{k.catatan}”
                </p>
              )}
            </div>
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
