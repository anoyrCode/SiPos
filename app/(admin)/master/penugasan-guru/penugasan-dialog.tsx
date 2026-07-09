"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, School } from "lucide-react";

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
import { cn } from "@/lib/utils";
import { getPenugasan, setPenugasan, type Shift } from "./actions";

type KelasOpt = { id: string; label: string };

const SHIFTS: Shift[] = [1, 2, 3];

export function PenugasanDialog({
  pegawaiId,
  pegawaiNama,
  kelasOptions,
  count,
}: {
  pegawaiId: string;
  pegawaiNama: string;
  kelasOptions: KelasOpt[];
  count: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shift, setShift] = useState<Shift | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onOpenChange(o: boolean) {
    setOpen(o);
    setError(null);
    if (o) {
      setLoading(true);
      const penugasan = await getPenugasan(pegawaiId);
      setSelected(new Set(penugasan.kelasIds));
      setShift(penugasan.shift);
      setLoading(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSave() {
    setError(null);
    startTransition(async () => {
      const res = await setPenugasan(pegawaiId, [...selected], shift);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      toast.success("Penugasan guru berhasil disimpan.");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <School data-icon="inline-start" />
          {count > 0 ? `${count} kelas` : "Atur kelas"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="-mx-6 -mt-6 border-b px-6 pb-4 pt-6">
          <DialogTitle>Penugasan Kelas</DialogTitle>
          <DialogDescription>{pegawaiNama}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">Shift</p>
            <div className="flex gap-2">
              {SHIFTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setShift((prev) => (prev === s ? null : s))}
                  aria-pressed={shift === s}
                  disabled={loading}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                    shift === s
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  Shift {s}
                </button>
              ))}
            </div>
          </div>

          <div className="-mx-2 max-h-[50vh] overflow-y-auto px-2 py-1 scrollbar-thin">
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Memuat…
              </p>
            ) : kelasOptions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Belum ada kelas di tahun ajaran aktif.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {kelasOptions.map((k) => {
                  const on = selected.has(k.id);
                  return (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => toggle(k.id)}
                      aria-pressed={on}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                        on
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {on && <Check className="size-3.5" />}
                      {k.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter className="-mx-6 -mb-6 border-t bg-muted/20 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="button" onClick={onSave} disabled={pending || loading}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
