"use client";

import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Pill,
  Stethoscope,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDateID } from "@/lib/format";

export type RekamItem = {
  id: string;
  tanggal: string;
  keluhan: string;
  tindakan: string | null;
  obat: string | null;
  catatan: string | null;
};

const PER_PAGE = 5;

export function RekamMedisList({ items }: { items: RekamItem[] }) {
  const [page, setPage] = useState(1);
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Belum ada catatan UKS.
      </p>
    );
  }
  const totalPages = Math.ceil(items.length / PER_PAGE);
  const current = Math.min(page, totalPages);
  const rows = items.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  return (
    <div className="space-y-3">
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-border/70 bg-card p-3 shadow-sm transition-colors hover:border-primary/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Stethoscope className="size-4" />
                </span>
                <p className="truncate text-sm font-semibold capitalize">
                  {r.keluhan}
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] text-muted-foreground">
                <CalendarDays className="size-3" />
                {formatDateID(r.tanggal)}
              </span>
            </div>
            {(r.tindakan || r.obat) && (
              <div className="mt-2 flex flex-wrap gap-1.5 pl-[2.625rem]">
                {r.tindakan && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[0.7rem]">
                    <ClipboardCheck className="size-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Tindakan:</span>
                    <span className="font-medium capitalize">{r.tindakan}</span>
                  </span>
                )}
                {r.obat && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[0.7rem]">
                    <Pill className="size-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Obat:</span>
                    <span className="font-medium capitalize">{r.obat}</span>
                  </span>
                )}
              </div>
            )}
            {r.catatan && (
              <p className="mt-1.5 pl-[2.625rem] text-xs italic text-muted-foreground">
                “{r.catatan}”
              </p>
            )}
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-xs text-muted-foreground">
            Hal {current} / {totalPages} · {items.length} catatan
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={current === 1}
              aria-label="Sebelumnya"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={current === totalPages}
              aria-label="Berikutnya"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
