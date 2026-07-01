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

  const MEDAL_CHIP = [
    "bg-amber-400 text-white shadow-sm",
    "bg-slate-400 text-white shadow-sm",
    "bg-orange-400 text-white shadow-sm",
  ];

  const MEDAL_BAR = [
    "bg-amber-400",
    "bg-slate-400",
    "bg-orange-400",
  ];

  const MEDAL_ROW_BG = [
    "bg-amber-50/60 dark:bg-amber-500/10",
    "bg-slate-100/60 dark:bg-slate-500/10",
    "bg-orange-50/60 dark:bg-orange-500/10",
  ];

  const chipClass = (idx: number) => {
    if (variant === "positive" && idx < 3) return MEDAL_CHIP[idx];
    if (idx < 3)
      return variant === "positive"
        ? "bg-positive-soft text-positive"
        : "bg-negative-soft text-negative";
    return "bg-muted text-muted-foreground";
  };

  return (
    <ol className="max-h-72 space-y-1 overflow-y-auto pr-1">
      {items.map((it, idx) => {
        const isMedal = variant === "positive" && idx < 3;
        return (
          <li key={it.id}>
            <Link
              href={`/santri/${it.id}`}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted",
                isMedal && MEDAL_ROW_BG[idx],
                isMedal && "hover:brightness-95 dark:hover:brightness-125",
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
                <p className={cn("truncate font-medium", isMedal ? "text-sm" : "text-sm text-muted-foreground")}>
                  {it.nama}
                </p>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isMedal ? MEDAL_BAR[idx] : barColor,
                    )}
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
        );
      })}
    </ol>
  );
}
