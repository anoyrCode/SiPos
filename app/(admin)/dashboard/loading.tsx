import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function CardSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2">
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          <Skeleton className="h-5 w-10 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="space-y-4 p-4 md:space-y-6 md:p-8">
      {/* Hero skeleton */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#00b4d8] to-[#036985] p-4 sm:rounded-3xl sm:p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-20 bg-white/30" />
            <Skeleton className="h-6 w-48 bg-white/30" />
            <Skeleton className="h-3.5 w-36 bg-white/30" />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl bg-white/12 px-3 py-2.5 ring-1 ring-white/15 sm:px-4 sm:py-3"
              >
                <Skeleton className="h-3 w-16 bg-white/30" />
                <Skeleton className="mt-2 h-7 w-12 bg-white/30" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Perkembangan + Donut */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <CardSkeleton>
          <Skeleton className="h-48 w-full rounded-xl sm:h-64" />
        </CardSkeleton>
        <CardSkeleton>
          <div className="space-y-3">
            <Skeleton className="mx-auto h-44 w-44 rounded-full" />
            <div className="flex justify-center gap-4">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          </div>
        </CardSkeleton>
      </div>

      {/* Peringkat positif + Perlu perhatian + Peringkat kelas */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <CardSkeleton>
          <ListSkeleton rows={5} />
        </CardSkeleton>
        <CardSkeleton>
          <ListSkeleton rows={5} />
        </CardSkeleton>
        <CardSkeleton>
          <ListSkeleton rows={5} />
        </CardSkeleton>
      </div>

      {/* Statistik + Aktivitas */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <CardSkeleton>
          <div className="space-y-3">
            <div className="flex gap-1">
              <Skeleton className="h-7 w-16 rounded-md" />
              <Skeleton className="h-7 w-16 rounded-md" />
            </div>
            <Skeleton className="h-48 w-full rounded-xl sm:h-64" />
          </div>
        </CardSkeleton>
        <CardSkeleton>
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4 border-b py-2 last:border-0"
              >
                <div className="min-w-0 space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-5 w-10 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </CardSkeleton>
      </div>
    </div>
  );
}
