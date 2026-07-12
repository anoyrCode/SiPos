"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function JabatanFilter({
  value,
  options,
}: {
  value: string;
  options: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(v: string) {
    const p = new URLSearchParams(searchParams);
    if (v === "semua") p.delete("jabatan");
    else p.set("jabatan", v);
    router.replace(`${pathname}?${p.toString()}`);
  }

  return (
    <Select value={value || "semua"} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-52">
        <SelectValue placeholder="Jabatan" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="semua">Semua Jabatan</SelectItem>
        {options.map((j) => (
          <SelectItem key={j} value={j}>
            {j}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
