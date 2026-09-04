"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/field";
import { ajukanIzin } from "./actions";
import type { FormResult } from "@/lib/forms";
import type { KategoriPengajuan } from "@/lib/absensi-status";

// Ada laporan macet di "Menyimpan..." tanpa pernah selesai -- sudah dicek,
// bukan row lock DB dan bukan bug logika (tidak ada percabangan tanggal di
// ajukanIzin()). Aksi ini melakukan 5+ panggilan jaringan berurutan (cek
// izin, profil, cek konflik, upload bukti, insert, upsert); kalau salah
// satu stall krn koneksi tidak stabil, Server Action tidak bisa di-abort
// dari sini, jadi tanpa batas waktu UI menunggu selamanya. Timeout ini
// TIDAK membatalkan request aslinya di server, cuma membebaskan UI supaya
// pengguna tahu & bisa coba lagi (server tetap bebas menyimpan belakangan).
const SUBMIT_TIMEOUT_MS = 30_000;

function withTimeout(promise: Promise<FormResult>): Promise<FormResult> {
  return Promise.race([
    promise,
    new Promise<FormResult>((resolve) => {
      setTimeout(
        () =>
          resolve({
            ok: false,
            error: "Waktu tunggu habis. Periksa koneksi internet Anda, lalu coba lagi.",
          }),
        SUBMIT_TIMEOUT_MS,
      );
    }),
  ]);
}

export function IzinDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kategori, setKategori] = useState<KategoriPengajuan>("izin");
  // Pulang awal berlaku satu hari saja & tidak perlu bukti.
  const isPulangAwal = kategori === "pulang_awal";
  const [mulai, setMulai] = useState("");
  const [selesai, setSelesai] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [bukti, setBukti] = useState<File | null>(null);

  function reset() {
    setKategori("izin");
    setMulai("");
    setSelesai("");
    setKeterangan("");
    setBukti(null);
    setError(null);
  }

  async function onSubmit() {
    setError(null);
    if (!mulai || (!isPulangAwal && !selesai)) {
      setError("Tanggal wajib diisi.");
      return;
    }
    if (kategori === "sakit" && !bukti) {
      setError("Bukti surat dokter wajib untuk kategori Sakit.");
      return;
    }
    setPending(true);
    const formData = new FormData();
    formData.set("kategori", kategori);
    formData.set("tanggal_mulai", mulai);
    formData.set("tanggal_selesai", isPulangAwal ? mulai : selesai);
    formData.set("keterangan", keterangan);
    if (bukti) formData.set("bukti", bukti);
    const res = await withTimeout(ajukanIzin(formData));
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    reset();
    toast.success("Pengajuan tercatat, menunggu persetujuan.");
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
        <Button type="button" variant="outline" className="w-full max-w-xs">
          <CalendarPlus data-icon="inline-start" />
          Ajukan Izin/Sakit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="-mx-6 -mt-6 border-b px-6 pb-4 pt-6">
          <DialogTitle>Ajukan Izin/Sakit</DialogTitle>
          <DialogDescription>
            Menunggu persetujuan HRD/admin. Hari yang diajukan tidak dihitung
            Alpa/Terlambat selama menunggu.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="-mx-2 space-y-4 px-2 py-1">
            <Field label="Kategori" required>
              <Select
                value={kategori}
                onValueChange={(v) => setKategori(v as KategoriPengajuan)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="izin">Izin</SelectItem>
                  <SelectItem value="sakit">Sakit</SelectItem>
                  <SelectItem value="pulang_awal">Pulang Awal</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className={isPulangAwal ? undefined : "grid grid-cols-2 gap-3"}>
              <Field
                label={isPulangAwal ? "Tanggal" : "Dari Tanggal"}
                htmlFor="mulai"
                required
              >
                <Input
                  id="mulai"
                  type="date"
                  value={mulai}
                  onChange={(e) => setMulai(e.target.value)}
                />
              </Field>
              {!isPulangAwal && (
                <Field label="Sampai Tanggal" htmlFor="selesai" required>
                  <Input
                    id="selesai"
                    type="date"
                    value={selesai}
                    onChange={(e) => setSelesai(e.target.value)}
                  />
                </Field>
              )}
            </div>
            <Field label="Keterangan" htmlFor="keterangan">
              <Textarea
                id="keterangan"
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
              />
            </Field>
            {!isPulangAwal && (
              <Field
                label="Bukti Surat Dokter"
                htmlFor="bukti"
                required={kategori === "sakit"}
                hint={
                  kategori === "sakit"
                    ? "Wajib untuk kategori Sakit. JPG/PNG/PDF, maks 5MB."
                    : "Opsional. JPG/PNG/PDF, maks 5MB."
                }
              >
                <Input
                  id="bukti"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => setBukti(e.target.files?.[0] ?? null)}
                />
              </Field>
            )}
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
            <Button type="button" onClick={onSubmit} disabled={pending}>
              {pending ? "Menyimpan…" : "Ajukan"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
