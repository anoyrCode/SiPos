import { CalendarCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireRekapAbsensiSantriAkses } from "@/lib/auth/dal";
import { getStr, type SearchParams } from "@/lib/list-params";
import { todayJakarta } from "@/lib/absensi-status";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DateFilter } from "@/app/(admin)/rekap-absensi/date-filter";
import { CheckpointDialog } from "./checkpoint-dialog";
import { RekapDetailDialog } from "./rekap-detail-dialog";

type Kelas = { id: string; nama_kelas: string };
type Checkpoint = { id: string; shift: number; jam: string; urutan: number };
type Exception = {
  status: "izin" | "sakit" | "alpa";
  catatan: string | null;
  santri: { nama: string } | null;
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRekapAbsensiSantriAkses();
  const sp = await searchParams;
  const tanggalParam = getStr(sp.tanggal);
  const tanggal = tanggalParam || todayJakarta();

  const supabase = await createClient();

  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("id")
    .eq("is_aktif", true)
    .maybeSingle();

  const [{ data: checkpointData }, { data: kelasRows }] = await Promise.all([
    supabase
      .from("absensi_santri_checkpoint")
      .select("id, shift, jam, urutan")
      .order("shift")
      .order("urutan"),
    ta?.id
      ? supabase
          .from("guru_kelas")
          .select("kelas:kelas!inner(id, nama_kelas, tahun_ajaran_id)")
          .eq("kelas.tahun_ajaran_id", ta.id)
      : Promise.resolve({ data: [] as { kelas: Kelas | null }[] }),
  ]);

  const checkpoints = (checkpointData ?? []) as Checkpoint[];
  const kelasMap = new Map<string, Kelas>();
  for (const r of (kelasRows ?? []) as unknown as { kelas: Kelas | null }[]) {
    if (r.kelas) kelasMap.set(r.kelas.id, r.kelas);
  }
  const kelasList = [...kelasMap.values()].sort((a, b) =>
    a.nama_kelas.localeCompare(b.nama_kelas),
  );
  const kelasIds = kelasList.map((k) => k.id);

  const [{ data: submissionData }, { data: exceptionData }, { data: santriCountData }] =
    kelasIds.length > 0
      ? await Promise.all([
          supabase
            .from("absensi_santri_submission")
            .select("kelas_id, checkpoint_id, pegawai:pegawai(nama)")
            .in("kelas_id", kelasIds)
            .eq("tanggal", tanggal),
          supabase
            .from("absensi_santri")
            .select("kelas_id, checkpoint_id, status, catatan, santri:santri(nama)")
            .in("kelas_id", kelasIds)
            .eq("tanggal", tanggal),
          supabase.from("santri_kelas").select("kelas_id").in("kelas_id", kelasIds),
        ])
      : [
          {
            data: [] as {
              kelas_id: string;
              checkpoint_id: string;
              pegawai: { nama: string } | null;
            }[],
          },
          {
            data: [] as {
              kelas_id: string;
              checkpoint_id: string;
              status: "izin" | "sakit" | "alpa";
              catatan: string | null;
              santri: { nama: string } | null;
            }[],
          },
          { data: [] as { kelas_id: string }[] },
        ];

  const totalSantriByKelas = new Map<string, number>();
  for (const r of (santriCountData ?? []) as { kelas_id: string }[]) {
    totalSantriByKelas.set(r.kelas_id, (totalSantriByKelas.get(r.kelas_id) ?? 0) + 1);
  }

  const submissionMap = new Map<string, { dicatatOleh: string }>();
  for (const r of (submissionData ?? []) as unknown as {
    kelas_id: string;
    checkpoint_id: string;
    pegawai: { nama: string } | null;
  }[]) {
    submissionMap.set(`${r.kelas_id}:${r.checkpoint_id}`, {
      dicatatOleh: r.pegawai?.nama ?? "—",
    });
  }

  const exceptionMap = new Map<string, Exception[]>();
  for (const r of (exceptionData ?? []) as unknown as {
    kelas_id: string;
    checkpoint_id: string;
    status: "izin" | "sakit" | "alpa";
    catatan: string | null;
    santri: { nama: string } | null;
  }[]) {
    const key = `${r.kelas_id}:${r.checkpoint_id}`;
    const list = exceptionMap.get(key) ?? [];
    list.push({ status: r.status, catatan: r.catatan, santri: r.santri });
    exceptionMap.set(key, list);
  }

  const rows = kelasList.flatMap((k) =>
    checkpoints.map((c) => {
      const key = `${k.id}:${c.id}`;
      const submission = submissionMap.get(key);
      const exceptions = exceptionMap.get(key) ?? [];
      const total = totalSantriByKelas.get(k.id) ?? 0;
      const izin = exceptions.filter((e) => e.status === "izin").length;
      const sakit = exceptions.filter((e) => e.status === "sakit").length;
      const alpa = exceptions.filter((e) => e.status === "alpa").length;
      const hadir = Math.max(0, total - izin - sakit - alpa);
      return {
        key,
        kelas: k,
        checkpoint: c,
        submitted: Boolean(submission),
        dicatatOleh: submission?.dicatatOleh ?? null,
        hadir,
        izin,
        sakit,
        alpa,
        exceptions,
      };
    }),
  );

  return (
    <div className="animate-enter space-y-6 p-6 md:p-8">
      <PageHeader
        icon={CalendarCheck}
        title="Rekap Absensi Santri"
        description="Rekap kehadiran santri lintas kelas per tanggal."
      >
        <CheckpointDialog checkpoints={checkpoints} />
      </PageHeader>

      <div className="rounded-card border border-border/70 bg-card p-3 shadow-sm">
        <DateFilter value={tanggal} />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Belum ada kelas dengan musyrif yang ditugaskan tahun ajaran ini.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.key}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {r.kelas.nama_kelas}{" "}
                    <span className="font-mono text-xs text-muted-foreground">
                      · Shift {r.checkpoint.shift} · {r.checkpoint.jam.slice(0, 5)}
                    </span>
                  </p>
                  {r.submitted && (
                    <p className="text-xs text-muted-foreground">
                      Dicatat oleh {r.dicatatOleh}
                    </p>
                  )}
                </div>
                {!r.submitted ? (
                  <Badge variant="outline">Belum Diisi</Badge>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge variant="positive">{r.hadir} hadir</Badge>
                    {r.izin > 0 && <Badge variant="warning">{r.izin} izin</Badge>}
                    {r.sakit > 0 && <Badge variant="primary">{r.sakit} sakit</Badge>}
                    {r.alpa > 0 && <Badge variant="negative">{r.alpa} alpa</Badge>}
                    {r.exceptions.length > 0 && (
                      <RekapDetailDialog
                        title={`${r.kelas.nama_kelas} · ${r.checkpoint.jam.slice(0, 5)}`}
                        exceptions={r.exceptions}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
