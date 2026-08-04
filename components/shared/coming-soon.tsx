import { Construction } from "lucide-react";

export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4 md:p-8">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted">
          <Construction className="size-6 text-muted-foreground/70" />
        </span>
        <div className="space-y-1.5">
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
