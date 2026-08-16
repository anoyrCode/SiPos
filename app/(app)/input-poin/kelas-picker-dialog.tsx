"use client";

import { useState } from "react";
import { Check, Users } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getKelasTerjangkau, getSantriByKelas } from "./actions";
import type { KelasOpt, SantriHit } from "./schema";

export function KelasPickerDialog({
  /** Santri yang sudah terpilih di form — dipakai untuk menandai baris yang
      sudah masuk, supaya tidak terlihat seolah belum dipilih. */
  sudahTerpilih,
  onTambah,
}: {
  sudahTerpilih: SantriHit[];
  onTambah: (santri: SantriHit[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kelas, setKelas] = useState<KelasOpt[]>([]);
  const [kelasAktif, setKelasAktif] = useState<KelasOpt | null>(null);
  const [roster, setRoster] = useState<SantriHit[]>([]);
  const [dicentang, setDicentang] = useState<Set<string>>(new Set());
  const [memuatKelas, setMemuatKelas] = useState(false);
  const [memuatRoster, setMemuatRoster] = useState(false);

  const idTerpilih = new Set(sudahTerpilih.map((s) => s.id));

  // Dimuat dari penangan buka-dialog, BUKAN dari useEffect. Memanggil
  // setState langsung di badan efek memicu render beruntun dan ditolak
  // React Compiler; lagi pula pemicunya di sini memang aksi pengguna, bukan
  // sinkronisasi dengan sistem luar.
  async function muatKelas() {
    if (kelas.length > 0) return;
    setMemuatKelas(true);
    try {
      setKelas(await getKelasTerjangkau());
    } finally {
      setMemuatKelas(false);
    }
  }

  async function bukaKelas(k: KelasOpt) {
    setKelasAktif(k);
    setMemuatRoster(true);
    const hasil = await getSantriByKelas(k.id);
    setRoster(hasil);
    // Santri yang sudah ada di form ditandai tercentang sejak awal — kalau
    // tidak, musyrif mengira mereka belum masuk lalu menambahkannya lagi.
    setDicentang(new Set(hasil.filter((s) => idTerpilih.has(s.id)).map((s) => s.id)));
    setMemuatRoster(false);
  }

  function toggle(id: string) {
    setDicentang((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const semuaTercentang = roster.length > 0 && dicentang.size === roster.length;
  // Hanya yang BELUM ada di form yang benar-benar ditambahkan — jumlah ini
  // yang ditampilkan di tombol, supaya tidak menjanjikan lebih dari yang terjadi.
  const akanDitambah = roster.filter(
    (s) => dicentang.has(s.id) && !idTerpilih.has(s.id),
  );

  function tutup() {
    setOpen(false);
    setKelasAktif(null);
    setRoster([]);
    setDicentang(new Set());
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setOpen(true);
          void muatKelas();
        } else tutup();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-10 shrink-0">
          <Users className="size-4" />
          Pilih dari Kelas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Pilih dari Kelas</DialogTitle>
          <DialogDescription className="text-sm">
            {kelasAktif
              ? `${kelasAktif.nama_kelas} — centang santri yang akan diberi poin.`
              : "Pilih kelas terlebih dahulu."}
          </DialogDescription>
        </DialogHeader>

        {!kelasAktif ? (
          <div className="space-y-2">
            {memuatKelas && (
              <p className="py-6 text-center text-sm text-muted-foreground">Memuat…</p>
            )}
            {!memuatKelas && kelas.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Tidak ada kelas yang bisa Anda pilih pada tahun ajaran aktif.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {kelas.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => bukaKelas(k)}
                  className="rounded-full border border-border/70 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60"
                >
                  {k.nama_kelas}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setKelasAktif(null);
                  setRoster([]);
                  setDicentang(new Set());
                }}
              >
                Ganti kelas
              </Button>
              {roster.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDicentang(
                      semuaTercentang ? new Set() : new Set(roster.map((s) => s.id)),
                    )
                  }
                >
                  {semuaTercentang ? "Kosongkan" : "Pilih Semua"}
                </Button>
              )}
            </div>

            {memuatRoster ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Memuat…</p>
            ) : roster.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Belum ada santri aktif di kelas ini.
              </p>
            ) : (
              <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                {roster.map((s) => {
                  const aktif = dicentang.has(s.id);
                  const sudah = idTerpilih.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(s.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                        aktif
                          ? "border-primary bg-primary/10"
                          : "border-border/70 hover:bg-accent/60",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border",
                          aktif
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border",
                        )}
                      >
                        {aktif && <Check className="size-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {s.nama}
                        </span>
                        {s.nis && (
                          <span className="block font-mono text-xs text-muted-foreground">
                            {s.nis}
                          </span>
                        )}
                      </span>
                      {sudah && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          sudah dipilih
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <Button
              type="button"
              className="h-11 w-full"
              disabled={akanDitambah.length === 0}
              onClick={() => {
                onTambah(akanDitambah);
                tutup();
              }}
            >
              {akanDitambah.length === 0
                ? "Belum ada yang ditambahkan"
                : `Tambahkan ${akanDitambah.length} santri`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
