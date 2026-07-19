import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  HeartPulse,
  Minus,
  PieChart,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { orDash } from "@/lib/format";
import { getStr, type SearchParams } from "@/lib/list-params";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { computeSantriProgress, computeSantriStatusLevel, santriStatusTone } from "@/lib/santri-status";
import { SantriStatusBadge } from "@/components/shared/santri-status-badge";
import { SantriProgressBar } from "@/components/shared/santri-progress-bar";
import { KomposisiPoin, PerkembanganSkor } from "./charts";
import { RiwayatList } from "./riwayat-list";
import { RekamMedisList } from "./rekam-medis-list";
import { BulanFilter } from "./bulan-filter";

type Tx = {
  id: string;
  tipe: "POSITIF" | "NEGATIF";
  nilai_poin: number;
  tanggal_kejadian: string;
  catatan: string | null;
  master_poin: { kode_poin: string; nama_poin: string } | null;
};

function initials(nama: string): string {
  const parts = nama.trim().split(/\s+/).filter(Boolean);
  const s =
    parts.length >= 2 ? parts[0][0] + parts[1][0] : nama.trim().slice(0, 2);
  return (s || "?").toUpperCase();
}

function tanggalLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

/** Persentase perubahan dibanding bulan lalu + arah (naik/turun/tetap). */
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

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ santriId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { santriId } = await params;
  const sp = await searchParams;
  const bulanFilter = getStr(sp.bulan);
  const supabase = await createClient();

  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("id, tahun")
    .eq("is_aktif", true)
    .maybeSingle();

  // RLS membatasi: wali hanya bisa baca santri miliknya.
  const { data: santri } = await supabase
    .from("santri")
    .select("id, nis, nama")
    .eq("id", santriId)
    .maybeSingle();
  if (!santri) notFound();

  let kelasNama: string | null = null;
  if (ta?.id) {
    const { data: sk } = await supabase
      .from("santri_kelas")
      .select("kelas:kelas!inner(nama_kelas, tahun_ajaran_id)")
      .eq("santri_id", santriId)
      .eq("kelas.tahun_ajaran_id", ta.id)
      .maybeSingle();
    kelasNama =
      (sk as unknown as { kelas: { nama_kelas: string } | null } | null)?.kelas
        ?.nama_kelas ?? null;
  }

  let txQuery = supabase
    .from("transaksi_poin")
    .select(
      "id, tipe, nilai_poin, tanggal_kejadian, catatan, master_poin:master_poin(kode_poin, nama_poin)",
    )
    .eq("santri_id", santriId)
    .order("tanggal_kejadian", { ascending: false })
    .order("created_at", { ascending: false });
  if (ta?.id) txQuery = txQuery.eq("tahun_ajaran_id", ta.id);
  const { data: txData } = await txQuery;
  const tx = (txData ?? []) as unknown as Tx[];

  // Rekam medis UKS (RLS membatasi: wali hanya anaknya).
  const { data: rekamData } = await supabase
    .from("rekam_medis")
    .select("id, tanggal, keluhan, tindakan, obat, catatan")
    .eq("santri_id", santriId)
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false });
  const rekam = (rekamData ?? []) as {
    id: string;
    tanggal: string;
    keluhan: string;
    tindakan: string | null;
    obat: string | null;
    catatan: string | null;
  }[];

  const pos = tx
    .filter((t) => t.tipe === "POSITIF")
    .reduce((a, t) => a + t.nilai_poin, 0);
  const neg = tx
    .filter((t) => t.tipe === "NEGATIF")
    .reduce((a, t) => a + t.nilai_poin, 0);
  const net = pos - neg;
  const statusLevel = computeSantriStatusLevel(net, neg);
  const tone = santriStatusTone(statusLevel);
  const progress = computeSantriProgress(net, neg, statusLevel);

  // Riwayat Poin: difilter per bulan kalau ?bulan= diisi. KPI/chart/status
  // di atas TETAP dari `tx` penuh 1 tahun ajaran, tidak ikut filter ini.
  const txRiwayat = bulanFilter
    ? tx.filter((t) => t.tanggal_kejadian.startsWith(bulanFilter))
    : tx;

  // Perbandingan bulan ini vs bulan lalu — dihitung dari `tx` penuh
  // (bukan txRiwayat), supaya tidak ikut kefilter oleh BulanFilter.
  const monthlyBuckets = new Map<string, { pos: number; neg: number }>();
  for (const t of tx) {
    const key = t.tanggal_kejadian.slice(0, 7);
    const e = monthlyBuckets.get(key) ?? { pos: 0, neg: 0 };
    if (t.tipe === "POSITIF") e.pos += t.nilai_poin;
    else e.neg += t.nilai_poin;
    monthlyBuckets.set(key, e);
  }
  const fmtBulan = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" });
  const bulanIniKey = fmtBulan.format(new Date()).slice(0, 7);
  const [thnIni, blnIni] = bulanIniKey.split("-").map(Number);
  const bulanLaluDate = new Date(thnIni, blnIni - 2, 1);
  const bulanLaluKey = `${bulanLaluDate.getFullYear()}-${String(bulanLaluDate.getMonth() + 1).padStart(2, "0")}`;
  const bulanIni = monthlyBuckets.get(bulanIniKey) ?? { pos: 0, neg: 0 };
  const bulanLalu = monthlyBuckets.get(bulanLaluKey);

  // Perkembangan skor kumulatif per transaksi (urut lama → baru) — tiap
  // transaksi jadi 1 titik, jadi tidak perlu menunggu berganti minggu
  // kalender dulu baru grafiknya muncul.
  const perkembangan = [...tx].reverse().reduce<
    { tanggal: string; skor: number }[]
  >((acc, t) => {
    const sebelumnya = acc.length > 0 ? acc[acc.length - 1].skor : 0;
    const skor = sebelumnya + (t.tipe === "POSITIF" ? t.nilai_poin : -t.nilai_poin);
    acc.push({ tanggal: tanggalLabel(t.tanggal_kejadian), skor });
    return acc;
  }, []);

  return (
    <div className="animate-enter space-y-4 p-4 md:space-y-6 md:p-8">
      <Button asChild variant="ghost" size="sm">
        <Link href="/anak">
          <ArrowLeft data-icon="inline-start" />
          Kembali
        </Link>
      </Button>

      {/* Hero santri */}
      <section
        className="relative overflow-hidden rounded-3xl p-6 text-white shadow-lg shadow-primary/20 sm:p-7"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #00b4d8 0%, #0092b7 55%, #036985 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-white/10 blur-3xl"
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold ring-1 ring-white/25 backdrop-blur">
              {initials(santri.nama)}
            </span>
            <div className="space-y-0.5">
              <h1 className="font-heading text-xl font-bold capitalize tracking-tight sm:text-2xl">
                {santri.nama}
              </h1>
              <p className="text-sm text-white/80">
                {orDash(kelasNama)}
                {santri.nis ? ` · ${santri.nis}` : ""}
                {ta?.tahun ? ` · ${ta.tahun}` : ""}
              </p>
              <SantriStatusBadge level={statusLevel} onHero className="mt-1" />
              <SantriProgressBar progress={progress} onHero className="mt-2 max-w-xs" />
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/80">Skor total</p>
            <p className="font-heading text-4xl font-bold tabular-nums">
              {net > 0 ? "+" : ""}
              {net}
            </p>
          </div>
        </div>
      </section>

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-positive-soft text-positive">
              <ThumbsUp className="size-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Poin Positif</p>
              <p className="font-heading text-2xl font-bold tabular-nums text-positive">
                +{pos}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-negative-soft text-negative">
              <ThumbsDown className="size-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Poin Negatif</p>
              <p className="font-heading text-2xl font-bold tabular-nums text-negative">
                −{neg}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-xl",
                tone === "positive" && "bg-positive-soft text-positive",
                tone === "warning" && "bg-warning-soft text-warning",
                tone === "negative" && "bg-negative-soft text-negative",
              )}
            >
              <TrendingUp className="size-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Skor Total</p>
              <p
                className={cn(
                  "font-heading text-2xl font-bold tabular-nums",
                  tone === "positive" && "text-positive",
                  tone === "warning" && "text-warning",
                  tone === "negative" && "text-negative",
                )}
              >
                {net > 0 ? "+" : ""}
                {net}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Perbandingan bulan */}
      {bulanLalu && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              Bulan Ini vs Bulan Lalu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    label: "Poin Positif",
                    current: bulanIni.pos,
                    previous: bulanLalu.pos,
                    goodDirection: "up" as const,
                  },
                  {
                    label: "Poin Negatif",
                    current: bulanIni.neg,
                    previous: bulanLalu.neg,
                    goodDirection: "down" as const,
                  },
                ] as const
              ).map((m) => {
                const delta = formatDelta(m.current, m.previous);
                const isGood = delta.direction === m.goodDirection;
                const isBad = delta.direction !== "flat" && delta.direction !== m.goodDirection;
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
                      Bulan lalu: {m.previous}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              Perkembangan Skor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PerkembanganSkor data={perkembangan} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="size-4 text-primary" />
              Komposisi Poin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <KomposisiPoin pos={pos} neg={neg} />
          </CardContent>
        </Card>
      </div>

      {/* Riwayat */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              Riwayat Poin
            </span>
            <BulanFilter value={bulanFilter} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RiwayatList
            items={txRiwayat.map((t) => ({
              id: t.id,
              tipe: t.tipe,
              nilai_poin: t.nilai_poin,
              tanggal_kejadian: t.tanggal_kejadian,
              catatan: t.catatan,
              nama_poin: t.master_poin?.nama_poin ?? null,
            }))}
          />
        </CardContent>
      </Card>

      {/* Rekam Medis UKS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HeartPulse className="size-4 text-primary" />
            Rekam Medis UKS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RekamMedisList items={rekam} />
        </CardContent>
      </Card>
    </div>
  );
}
