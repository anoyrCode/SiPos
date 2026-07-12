"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Plus, Trash2 } from "lucide-react";

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
import { Field } from "@/components/shared/field";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDateID } from "@/lib/format";
import { addLiburKhusus, deleteLiburKhusus } from "./actions";

export type LiburKhususRow = { tanggal: string; keterangan: string };

export function LiburKhususDialog({ initial }: { initial: LiburKhususRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalSelesai, setTanggalSelesai] = useState("");
  const [keterangan, setKeterangan] = useState("");

  async function onAdd() {
    setError(null);
    if (!tanggalMulai || !keterangan.trim()) {
      setError("Tanggal dan keterangan wajib diisi.");
      return;
    }
    setPending(true);
    const res = await addLiburKhusus(
      tanggalMulai,
      tanggalSelesai || tanggalMulai,
      keterangan,
    );
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setTanggalMulai("");
    setTanggalSelesai("");
    setKeterangan("");
    toast.success("Hari libur khusus ditambahkan.");
    router.refresh();
  }

  const sorted = [...initial].sort((a, b) => (a.tanggal < b.tanggal ? -1 : 1));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full sm:w-auto">
          <CalendarDays data-icon="inline-start" />
          Hari Libur Khusus
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Hari Libur Khusus Pondok</DialogTitle>
          <DialogDescription>
            Tanggal di daftar ini otomatis dikecualikan dari Alpa/Telat untuk
            semua pegawai (mis. libur nasional, libur semester, acara pondok).
            Bisa pilih rentang tanggal sekaligus.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Dari Tanggal" htmlFor="libur-tanggal-mulai">
            <Input
              id="libur-tanggal-mulai"
              type="date"
              value={tanggalMulai}
              onChange={(e) => setTanggalMulai(e.target.value)}
            />
          </Field>
          <Field label="Sampai Tanggal (opsional)" htmlFor="libur-tanggal-selesai">
            <Input
              id="libur-tanggal-selesai"
              type="date"
              min={tanggalMulai || undefined}
              value={tanggalSelesai}
              onChange={(e) => setTanggalSelesai(e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Keterangan" htmlFor="libur-keterangan">
            <Input
              id="libur-keterangan"
              placeholder="mis. Libur Semester Ganjil"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
            />
          </Field>
          <Button type="button" onClick={onAdd} disabled={pending}>
            <Plus data-icon="inline-start" />
            Tambah
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
          {sorted.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada hari libur khusus.
            </p>
          ) : (
            sorted.map((l) => (
              <div
                key={l.tanggal}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{formatDateID(l.tanggal)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.keterangan}
                  </p>
                </div>
                <ConfirmDialog
                  action={deleteLiburKhusus}
                  id={l.tanggal}
                  title="Hapus hari libur khusus?"
                  description={`"${l.keterangan}" (${formatDateID(l.tanggal)}) akan dihapus.`}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label="Hapus">
                      <Trash2 />
                    </Button>
                  }
                />
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
