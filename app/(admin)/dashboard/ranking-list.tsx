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

  const MEDALS = [
    "bg-amber-100 text-amber-600",
    "bg-slate-100 text-slate-500",
    "bg-orange-100 text-orange-700",
  ];

  const chipClass = (idx: number) => {
    if (variant === "positive" && idx < 3) return MEDALS[idx];
    if (idx < 3)
      return variant === "positive"
        ? "bg-positive-soft text-positive"
        : "bg-negative-soft text-negative";
    return "bg-muted text-muted-foreground";
  };

  return (
    <ol className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
      {items.map((it, idx) => (
        <li key={it.id}>
          <Link
            href={`/santri/${it.id}`}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted",
              variant === "positive" && "hover:border-l-2 hover:border-l-primary hover:pl-[6px]",
            )}
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                chipClass(idx),
              )}
            >
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{it.nama}</p>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", barColor)}
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
