"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { submitAbsensiSantri } from "./actions";

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
};

export function AbsensiSantriForm({
  checkpointId,
  tanggal,
  groups,
}: {
  checkpointId: string;
  tanggal: string;
  groups: KelasGroup[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
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

  function cycleStatus(santriId: string) {
    setStatuses((prev) => {
      const current = prev[santriId] ?? "hadir";
      const nextIndex = (CYCLE.indexOf(current) + 1) % CYCLE.length;
      return { ...prev, [santriId]: CYCLE[nextIndex] };
    });
  }

  function onSubmit() {
    startTransition(async () => {
      const results = await Promise.all(
        groups
          .filter((g) => g.roster.length > 0)
          .map(async (g) => {
            const pengecualian = g.roster
              .filter((s) => statuses[s.id] !== "hadir")
              .map((s) => ({
                santri_id: s.id,
                status: statuses[s.id] as "izin" | "sakit" | "alpa",
                catatan: notes[s.id]?.trim() || null,
              }));
            const res = await submitAbsensiSantri(
              g.kelasId,
              checkpointId,
              tanggal,
              pengecualian,
            );
            return { kelasNama: g.kelasNama, res };
          }),
      );

      const failed = results.filter((r) => !r.res.ok);
      if (failed.length > 0) {
        toast.error(`Gagal simpan ${failed.length} kelas: ${failed.map((f) => f.kelasNama).join(", ")}`);
        return;
      }
      toast.success(
        groups.length > 1 ? `Absensi ${groups.length} kelas tersimpan.` : "Absensi tersimpan.",
      );
      router.refresh();
    });
  }

  const totalSantri = groups.reduce((n, g) => n + g.roster.length, 0);

  return (
    <div className="space-y-6 pb-4">
      {groups.map((g) => (
        <div key={g.kelasId} id={`kelas-${g.kelasId}`} className="scroll-mt-24 space-y-2">
          {groups.length > 1 && (
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{g.kelasNama}</h2>
              {g.submitted && <Badge variant="positive">Sudah diisi</Badge>}
            </div>
          )}
          {g.roster.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                Belum ada santri di kelas ini.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {g.roster.map((s) => {
                const status = statuses[s.id] ?? "hadir";
                return (
                  <Card key={s.id}>
                    <CardContent className="flex flex-col gap-2 py-3">
                      <button
                        type="button"
                        onClick={() => cycleStatus(s.id)}
                        className="flex w-full items-center justify-between gap-3 text-left"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{s.nama}</p>
                          {s.nis && (
                            <p className="font-mono text-xs text-muted-foreground">{s.nis}</p>
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
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {totalSantri > 0 && (
        <div className="sticky bottom-4 z-10">
          <Button
            onClick={onSubmit}
            disabled={pending}
            className="h-12 w-full text-base shadow-lg"
          >
            {pending
              ? "Menyimpan…"
              : groups.length > 1
                ? `Simpan Semua (${groups.length} kelas)`
                : "Simpan Absensi"}
          </Button>
        </div>
      )}
    </div>
  );
}
