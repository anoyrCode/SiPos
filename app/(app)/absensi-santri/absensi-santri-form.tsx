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

export function AbsensiSantriForm({
  kelasId,
  checkpointId,
  tanggal,
  roster,
  initialExceptions,
}: {
  kelasId: string;
  checkpointId: string;
  tanggal: string;
  roster: Santri[];
  initialExceptions: Record<string, Exception>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [statuses, setStatuses] = useState<Record<string, Status>>(() => {
    const init: Record<string, Status> = {};
    for (const s of roster) {
      init[s.id] = initialExceptions[s.id]?.status ?? "hadir";
    }
    return init;
  });
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const s of roster) {
      init[s.id] = initialExceptions[s.id]?.catatan ?? "";
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
    const pengecualian = roster
      .filter((s) => statuses[s.id] !== "hadir")
      .map((s) => ({
        santri_id: s.id,
        status: statuses[s.id] as "izin" | "sakit" | "alpa",
        catatan: notes[s.id]?.trim() || null,
      }));

    startTransition(async () => {
      const res = await submitAbsensiSantri(kelasId, checkpointId, tanggal, pengecualian);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Absensi tersimpan.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {roster.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Belum ada santri di kelas ini.
            </CardContent>
          </Card>
        ) : (
          roster.map((s) => {
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
          })
        )}
      </div>
      {roster.length > 0 && (
        <Button onClick={onSubmit} disabled={pending} className="h-12 w-full text-base">
          {pending ? "Menyimpan…" : "Simpan Absensi"}
        </Button>
      )}
    </div>
  );
}
