"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from "@/lib/list-params";

export function Pagination({
  page,
  perPage = DEFAULT_PER_PAGE,
  totalPages,
  totalItems,
  pageParam = "page",
  perPageParam = "perPage",
}: {
  page: number;
  perPage?: number;
  totalPages: number;
  totalItems: number;
  /** Nama query param halaman — beda-beda kalau 1 halaman punya >1 tabel independen. */
  pageParam?: string;
  /** Nama query param jumlah baris — pasangan dari `pageParam`. */
  perPageParam?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goTo(p: number) {
    const params = new URLSearchParams(searchParams);
    params.set(pageParam, String(p));
    router.replace(`${pathname}?${params.toString()}`);
  }

  function onPerPageChange(value: string) {
    const params = new URLSearchParams(searchParams);
    params.set(perPageParam, value);
    params.set(pageParam, "1");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {totalItems === 0
            ? "Tidak ada data"
            : `Halaman ${page} dari ${totalPages} · ${totalItems} data`}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground">Baris:</span>
          <Select value={String(perPage)} onValueChange={onPerPageChange}>
            <SelectTrigger className="h-8 w-18">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PER_PAGE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft data-icon="inline-start" />
          Sebelumnya
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goTo(page + 1)}
          disabled={page >= totalPages}
        >
          Berikutnya
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}
