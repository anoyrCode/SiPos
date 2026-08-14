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
  label = "Buat BAP",
  className = "h-11 flex-1",
}: {
  kelasId: string;
  kelasNama: string;
  shift: number;
  tanggal: string;
  tanggalLabel: string;
  musyrif: string;
  /** Jam pengecekan yang belum diisi. Kosong = BAP boleh dibuat. */
  jamBelumDiisi: string[];
  /**
   * Teks tombol. Musyrif hanya punya satu shift, jadi "Buat BAP" sudah jelas.
   * Di rekap admin satu kelas bisa punya beberapa shift lengkap sekaligus —
   * tanpa nomor shift di tombolnya, dua tombol berdampingan jadi identik dan
   * tidak bisa dibedakan.
   */
  label?: string;
  /**
   * `flex-1` cocok di kartu musyrif (dua tombol berbagi satu baris), tapi di
   * rekap admin tombolnya ada di wadah `flex-wrap` — di sana `flex-1` membuat
   * tiap tombol melar memenuhi lebar kartu.
   */
  className?: string;
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
    try {
      await downloadBapAbsensiSantri({
        kelas: kelasNama,
        shift,
        tanggalLabel,
        musyrif,
        jamPengecekan: hasil.jamPengecekan,
        data: hasil.data,
        catatan: hasil.catatan,
      });
    } catch {
      // jsPDF dimuat dinamis saat tombol diklik dan menyusun berkas di
      // memori — bisa gagal di jaringan buruk atau HP lawas. Tanpa ini,
      // tombolnya diklik dan tidak terjadi apa-apa tanpa penjelasan.
      toast.error("Gagal membuat PDF. Coba lagi.");
    }
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
        className={className}
        disabled
        title={`Belum bisa: ${jamBelumDiisi.join(", ")} belum diisi`}
      >
        <FileText className="size-4" />
        {label}
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
        <Button type="button" variant="outline" className={className}>
          <FileText className="size-4" />
          {label}
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

            {/* Judul bagian dibuat kecil, kapital, dan redup — bukan `text-sm
                font-semibold` seperti sub-bagian form. Di sini isinya yang
                harus menonjol; judul seukuran teks isi membuat judul dan isi
                saling berebut dan bagian-bagiannya terbaca menyatu. */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Yakni
              </h3>
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
                      className="rounded-lg border border-border/70 px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        {/* Nama santri di sini panjang-panjang; dibiarkan
                            membungkus, bukan dipotong, supaya tidak ada nama
                            yang tidak terbaca utuh di berita acara. */}
                        <p className="min-w-0 text-sm font-medium leading-snug">
                          {s.nama}
                        </p>
                        <Badge variant={STATUS_VARIANT[s.status]} className="shrink-0">
                          {STATUS_LABEL[s.status]}
                        </Badge>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {s.jamList.join(" · ")}
                      </p>
                      {s.catatan && (
                        <p className="mt-1 text-xs text-muted-foreground">{s.catatan}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Catatan selama pengawasan
              </h3>
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
            <p className="border-t border-border/50 pt-3 text-xs leading-relaxed text-muted-foreground">
              Jam pengecekan:{" "}
              <span className="font-mono">{hasil.jamPengecekan.join(", ")}</span>
            </p>

            {/* Dua kolom, tidak pernah bertumpuk. Tombol selebar dialog dengan
                tinggi berapa pun tetap terbaca sebagai batang tipis — yang
                memperbaiki proporsinya adalah lebarnya, bukan tingginya.
                Label "Salin ke WA" sengaja pendek supaya muat berdampingan di
                layar HP tanpa terpotong. */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button type="button" onClick={onUnduhPdf} className="h-11">
                <FileText className="size-4" />
                Unduh PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onSalin}
                className="h-11"
              >
                <Copy className="size-4" />
                Salin ke WA
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
