"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { searchSantri } from "./actions";
import type { SantriHit } from "./schema";

export function SantriPicker({
  value,
  onChange,
}: {
  value: SantriHit | null;
  onChange: (v: SantriHit | null) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SantriHit[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      startTransition(async () => setResults(await searchSantri(q)));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
        <span>
          {value.nama}
          {value.nis ? (
            <span className="text-muted-foreground"> · {value.nis}</span>
          ) : null}
        </span>
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={() => onChange(null)}
        >
          Ganti
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
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
          {!pending && results.length === 0 && (
            <p className="p-2 text-xs text-muted-foreground">
              {q ? "Tidak ada hasil." : "Ketik untuk mencari santri."}
            </p>
          )}
          {results.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onChange(s);
                setQ("");
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <span>{s.nama}</span>
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
  );
}
