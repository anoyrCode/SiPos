import { Badge } from "@/components/ui/badge";
import { formatDateID } from "@/lib/format";

export type RiwayatItem = {
  id: string;
  tipe: "POSITIF" | "NEGATIF";
  nilai_poin: number;
  tanggal_kejadian: string;
  catatan: string | null;
  nama_poin: string | null;
};

export function RiwayatList({ items }: { items: RiwayatItem[] }) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Belum ada catatan poin.
      </p>
    );
  }

  return (
    <div className="max-h-60 space-y-1 overflow-y-auto pr-1 scrollbar-thin">
      {items.map((t) => {
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
  );
}
