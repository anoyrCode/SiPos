"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addSantriToKelas } from "./actions";

type SantriOpt = { id: string; nis: string | null; nama: string };

export function AddSantri({
  kelasId,
  available,
}: {
  kelasId: string;
  available: SantriOpt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return available;
    return available.filter(
      (s) =>
        s.nama.toLowerCase().includes(term) ||
        (s.nis ?? "").toLowerCase().includes(term),
    );
  }, [q, available]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reset() {
    setQ("");
    setSelected(new Set());
    setError(null);
  }

  function onSubmit() {
    if (selected.size === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await addSantriToKelas(kelasId, Array.from(selected));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus data-icon="inline-start" />
          Tambah Santri
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Santri ke Kelas</DialogTitle>
          <DialogDescription>
            Hanya santri aktif yang belum punya kelas di tahun ajaran ini.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Cari nama atau NIS…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-1">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {available.length === 0
                ? "Semua santri aktif sudah punya kelas. Tambah santri baru di Master → Santri, atau keluarkan dari kelas lain dulu."
                : "Tidak ada santri yang cocok dengan pencarian."}
            </p>
          ) : (
            filtered.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  className="size-4 accent-primary"
                />
                <span className="flex-1 text-sm">{s.nama}</span>
                {s.nis && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {s.nis}
                  </span>
                )}
              </label>
            ))
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Batal
          </Button>
          <Button onClick={onSubmit} disabled={pending || selected.size === 0}>
            {pending ? "Menyimpan…" : `Tambah ${selected.size} santri`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
