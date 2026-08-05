"use client";

import { useState } from "react";
import { Eye } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Exception = {
  status: "izin" | "sakit" | "alpa";
  catatan: string | null;
  santri: { nama: string } | null;
};

const STATUS_LABEL: Record<Exception["status"], string> = {
  izin: "Izin",
  sakit: "Sakit",
  alpa: "Alpa",
};
const STATUS_VARIANT: Record<Exception["status"], "warning" | "primary" | "negative"> = {
  izin: "warning",
  sakit: "primary",
  alpa: "negative",
};

export function RekapDetailDialog({
  title,
  exceptions,
}: {
  title: string;
  exceptions: Exception[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Lihat detail">
          <Eye />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {exceptions.map((e, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{e.santri?.nama ?? "—"}</p>
                {e.catatan && (
                  <p className="truncate text-xs text-muted-foreground">{e.catatan}</p>
                )}
              </div>
              <Badge variant={STATUS_VARIANT[e.status]} className="shrink-0">
                {STATUS_LABEL[e.status]}
              </Badge>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
