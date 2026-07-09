import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/dal";
import { homePathForProfile } from "@/lib/auth/roles";
import { formatDateID, orDash } from "@/lib/format";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PerkembanganChart } from "@/app/(admin)/dashboard/charts";

type Tx = {
  id: string;
  tipe: "POSITIF" | "NEGATIF";
  nilai_poin: number;
  tanggal_kejadian: string;
  catatan: string | null;
  master_poin: { kode_poin: string; nama_poin: string } | null;
};

const STATUS: Record<
  string,
  { label: string; variant: "primary" | "outline" | "warning" }
> = {
  aktif: { label: "Aktif", variant: "primary" },
  lulus: { label: "Lulus", variant: "outline" },
  keluar: { label: "Keluar", variant: "warning" },
};

function monthLabel(key: string): string {
  const d = new Date(`${key}-01T00:00:00`);
  return new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "2-digit",
  }).format(d);
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

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireAuth();
  if (!(profile.perms.master || profile.perms.laporan)) {
    redirect(homePathForProfile(profile));
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("id, tahun, tanggal_mulai, tanggal_selesai")
    .eq("is_aktif", true)
    .maybeSingle();

  const { data: santri } = await supabase
    .from("santri")
    .select(
      "id, nis, nisn, nama, email, jenis_kelamin, nama_ayah, nama_ibu, nama_wali, no_telp_wali, status",
    )
    .eq("id", id)
    .maybeSingle();
  if (!santri) notFound();

  let kelasNama: string | null = null;
  if (ta?.id) {
    const { data: sk } = await supabase
      .from("santri_kelas")
      .select("kelas:kelas!inner(nama_kelas, tahun_ajaran_id)")
      .eq("santri_id", id)
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
    .eq("santri_id", id)
    .order("tanggal_kejadian", { ascending: false })
    .order("created_at", { ascending: false });
  if (ta?.id) txQuery = txQuery.eq("tahun_ajaran_id", ta.id);
  const { data: txData } = await txQuery;
  const tx = (txData ?? []) as unknown as Tx[];

  const pos = tx.filter((t) => t.tipe === "POSITIF").reduce((a, t) => a + t.nilai_poin, 0);
  const neg = tx.filter((t) => t.tipe === "NEGATIF").reduce((a, t) => a + t.nilai_poin, 0);
  const net = pos - neg;

  // Tren bulanan
  const buckets = new Map<string, { pos: number; neg: number }>();
  for (const t of tx) {
    const k = t.tanggal_kejadian.slice(0, 7);
    const e = buckets.get(k) ?? { pos: 0, neg: 0 };
    if (t.tipe === "POSITIF") e.pos += t.nilai_poin;
    else e.neg += t.nilai_poin;
    buckets.set(k, e);
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

  const status = STATUS[santri.status] ?? STATUS.aktif;
  const profil: { label: string; value: string }[] = [
    { label: "NIS", value: orDash(santri.nis) },
    { label: "NISN", value: orDash(santri.nisn) },
    {
      label: "Jenis Kelamin",
      value: santri.jenis_kelamin
        ? santri.jenis_kelamin === "L"
          ? "Laki-laki"
          : "Perempuan"
        : "—",
    },
    { label: "Email", value: orDash(santri.email) },
    { label: "Nama Ayah", value: orDash(santri.nama_ayah) },
    { label: "Nama Ibu", value: orDash(santri.nama_ibu) },
    { label: "Nama Wali", value: orDash(santri.nama_wali) },
    { label: "No Telp Wali", value: orDash(santri.no_telp_wali) },
  ];

  return (
    <div className="animate-enter space-y-6 p-6 md:p-8">
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/riwayat-poin">
            <ArrowLeft data-icon="inline-start" />
            Kembali
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-xl font-bold tracking-tight">
            {santri.nama}
          </h1>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {orDash(kelasNama)}
          {ta?.tahun ? ` · ${ta.tahun}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="space-y-1">
            <p className="text-xs text-muted-foreground">Poin Positif</p>
            <p className="font-heading text-2xl font-bold tabular-nums text-positive">
              +{pos}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <p className="text-xs text-muted-foreground">Poin Negatif</p>
            <p className="font-heading text-2xl font-bold tabular-nums text-negative">
              −{neg}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <p className="text-xs text-muted-foreground">Skor Total</p>
            <p
              className={`font-heading text-2xl font-bold tabular-nums ${
                net >= 0 ? "text-positive" : "text-negative"
              }`}
            >
              {net > 0 ? "+" : ""}
              {net}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Profil</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5 text-sm">
              {profil.map((p) => (
                <div key={p.label} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{p.label}</dt>
                  <dd className="text-right font-medium">{p.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tren Bulanan</CardTitle>
          </CardHeader>
          <CardContent>
            <PerkembanganChart data={trend} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Riwayat Poin</h2>
        {tx.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Belum ada catatan poin.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {tx.map((t) => (
              <Card key={t.id}>
                <CardContent className="flex items-center justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {t.master_poin?.nama_poin ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateID(t.tanggal_kejadian)}
                      {t.catatan ? ` · ${t.catatan}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant={t.tipe === "POSITIF" ? "positive" : "negative"}
                    className="shrink-0 font-mono"
                  >
                    {t.tipe === "POSITIF" ? "+" : "−"}
                    {t.nilai_poin}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
