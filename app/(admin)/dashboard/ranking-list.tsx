import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type RankItem = { id: string; nama: string; total: number };

export function RankingList({
  items,
  variant,
}: {
  items: RankItem[];
  variant: "positive" | "negative";
}) {
  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Belum ada data.
      </p>
    );
  }

  const max = Math.max(...items.map((i) => i.total), 1);
  const sign = variant === "positive" ? "+" : "−";
  const barColor = variant === "positive" ? "bg-chart-pos" : "bg-chart-neg";
  const topChip =
    variant === "positive"
      ? "bg-positive-soft text-positive"
      : "bg-negative-soft text-negative";

  return (
    <ol className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
      {items.map((it, idx) => (
        <li key={it.id}>
          <Link
            href={`/santri/${it.id}`}
            className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                idx < 3 ? topChip : "bg-muted text-muted-foreground",
              )}
            >
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{it.nama}</p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", barColor)}
                  style={{ width: `${Math.round((it.total / max) * 100)}%` }}
                />
              </div>
            </div>
            <Badge variant={variant} className="shrink-0 font-mono">
              {sign}
              {it.total}
            </Badge>
          </Link>
        </li>
      ))}
    </ol>
  );
}
