import * as React from "react";
import { Inbox } from "lucide-react";

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
}: {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  empty?: React.ReactNode;
}) {
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
              <TableCell colSpan={columns.length} className="h-40">
                <div className="flex flex-col items-center justify-center gap-2.5 text-muted-foreground">
                  <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                    <Inbox className="size-5 text-muted-foreground/70" />
                  </span>
                  <span className="text-sm">{empty}</span>
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
