"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PoinOpt } from "./schema";

export function PoinMultiPicker({
  options,
  value,
  onChange,
  tipe,
}: {
  options: PoinOpt[];
  value: string[];
  onChange: (v: string[]) => void;
  tipe: "POSITIF" | "NEGATIF";
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selectedSet = new Set(value);
  const selected = options.filter((p) => selectedSet.has(p.id));

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return options.filter((p) => {
      if (selectedSet.has(p.id)) return false;
      if (!t) return true;
      return (
        p.nama_poin.toLowerCase().includes(t) ||
        p.kode_poin.toLowerCase().includes(t)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, options, value]);

  const isPos = tipe === "POSITIF";

  function toggle(id: string) {
    if (selectedSet.has(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  }

  return (
    <div ref={boxRef} className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((p) => (
            <Badge
              key={p.id}
              variant={isPos ? "positive" : "negative"}
              className="gap-1 pr-1 font-medium"
            >
              {p.nama_poin}
              <span className="font-mono opacity-70">
                ({isPos ? "+" : "−"}
                {p.nilai_poin})
              </span>
              <button
                type="button"
                aria-label={`Hapus ${p.nama_poin}`}
                onClick={() => onChange(value.filter((x) => x !== p.id))}
                className="rounded-full p-0.5 hover:bg-foreground/10"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="relative">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={
              options.length ? "Cari poin (kode / nama)…" : "Belum ada poin aktif"
            }
            disabled={options.length === 0}
            className={cn(
              "flex h-9 w-full items-center rounded-lg border border-border bg-background py-1 pl-9 pr-9 text-sm shadow-xs outline-none transition-colors",
              "placeholder:text-muted-foreground hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />
          <ChevronDown
            className={cn(
              "pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60 transition-transform",
              open && "rotate-180",
            )}
          />
        </div>

        {open && options.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-xl">
            {filtered.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">
                {q ? "Tidak ada hasil." : "Semua poin sudah dipilih."}
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="truncate">
                    <span className="font-mono text-xs text-muted-foreground">
                      {p.kode_poin}
                    </span>{" "}
                    · {p.nama_poin}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-xs font-semibold",
                      isPos ? "text-positive" : "text-negative",
                    )}
                  >
                    {isPos ? "+" : "−"}
                    {p.nilai_poin}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
