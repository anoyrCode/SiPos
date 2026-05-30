"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addSantriToWali,
  getWaliAnak,
  removeSantriFromWali,
  searchSantriForWali,
} from "./actions";

type Anak = {
  id: string;
  santri: { id: string; nis: string | null; nama: string } | null;
};
type SantriOpt = { id: string; nis: string | null; nama: string };

export function WaliAnakDialog({
  waliId,
  count,
}: {
  waliId: string;
  count: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [anak, setAnak] = useState<Anak[] | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SantriOpt[]>([]);
  const [pending, startTransition] = useTransition();

  async function load() {
    setAnak(await getWaliAnak(waliId));
  }

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      startTransition(async () => setResults(await searchSantriForWali(q)));
    }, 300);
    return () => clearTimeout(t);
  }, [q, open]);

  const linkedIds = new Set((anak ?? []).map((a) => a.santri?.id));
  const filtered = results.filter((r) => !linkedIds.has(r.id));

  function add(id: string) {
    startTransition(async () => {
      await addSantriToWali(waliId, [id]);
      await load();
      router.refresh();
    });
  }

  function remove(wsId: string) {
    startTransition(async () => {
      await removeSantriFromWali(wsId);
      await load();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) load();
        else {
          setAnak(null);
          setQ("");
          setResults([]);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users data-icon="inline-start" />
          Anak ({count})
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anak Terhubung</DialogTitle>
          <DialogDescription>
            Atur santri yang terhubung ke akun wali ini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Terhubung
          </p>
          <div className="space-y-1 rounded-lg border p-1">
            {anak === null ? (
              <p className="p-2 text-xs text-muted-foreground">Memuat…</p>
            ) : anak.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">
                Belum ada anak terhubung.
              </p>
            ) : (
              anak.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span>
                    {a.santri?.nama ?? "—"}
                    {a.santri?.nis && (
                      <span className="ml-1 font-mono text-xs text-muted-foreground">
                        {a.santri.nis}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    aria-label="Lepas"
                    disabled={pending}
                    onClick={() => remove(a.id)}
                    className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Tambah anak</p>
          <Input
            placeholder="Cari santri (NIS/nama)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="max-h-48 space-y-1 overflow-auto rounded-lg border p-1">
            {filtered.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">
                {q ? "Tidak ada hasil." : "Ketik untuk mencari."}
              </p>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={pending}
                  onClick={() => add(s.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <span>
                    {s.nama}
                    {s.nis && (
                      <span className="ml-1 font-mono text-xs text-muted-foreground">
                        {s.nis}
                      </span>
                    )}
                  </span>
                  <Plus className="size-3.5" />
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
