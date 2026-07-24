import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  GraduationCap,
  MailWarning,
  Minus,
  PieChart,
  TrendingDown,
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

/** Bentuk hasil RPC `dashboard_stats` (agregasi transaksi_poin di database). */
type DashboardStats = {
  per_santri: { santri_id: string; pos: number; neg: number }[];
  per_poin: { master_poin_id: string; count: number }[];
  per_month: { month: string; pos: number; neg: number }[];
  per_level: { level: string; count: number }[];
  prev: { pos: number; neg: number; count: number } | null;
};

const TX_PAGE_SIZE = 1000;

/**
 * Ambil SEMUA baris transaksi_poin (opsional difilter 1 tahun ajaran),
 * dipaginasi penuh — Supabase/PostgREST membatasi 1000 baris per request
 * secara default, jadi tahun ajaran dgn >1000 transaksi bakal diam-diam
 * terpotong tanpa ini (baris mana yg kepotong tidak menentu krn tidak
 * ada `.order()`, bisa termasuk transaksi terbaru).
 *
 * TAMBAL SEMENTARA: sekuensial (bukan paralel) + tanpa count exact, karena
 * di Supabase free-tier (compute kecil) query paralel + full count bikin
 * sebagian query kena statement timeout → dashboard Oops. Kalau 1 halaman
 * gagal, berhenti & pakai yang sudah kekumpul (jangan lempar Oops).
 * Solusi sebenarnya: agregasi di database, sedang dikerjakan.
 */
async function fetchAllTransaksi<T>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  select: string,
  taId?: string,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    let q = supabase
      .from("transaksi_poin")
      .select(select)
      .range(from, from + TX_PAGE_SIZE - 1);
    if (taId) q = q.eq("tahun_ajaran_id", taId);
    const { data, error } = await q;
    if (error) break;
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < TX_PAGE_SIZE) break;
    from += TX_PAGE_SIZE;
  }
  return rows;
}

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

/** Persentase perubahan dibanding tahun sebelumnya + arah (naik/turun/tetap). */
function formatDelta(
  current: number,
  previous: number,
): { text: string; direction: "up" | "down" | "flat" } {
  if (previous === 0) {
    return current === 0
      ? { text: "0%", direction: "flat" }
      : { text: "Baru", direction: "up" };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { text: "0%", direction: "flat" };
  return { text: `${pct > 0 ? "+" : ""}${pct}%`, direction: pct > 0 ? "up" : "down" };
}

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

  // `ta` dan `taListAll` independen satu sama lain — paralel, bukan berurutan.
  const [{ data: ta }, { data: taListAll }] = await Promise.all([
    supabase
      .from("tahun_ajaran")
      .select("id, tahun, tanggal_mulai, tanggal_selesai")
      .eq("is_aktif", true)
      .maybeSingle(),
    // Tahun ajaran sebelumnya (utk perbandingan) — diurutkan dari teks "tahun"
    // (format "YYYY/YYYY", urut leksikografis = urut kronologis).
    supabase
      .from("tahun_ajaran")
      .select("id, tahun")
      .order("tahun", { ascending: false }),
  ]);
  const taIdx = (taListAll ?? []).findIndex((t) => t.id === ta?.id);
  const taSebelumnya =
    taIdx >= 0 ? (taListAll ?? [])[taIdx + 1] : undefined;

  // Aktivitas terbaru: hanya 1 hari terakhir (24 jam)
  // eslint-disable-next-line react-hooks/purity -- server component, dievaluasi per request
  const sinceISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Penempatan santri per kelas (tahun ajaran aktif) — untuk chart poin per kelas
  const skQuery = supabase
    .from("santri_kelas")
    .select("santri_id, kelas:kelas!inner(nama_kelas, tahun_ajaran_id)");
  if (ta?.id) skQuery.eq("kelas.tahun_ajaran_id", ta.id);

  // Semua query di bawah ini independen satu sama lain (gak ada yg butuh hasil
  // query lain di grup ini) — jalankan paralel, bukan berurutan, supaya round-trip
  // ke Supabase jadi 1 gelombang bersamaan alih-alih berantai.
  const [
    totalSantriRes,
    pegawaiRes,
    mpRes,
    recentRes,
    jabatanGuruRes,
    statsRes,
    { data: skData },
  ] = await Promise.all([
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
    supabase.from("jabatan").select("nama").eq("is_guru", true),
    supabase.rpc("dashboard_stats", {
      p_ta: ta?.id ?? null,
      p_ta_prev: taSebelumnya?.id ?? null,
    }),
    skQuery,
  ]);

  // Guru/musyrif: jabatan (utama ATAU tambahan) cocok daftar is_guru=true dari master jabatan.
  const guruNamaSet = new Set(
    (jabatanGuruRes.data ?? []).map((j) => j.nama.toLowerCase()),
  );
  function isGuruLike(p: { jabatan: string | null; jabatan_tambahan: string[] | null }) {
    return [p.jabatan, ...(p.jabatan_tambahan ?? [])]
      .filter((j): j is string => !!j)
      .some((j) => guruNamaSet.has(j.toLowerCase()));
  }
  const pegawaiAll = pegawaiRes.data ?? [];
  const guruLCount = pegawaiAll.filter(
    (p) => p.jenis_kelamin === "L" && isGuruLike(p),
  ).length;
  const guruPCount = pegawaiAll.filter(
    (p) => p.jenis_kelamin === "P" && isGuruLike(p),
  ).length;

  // Perbandingan dgn tahun ajaran sebelumnya — diisi di blok agregat di
  // bawah (setelah santriSum/poinCount/prevTotals tersedia).
  let perbandinganTa: {
    taSebelumnyaLabel: string;
    posAktif: number;
    posSebelumnya: number;
    negAktif: number;
    negSebelumnya: number;
    jumlahAktif: number;
    jumlahSebelumnya: number;
  } | null = null;
  const santriKelas = new Map<string, string>();
  for (const row of (skData ?? []) as unknown as {
    santri_id: string;
    kelas: { nama_kelas: string } | null;
  }[]) {
    if (row.kelas?.nama_kelas) santriKelas.set(row.santri_id, row.kelas.nama_kelas);
  }
  // Jumlah santri per kelas — dipakai buat rata-ratakan Peringkat Kelas,
  // supaya kelas dgn santri lebih banyak gak otomatis unggul cuma krn totalnya besar.
  const kelasCount = new Map<string, number>();
  for (const nama of santriKelas.values()) {
    kelasCount.set(nama, (kelasCount.get(nama) ?? 0) + 1);
  }

  const poinMeta = new Map(
    (mpRes.data ?? []).map((p) => [
      p.id,
      p as { nama_poin: string; tipe: string; level: string | null },
    ]),
  );

  // ---- Agregat transaksi_poin ----
  // Sumber utama: RPC dashboard_stats (penjumlahan di database — cepat,
  // cuma transfer hasil ringkas). Kalau RPC gagal (mis. migration 0032
  // belum dijalankan di Supabase), fallback ke agregasi di JS dari
  // fetchAllTransaksi (lambat, tapi tetap render — deploy aman).
  const santriSum = new Map<string, { pos: number; neg: number }>();
  const poinCount = new Map<string, number>();
  const buckets = new Map<string, { pos: number; neg: number }>();
  const levelCount = new Map<string, number>();
  let prevTotals: { pos: number; neg: number; count: number } | null = null;

  const stats = (statsRes.data as DashboardStats | null) ?? null;
  if (stats && !statsRes.error) {
    for (const r of stats.per_santri)
      santriSum.set(r.santri_id, { pos: r.pos, neg: r.neg });
    for (const r of stats.per_poin) poinCount.set(r.master_poin_id, r.count);
    for (const r of stats.per_month)
      buckets.set(r.month, { pos: r.pos, neg: r.neg });
    for (const r of stats.per_level) levelCount.set(r.level, r.count);
    prevTotals = stats.prev;
  } else {
    const tx = await fetchAllTransaksi<Tx>(
      supabase,
      "santri_id, master_poin_id, tipe, nilai_poin, tanggal_kejadian",
      ta?.id,
    );
    for (const t of tx) {
      const s = santriSum.get(t.santri_id) ?? { pos: 0, neg: 0 };
      if (t.tipe === "POSITIF") s.pos += t.nilai_poin;
      else s.neg += t.nilai_poin;
      santriSum.set(t.santri_id, s);

      poinCount.set(t.master_poin_id, (poinCount.get(t.master_poin_id) ?? 0) + 1);

      const k = t.tanggal_kejadian.slice(0, 7);
      const e = buckets.get(k) ?? { pos: 0, neg: 0 };
      if (t.tipe === "POSITIF") e.pos += t.nilai_poin;
      else e.neg += t.nilai_poin;
      buckets.set(k, e);

      if (t.tipe === "NEGATIF") {
        const lv = poinMeta.get(t.master_poin_id)?.level || "Lainnya";
        levelCount.set(lv, (levelCount.get(lv) ?? 0) + 1);
      }
    }
    if (taSebelumnya) {
      const txPrev = await fetchAllTransaksi<{ tipe: string; nilai_poin: number }>(
        supabase,
        "tipe, nilai_poin",
        taSebelumnya.id,
      );
      const sum = (tipe: string) =>
        txPrev.filter((r) => r.tipe === tipe).reduce((s, r) => s + r.nilai_poin, 0);
      prevTotals = { pos: sum("POSITIF"), neg: sum("NEGATIF"), count: txPrev.length };
    }
  }

  // Poin per kelas — dijumlahkan dari total per santri + peta santri→kelas
  // (setara menjumlahkan tiap transaksi, tanpa perlu baris mentah).
  const kelasSum = new Map<string, { pos: number; neg: number }>();
  for (const [santriId, v] of santriSum) {
    const kelasNama = santriKelas.get(santriId);
    if (!kelasNama) continue;
    const ks = kelasSum.get(kelasNama) ?? { pos: 0, neg: 0 };
    ks.pos += v.pos;
    ks.neg += v.neg;
    kelasSum.set(kelasNama, ks);
  }

  if (taSebelumnya) {
    let posAktif = 0;
    let negAktif = 0;
    for (const v of santriSum.values()) {
      posAktif += v.pos;
      negAktif += v.neg;
    }
    let jumlahAktif = 0;
    for (const c of poinCount.values()) jumlahAktif += c;
    const prev = prevTotals ?? { pos: 0, neg: 0, count: 0 };
    perbandinganTa = {
      taSebelumnyaLabel: taSebelumnya.tahun,
      posAktif,
      posSebelumnya: prev.pos,
      negAktif,
      negSebelumnya: prev.neg,
      jumlahAktif,
      jumlahSebelumnya: prev.count,
    };
  }

  // Statistik poin: jumlah kejadian per poin (dari poinCount di atas)
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

  // Peringkat kelas berdasarkan rata-rata skor bersih (positif - negatif)
  // PER SANTRI — bukan total kelas, supaya kelas dgn santri lebih banyak
  // gak otomatis unggul cuma krn jumlah santrinya, bukan performanya.
  const peringkatKelas = [...kelasSum.entries()]
    .map(([kelas, v]) => {
      const jumlahSantri = kelasCount.get(kelas) ?? 0;
      const net = v.pos - v.neg;
      return {
        nama: kelas,
        total: jumlahSantri > 0 ? Math.round(net / jumlahSantri) : net,
      };
    })
    .filter((k) => k.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
  const maxKelas = Math.max(1, ...peringkatKelas.map((k) => k.total));

  const PERINGKAT_N = 20;
  const negSorted = [...santriSum.entries()]
    .filter(([, v]) => v.neg > 0)
    .sort((a, b) => b[1].neg - a[1].neg);
  const posSorted = [...santriSum.entries()]
    .filter(([, v]) => v.pos - v.neg > 0)
    .sort((a, b) => (b[1].pos - b[1].neg) - (a[1].pos - a[1].neg));
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
    total: v.pos - v.neg,
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

      {perbandinganTa && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              Perbandingan Tahun Ajaran
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              {ta?.tahun ?? "—"} dibanding {perbandinganTa.taSebelumnyaLabel}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(
                [
                  {
                    label: "Poin Positif",
                    current: perbandinganTa.posAktif,
                    previous: perbandinganTa.posSebelumnya,
                    goodDirection: "up" as const,
                  },
                  {
                    label: "Poin Negatif",
                    current: perbandinganTa.negAktif,
                    previous: perbandinganTa.negSebelumnya,
                    goodDirection: "down" as const,
                  },
                  {
                    label: "Jumlah Transaksi",
                    current: perbandinganTa.jumlahAktif,
                    previous: perbandinganTa.jumlahSebelumnya,
                    goodDirection: null,
                  },
                ] as const
              ).map((m) => {
                const delta = formatDelta(m.current, m.previous);
                const isGood =
                  m.goodDirection !== null && delta.direction === m.goodDirection;
                const isBad =
                  m.goodDirection !== null &&
                  delta.direction !== "flat" &&
                  delta.direction !== m.goodDirection;
                const Icon =
                  delta.direction === "up"
                    ? TrendingUp
                    : delta.direction === "down"
                      ? TrendingDown
                      : Minus;
                return (
                  <div
                    key={m.label}
                    className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5"
                  >
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-mono text-lg font-semibold tabular-nums">
                        {m.current}
                      </span>
                      <span
                        className={cn(
                          "flex items-center gap-0.5 text-xs font-medium",
                          isGood && "text-positive",
                          isBad && "text-negative",
                          !isGood && !isBad && "text-muted-foreground",
                        )}
                      >
                        <Icon className="size-3" />
                        {delta.text}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sebelumnya: {m.previous}
                    </p>
                  </div>
                );
              })}
            </div>
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
            <p className="text-xs text-muted-foreground">Skor bersih (positif − negatif)</p>
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
            <p className="text-xs text-muted-foreground">
              Rata-rata skor bersih per santri
            </p>
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
