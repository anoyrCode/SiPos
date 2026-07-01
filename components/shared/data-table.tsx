import * as React from "react";
import { Inbox, SearchX } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headClassName?: string;
};

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  empty = "Belum ada data.",
  emptyHint,
  isFiltered = false,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  empty?: React.ReactNode;
  emptyHint?: React.ReactNode;
  isFiltered?: boolean;
}) {
  const emptyIcon = isFiltered ? SearchX : Inbox;
  const EmptyIcon = emptyIcon;
  const emptyMessage = isFiltered
    ? "Tidak ada hasil yang cocok"
    : empty;
  const emptySubtext = isFiltered
    ? "Coba kata kunci atau filter yang berbeda."
    : emptyHint;

  return (
    <div className="overflow-hidden rounded-card border border-border/70 bg-card shadow-[0_1px_2px_rgba(16,23,41,0.04),0_14px_30px_-18px_rgba(16,23,41,0.14)]">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => (
              <TableHead key={c.key} className={c.headClassName}>
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="h-44">
                <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                    <EmptyIcon className="size-5 text-muted-foreground/70" />
                  </span>
                  <div className="space-y-1 text-center">
                    <p className="text-sm font-medium text-foreground/80">{emptyMessage}</p>
                    {emptySubtext && (
                      <p className="text-xs text-muted-foreground">{emptySubtext}</p>
                    )}
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={getRowId(row)}>
                {columns.map((c) => (
                  <TableCell key={c.key} className={cn(c.className)}>
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
