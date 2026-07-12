"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function JenisKelaminFilter({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(v: string) {
    const p = new URLSearchParams(searchParams);
    if (v === "semua") p.delete("jk");
    else p.set("jk", v);
    router.replace(`${pathname}?${p.toString()}`);
  }

  return (
    <Select value={value || "semua"} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-44">
        <SelectValue placeholder="Jenis Kelamin" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="semua">Semua Jenis Kelamin</SelectItem>
        <SelectItem value="L">Laki-laki</SelectItem>
        <SelectItem value="P">Perempuan</SelectItem>
      </SelectContent>
    </Select>
  );
}
