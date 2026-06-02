"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TaFilter({
  options,
  value,
}: {
  options: { value: string; label: string }[];
  value: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(v: string) {
    const p = new URLSearchParams(searchParams);
    p.set("ta", v);
    router.replace(`${pathname}?${p.toString()}`);
  }

  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-56">
        <SelectValue placeholder="Tahun ajaran" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
