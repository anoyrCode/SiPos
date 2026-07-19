import { cn } from "@/lib/utils";
import type { SantriProgress } from "@/lib/santri-status";

export function SantriProgressBar({
  progress,
  onHero = false,
  className,
}: {
  progress: SantriProgress;
  onHero?: boolean;
  className?: string;
}) {
  if (progress.kind === "message") {
    return (
      <p
        className={cn(
          "text-xs",
          onHero ? "text-white/80" : "text-muted-foreground",
          className,
        )}
      >
        {progress.text}
      </p>
    );
  }
  return (
    <div className={cn("space-y-1", className)}>
      <p className={cn("text-xs", onHero ? "text-white/80" : "text-muted-foreground")}>
        {progress.pointsNeeded} poin lagi menuju {progress.nextLevelLabel}
      </p>
      <div
        className={cn(
          "h-1.5 w-full overflow-hidden rounded-full",
          onHero ? "bg-white/20" : "bg-muted",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            onHero ? "bg-white" : "bg-chart-pos",
          )}
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  );
}
