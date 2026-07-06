"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DateFilter({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(v: string) {
    const p = new URLSearchParams(searchParams);
    if (v) p.set("tanggal", v);
    else p.delete("tanggal");
    router.replace(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="space-y-1">
      <Label htmlFor="tanggal" className="text-xs">
        Tanggal
      </Label>
      <Input
        id="tanggal"
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-44"
      />
    </div>
  );
}
