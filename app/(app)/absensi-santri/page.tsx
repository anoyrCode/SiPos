import Link from "next/link";
import { CalendarCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireAbsensiSantri } from "@/lib/auth/dal";
import { getStr, type SearchParams } from "@/lib/list-params";
import { todayJakarta } from "@/lib/absensi-status";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AbsensiSantriForm } from "./absensi-santri-form";

type Checkpoint = { id: string; jam: string; urutan: number };
type Kelas = { id: string; nama_kelas: string };
type Santri = { id: string; nis: string | null; nama: string };
type ExceptionRow = {
  santri_id: string;
  status: "izin" | "sakit" | "alpa";
  catatan: string | null;
};

function minutesOfDay(hhmmss: string): number {
  const [h, m] = hhmmss.split(":").map(Number);
  return h * 60 + m;
}

function nearestCheckpointId(checkpoints: Checkpoint[], nowHHMM: string): string {
  const now = minutesOfDay(nowHHMM);
  let bestId = checkpoints[0].id;
  let bestDiff = Infinity;
  for (const c of checkpoints) {
    const cm = minutesOfDay(c.jam);
    const diff = Math.min(Math.abs(cm - now), 1440 - Math.abs(cm - now));
    if (diff < bestDiff) {
      bestDiff = diff;
      bestId = c.id;
    }
  }
  return bestId;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const profile = await requireAbsensiSantri();
  const sp = await searchParams;
  const supabase = await createClient();
  const tanggal = todayJakarta();

  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("id")
    .eq("is_aktif", true)
    .maybeSingle();

  if (!ta?.id || !profile.pegawai_id || !profile.shift) {
    return (
      <div className="animate-enter space-y-6 p-6 md:p-8">
        <PageHeader icon={CalendarCheck} title="Absensi Santri" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {!ta?.id
              ? "Belum ada tahun ajaran aktif."
              : "Akun ini belum terhubung ke data pegawai atau belum diatur shift-nya."}
          </CardContent>
        </Card>
      </div>
    );
  }

  const [{ data: checkpointData }, { data: gkData }] = await Promise.all([
    supabase
      .from("absensi_santri_checkpoint")
      .select("id, jam, urutan")
      .eq("shift", profile.shift)
      .order("urutan"),
    supabase
      .from("guru_kelas")
      .select("kelas:kelas!inner(id, nama_kelas, tahun_ajaran_id)")
      .eq("pegawai_id", profile.pegawai_id)
      .eq("kelas.tahun_ajaran_id", ta.id),
  ]);

  const checkpoints = (checkpointData ?? []) as Checkpoint[];
  const kelasOptions = ((gkData ?? []) as unknown as { kelas: Kelas | null }[])
    .map((r) => r.kelas)
    .filter((k): k is Kelas => Boolean(k))
    .sort((a, b) => a.nama_kelas.localeCompare(b.nama_kelas));

  if (checkpoints.length === 0 || kelasOptions.length === 0) {
    return (
      <div className="animate-enter space-y-6 p-6 md:p-8">
        <PageHeader icon={CalendarCheck} title="Absensi Santri" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {checkpoints.length === 0
              ? "Belum ada jadwal checkpoint untuk shift Anda. Hubungi admin."
              : "Anda belum ditugaskan ke kelas manapun tahun ajaran ini."}
          </CardContent>
        </Card>
      </div>
    );
  }

  const kelasParam = getStr(sp.kelas);
  const selectedKelas =
    kelasOptions.find((k) => k.id === kelasParam) ?? kelasOptions[0];

  const nowHHMM = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  const checkpointParam = getStr(sp.checkpoint);
  const selectedCheckpoint =
    checkpoints.find((c) => c.id === checkpointParam) ??
    checkpoints.find((c) => c.id === nearestCheckpointId(checkpoints, nowHHMM))!;

  const [{ data: rosterData }, { data: existingData }, { data: submissionsToday }] =
    await Promise.all([
      supabase
        .from("santri_kelas")
        .select("santri:santri(id, nis, nama)")
        .eq("kelas_id", selectedKelas.id),
      supabase
        .from("absensi_santri")
        .select("santri_id, status, catatan")
        .eq("checkpoint_id", selectedCheckpoint.id)
        .eq("kelas_id", selectedKelas.id)
        .eq("tanggal", tanggal),
      supabase
        .from("absensi_santri_submission")
        .select("checkpoint_id, updated_at")
        .eq("kelas_id", selectedKelas.id)
        .eq("tanggal", tanggal)
        .order("updated_at", { ascending: false }),
    ]);

  const roster = ((rosterData ?? []) as unknown as { santri: Santri | null }[])
    .map((r) => r.santri)
    .filter((s): s is Santri => Boolean(s))
    .sort((a, b) => a.nama.localeCompare(b.nama));

  const initialExceptions: Record<
    string,
    { status: "izin" | "sakit" | "alpa"; catatan: string | null }
  > = {};
  const existingForThisCheckpoint = (existingData ?? []) as ExceptionRow[];

  if (existingForThisCheckpoint.length > 0) {
    // Checkpoint ini sudah pernah diisi — pakai datanya apa adanya.
    for (const e of existingForThisCheckpoint) {
      initialExceptions[e.santri_id] = { status: e.status, catatan: e.catatan };
    }
  } else {
    // Checkpoint ini BELUM diisi — carry-forward dari checkpoint lain yang
    // paling baru disubmit hari ini untuk kelas yang sama (kalau ada).
    const latestOther = (submissionsToday ?? []).find(
      (s) => s.checkpoint_id !== selectedCheckpoint.id,
    );
    if (latestOther) {
      const { data: carryData } = await supabase
        .from("absensi_santri")
        .select("santri_id, status, catatan")
        .eq("checkpoint_id", latestOther.checkpoint_id)
        .eq("kelas_id", selectedKelas.id)
        .eq("tanggal", tanggal);
      for (const e of (carryData ?? []) as ExceptionRow[]) {
        initialExceptions[e.santri_id] = { status: e.status, catatan: e.catatan };
      }
    }
  }

  const submittedCheckpointIds = new Set(
    (submissionsToday ?? []).map((s) => s.checkpoint_id),
  );

  return (
    <div className="animate-enter space-y-6 p-6 md:p-8">
      <PageHeader
        icon={CalendarCheck}
        title="Absensi Santri"
        description={`${selectedKelas.nama_kelas} · Shift ${profile.shift}`}
      />

      {kelasOptions.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {kelasOptions.map((k) => (
            <Link
              key={k.id}
              href={`/absensi-santri?kelas=${k.id}&checkpoint=${selectedCheckpoint.id}`}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                k.id === selectedKelas.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/70 text-muted-foreground hover:bg-accent/60",
              )}
            >
              {k.nama_kelas}
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {checkpoints.map((c) => (
          <Link
            key={c.id}
            href={`/absensi-santri?kelas=${selectedKelas.id}&checkpoint=${c.id}`}
            className={cn(
              "rounded-full border px-3 py-1.5 font-mono text-sm font-medium transition-colors",
              c.id === selectedCheckpoint.id
                ? "border-primary bg-primary/10 text-primary"
                : submittedCheckpointIds.has(c.id)
                  ? "border-positive/40 bg-positive-soft text-positive"
                  : "border-border/70 text-muted-foreground hover:bg-accent/60",
            )}
          >
            {c.jam.slice(0, 5)}
          </Link>
        ))}
      </div>

      <AbsensiSantriForm
        kelasId={selectedKelas.id}
        checkpointId={selectedCheckpoint.id}
        tanggal={tanggal}
        roster={roster}
        initialExceptions={initialExceptions}
      />
    </div>
  );
}
