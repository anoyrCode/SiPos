"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { searchSantri } from "./actions";
import type { SantriHit } from "./schema";

export function SantriMultiPicker({
  value,
  onChange,
}: {
  value: SantriHit[];
  onChange: (v: SantriHit[]) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SantriHit[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      startTransition(async () => {
        setResults(await searchSantri(q));
      });
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selectedIds = new Set(value.map((s) => s.id));
  const filtered = results.filter((r) => !selectedIds.has(r.id));

  return (
    <div ref={boxRef} className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((s) => (
            <Badge key={s.id} variant="primary" className="gap-1 pr-1">
              {s.nama}
              {s.kelas ? ` · ${s.kelas}` : ""}
              <button
                type="button"
                aria-label={`Hapus ${s.nama}`}
                onClick={() => onChange(value.filter((x) => x.id !== s.id))}
                className="rounded-full p-0.5 hover:bg-foreground/10"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="relative">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Cari santri (NIS / nama)…"
        />
        {open && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-xl">
            {pending && (
              <p className="p-2 text-xs text-muted-foreground">Mencari…</p>
            )}
            {!pending && filtered.length === 0 && (
              <p className="p-2 text-xs text-muted-foreground">
                {q ? "Tidak ada hasil." : "Ketik untuk mencari santri."}
              </p>
            )}
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onChange([...value, s]);
                  setQ("");
                }}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <span>
                  {s.nama}
                  {s.kelas && (
                    <span className="text-muted-foreground"> · {s.kelas}</span>
                  )}
                </span>
                {s.nis && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {s.nis}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
