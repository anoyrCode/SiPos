import { Clock, type LucideIcon } from "lucide-react";

export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="animate-enter flex min-h-[70vh] items-center justify-center overflow-hidden p-4 md:p-8">
      <div className="relative flex max-w-sm flex-col items-center gap-4 text-center">
        {/* Lingkaran ambient lembut — gema tipis dari hero brand, sengaja
            dijaga tunggal & redup supaya halaman kosong ini tidak terasa
            "mati", tanpa jadi hero penuh (gradient+blur+shimmer) yang
            pernah dianggap terlalu templated di halaman lain. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-6 left-1/2 size-40 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl motion-safe:animate-[float_7s_ease-in-out_infinite]"
        />
        <span className="relative flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-[#00b4d8] text-primary-foreground shadow-lg shadow-primary/25 ring-1 ring-white/15">
          <Icon className="size-7" />
        </span>
        <div className="relative space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[0.7rem] font-semibold text-amber-600 dark:text-amber-400">
            <Clock className="size-3" />
            Segera Hadir
          </span>
          <h1 className="font-heading text-xl font-bold tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
