"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PENGAJUAN_STATUS_LABEL, type PengajuanStatus } from "@/lib/absensi-status";

const OPTIONS: PengajuanStatus[] = ["menunggu", "disetujui", "ditolak"];

export function PengajuanStatusFilter({ value }: { value: PengajuanStatus }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(v: string) {
    const p = new URLSearchParams(searchParams);
    p.set("pstatus", v);
    router.replace(`${pathname}?${p.toString()}`);
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((status) => (
          <SelectItem key={status} value={status}>
            {PENGAJUAN_STATUS_LABEL[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
