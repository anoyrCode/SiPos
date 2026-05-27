"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type Option = { value: string; label: string };

export function DistribusiSelectors({
  tahunAjaran,
  kelas,
  taId,
  kelasId,
}: {
  tahunAjaran: Option[];
  kelas: Option[];
  taId: string;
  kelasId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setTa(v: string) {
    const p = new URLSearchParams(searchParams);
    p.set("ta", v);
    p.delete("kelas");
    router.replace(`${pathname}?${p.toString()}`);
  }

  function setKelas(v: string) {
    const p = new URLSearchParams(searchParams);
    if (taId) p.set("ta", taId);
    p.set("kelas", v);
    router.replace(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:max-w-xl">
      <div className="space-y-1.5">
        <Label>Tahun Ajaran</Label>
        <Select value={taId || undefined} onValueChange={setTa}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih tahun ajaran" />
          </SelectTrigger>
          <SelectContent>
            {tahunAjaran.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Kelas</Label>
        <Select
          value={kelasId || undefined}
          onValueChange={setKelas}
          disabled={kelas.length === 0}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={kelas.length === 0 ? "Belum ada kelas" : "Pilih kelas"}
            />
          </SelectTrigger>
          <SelectContent>
            {kelas.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
