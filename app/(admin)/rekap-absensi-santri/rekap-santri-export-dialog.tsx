"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet } from "lucide-react";

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
import { Field } from "@/components/shared/field";
import { downloadExcelMultiSheet } from "@/lib/export";
import { getRekapSantriRentang } from "./actions";

export function RekapSantriExportDialog({
  jk,
  defaultDari,
  defaultSampai,
}: {
  jk: string;
  defaultDari: string;
  defaultSampai: string;
}) {
  const [open, setOpen] = useState(false);
  const [dari, setDari] = useState(defaultDari);
  const [sampai, setSampai] = useState(defaultSampai);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onExport() {
    setError(null);
    if (!dari || !sampai) {
      setError("Tanggal Dari dan Sampai wajib diisi.");
      return;
    }
    if (sampai < dari) {
      setError("Tanggal Sampai tidak boleh lebih awal dari tanggal Dari.");
      return;
    }
    setPending(true);
    const res = await getRekapSantriRentang(dari, sampai, jk);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await downloadExcelMultiSheet(res.filename, res.sheets);
    setOpen(false);
    toast.success(`Rekap ${res.sheets.length} kelas berhasil diunduh.`);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full sm:w-auto">
          <FileSpreadsheet data-icon="inline-start" />
          Export Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Rekap Absensi Santri</DialogTitle>
          <DialogDescription>
            Satu sheet per kelas, berisi jumlah hari izin/sakit/alpa tiap santri.
            Maksimal 62 hari sekali unduh. Mengikuti filter jenis kelamin yang
            sedang aktif di halaman.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Dari Tanggal" htmlFor="export-dari" required>
            <Input
              id="export-dari"
              type="date"
              value={dari}
              onChange={(e) => setDari(e.target.value)}
            />
          </Field>
          <Field label="Sampai Tanggal" htmlFor="export-sampai" required>
            <Input
              id="export-sampai"
              type="date"
              value={sampai}
              onChange={(e) => setSampai(e.target.value)}
            />
          </Field>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Batal
          </Button>
          <Button type="button" onClick={onExport} disabled={pending}>
            {pending ? "Menyiapkan…" : "Unduh"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
