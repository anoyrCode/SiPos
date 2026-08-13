import Link from "next/link";
import { CalendarCheck, Check, TriangleAlert } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireAbsensiSantri } from "@/lib/auth/dal";
import { getStr, type SearchParams } from "@/lib/list-params";
import { todayJakarta, nowHHMMJakarta } from "@/lib/absensi-status";
import {
  isCheckpointBelumTerjadi,
  isCheckpointTerlaluAwal,
  jamMulaiBolehSimpan,
  mostRecentCheckpointId,
  tanggalShift,
} from "@/lib/absensi-santri";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AbsensiSantriForm, type KelasGroup } from "./absensi-santri-form";
import type { CatatanItem } from "./catatan-dialog";

type Checkpoint = { id: string; jam: string; urutan: number };
type Kelas = { id: string; nama_kelas: string };
type Santri = { id: string; nis: string | null; nama: string };
type ExceptionRow = {
  santri_id: string;
  kelas_id: string;
  checkpoint_id: string;
  status: "izin" | "sakit" | "alpa";
  catatan: string | null;
};
type SubmissionRow = { kelas_id: string; checkpoint_id: string; updated_at: string };

const PAGE_SIZE = 1000;

/**
 * Ambil SEMUA baris lewat paginasi. PostgREST membatasi 1000 baris per
 * permintaan secara diam-diam — musyrif shift 3 sering ditugaskan ke SEMUA
 * kelas (~780 santri di pondok ini), sudah dekat batas itu. Tanpa ini,
 * kelas yang terurut belakangan bisa kehilangan sebagian/semua roster-nya
 * tanpa pesan error, dan santrinya otomatis terhitung hadir di rekap.
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
  const profile = await requireAbsensiSantri();
  const sp = await searchParams;
  const supabase = await createClient();

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
    .sort((a, b) => a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true }));

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

  const nowHHMM = nowHHMMJakarta();
  const tanggal = tanggalShift(checkpoints, nowHHMM, todayJakarta());
  const checkpointParam = getStr(sp.checkpoint);
  const autoCheckpointId = mostRecentCheckpointId(checkpoints, nowHHMM);
  const selectedCheckpoint =
    checkpoints.find((c) => c.id === checkpointParam) ??
    checkpoints.find((c) => c.id === autoCheckpointId)!;
  // `?checkpoint=` di URL nempel terus lintas refresh (state ada di URL,
  // bukan di memori) — kalau musyrif sempat pindah ke jam lain lalu lupa,
  // halaman ini bisa kelihatan "nyangkut" di jam lama. Kasih jalan keluar
  // eksplisit, cuma muncul kalau memang lagi menyimpang dari jam sekarang.
  const isManualOverride = checkpointParam !== "" && selectedCheckpoint.id !== autoCheckpointId;
  const hariIni = todayJakarta();
  const belumTerjadi = isCheckpointBelumTerjadi(
    selectedCheckpoint.jam,
    nowHHMM,
    tanggal,
    hariIni,
  );
  const terlaluAwal = isCheckpointTerlaluAwal(
    selectedCheckpoint.jam,
    nowHHMM,
    tanggal,
    hariIni,
  );

  // Musyrif shift 3 (jaga malam) sering menampung SEMUA kelas sekaligus —
  // supaya tidak harus pindah halaman per kelas satu-satu, semua kelas
  // yang diampu ditampilkan sekaligus dalam satu layar (scroll), dibatch
  // jadi 3 query total (bukan N query per kelas).
  const kelasIds = kelasOptions.map((k) => k.id);

  const [rosterRows, exceptionRows, { data: allSubmissionsData }, { data: catatanData }] =
    await Promise.all([
    ambilSemua<{ kelas_id: string; santri: Santri | null }>((from, to) =>
      supabase
        .from("santri_kelas")
        .select("kelas_id, santri:santri(id, nis, nama)")
        .in("kelas_id", kelasIds)
        .order("id")
        .range(from, to),
    ),
    ambilSemua<ExceptionRow>((from, to) =>
      supabase
        .from("absensi_santri")
        .select("santri_id, kelas_id, checkpoint_id, status, catatan")
        .in("kelas_id", kelasIds)
        .eq("tanggal", tanggal)
        .order("id")
        .range(from, to),
    ),
    supabase
      .from("absensi_santri_submission")
      .select("kelas_id, checkpoint_id, updated_at")
      .in("kelas_id", kelasIds)
      .eq("tanggal", tanggal)
      .order("updated_at", { ascending: false }),
    supabase
      .from("absensi_santri_catatan")
      .select("id, kelas_id, jam, isi")
      .in("kelas_id", kelasIds)
      .eq("tanggal", tanggal)
      .eq("shift", profile.shift)
      .order("jam"),
    ]);

  const rosterByKelas = new Map<string, Santri[]>();
  for (const r of rosterRows) {
    if (!r.santri) continue;
    const list = rosterByKelas.get(r.kelas_id) ?? [];
    list.push(r.santri);
    rosterByKelas.set(r.kelas_id, list);
  }
  for (const list of rosterByKelas.values()) {
    list.sort((a, b) => a.nama.localeCompare(b.nama));
  }

  const exceptionsByKelasCheckpoint = new Map<string, ExceptionRow[]>();
  for (const e of exceptionRows) {
    const key = `${e.kelas_id}:${e.checkpoint_id}`;
    const list = exceptionsByKelasCheckpoint.get(key) ?? [];
    list.push(e);
    exceptionsByKelasCheckpoint.set(key, list);
  }

  const submissionsByKelas = new Map<string, SubmissionRow[]>();
  // Berapa kelas milik musyrif ini yang sudah terisi di TIAP jam — dipakai
  // untuk menandai deretan jam di atas. Tanpa ini musyrif tidak punya cara
  // tahu jam mana yang sudah dia kerjakan selain membukanya satu per satu.
  const terisiPerCheckpoint = new Map<string, number>();
  for (const s of (allSubmissionsData ?? []) as SubmissionRow[]) {
    const list = submissionsByKelas.get(s.kelas_id) ?? [];
    list.push(s);
    submissionsByKelas.set(s.kelas_id, list);
    terisiPerCheckpoint.set(
      s.checkpoint_id,
      (terisiPerCheckpoint.get(s.checkpoint_id) ?? 0) + 1,
    );
  }

  const catatanByKelas = new Map<string, CatatanItem[]>();
  for (const c of (catatanData ?? []) as {
    id: string;
    kelas_id: string;
    jam: string;
    isi: string;
  }[]) {
    const list = catatanByKelas.get(c.kelas_id) ?? [];
    list.push({ id: c.id, jam: c.jam, isi: c.isi });
    catatanByKelas.set(c.kelas_id, list);
  }

  const groups: KelasGroup[] = kelasOptions.map((k) => {
    const roster = rosterByKelas.get(k.id) ?? [];
    // `submissionsByKelas` sudah terurut desc updated_at (dari query di atas).
    const kelasSubmissions = submissionsByKelas.get(k.id) ?? [];
    const submitted = kelasSubmissions.some((s) => s.checkpoint_id === selectedCheckpoint.id);

    const initialExceptions: Record<
      string,
      { status: "izin" | "sakit" | "alpa"; catatan: string | null }
    > = {};
    if (submitted) {
      // Checkpoint ini sudah pernah diisi untuk kelas ini — pakai apa adanya.
      const rows = exceptionsByKelasCheckpoint.get(`${k.id}:${selectedCheckpoint.id}`) ?? [];
      for (const e of rows) {
        initialExceptions[e.santri_id] = { status: e.status, catatan: e.catatan };
      }
    } else {
      // BELUM diisi — carry-forward dari checkpoint lain yang paling baru
      // disubmit hari ini untuk kelas yang sama (kalau ada).
      const latestOther = kelasSubmissions.find(
        (s) => s.checkpoint_id !== selectedCheckpoint.id,
      );
      if (latestOther) {
        const rows =
          exceptionsByKelasCheckpoint.get(`${k.id}:${latestOther.checkpoint_id}`) ?? [];
        for (const e of rows) {
          initialExceptions[e.santri_id] = { status: e.status, catatan: e.catatan };
        }
      }
    }

    return {
      kelasId: k.id,
      kelasNama: k.nama_kelas,
      submitted,
      roster,
      initialExceptions,
      catatan: catatanByKelas.get(k.id) ?? [],
    };
  });

  return (
    <div className="animate-enter space-y-6 p-6 md:p-8">
      <PageHeader
        icon={CalendarCheck}
        title="Absensi Santri"
        description={`${kelasOptions.length} kelas · Shift ${profile.shift}`}
      />

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {checkpoints.map((c) => {
            const terisi = terisiPerCheckpoint.get(c.id) ?? 0;
            const lengkap = terisi >= kelasOptions.length;
            const dipilih = c.id === selectedCheckpoint.id;
            return (
              <Link
                key={c.id}
                href={`/absensi-santri?checkpoint=${c.id}`}
                title={
                  lengkap
                    ? "Semua kelas Anda sudah diisi di jam ini"
                    : terisi > 0
                      ? `${terisi} dari ${kelasOptions.length} kelas sudah diisi di jam ini`
                      : "Belum ada kelas yang diisi di jam ini"
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-sm font-medium transition-colors",
                  dipilih
                    ? "border-primary bg-primary/10 text-primary"
                    : lengkap
                      ? "border-positive/40 bg-positive-soft text-positive"
                      : "border-border/70 text-muted-foreground hover:bg-accent/60",
                )}
              >
                {c.jam.slice(0, 5)}
                {lengkap ? (
                  <Check className="size-3.5 shrink-0" />
                ) : terisi > 0 ? (
                  <span className="font-sans text-[0.7rem] tabular-nums">
                    {terisi}/{kelasOptions.length}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Sekarang {nowHHMM} WIB · tanda <Check className="inline size-3 align-[-1px]" /> berarti
          semua kelas Anda sudah diisi di jam itu.
        </p>
      </div>

      {isManualOverride && (
        <Link
          href="/absensi-santri"
          className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary underline underline-offset-2"
        >
          Kembali ke jam saat ini
        </Link>
      )}

      {/* Jam terpilih belum tiba — terjadi kalau halaman dibuka sebelum shift
          dimulai, atau musyrif sengaja mengklik jam yang belum datang. Kalau
          disimpan, di rekap admin akan muncul sebagai "jam itu sudah diisi"
          padahal jamnya belum terjadi — persis kebingungan yang dilaporkan.
          Selisih kecil (mengisi menjelang jamnya) cuma diperingatkan; yang
          jauh sebelum waktunya ditolak, sejalan dengan gerbang di server. */}
      {belumTerjadi && (
        <div
          className={cn(
            "flex items-start gap-2.5 rounded-card border px-4 py-3 text-sm",
            terlaluAwal
              ? "border-negative/40 bg-negative-soft text-negative"
              : "border-warning/40 bg-warning-soft text-warning",
          )}
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {terlaluAwal ? (
            <p>
              Jam{" "}
              <span className="font-mono font-semibold">
                {selectedCheckpoint.jam.slice(0, 5)}
              </span>{" "}
              belum tiba (sekarang {nowHHMM} WIB), jadi belum bisa disimpan. Absensi jam ini
              terbuka mulai{" "}
              <span className="font-mono font-semibold">
                {jamMulaiBolehSimpan(selectedCheckpoint.jam)}
              </span>
              . Untuk mengisi jam yang sudah lewat, pilih jamnya di atas.
            </p>
          ) : (
            <p>
              Jam{" "}
              <span className="font-mono font-semibold">
                {selectedCheckpoint.jam.slice(0, 5)}
              </span>{" "}
              belum terjadi (sekarang {nowHHMM} WIB). Kalau disimpan sekarang, di rekap akan
              tercatat sebagai absensi jam {selectedCheckpoint.jam.slice(0, 5)}.
            </p>
          )}
        </div>
      )}

      {/* `key` WAJIB: pindah checkpoint itu soft-navigation (searchParams
          berubah, posisi komponen di tree sama), jadi React akan MEMPERTAHANKAN
          state form — inisialisasi useState hanya jalan sekali saat mount.
          Tanpa key, status yang ditandai di checkpoint sebelumnya ikut kebawa
          ke checkpoint berikutnya & bisa tersimpan sebagai data yang salah. */}
      <AbsensiSantriForm
        key={`${selectedCheckpoint.id}:${tanggal}`}
        checkpointId={selectedCheckpoint.id}
        tanggal={tanggal}
        groups={groups}
        terkunci={terlaluAwal}
        jamSekarang={nowHHMM}
      />
    </div>
  );
}
