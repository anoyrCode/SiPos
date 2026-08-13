"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NotebookPen, Pencil, Trash2, X } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/field";
import { tambahCatatan, ubahCatatan, hapusCatatan } from "./catatan-actions";

export type CatatanItem = { id: string; jam: string; isi: string };

export function CatatanDialog({
  kelasId,
  kelasNama,
  jamSekarang,
  catatan,
}: {
  kelasId: string;
  kelasNama: string;
  /**
   * Jam WIB "HH:MM" dihitung di server — jangan hitung di klien, zona waktu
   * perangkat pengguna bisa berbeda dan memicu hydration mismatch.
   */
  jamSekarang: string;
  catatan: CatatanItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [jam, setJam] = useState(jamSekarang);
  const [isi, setIsi] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setEditId(null);
    setJam(jamSekarang);
    setIsi("");
    setError(null);
  }

  async function onSimpan() {
    setError(null);
    if (!isi.trim()) {
      setError("Isi catatan tidak boleh kosong.");
      return;
    }
    setPending(true);
    const res = editId
      ? await ubahCatatan(editId, jam, isi)
      : await tambahCatatan(kelasId, jam, isi);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success(editId ? "Catatan diperbarui." : "Catatan ditambahkan.");
    reset();
    router.refresh();
  }

  async function onHapus(id: string) {
    setPending(true);
    const res = await hapusCatatan(id);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Catatan dihapus.");
    if (editId === id) reset();
    router.refresh();
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
        <Button type="button" variant="outline" className="h-11 flex-1">
          <NotebookPen className="size-4" />
          Catatan ({catatan.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Catatan Pengawasan</DialogTitle>
          <DialogDescription className="text-sm">
            {kelasNama} — catatan kejadian selama shift Anda hari ini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {catatan.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Belum ada catatan.
            </p>
          ) : (
            catatan.map((c) => (
              <div
                key={c.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-border/70 p-2.5"
              >
                <div className="min-w-0">
                  <span className="font-mono text-xs text-muted-foreground">
                    {c.jam.slice(0, 5)}
                  </span>
                  <p className="text-sm">{c.isi}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    onClick={() => {
                      setEditId(c.id);
                      setJam(c.jam.slice(0, 5));
                      setIsi(c.isi);
                      setError(null);
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    onClick={() => onHapus(c.id)}
                  >
                    <Trash2 className="size-3.5 text-negative" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3 border-t border-border/50 pt-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {editId ? "Ubah Catatan" : "Tambah Catatan"}
            </p>
            {editId && (
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                <X className="size-3.5" />
                Batal
              </Button>
            )}
          </div>
          <Field label="Jam" htmlFor="catatan-jam">
            <Input
              id="catatan-jam"
              type="time"
              value={jam}
              onChange={(e) => setJam(e.target.value)}
            />
          </Field>
          <Field label="Catatan" htmlFor="catatan-isi" error={error ?? undefined}>
            <Textarea
              id="catatan-isi"
              value={isi}
              onChange={(e) => setIsi(e.target.value)}
              placeholder="mis. Santri ramai di kelas saat kajian"
              className="min-h-20 text-sm"
            />
          </Field>
          <Button
            type="button"
            onClick={onSimpan}
            disabled={pending}
            className="h-11 w-full"
          >
            {pending ? "Menyimpan…" : editId ? "Simpan Perubahan" : "Tambah Catatan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
