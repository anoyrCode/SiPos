import { CalendarDays } from "lucide-react";

import { formatDateID } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

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

export function KehadiranList({ items }: { items: KehadiranItem[] }) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Belum ada catatan kehadiran tahun ini.
      </p>
    );
  }

  return (
    <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
      {items.map((k) => (
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
  );
}
