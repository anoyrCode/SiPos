"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

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
import { cn } from "@/lib/utils";
import { JENIS_LABEL, JENIS_URUT, type JenisCatatan } from "@/lib/catatan-harian";
import { ubahCatatanAdmin } from "./actions";

export function EditCatatanDialog({
  id,
  santriNama,
  tanggalAwal,
  jenisAwal,
  isiAwal,
  hariIni,
}: {
  id: string;
  santriNama: string;
  tanggalAwal: string;
  jenisAwal: JenisCatatan;
  isiAwal: string;
  /** "YYYY-MM-DD" WIB dari server — batas atas pemilih tanggal. */
  hariIni: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tanggal, setTanggal] = useState(tanggalAwal);
  const [jenis, setJenis] = useState<JenisCatatan>(jenisAwal);
  const [isi, setIsi] = useState(isiAwal);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSimpan() {
    setError(null);
    if (!isi.trim()) {
      setError("Isi catatan tidak boleh kosong.");
      return;
    }
    setPending(true);
    const res = await ubahCatatanAdmin(id, tanggal, jenis, isi);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success("Catatan diperbarui.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          // Dikembalikan ke nilai baris, bukan dikosongkan — dialog ini
          // menyunting data yang sudah ada.
          setTanggal(tanggalAwal);
          setJenis(jenisAwal);
          setIsi(isiAwal);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Ubah catatan">
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Ubah Catatan</DialogTitle>
          <DialogDescription className="text-sm">
            {santriNama} — perubahan tercatat dan terlihat wali.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Jenis">
            <div className="flex gap-2">
              {JENIS_URUT.map((j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setJenis(j)}
                  className={cn(
                    "h-10 flex-1 rounded-lg border text-sm font-medium transition-colors",
                    jenis === j
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/70 text-muted-foreground hover:bg-accent/60",
                  )}
                >
                  {JENIS_LABEL[j]}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Tanggal" htmlFor={`edit-tanggal-${id}`}>
            <Input
              id={`edit-tanggal-${id}`}
              type="date"
              max={hariIni}
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
            />
          </Field>

          <Field label="Catatan" htmlFor={`edit-isi-${id}`} error={error ?? undefined}>
            <Textarea
              id={`edit-isi-${id}`}
              value={isi}
              onChange={(e) => setIsi(e.target.value)}
              className="min-h-32 text-sm"
            />
          </Field>

          <Button
            type="button"
            onClick={onSimpan}
            disabled={pending}
            className="h-11 w-full"
          >
            {pending ? "Menyimpan…" : "Simpan Perubahan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
