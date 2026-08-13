"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Copy, FileText } from "lucide-react";

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
    // Label tetap menyebut aksinya, bukan penolakannya — alasannya ditulis
    // sebagai keterangan di bawah tombol oleh pemanggil, supaya tombol tidak
    // berubah bentuk hanya karena daftar jamnya panjang.
    return (
      <Button
        type="button"
        variant="outline"
        className="h-10 flex-1"
        disabled
        title={`Belum bisa: ${jamBelumDiisi.join(", ")} belum diisi`}
      >
        <FileText className="size-4" />
        Buat BAP
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
        <Button type="button" variant="outline" className="h-10 flex-1">
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
            {/* Yang dibaca lebih dulu oleh pembaca berita acara adalah
                PROPORSI kehadiran, bukan tiga bilangan terpisah — karena itu
                satu panel dengan perbandingan dan bilah, bukan tiga kotak
                angka berbobot sama. Warna semantik yang membawa maknanya:
                hijau hadir, merah tidak hadir. */}
            <div className="rounded-card border border-border/70 bg-muted/30 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-mono text-3xl font-bold tabular-nums text-positive">
                    {hasil.data.jumlahSantri}
                  </span>{" "}
                  dari{" "}
                  <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                    {hasil.data.seharusnya}
                  </span>{" "}
                  santri hadir
                </p>
                {hasil.data.tidakHadir > 0 && (
                  <Badge variant="negative">
                    {hasil.data.tidakHadir} tidak hadir
                  </Badge>
                )}
              </div>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-negative-soft">
                <div
                  className="bg-positive transition-[width] duration-500"
                  style={{
                    width:
                      hasil.data.seharusnya > 0
                        ? `${(hasil.data.jumlahSantri / hasil.data.seharusnya) * 100}%`
                        : "0%",
                  }}
                />
              </div>
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Yakni</h3>
              {hasil.data.yakni.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-positive">
                  <CheckCircle2 className="size-4 shrink-0" />
                  Seluruh santri hadir di semua jam pengecekan.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {hasil.data.yakni.map((s) => (
                    <li
                      key={s.santriId}
                      className="flex items-start justify-between gap-2 rounded-lg border border-border/70 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{s.nama}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {s.jamList.join(" · ")}
                        </p>
                        {s.catatan && (
                          <p className="mt-0.5 text-xs italic text-muted-foreground">
                            {s.catatan}
                          </p>
                        )}
                      </div>
                      <Badge variant={STATUS_VARIANT[s.status]} className="shrink-0">
                        {STATUS_LABEL[s.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Catatan selama pengawasan</h3>
              {hasil.catatan.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada catatan kejadian.</p>
              ) : (
                <ul className="space-y-1.5">
                  {hasil.catatan.map((c, i) => (
                    <li key={i} className="flex gap-2.5 text-sm">
                      <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                        {c.jam.slice(0, 5)}
                      </span>
                      <span className="min-w-0">{c.isi}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Cakupan pengawasan ikut tercetak di PDF, jadi tetap ditampilkan
                supaya isinya tidak mengejutkan saat diunduh — tapi sebagai
                catatan kaki, bukan section tersendiri. Sebagai deretan chip,
                tujuh jam pengecekan memakan dua baris dan terbaca lebih
                penting daripada Yakni di atasnya. */}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Jam pengecekan:{" "}
              <span className="font-mono">{hasil.jamPengecekan.join(", ")}</span>
            </p>

            <div className="flex flex-col gap-2 border-t border-border/50 pt-4 sm:flex-row">
              <Button type="button" onClick={onUnduhPdf} className="h-11 flex-1">
                <FileText className="size-4" />
                Unduh PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onSalin}
                className="h-11 flex-1"
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
