"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";

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
import { Field } from "@/components/shared/field";
import { SantriPicker } from "./santri-picker";
import { createRekam, updateRekam } from "./actions";
import type { RekamRow, SantriHit } from "./schema";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function RekamForm({ initial }: { initial?: RekamRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [santri, setSantri] = useState<SantriHit | null>(null);
  const [tanggal, setTanggal] = useState(initial?.tanggal ?? today());
  const [keluhan, setKeluhan] = useState(initial?.keluhan ?? "");
  const [tindakan, setTindakan] = useState(initial?.tindakan ?? "");
  const [obat, setObat] = useState(initial?.obat ?? "");
  const [catatan, setCatatan] = useState(initial?.catatan ?? "");

  function reset() {
    setError(null);
    setSantri(null);
    setTanggal(initial?.tanggal ?? today());
    setKeluhan(initial?.keluhan ?? "");
    setTindakan(initial?.tindakan ?? "");
    setObat(initial?.obat ?? "");
    setCatatan(initial?.catatan ?? "");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!initial && !santri) {
      setError("Pilih santri.");
      return;
    }
    setSubmitting(true);
    const payload = {
      santri_id: initial ? "ignored" : (santri?.id ?? ""),
      tanggal,
      keluhan,
      tindakan,
      obat,
      catatan,
    };
    const res = initial
      ? await updateRekam(initial.id, payload)
      : await createRekam(payload);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    reset();
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
        {initial ? (
          <Button variant="ghost" size="icon-sm" aria-label="Edit">
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus data-icon="inline-start" />
            Catat Kunjungan
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="-mx-6 -mt-6 border-b px-6 pb-4 pt-6">
          <DialogTitle>
            {initial ? "Edit Kunjungan UKS" : "Catat Kunjungan UKS"}
          </DialogTitle>
          <DialogDescription>
            {initial
              ? "Perbarui catatan kunjungan."
              : "Catat keluhan & penanganan santri di UKS."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="-mx-2 max-h-[58vh] space-y-4 overflow-y-auto px-2 py-1 scrollbar-thin">
            {initial ? (
              <Field label="Santri">
                <Input
                  value={initial.santri?.nama ?? "—"}
                  readOnly
                  className="bg-muted/50"
                />
              </Field>
            ) : (
              <Field label="Santri" required>
                <SantriPicker value={santri} onChange={setSantri} />
              </Field>
            )}
            <Field label="Tanggal" required className="sm:max-w-xs">
              <Input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
              />
            </Field>
            <Field label="Keluhan" required>
              <Textarea
                value={keluhan}
                onChange={(e) => setKeluhan(e.target.value)}
                placeholder="mis. Demam, pusing"
              />
            </Field>
            <Field label="Tindakan">
              <Textarea
                value={tindakan}
                onChange={(e) => setTindakan(e.target.value)}
                placeholder="Penanganan yang diberikan"
              />
            </Field>
            <Field label="Obat">
              <Input
                value={obat}
                onChange={(e) => setObat(e.target.value)}
                placeholder="Nama obat & dosis (opsional)"
              />
            </Field>
            <Field label="Catatan">
              <Textarea
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Opsional"
              />
            </Field>
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
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
