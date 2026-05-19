import * as React from "react";
import type { LucideIcon } from "lucide-react";

export function PageHeader({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 items-center gap-3.5">
        {Icon && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary to-[#00b4d8] text-primary-foreground shadow-lg shadow-primary/25 ring-1 ring-white/15">
            <Icon className="size-5" />
          </span>
        )}
        <div className="min-w-0 space-y-0.5">
          <h1 className="truncate font-heading text-xl font-bold tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="truncate text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {children && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}
