"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    <div className="flex items-center gap-2">
      <Input
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-40 text-xs"
        aria-label="Filter bulan riwayat poin"
      />
      {value && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
          Semua Bulan
        </Button>
      )}
    </div>
  );
}
