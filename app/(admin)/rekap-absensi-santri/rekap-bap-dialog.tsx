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
import { downloadExcelMultiSheet } from "@/lib/export";
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

    // Tiga sheet, bukan satu. Menjejalkan daftar nama santri dan daftar
    // catatan ke dalam satu sel (digabung titik koma) membuat tabelnya tidak
    // terbaca — dan build komunitas SheetJS tidak bisa menulis bungkus teks
    // untuk meredamnya. Sheet "Rekap" karena itu dijaga tetap angka semua dan
    // kolomnya sempit; rinciannya pindah ke sheet tersendiri, satu baris per
    // kejadian, sehingga bisa disaring dan di-pivot seperti data biasa.
    const info: (string | number)[][] = [
      ["Rekap Berita Acara Pengawasan"],
      ["Rentang", `${dari} s/d ${sampai}`],
      ["Shift", shift === 0 ? "Semua" : `Shift ${shift}`],
      ["Jenis Kelamin Kelas", JK_LABEL[jk] ?? "Semua"],
      ["Dicetak", formatDateID(new Date().toISOString().slice(0, 10))],
      [],
    ];

    const barisTidakHadir = res.rows.flatMap((r) =>
      r.data.yakni.map((s) => ({
        Tanggal: r.tanggal,
        Kelas: r.kelas,
        Shift: r.shift,
        "Nama Santri": s.nama,
        NIS: s.nis ?? "-",
        Status: STATUS_LABEL[s.status],
        "Jam Tidak Hadir": s.jamList.join(", "),
        Keterangan: s.catatan ?? "-",
      })),
    );

    const barisCatatan = res.rows.flatMap((r) =>
      r.catatanList.map((c) => ({
        Tanggal: r.tanggal,
        Kelas: r.kelas,
        Shift: r.shift,
        Jam: c.jam.slice(0, 5),
        Catatan: c.isi,
      })),
    );

    await downloadExcelMultiSheet(
      `rekap-bap-${dari}-sd-${sampai}-${labelFilter()}.xlsx`,
      [
        {
          sheetName: "Rekap",
          infoRows: info,
          rows: res.rows.map((r) => ({
            Tanggal: r.tanggal,
            Kelas: r.kelas,
            "Jenis Kelamin": JK_LABEL[r.jenisKelamin ?? ""] ?? "Belum diisi",
            Shift: r.shift,
            Musyrif: r.musyrif,
            Hadir: r.jumlahSantri,
            Seharusnya: r.seharusnya,
            "Tidak Hadir": r.tidakHadir,
            Kelengkapan: `${r.jamTerisi}/${r.jamTotal}`,
          })),
          colWidths: [12, 16, 14, 6, 24, 8, 12, 12, 13],
        },
        {
          sheetName: "Tidak Hadir",
          infoRows: info,
          // Sheet kosong tanpa satu baris pun tidak menuliskan header sama
          // sekali, dan pembacanya bingung apakah datanya nihil atau rusak.
          rows:
            barisTidakHadir.length > 0
              ? barisTidakHadir
              : [{ Keterangan: "Tidak ada santri yang tidak hadir pada rentang ini." }],
          colWidths: [12, 16, 6, 28, 12, 10, 22, 45],
        },
        {
          sheetName: "Catatan Pengawasan",
          infoRows: info,
          rows:
            barisCatatan.length > 0
              ? barisCatatan
              : [{ Keterangan: "Tidak ada catatan pengawasan pada rentang ini." }],
          colWidths: [12, 16, 6, 8, 70],
        },
      ],
    );
    setOpen(false);
    toast.success(`${res.rows.length} baris rekap BAP diunduh.`);
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
