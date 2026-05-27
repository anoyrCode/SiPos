"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setWaliKelas } from "./actions";

type Option = { value: string; label: string };
const NONE = "__none";

export function WaliKelasSelect({
  kelasId,
  waliId,
  pegawai,
}: {
  kelasId: string;
  waliId: string | null;
  pegawai: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(v: string) {
    setError(null);
    startTransition(async () => {
      const res = await setWaliKelas(kelasId, v === NONE ? null : v);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-1.5">
      <Select
        value={waliId || NONE}
        onValueChange={onChange}
        disabled={pending}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Pilih wali kelas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>— Tidak ada —</SelectItem>
          {pegawai.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
