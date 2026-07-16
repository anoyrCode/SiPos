"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDateID } from "@/lib/format";
import { tambahJadwalSementara, hapusJadwalSementara } from "./actions";
import type { JadwalSementaraRow } from "./schema";

export function JadwalSementaraSection({
  pegawaiId,
  initial,
}: {
  pegawaiId: string;
  initial: JadwalSementaraRow[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalSelesai, setTanggalSelesai] = useState("");
  const [jamMasuk, setJamMasuk] = useState("");
  const [jamPulang, setJamPulang] = useState("");
  const [keterangan, setKeterangan] = useState("");

  async function onAdd() {
    setError(null);
    if (!tanggalMulai || !tanggalSelesai || !jamMasuk || !jamPulang) {
      setError("Tanggal mulai, tanggal selesai, jam masuk, dan jam pulang wajib diisi.");
      return;
    }
    setPending(true);
    const res = await tambahJadwalSementara(
      pegawaiId,
      tanggalMulai,
      tanggalSelesai,
      jamMasuk,
      jamPulang,
      keterangan,
    );
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setTanggalMulai("");
    setTanggalSelesai("");
    setJamMasuk("");
    setJamPulang("");
    setKeterangan("");
    toast.success("Jadwal sementara ditambahkan.");
    router.refresh();
  }

  const sorted = [...initial].sort((a, b) =>
    a.tanggal_mulai < b.tanggal_mulai ? 1 : -1,
  );

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div>
        <h4 className="text-sm font-semibold">Jadwal Sementara</h4>
        <p className="text-xs text-muted-foreground">
          Untuk penggantian sementara (mis. gantiin pegawai lain yang
          berhalangan) — berlaku HANYA di rentang tanggal ini, menang atas
          jadwal biasa. Jadwal asli tidak perlu diubah/dikembalikan manual.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Dari Tanggal" htmlFor="js-tanggal-mulai">
          <Input
            id="js-tanggal-mulai"
            type="date"
            value={tanggalMulai}
            onChange={(e) => setTanggalMulai(e.target.value)}
          />
        </Field>
        <Field label="Sampai Tanggal" htmlFor="js-tanggal-selesai">
          <Input
            id="js-tanggal-selesai"
            type="date"
            min={tanggalMulai || undefined}
            value={tanggalSelesai}
            onChange={(e) => setTanggalSelesai(e.target.value)}
          />
        </Field>
        <Field label="Jam Masuk" htmlFor="js-jam-masuk">
          <Input
            id="js-jam-masuk"
            type="time"
            value={jamMasuk}
            onChange={(e) => setJamMasuk(e.target.value)}
          />
        </Field>
        <Field label="Jam Pulang" htmlFor="js-jam-pulang">
          <Input
            id="js-jam-pulang"
            type="time"
            value={jamPulang}
            onChange={(e) => setJamPulang(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Keterangan (opsional)" htmlFor="js-keterangan">
          <Input
            id="js-keterangan"
            placeholder="mis. Gantiin Pak Budi cuti"
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
          />
        </Field>
        <Button type="button" onClick={onAdd} disabled={pending}>
          <Plus data-icon="inline-start" />
          Tambah
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
        {sorted.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">
            Belum ada jadwal sementara.
          </p>
        ) : (
          sorted.map((j) => (
            <div
              key={j.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-card px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {formatDateID(j.tanggal_mulai)} – {formatDateID(j.tanggal_selesai)}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {j.jam_masuk.slice(0, 5)} – {j.jam_pulang.slice(0, 5)}
                  {j.keterangan ? ` · ${j.keterangan}` : ""}
                </p>
              </div>
              <ConfirmDialog
                action={hapusJadwalSementara}
                id={j.id}
                title="Hapus jadwal sementara?"
                description={`Jadwal sementara ${formatDateID(j.tanggal_mulai)} – ${formatDateID(j.tanggal_selesai)} akan dihapus.`}
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label="Hapus">
                    <Trash2 />
                  </Button>
                }
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
