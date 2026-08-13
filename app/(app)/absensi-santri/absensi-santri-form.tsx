"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { submitAbsensiSantri } from "./actions";
import { CatatanDialog, type CatatanItem } from "./catatan-dialog";

type Status = "hadir" | "izin" | "sakit" | "alpa";
const CYCLE: Status[] = ["hadir", "izin", "sakit", "alpa"];

const STATUS_LABEL: Record<Status, string> = {
  hadir: "Hadir",
  izin: "Izin",
  sakit: "Sakit",
  alpa: "Alpa",
};
const STATUS_VARIANT: Record<Status, "positive" | "warning" | "primary" | "negative"> = {
  hadir: "positive",
  izin: "warning",
  sakit: "primary",
  alpa: "negative",
};

type Santri = { id: string; nis: string | null; nama: string };
type Exception = { status: "izin" | "sakit" | "alpa"; catatan: string | null };

export type KelasGroup = {
  kelasId: string;
  kelasNama: string;
  submitted: boolean;
  roster: Santri[];
  initialExceptions: Record<string, Exception>;
  catatan: CatatanItem[];
};

export function AbsensiSantriForm({
  checkpointId,
  tanggal,
  groups,
  // Jam checkpoint ini masih terlalu jauh di depan untuk disimpan. Alasannya
  // sudah dijelaskan spanduk di atas form, jadi di sini cukup mematikan
  // tombolnya. Ini semata kenyamanan — gerbang yang sebenarnya ada di
  // submitAbsensiSantri(), karena server action bisa dipanggil langsung
  // tanpa lewat tombol ini.
  terkunci = false,
  jamSekarang,
}: {
  checkpointId: string;
  tanggal: string;
  groups: KelasGroup[];
  terkunci?: boolean;
  /** Jam WIB "HH:MM" dari server — nilai awal form catatan. */
  jamSekarang: string;
}) {
  const router = useRouter();
  const single = groups.length <= 1;
  const [statuses, setStatuses] = useState<Record<string, Status>>(() => {
    const init: Record<string, Status> = {};
    for (const g of groups) {
      for (const s of g.roster) {
        init[s.id] = g.initialExceptions[s.id]?.status ?? "hadir";
      }
    }
    return init;
  });
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const g of groups) {
      for (const s of g.roster) {
        init[s.id] = g.initialExceptions[s.id]?.catatan ?? "";
      }
    }
    return init;
  });
  // Ditutup semua by default — musyrif dengan banyak kelas (mis. shift
  // malam yang menampung seluruh pondok) cuma perlu render/scroll roster
  // kelas yang sedang dikerjakan, bukan semuanya sekaligus.
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    single ? new Set(groups.map((g) => g.kelasId)) : new Set(),
  );
  // Simpan SELALU per kelas, tidak pernah digabung — musyrif kadang cuma
  // benar-benar mengawasi/mengecek sebagian dari kelas yang ditugaskan ke
  // dia; kelas yang belum dia buka & tinjau TIDAK BOLEH ikut tersimpan
  // (defaultnya "hadir semua"), supaya tidak menandai kelas yang belum
  // dicek sebagai "sudah diisi".
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  function toggleExpanded(kelasId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(kelasId)) next.delete(kelasId);
      else next.add(kelasId);
      return next;
    });
  }

  function cycleStatus(santriId: string) {
    setStatuses((prev) => {
      const current = prev[santriId] ?? "hadir";
      const nextIndex = (CYCLE.indexOf(current) + 1) % CYCLE.length;
      return { ...prev, [santriId]: CYCLE[nextIndex] };
    });
  }

  async function onSubmitKelas(g: KelasGroup) {
    setSubmittingId(g.kelasId);
    const pengecualian = g.roster
      .filter((s) => statuses[s.id] !== "hadir")
      .map((s) => ({
        santri_id: s.id,
        status: statuses[s.id] as "izin" | "sakit" | "alpa",
        catatan: notes[s.id]?.trim() || null,
      }));
    const res = await submitAbsensiSantri(g.kelasId, checkpointId, tanggal, pengecualian);
    setSubmittingId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Absensi ${g.kelasNama} tersimpan.`);
    router.refresh();
  }

  return (
    <div className="space-y-2.5 pb-4">
      {groups.map((g) => {
        const isOpen = expanded.has(g.kelasId) || single;
        const isSubmitting = submittingId === g.kelasId;
        return (
          <div
            key={g.kelasId}
            id={`kelas-${g.kelasId}`}
            className="scroll-mt-24 overflow-hidden rounded-card border border-border/70 bg-card shadow-sm"
          >
            {/* Header selalu dirender — sebelumnya dilewati saat musyrif cuma
                punya 1 kelas, sehingga penanda "Sudah diisi" tidak pernah
                muncul untuk mereka dan tidak ada cara tahu jam ini sudah
                dikerjakan atau belum. Yang berbeda hanya bisa/tidaknya
                dilipat, bukan ada/tidaknya informasi. */}
            {single ? (
              <div className="flex items-center justify-between gap-2 bg-muted/30 px-4 py-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold">{g.kelasNama}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    ({g.roster.length})
                  </span>
                </span>
                {g.submitted && <Badge variant="positive">Sudah diisi</Badge>}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => toggleExpanded(g.kelasId)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-2 bg-muted/30 px-4 py-3 text-left"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <ChevronRight
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      isOpen && "rotate-90",
                    )}
                  />
                  <span className="truncate text-sm font-semibold">{g.kelasNama}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    ({g.roster.length})
                  </span>
                </span>
                {g.submitted && <Badge variant="positive">Sudah diisi</Badge>}
              </button>
            )}
            {isOpen && (
              <div className="border-t border-border/50">
                {g.roster.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Belum ada santri di kelas ini.
                  </p>
                ) : (
                  <>
                    <div className="divide-y divide-border/50">
                      {g.roster.map((s) => {
                        const status = statuses[s.id] ?? "hadir";
                        return (
                          <div key={s.id} className="flex flex-col gap-2 px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => cycleStatus(s.id)}
                              className="flex w-full items-center justify-between gap-3 text-left"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{s.nama}</p>
                                {s.nis && (
                                  <p className="font-mono text-xs text-muted-foreground">
                                    {s.nis}
                                  </p>
                                )}
                              </div>
                              <Badge variant={STATUS_VARIANT[status]} className="shrink-0">
                                {STATUS_LABEL[status]}
                              </Badge>
                            </button>
                            {status !== "hadir" && (
                              <Textarea
                                placeholder="Catatan singkat (opsional)"
                                value={notes[s.id] ?? ""}
                                onChange={(e) =>
                                  setNotes((prev) => ({ ...prev, [s.id]: e.target.value }))
                                }
                                className="min-h-16 text-sm"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="space-y-2 border-t border-border/50 p-3">
                      <Button
                        onClick={() => onSubmitKelas(g)}
                        disabled={terkunci || submittingId !== null}
                        className="h-11 w-full"
                      >
                        {terkunci
                          ? "Belum bisa disimpan"
                          : isSubmitting
                            ? "Menyimpan…"
                            : g.submitted
                              ? "Perbarui Absensi"
                              : "Simpan Absensi"}
                      </Button>
                      {/* Tombol-tombol ini WAJIB di badan kartu, bukan di header:
                          header kartu untuk musyrif multi-kelas itu sendiri sebuah
                          <button>, dan menyarangkan <button> di dalam <button>
                          adalah HTML tidak valid. */}
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <CatatanDialog
                          kelasId={g.kelasId}
                          kelasNama={g.kelasNama}
                          jamSekarang={jamSekarang}
                          catatan={g.catatan}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
