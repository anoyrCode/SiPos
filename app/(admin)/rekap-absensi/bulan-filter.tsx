"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BulanFilter({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(v: string) {
    const p = new URLSearchParams(searchParams);
    if (v) p.set("bulan", v);
    else p.delete("bulan");
    router.replace(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="space-y-1">
      <Label htmlFor="bulan" className="text-xs">
        Bulan
      </Label>
      <Input
        id="bulan"
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-44"
      />
    </div>
  );
}
