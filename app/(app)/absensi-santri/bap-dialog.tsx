"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, FileText } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBapWhatsApp, type BapStatus } from "@/lib/bap-absensi-santri";
import { downloadBapAbsensiSantri } from "@/lib/pdf";
import { getBapData, type BapResult } from "./bap-actions";

const STATUS_LABEL: Record<BapStatus, string> = {
  izin: "Izin",
  sakit: "Sakit",
  alpa: "Alpa",
};
const STATUS_VARIANT: Record<BapStatus, "warning" | "primary" | "negative"> = {
  izin: "warning",
  sakit: "primary",
  alpa: "negative",
};

export function BapDialog({
  kelasId,
  kelasNama,
  shift,
  tanggal,
  tanggalLabel,
  musyrif,
  jamBelumDiisi,
}: {
  kelasId: string;
  kelasNama: string;
  shift: number;
  tanggal: string;
  tanggalLabel: string;
  musyrif: string;
  /** Jam pengecekan yang belum diisi. Kosong = BAP boleh dibuat. */
  jamBelumDiisi: string[];
}) {
  const [open, setOpen] = useState(false);
  const [hasil, setHasil] = useState<BapResult | null>(null);
  const [pending, setPending] = useState(false);
  const terkunci = jamBelumDiisi.length > 0;

  async function muat() {
    setPending(true);
    const res = await getBapData(kelasId, shift, tanggal);
    setPending(false);
    setHasil(res);
  }

  async function onUnduhPdf() {
    if (!hasil?.ok) return;
    await downloadBapAbsensiSantri({
      kelas: kelasNama,
      shift,
      tanggalLabel,
      musyrif,
      jamPengecekan: hasil.jamPengecekan,
      data: hasil.data,
      catatan: hasil.catatan,
    });
  }

  async function onSalin() {
    if (!hasil?.ok) return;
    const teks = formatBapWhatsApp({
      kelas: kelasNama,
      shift,
      tanggalLabel,
      musyrif,
      data: hasil.data,
      catatan: hasil.catatan,
    });
    try {
      await navigator.clipboard.writeText(teks);
      toast.success("Teks BAP disalin.");
    } catch {
      // Clipboard API butuh konteks aman (HTTPS/localhost) dan bisa ditolak
      // browser lama. Jangan gagal diam-diam.
      toast.error("Gagal menyalin. Salin manual dari teks yang tampil.");
    }
  }

  if (terkunci) {
    return (
      <Button type="button" variant="outline" className="flex-1" disabled>
        <FileText className="size-4" />
        Belum bisa — {jamBelumDiisi.join(", ")} belum diisi
      </Button>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void muat();
        else setHasil(null);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="flex-1">
          <FileText className="size-4" />
          Buat BAP
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Berita Acara Pengawasan</DialogTitle>
          <DialogDescription className="text-sm">
            {kelasNama} · Shift {shift} · {tanggalLabel}
          </DialogDescription>
        </DialogHeader>

        {pending && (
          <p className="py-6 text-center text-sm text-muted-foreground">Memuat…</p>
        )}

        {!pending && hasil && !hasil.ok && (
          <p className="py-6 text-center text-sm text-negative">{hasil.error}</p>
        )}

        {!pending && hasil?.ok && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["Jumlah santri", hasil.data.jumlahSantri],
                  ["Seharusnya", hasil.data.seharusnya],
                  ["Tidak Hadir", hasil.data.tidakHadir],
                ] as [string, number][]
              ).map(([label, nilai]) => (
                <div
                  key={label}
                  className="rounded-lg border border-border/70 p-2.5 text-center"
                >
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold tabular-nums">{nilai}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-sm font-semibold">Yakni</p>
              {hasil.data.yakni.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Tidak ada santri yang tidak hadir.
                </p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {hasil.data.yakni.map((s) => (
                    <li key={s.santriId} className="flex items-center gap-2 text-sm">
                      <Badge variant={STATUS_VARIANT[s.status]}>
                        {STATUS_LABEL[s.status]}
                      </Badge>
                      <span className="min-w-0 truncate">{s.nama}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {s.jamList.join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="text-sm font-semibold">Catatan selama pengawasan</p>
              {hasil.catatan.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada catatan.</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {hasil.catatan.map((c, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-mono text-xs text-muted-foreground">
                        {c.jam.slice(0, 5)}
                      </span>{" "}
                      {c.isi}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" onClick={onUnduhPdf} className="flex-1">
                <FileText className="size-4" />
                Unduh PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onSalin}
                className="flex-1"
              >
                <Copy className="size-4" />
                Salin untuk WhatsApp
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
