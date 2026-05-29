"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, ChevronDown, X } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function fmt(iso: string): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function DateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const hasRange = Boolean(from || to);

  function set(key: "from" | "to", v: string) {
    const p = new URLSearchParams(searchParams);
    if (v) p.set(key, v);
    else p.delete(key);
    p.delete("page");
    router.replace(`${pathname}?${p.toString()}`);
  }

  function clear() {
    const p = new URLSearchParams(searchParams);
    p.delete("from");
    p.delete("to");
    p.delete("page");
    router.replace(`${pathname}?${p.toString()}`);
  }

  const label = hasRange
    ? `${fmt(from) ?? "Awal"} – ${fmt(to) ?? "Sekarang"}`
    : "Periode";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm shadow-xs outline-none transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            hasRange ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <CalendarRange className="size-4 shrink-0 text-muted-foreground" />
          <span className="whitespace-nowrap">{label}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Dari tanggal</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => set("from", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Sampai tanggal</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => set("to", e.target.value)}
          />
        </div>
        {hasRange && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={clear}
          >
            <X className="size-3.5" data-icon="inline-start" />
            Hapus filter tanggal
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
