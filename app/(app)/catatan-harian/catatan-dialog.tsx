"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2, X } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/shared/field";
import { cn } from "@/lib/utils";
import {
  JENIS_LABEL,
  JENIS_URUT,
  JENIS_VARIANT,
  type JenisCatatan,
} from "@/lib/catatan-harian";
import { formatDateID } from "@/lib/format";
import {
  tambahCatatanHarian,
  ubahCatatanHarian,
  hapusCatatanHarian,
} from "./actions";

export type CatatanItem = {
  id: string;
  tanggal: string;
  jenis: JenisCatatan;
  isi: string;
  /** Ditulis oleh pengguna yang sedang login — penentu boleh/tidaknya diubah. */
  milikSaya: boolean;
};

export function CatatanDialog({
  santriId,
  santriNama,
  hariIni,
  catatan,
  trigger,
}: {
  santriId: string;
  santriNama: string;
  /**
   * "YYYY-MM-DD" WIB dari server — jangan hitung di klien, zona waktu
   * perangkat pengguna bisa berbeda dan memicu hydration mismatch.
   */
  hariIni: string;
  catatan: CatatanItem[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tanggal, setTanggal] = useState(hariIni);
  const [jenis, setJenis] = useState<JenisCatatan>("baik");
  const [isi, setIsi] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [konfirmasi, setKonfirmasi] = useState(false);

  function reset() {
    setEditId(null);
    setTanggal(hariIni);
    setJenis("baik");
    setIsi("");
    setError(null);
    setKonfirmasi(false);
  }

  /**
   * Catatan "Perlu Perhatian" ditahan satu lapis konfirmasi dulu — isinya
   * langsung terbaca orang tua, dan kabar buruk yang sampai tanpa konteks
   * bisa membuat mereka cemas. Jenis lain tersimpan langsung tanpa gangguan.
   */
  function onSimpanClick() {
    setError(null);
    if (!isi.trim()) {
      setError("Isi catatan tidak boleh kosong.");
      return;
    }
    if (jenis === "perhatian") {
      setKonfirmasi(true);
      return;
    }
    void simpanSekarang();
  }

  async function simpanSekarang() {
    setPending(true);
    const res = editId
      ? await ubahCatatanHarian(editId, tanggal, jenis, isi)
      : await tambahCatatanHarian(santriId, tanggal, jenis, isi);
    setPending(false);
    if (!res.ok) {
      // Konfirmasi ditutup supaya pesan errornya terlihat di form di baliknya.
      setKonfirmasi(false);
      setError(res.error);
      return;
    }
    toast.success(editId ? "Catatan diperbarui." : "Catatan ditambahkan.");
    reset();
    router.refresh();
  }

  async function onHapus(id: string) {
    setPending(true);
    const res = await hapusCatatanHarian(id);
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
    <>
      {/* Form disembunyikan selama konfirmasi tampil (bukan ditumpuk) — pola
          yang sama dengan konfirmasi berlapis di halaman Absensi. Isian tetap
          hidup di state React, jadi "Kembali" mengembalikannya utuh. */}
      <Dialog
        open={open && !konfirmasi}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Catatan Harian</DialogTitle>
            <DialogDescription className="text-sm">{santriNama}</DialogDescription>
          </DialogHeader>

          {catatan.length > 0 && (
            <div className="space-y-2">
              {catatan.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-border/70 p-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={JENIS_VARIANT[c.jenis]}>
                        {JENIS_LABEL[c.jenis]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateID(c.tanggal)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{c.isi}</p>
                  </div>
                  {c.milikSaya && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={pending}
                        onClick={() => {
                          setEditId(c.id);
                          setTanggal(c.tanggal);
                          setJenis(c.jenis);
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
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 border-t border-border/50 pt-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                {editId ? "Ubah Catatan" : "Tulis Catatan"}
              </p>
              {editId && (
                <Button type="button" variant="ghost" size="sm" onClick={reset}>
                  <X className="size-3.5" />
                  Batal
                </Button>
              )}
            </div>

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

            <Field label="Tanggal" htmlFor="catatan-tanggal">
              <Input
                id="catatan-tanggal"
                type="date"
                max={hariIni}
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
              />
            </Field>

            <Field label="Catatan" htmlFor="catatan-isi" error={error ?? undefined}>
              <Textarea
                id="catatan-isi"
                value={isi}
                onChange={(e) => setIsi(e.target.value)}
                placeholder="mis. Hafalannya bertambah 2 halaman pekan ini"
                className="min-h-24 text-sm"
              />
            </Field>

            <Button
              type="button"
              onClick={onSimpanClick}
              disabled={pending}
              className="h-11 w-full"
            >
              {pending ? "Menyimpan…" : editId ? "Simpan Perubahan" : "Simpan Catatan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={konfirmasi}
        onOpenChange={(o) => {
          if (!o) setKonfirmasi(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Catatan ini akan terbaca orang tua
            </DialogTitle>
            <DialogDescription className="text-sm">
              Catatan &quot;Perlu Perhatian&quot; tampil langsung di aplikasi wali
              santri. Sebaiknya dikoordinasikan dulu dengan kesantrian agar orang
              tua menerimanya dengan gambaran yang utuh, bukan sepenggal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setKonfirmasi(false)}
              disabled={pending}
            >
              Kembali
            </Button>
            <Button type="button" onClick={simpanSekarang} disabled={pending}>
              {pending ? "Menyimpan…" : "Ya, Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
