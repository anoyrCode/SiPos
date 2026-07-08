"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_LABEL, type AbsensiStatus } from "@/lib/absensi-status";

const STATUS_OPTIONS = Object.entries(STATUS_LABEL) as [AbsensiStatus, string][];

export function StatusFilter({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(v: string) {
    const p = new URLSearchParams(searchParams);
    if (v === "semua") p.delete("status");
    else p.set("status", v);
    router.replace(`${pathname}?${p.toString()}`);
  }

  return (
    <Select value={value || "semua"} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-48">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="semua">Semua Status</SelectItem>
        {STATUS_OPTIONS.map(([key, label]) => (
          <SelectItem key={key} value={key}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
