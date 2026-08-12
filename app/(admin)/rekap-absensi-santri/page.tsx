import { CalendarCheck, ChevronRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireRekapAbsensiSantriAkses } from "@/lib/auth/dal";
import { getStr, type SearchParams } from "@/lib/list-params";
import { todayJakarta } from "@/lib/absensi-status";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterSelect } from "@/components/shared/filter-select";
import { DateFilter } from "@/app/(admin)/rekap-absensi/date-filter";
import { CheckpointDialog } from "./checkpoint-dialog";
import { RekapDetailDialog } from "./rekap-detail-dialog";
import { RekapSantriExportDialog } from "./rekap-santri-export-dialog";

type Kelas = { id: string; nama_kelas: string; jenis_kelamin: "L" | "P" | null };
type Checkpoint = { id: string; shift: number; jam: string; urutan: number };
type Exception = {
  status: "izin" | "sakit" | "alpa";
  catatan: string | null;
  santri: { nama: string } | null;
};

const PAGE_SIZE = 1000;

/**
 * Ambil SEMUA baris lewat paginasi. PostgREST membatasi 1000 baris per
 * permintaan secara diam-diam — jumlah santri di pondok ini (~780) sudah
 * dekat batas itu untuk query santri_kelas lintas semua kelas. Tanpa ini,
 * jumlah hadir bisa dihitung dari total keanggotaan yang terpotong, salah
 * tanpa pesan error.
 */
async function ambilSemua<T>(
  run: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data } = await run(from, from + PAGE_SIZE - 1);
    const batch = (data ?? []) as unknown as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRekapAbsensiSantriAkses();
  const sp = await searchParams;
  const tanggalParam = getStr(sp.tanggal);
  const tanggal = tanggalParam || todayJakarta();
  const jkFilter = getStr(sp.jk);
  // Dihitung di server (WIB) lalu dikirim sebagai prop — kalau dihitung di
  // komponen client, zona waktu perangkat pengguna bisa berbeda dari server
  // dan memicu hydration mismatch.
  const hariIni = todayJakarta();
  const awalBulan = `${hariIni.slice(0, 7)}-01`;

  const supabase = await createClient();

  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("id")
    .eq("is_aktif", true)
    .maybeSingle();

  const [{ data: checkpointData }, { data: gkData }] = await Promise.all([
    supabase
      .from("absensi_santri_checkpoint")
      .select("id, shift, jam, urutan")
      .order("shift")
      .order("urutan"),
    ta?.id
      ? supabase
          .from("guru_kelas")
          .select(
            "pegawai:pegawai(shift), kelas:kelas!inner(id, nama_kelas, jenis_kelamin, tahun_ajaran_id)",
          )
          .eq("kelas.tahun_ajaran_id", ta.id)
      : Promise.resolve({
          data: [] as { pegawai: { shift: number | null } | null; kelas: Kelas | null }[],
        }),
  ]);

  const checkpoints = (checkpointData ?? []) as Checkpoint[];

  // Kelas + shift mana saja yang benar-benar punya musyrif ditugaskan —
  // checkpoint dari shift yang TIDAK ditugaskan ke kelas itu tidak mungkin
  // pernah diisi siapapun (RLS mensyaratkan guru_kelas + shift cocok), jadi
  // dikecualikan dari rekap supaya tidak jadi baris "Belum Diisi" abadi.
  const kelasMap = new Map<string, Kelas>();
  const coveredShiftsByKelas = new Map<string, Set<number>>();
  for (const r of (gkData ?? []) as unknown as {
    pegawai: { shift: number | null } | null;
    kelas: Kelas | null;
  }[]) {
    if (!r.kelas) continue;
    kelasMap.set(r.kelas.id, r.kelas);
    if (r.pegawai?.shift) {
      const set = coveredShiftsByKelas.get(r.kelas.id) ?? new Set<number>();
      set.add(r.pegawai.shift);
      coveredShiftsByKelas.set(r.kelas.id, set);
    }
  }
  // `numeric: true` supaya "Kelas 7A" tampil sebelum "Kelas 10A" (urutan
  // alami angka), bukan diurutkan leksikografis per-karakter ("1" < "7").
  const kelasList = [...kelasMap.values()]
    .filter((k) => {
      if (jkFilter === "kosong") return k.jenis_kelamin === null;
      if (jkFilter === "L" || jkFilter === "P") return k.jenis_kelamin === jkFilter;
      return true;
    })
    .sort((a, b) =>
      a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true }),
    );
  const kelasIds = kelasList.map((k) => k.id);

  const [{ data: submissionData }, exceptionRows, santriCountRows] =
    kelasIds.length > 0
      ? await Promise.all([
          supabase
            .from("absensi_santri_submission")
            .select("kelas_id, checkpoint_id, pegawai:pegawai(nama)")
            .in("kelas_id", kelasIds)
            .eq("tanggal", tanggal),
          ambilSemua<{
            kelas_id: string;
            checkpoint_id: string;
            status: "izin" | "sakit" | "alpa";
            catatan: string | null;
            santri: { nama: string } | null;
          }>((from, to) =>
            supabase
              .from("absensi_santri")
              .select("kelas_id, checkpoint_id, status, catatan, santri:santri(nama)")
              .in("kelas_id", kelasIds)
              .eq("tanggal", tanggal)
              .order("id")
              .range(from, to),
          ),
          ambilSemua<{ kelas_id: string }>((from, to) =>
            supabase
              .from("santri_kelas")
              .select("kelas_id")
              .in("kelas_id", kelasIds)
              .order("id")
              .range(from, to),
          ),
        ])
      : [
          {
            data: [] as {
              kelas_id: string;
              checkpoint_id: string;
              pegawai: { nama: string } | null;
            }[],
          },
          [] as {
            kelas_id: string;
            checkpoint_id: string;
            status: "izin" | "sakit" | "alpa";
            catatan: string | null;
            santri: { nama: string } | null;
          }[],
          [] as { kelas_id: string }[],
        ];

  const totalSantriByKelas = new Map<string, number>();
  for (const r of santriCountRows) {
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
  for (const r of exceptionRows) {
    const key = `${r.kelas_id}:${r.checkpoint_id}`;
    const list = exceptionMap.get(key) ?? [];
    list.push({ status: r.status, catatan: r.catatan, santri: r.santri });
    exceptionMap.set(key, list);
  }

  const groups = kelasList
    .map((k) => {
      const covered = coveredShiftsByKelas.get(k.id) ?? new Set<number>();
      const kelasCheckpoints = checkpoints.filter((c) => covered.has(c.shift));
      const total = totalSantriByKelas.get(k.id) ?? 0;
      const rows = kelasCheckpoints.map((c) => {
        const key = `${k.id}:${c.id}`;
        const submission = submissionMap.get(key);
        const exceptions = exceptionMap.get(key) ?? [];
        const izin = exceptions.filter((e) => e.status === "izin").length;
        const sakit = exceptions.filter((e) => e.status === "sakit").length;
        const alpa = exceptions.filter((e) => e.status === "alpa").length;
        const hadir = Math.max(0, total - izin - sakit - alpa);
        return {
          key,
          checkpoint: c,
          submitted: Boolean(submission),
          dicatatOleh: submission?.dicatatOleh ?? null,
          hadir,
          izin,
          sakit,
          alpa,
          exceptions,
        };
      });
      return { kelas: k, rows };
    })
    .filter((g) => g.rows.length > 0);

  return (
    <div className="animate-enter space-y-6 p-6 md:p-8">
      <PageHeader
        icon={CalendarCheck}
        title="Rekap Absensi Santri"
        description="Rekap kehadiran santri lintas kelas per tanggal."
      >
        <CheckpointDialog checkpoints={checkpoints} />
      </PageHeader>

      <div className="flex flex-wrap items-end gap-3 rounded-card border border-border/70 bg-card p-3 shadow-sm">
        <DateFilter value={tanggal} />
        <FilterSelect
          param="jk"
          placeholder="Jenis kelamin"
          allLabel="Semua jenis kelamin"
          options={[
            { value: "L", label: "Putra" },
            { value: "P", label: "Putri" },
            { value: "kosong", label: "Belum diisi" },
          ]}
        />
        <div className="w-full sm:ml-auto sm:w-auto">
          <RekapSantriExportDialog
            jk={jkFilter}
            defaultDari={awalBulan}
            defaultSampai={hariIni}
          />
        </div>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {jkFilter
              ? "Tidak ada kelas yang cocok dengan filter jenis kelamin."
              : "Belum ada kelas dengan musyrif yang ditugaskan tahun ajaran ini."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const filledCount = g.rows.filter((r) => r.submitted).length;
            const totalIzin = g.rows.reduce((s, r) => s + r.izin, 0);
            const totalSakit = g.rows.reduce((s, r) => s + r.sakit, 0);
            const totalAlpa = g.rows.reduce((s, r) => s + r.alpa, 0);
            return (
              <details
                key={g.kelas.id}
                className="group overflow-hidden rounded-card border border-border/70 bg-card shadow-sm"
              >
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 bg-muted/30 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2">
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-90" />
                    <span className="font-heading text-base font-semibold">
                      {g.kelas.nama_kelas}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">
                      {filledCount}/{g.rows.length} terisi
                    </span>
                    {totalIzin > 0 && <Badge variant="warning">{totalIzin} izin</Badge>}
                    {totalSakit > 0 && <Badge variant="primary">{totalSakit} sakit</Badge>}
                    {totalAlpa > 0 && <Badge variant="negative">{totalAlpa} alpa</Badge>}
                  </span>
                </summary>
                <div className="border-t border-border/50">
                  {g.rows.map((r) => (
                    <div
                      key={r.key}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-5 py-2.5 last:border-b-0"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-xs text-muted-foreground">
                          {r.checkpoint.jam.slice(0, 5)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Shift {r.checkpoint.shift}
                        </span>
                        {r.submitted && r.dicatatOleh && (
                          <span className="hidden text-xs text-muted-foreground sm:inline">
                            · {r.dicatatOleh}
                          </span>
                        )}
                      </div>
                      {!r.submitted ? (
                        <Badge variant="outline">Belum Diisi</Badge>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="positive">{r.hadir} hadir</Badge>
                          {r.izin > 0 && <Badge variant="warning">{r.izin} izin</Badge>}
                          {r.sakit > 0 && <Badge variant="primary">{r.sakit} sakit</Badge>}
                          {r.alpa > 0 && <Badge variant="negative">{r.alpa} alpa</Badge>}
                          {r.exceptions.length > 0 && (
                            <RekapDetailDialog
                              title={`${g.kelas.nama_kelas} · ${r.checkpoint.jam.slice(0, 5)}`}
                              exceptions={r.exceptions}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
