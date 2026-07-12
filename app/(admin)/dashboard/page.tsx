import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  GraduationCap,
  MailWarning,
  PieChart,
  TrendingUp,
  Users,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireDashboard } from "@/lib/auth/dal";
import { formatDateID } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CountUp,
  LevelDonutChart,
  PerkembanganChart,
  StatistikPoinChart,
} from "./charts";
import { RankingList } from "./ranking-list";
import { cn } from "@/lib/utils";

type Tx = {
  santri_id: string;
  master_poin_id: string;
  tipe: "POSITIF" | "NEGATIF";
  nilai_poin: number;
  tanggal_kejadian: string;
};

function monthLabel(key: string): string {
  const d = new Date(`${key}-01T00:00:00`);
  const month = new Intl.DateTimeFormat("id-ID", { month: "short" }).format(d);
  const year = d.getFullYear().toString().slice(-2);
  return `${month} '${year}`;
}

function enumerateMonths(start: string, end: string): string[] {
  const res: string[] = [];
  let cur = new Date(`${start.slice(0, 7)}-01T00:00:00`);
  const last = new Date(`${end.slice(0, 7)}-01T00:00:00`);
  let guard = 0;
  while (cur <= last && guard < 36) {
    res.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    guard++;
  }
  return res;
}

const TOP_N = 7;

// Warna juara 1–3 (emas / perak / perunggu) untuk peringkat kelas.
const RANK_STYLE = [
  {
    chip: "bg-amber-100 text-amber-700 ring-1 ring-amber-300/60",
    bar: "bg-linear-to-r from-amber-300 to-amber-500",
  },
  {
    chip: "bg-slate-200 text-slate-600 ring-1 ring-slate-300/70",
    bar: "bg-linear-to-r from-slate-300 to-slate-400",
  },
  {
    chip: "bg-orange-100 text-orange-700 ring-1 ring-orange-300/60",
    bar: "bg-linear-to-r from-orange-300 to-orange-500",
  },
];

export default async function Page() {
  await requireDashboard();
  const supabase = await createClient();

  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("id, tahun, tanggal_mulai, tanggal_selesai")
    .eq("is_aktif", true)
    .maybeSingle();

  // Aktivitas terbaru: hanya 1 hari terakhir (24 jam)
  // eslint-disable-next-line react-hooks/purity -- server component, dievaluasi per request
  const sinceISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [totalSantriRes, pegawaiRes, mpRes, recentRes] = await Promise.all([
    supabase
      .from("santri")
      .select("id", { count: "exact", head: true })
      .eq("status", "aktif"),
    supabase
      .from("pegawai")
      .select("jenis_kelamin, jabatan, jabatan_tambahan"),
    supabase.from("master_poin").select("id, nama_poin, tipe, level"),
    supabase
      .from("transaksi_poin")
      .select(
        "id, tipe, nilai_poin, tanggal_kejadian, santri:santri(nama), master_poin:master_poin(nama_poin)",
      )
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Guru/musyrif: cek jabatan utama ATAU jabatan tambahan.
  const GURU_PATTERN = /guru|musyrif/i;
  function isGuruLike(p: { jabatan: string | null; jabatan_tambahan: string[] | null }) {
    return [p.jabatan, ...(p.jabatan_tambahan ?? [])]
      .filter((j): j is string => !!j)
      .some((j) => GURU_PATTERN.test(j));
  }
  const pegawaiAll = pegawaiRes.data ?? [];
  const guruLCount = pegawaiAll.filter(
    (p) => p.jenis_kelamin === "L" && isGuruLike(p),
  ).length;
  const guruPCount = pegawaiAll.filter(
    (p) => p.jenis_kelamin === "P" && isGuruLike(p),
  ).length;

  let txQuery = supabase
    .from("transaksi_poin")
    .select("santri_id, master_poin_id, tipe, nilai_poin, tanggal_kejadian");
  if (ta?.id) txQuery = txQuery.eq("tahun_ajaran_id", ta.id);
  const { data: txData } = await txQuery;
  const tx = (txData ?? []) as Tx[];

  // Penempatan santri per kelas (tahun ajaran aktif) — untuk chart poin per kelas
  const skQuery = supabase
    .from("santri_kelas")
    .select("santri_id, kelas:kelas!inner(nama_kelas, tahun_ajaran_id)");
  if (ta?.id) skQuery.eq("kelas.tahun_ajaran_id", ta.id);
  const { data: skData } = await skQuery;
  const santriKelas = new Map<string, string>();
  for (const row of (skData ?? []) as unknown as {
    santri_id: string;
    kelas: { nama_kelas: string } | null;
  }[]) {
    if (row.kelas?.nama_kelas) santriKelas.set(row.santri_id, row.kelas.nama_kelas);
  }

  const poinMeta = new Map(
    (mpRes.data ?? []).map((p) => [
      p.id,
      p as { nama_poin: string; tipe: string; level: string | null },
    ]),
  );

  // Statistik poin: jumlah kejadian per poin
  const poinCount = new Map<string, number>();
  for (const t of tx) {
    poinCount.set(t.master_poin_id, (poinCount.get(t.master_poin_id) ?? 0) + 1);
  }
  const statAll = [...poinCount.entries()].map(([id, count]) => ({
    count,
    label: poinMeta.get(id)?.nama_poin ?? "?",
    tipe: poinMeta.get(id)?.tipe,
  }));
  const statPositif = statAll
    .filter((r) => r.tipe === "POSITIF")
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N)
    .map(({ label, count }) => ({ label, count }));
  const statNegatif = statAll
    .filter((r) => r.tipe === "NEGATIF")
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N)
    .map(({ label, count }) => ({ label, count }));

  // Perkembangan bulanan
  const buckets = new Map<string, { pos: number; neg: number }>();
  // Sebaran level pelanggaran (negatif)
  const levelCount = new Map<string, number>();
  // Peringkat santri
  const santriSum = new Map<string, { pos: number; neg: number }>();
  // Poin per kelas
  const kelasSum = new Map<string, { pos: number; neg: number }>();

  for (const t of tx) {
    const kelasNama = santriKelas.get(t.santri_id);
    if (kelasNama) {
      const ks = kelasSum.get(kelasNama) ?? { pos: 0, neg: 0 };
      if (t.tipe === "POSITIF") ks.pos += t.nilai_poin;
      else ks.neg += t.nilai_poin;
      kelasSum.set(kelasNama, ks);
    }
    const k = t.tanggal_kejadian.slice(0, 7);
    const e = buckets.get(k) ?? { pos: 0, neg: 0 };
    if (t.tipe === "POSITIF") e.pos += t.nilai_poin;
    else e.neg += t.nilai_poin;
    buckets.set(k, e);

    const s = santriSum.get(t.santri_id) ?? { pos: 0, neg: 0 };
    if (t.tipe === "POSITIF") s.pos += t.nilai_poin;
    else s.neg += t.nilai_poin;
    santriSum.set(t.santri_id, s);

    if (t.tipe === "NEGATIF") {
      const lv = poinMeta.get(t.master_poin_id)?.level || "Lainnya";
      levelCount.set(lv, (levelCount.get(lv) ?? 0) + 1);
    }
  }

  const monthKeys =
    ta?.tanggal_mulai && ta?.tanggal_selesai
      ? enumerateMonths(ta.tanggal_mulai, ta.tanggal_selesai)
      : [...buckets.keys()].sort();
  const trend = monthKeys.map((k) => ({
    bulan: monthLabel(k),
    positif: buckets.get(k)?.pos ?? 0,
    negatif: buckets.get(k)?.neg ?? 0,
  }));

  const LEVEL_ORDER = ["RINGAN", "SEDANG", "BERAT"];
  const levelData = [...levelCount.entries()]
    .sort((a, b) => {
      const ia = LEVEL_ORDER.indexOf(a[0]);
      const ib = LEVEL_ORDER.indexOf(b[0]);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    })
    .map(([level, value]) => ({ level, value }));

  // Peringkat kelas berdasarkan poin positif terbanyak.
  const peringkatKelas = [...kelasSum.entries()]
    .map(([kelas, v]) => ({ nama: kelas, total: v.pos }))
    .filter((k) => k.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
  const maxKelas = Math.max(1, ...peringkatKelas.map((k) => k.total));

  const PERINGKAT_N = 20;
  const negSorted = [...santriSum.entries()]
    .filter(([, v]) => v.neg > 0)
    .sort((a, b) => b[1].neg - a[1].neg);
  const posSorted = [...santriSum.entries()]
    .filter(([, v]) => v.pos > 0)
    .sort((a, b) => b[1].pos - a[1].pos);
  const topNeg = negSorted.slice(0, PERINGKAT_N);
  const topPos = posSorted.slice(0, PERINGKAT_N);

  const SP_LEVELS = [
    { level: 1, ambang: 300 },
    { level: 2, ambang: 600 },
    { level: 3, ambang: 900 },
  ];
  function spLevelFor(totalNegatif: number): number | null {
    let level: number | null = null;
    for (const sp of SP_LEVELS) {
      if (totalNegatif >= sp.ambang) level = sp.level;
    }
    return level;
  }
  const spEligible = negSorted.filter(([, v]) => v.neg >= 300);

  const idSet = new Set(
    [...topNeg, ...topPos, ...spEligible].map(([id]) => id),
  );
  const nameMap = new Map<string, string>();
  if (idSet.size > 0) {
    const { data: names } = await supabase
      .from("santri")
      .select("id, nama")
      .in("id", [...idSet]);
    for (const s of names ?? []) nameMap.set(s.id, s.nama);
  }
  const peringkatPos = topPos.map(([id, v]) => ({
    id,
    nama: nameMap.get(id) ?? "?",
    total: v.pos,
  }));
  const perluTindakanSP = spEligible.slice(0, 8).map(([id, v]) => ({
    id,
    nama: nameMap.get(id) ?? "?",
    total: v.neg,
    sp: spLevelFor(v.neg) ?? 1,
  }));
  const perluPerhatian = negSorted.slice(0, 7).map(([id, v]) => ({
    id,
    nama: nameMap.get(id) ?? "?",
    total: v.neg,
  }));

  const recent = (recentRes.data ?? []) as unknown as {
    id: string;
    tipe: "POSITIF" | "NEGATIF";
    nilai_poin: number;
    tanggal_kejadian: string;
    santri: { nama: string } | null;
    master_poin: { nama_poin: string } | null;
  }[];

  const cards = [
    { label: "Total Santri Aktif", value: totalSantriRes.count ?? 0, icon: Users },
    { label: "Guru Laki-laki", value: guruLCount, icon: GraduationCap },
    { label: "Guru Perempuan", value: guruPCount, icon: GraduationCap },
  ];

  return (
    <div className="animate-enter space-y-4 p-4 md:space-y-6 md:p-8">
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-2xl p-4 text-white shadow-lg shadow-primary/20 sm:rounded-3xl sm:p-6 md:p-8"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #00b4d8 0%, #0092b7 55%, #036985 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 left-1/4 size-72 rounded-full bg-cyan-200/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-white/80">Dashboard</p>
            <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
              Ringkasan Poin Santri
            </h1>
            <p className="text-sm text-white/80">
              Tahun ajaran aktif: {ta?.tahun ?? "—"}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {cards.map((c) => (
              <div
                key={c.label}
                className="rounded-2xl bg-white/12 px-3 py-2.5 ring-1 ring-white/15 backdrop-blur sm:px-4 sm:py-3"
              >
                <div className="flex items-center gap-1.5 text-[11px] text-white/80 sm:text-xs">
                  <c.icon className="size-3.5 sm:size-4" />
                  <span className="truncate">{c.label}</span>
                </div>
                <CountUp
                  value={c.value}
                  className="mt-1 block font-heading text-xl font-bold tabular-nums sm:text-2xl"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {perluTindakanSP.length > 0 && (
        <Card className="border-negative/30 bg-negative-soft/40">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-negative">
                <MailWarning className="size-4" />
                Perlu Tindakan (Surat Panggilan)
              </span>
              <Link
                href="/surat-panggilan"
                className="text-xs font-medium text-primary hover:underline"
              >
                Lihat semua
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {perluTindakanSP.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/surat-panggilan?sp=${s.sp}`}
                    className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card px-3 py-2 transition-colors hover:bg-muted"
                  >
                    <Badge
                      variant={s.sp === 3 ? "negative" : "warning"}
                      className={cn(
                        "shrink-0 font-mono",
                        s.sp === 3 && "animate-pulse",
                      )}
                    >
                      SP{s.sp}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.nama}</p>
                      <p className="text-xs text-muted-foreground">
                        −{s.total} poin
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Perkembangan + Sebaran level */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              Perkembangan Poin (per bulan)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PerkembanganChart data={trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="size-4 text-primary" />
              Sebaran Level Pelanggaran
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LevelDonutChart data={levelData} />
          </CardContent>
        </Card>
      </div>

      {/* Peringkat + Perlu perhatian */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="size-4 text-positive" />
              Peringkat Poin Positif
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RankingList items={peringkatPos} variant="positive" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" />
              Perlu Perhatian
            </CardTitle>
          </CardHeader>
          <CardContent>
            {perluPerhatian.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Tidak ada santri dengan poin negatif. 🎉
              </p>
            ) : (
              <ol className="max-h-72 space-y-0.5 overflow-y-auto pr-1 scrollbar-thin">
                {perluPerhatian.map((s, idx) => (
                  <li key={s.id}>
                    <Link
                      href={`/santri/${s.id}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-negative-soft text-xs font-semibold text-negative">
                        {idx + 1}
                      </span>
                      <span className="flex-1 truncate text-sm font-medium">
                        {s.nama}
                      </span>
                      <Badge variant="negative" className="font-mono">
                        −{s.total}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="size-4 text-positive" />
              Peringkat Kelas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {peringkatKelas.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Belum ada data.
              </p>
            ) : (
              <ol className="max-h-80 space-y-1 overflow-y-auto pr-1 scrollbar-thin">
                {peringkatKelas.map((k, idx) => {
                  const r = RANK_STYLE[idx];
                  return (
                    <li
                      key={k.nama}
                      className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/50"
                    >
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums shadow-sm",
                          r ? r.chip : "bg-muted text-muted-foreground",
                        )}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{k.nama}</p>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              r ? r.bar : "bg-chart-pos",
                            )}
                            style={{
                              width: `${Math.round((k.total / maxKelas) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <Badge variant="positive" className="shrink-0 font-mono">
                        +{k.total}
                      </Badge>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Statistik + Aktivitas */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              Statistik Poin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatistikPoinChart positif={statPositif} negatif={statNegatif} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              Aktivitas Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Belum ada aktivitas dalam 24 jam terakhir.
              </p>
            ) : (
              <div className="max-h-60 space-y-1 overflow-y-auto pr-1 scrollbar-thin">
                {recent.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-4 border-b py-2.5 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {r.santri?.nama ?? "—"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.master_poin?.nama_poin ?? "—"} ·{" "}
                        {formatDateID(r.tanggal_kejadian)}
                      </p>
                    </div>
                    <Badge
                      variant={r.tipe === "POSITIF" ? "positive" : "negative"}
                      className="shrink-0 font-mono"
                    >
                      {r.tipe === "POSITIF" ? "+" : "−"}
                      {r.nilai_poin}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
