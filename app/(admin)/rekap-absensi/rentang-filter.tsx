"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RentangFilter({ dari, sampai }: { dari: string; sampai: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(key: "dari" | "sampai", v: string) {
    const p = new URLSearchParams(searchParams);
    if (v) p.set(key, v);
    else p.delete(key);
    router.replace(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="dari" className="text-xs">
          Dari Tanggal
        </Label>
        <Input
          id="dari"
          type="date"
          value={dari}
          max={sampai || undefined}
          onChange={(e) => onChange("dari", e.target.value)}
          className="w-44"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="sampai" className="text-xs">
          Sampai Tanggal
        </Label>
        <Input
          id="sampai"
          type="date"
          value={sampai}
          min={dari || undefined}
          onChange={(e) => onChange("sampai", e.target.value)}
          className="w-44"
        />
      </div>
    </div>
  );
}
