"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText } from "lucide-react";

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
import { cn } from "@/lib/utils";
import { formatDateID } from "@/lib/format";
import { downloadExcelBapRekap } from "@/lib/export-bap";
import { downloadBapBatch } from "@/lib/pdf";
import type { BapStatus } from "@/lib/bap-absensi-santri";
import { getRekapBapRentang, getBapSehari } from "./bap-rekap-actions";

type Mode = "excel" | "pdf";

const STATUS_LABEL: Record<BapStatus, string> = {
  izin: "Izin",
  sakit: "Sakit",
  alpa: "Alpa",
};

const JK_LABEL: Record<string, string> = {
  "": "Semua",
  L: "Putra",
  P: "Putri",
  kosong: "Belum diisi",
};

const SHIFT_OPSI = [0, 1, 2, 3];
const JK_OPSI = ["", "L", "P", "kosong"];

export function RekapBapDialog({
  defaultDari,
  defaultSampai,
}: {
  /** Dihitung di server (WIB) — kalau dihitung di klien, zona waktu perangkat
      pengguna bisa berbeda dan memicu hydration mismatch. */
  defaultDari: string;
  defaultSampai: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("excel");
  const [dari, setDari] = useState(defaultDari);
  const [sampai, setSampai] = useState(defaultSampai);
  const [tanggal, setTanggal] = useState(defaultSampai);
  const [shift, setShift] = useState(0);
  const [jk, setJk] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function labelFilter() {
    const s = shift === 0 ? "semua-shift" : `shift${shift}`;
    const g = jk === "L" ? "putra" : jk === "P" ? "putri" : jk === "kosong" ? "tanpa-jk" : "semua";
    return `${s}-${g}`;
  }

  async function onExcel() {
    setError(null);
    setPending(true);
    const res = await getRekapBapRentang(dari, sampai, shift, jk);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.rows.length === 0) {
      setError("Tidak ada data pada rentang & filter ini.");
      return;
    }

    // Satu sheet berisi semuanya, termasuk nama santri yang tidak hadir dan
    // catatan pengawasan. Ini baru mungkin sejak memakai ExcelJS: teksnya
    // dibungkus di dalam sel, jadi daftar panjang tidak lagi memanjang
    // menabrak kolom sebelahnya seperti pada versi SheetJS.
    const baris = res.rows.map((r) => ({
      tanggal: r.tanggal,
      kelas: r.kelas,
      shift: r.shift,
      musyrif: r.musyrif,
      hadir: r.jumlahSantri,
      seharusnya: r.seharusnya,
      tidakHadir: r.tidakHadir,
      // Satu santri per baris, diawali bullet supaya batas antar santri
      // terlihat jelas saat teksnya membungkus. Keterangan milik santri
      // diberi label "Ket:" — tanpa label, teks yang membungkus ke baris
      // sendiri terbaca seperti catatan pengawasan yang nyasar kolom.
      namaTidakHadir:
        r.data.yakni
          .map((s) => {
            const inti = `• ${s.nama} — ${STATUS_LABEL[s.status]} · ${s.jamList.join(", ")}`;
            return s.catatan ? `${inti} · Ket: ${s.catatan}` : inti;
          })
          .join("\n") || "—",
      catatan:
        r.catatanList.map((c) => `• ${c.jam.slice(0, 5)} · ${c.isi}`).join("\n") || "—",
      jamTerisi: r.jamTerisi,
      jamTotal: r.jamTotal,
    }));

    try {
      await downloadExcelBapRekap(
        `rekap-bap-${dari}-sd-${sampai}-${labelFilter()}.xlsx`,
        {
          rentang: `${formatDateID(dari)} s/d ${formatDateID(sampai)}`,
          shift: shift === 0 ? "Semua shift" : `Shift ${shift}`,
          jenisKelamin: JK_LABEL[jk] ?? "Semua",
          dicetak: formatDateID(new Date().toISOString().slice(0, 10)),
        },
        baris,
      );
      setOpen(false);
      toast.success(`${res.rows.length} baris rekap BAP diunduh.`);
    } catch {
      // ExcelJS dimuat dinamis dan menyusun berkasnya di memori — bisa gagal
      // di jaringan buruk atau perangkat lawas. Tanpa ini tombolnya diklik
      // dan tidak terjadi apa-apa tanpa penjelasan. Pola sama seperti onPdf.
      toast.error("Gagal membuat Excel. Coba lagi.");
    }
  }

  async function onPdf() {
    setError(null);
    setPending(true);
    const res = await getBapSehari(tanggal, shift, jk);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }

    try {
      await downloadBapBatch(
        res.rows.map((r) => ({
          kelas: r.kelas,
          shift: r.shift,
          tanggalLabel: formatDateID(r.tanggal),
          musyrif: r.musyrif,
          jamPengecekan: r.jamPengecekan,
          // Bentuk terstruktur, bukan kolom teks `r.yakni`/`r.catatanPengawasan`
          // yang diringkas untuk Excel — `drawBapPage` menyusun tata letaknya
          // sendiri dan butuh datanya utuh.
          data: r.data,
          catatan: r.catatanList,
        })),
        `bap-${tanggal}-${labelFilter()}`,
      );
      setOpen(false);
      toast.success(`${res.rows.length} BAP diunduh dalam satu berkas.`);
    } catch {
      toast.error("Gagal membuat PDF. Coba lagi.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-10 w-full sm:w-auto">
          <FileText className="size-4" />
          Rekap BAP
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Rekap BAP</DialogTitle>
          <DialogDescription className="text-sm">
            Berita acara pengawasan lintas kelas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["excel", "pdf"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={cn(
                  "h-10 rounded-lg border text-sm font-medium transition-colors",
                  mode === m
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/70 text-muted-foreground hover:bg-accent/60",
                )}
              >
                {m === "excel" ? "Excel (rentang)" : "PDF (satu hari)"}
              </button>
            ))}
          </div>

          {mode === "excel" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dari" htmlFor="bap-dari">
                <Input
                  id="bap-dari"
                  type="date"
                  value={dari}
                  onChange={(e) => setDari(e.target.value)}
                />
              </Field>
              <Field label="Sampai" htmlFor="bap-sampai">
                <Input
                  id="bap-sampai"
                  type="date"
                  value={sampai}
                  onChange={(e) => setSampai(e.target.value)}
                />
              </Field>
            </div>
          ) : (
            <Field label="Tanggal" htmlFor="bap-tanggal">
              <Input
                id="bap-tanggal"
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
              />
            </Field>
          )}

          <Field label="Shift">
            <div className="grid grid-cols-4 gap-2">
              {SHIFT_OPSI.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setShift(s)}
                  className={cn(
                    "h-10 rounded-lg border text-sm font-medium transition-colors",
                    shift === s
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/70 text-muted-foreground hover:bg-accent/60",
                  )}
                >
                  {s === 0 ? "Semua" : s}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Jenis Kelamin Kelas" error={error ?? undefined}>
            <div className="grid grid-cols-4 gap-2">
              {JK_OPSI.map((g) => (
                <button
                  key={g || "semua"}
                  type="button"
                  onClick={() => setJk(g)}
                  className={cn(
                    "h-10 rounded-lg border text-xs font-medium transition-colors",
                    jk === g
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/70 text-muted-foreground hover:bg-accent/60",
                  )}
                >
                  {JK_LABEL[g]}
                </button>
              ))}
            </div>
          </Field>

          {mode === "pdf" && (
            <p className="text-xs text-muted-foreground">
              PDF hanya memuat BAP yang seluruh jam pengecekannya sudah terisi. Semua
              kelas yang cocok digabung jadi satu berkas, satu kelas per halaman.
            </p>
          )}

          <Button
            type="button"
            onClick={mode === "excel" ? onExcel : onPdf}
            disabled={pending}
            className="h-11 w-full"
          >
            {pending ? "Menyiapkan…" : mode === "excel" ? "Unduh Excel" : "Unduh PDF"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
