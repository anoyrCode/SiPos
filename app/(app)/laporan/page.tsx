import Link from "next/link";
import { FileBarChart2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/dal";
import { getStr, type SearchParams } from "@/lib/list-params";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaFilter } from "./ta-filter";
import { RekapSantriTable, type RekapSantriRow } from "./rekap-santri-table";
import { RekapKelasTable } from "./rekap-kelas-table";

type KelasRekap = {
  key: string;
  nama: string;
  count: number;
  pos: number;
  neg: number;
  net: number;
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const mode = getStr(sp.mode) === "santri" ? "santri" : "kelas";

  const profile = await getProfile();
  if (!profile?.perms.laporan) {
    return (
      <div className="animate-enter space-y-6 p-6 md:p-8">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Anda tidak memiliki hak akses untuk melihat laporan.
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();

  // Peran ter-scope (mis. musyrif/musyrifah): batasi rekap ke santri di
  // kelas yang ditugaskan ke pegawai ini (lintas tahun ajaran — kelas_id
  // sudah unik per tahun ajaran, jadi otomatis cuma cocok di tahun yang
  // relevan tanpa perlu filter TA terpisah di sini).
  let scopedKelasIds: string[] | null = null;
  if (profile.perms.scope_kelas && !profile.perms.super && profile.pegawai_id) {
    const { data: gk } = await supabase
      .from("guru_kelas")
      .select("kelas_id")
      .eq("pegawai_id", profile.pegawai_id);
    scopedKelasIds = [...new Set((gk ?? []).map((r) => r.kelas_id))];
  }

  const { data: taData } = await supabase
    .from("tahun_ajaran")
    .select("id, tahun, is_aktif")
    .order("tahun", { ascending: false });
  const taList = taData ?? [];
  const activeTa = taList.find((t) => t.is_aktif);
  const taId = getStr(sp.ta) || activeTa?.id || taList[0]?.id || "";
  const selectedTa = taList.find((t) => t.id === taId);
  const taLabel = selectedTa?.tahun ?? "export";
  const taOptions = taList.map((t) => ({
    value: t.id,
    label: t.is_aktif ? `${t.tahun} (aktif)` : t.tahun,
  }));

  let kelasRekap: KelasRekap[] = [];
  let santriRekap: RekapSantriRow[] = [];

  if (taId) {
    let placeQuery = supabase
      .from("santri_kelas")
      .select("santri_id, kelas:kelas!inner(id, nama_kelas, tahun_ajaran_id)")
      .eq("kelas.tahun_ajaran_id", taId);
    if (scopedKelasIds) {
      placeQuery = placeQuery.in(
        "kelas_id",
        scopedKelasIds.length > 0
          ? scopedKelasIds
          : ["00000000-0000-0000-0000-000000000000"],
      );
    }
    const { data: placeData } = await placeQuery;
    const placements = (placeData ?? []) as unknown as {
      santri_id: string;
      kelas: { id: string; nama_kelas: string } | null;
    }[];

    // Kalau ter-scope, transaksi juga dibatasi ke santri hasil placeQuery di
    // atas — supaya santri di luar kelas yang ditugaskan tidak "bocor" lewat
    // bucket "Tanpa Kelas" (yang aslinya utk santri tanpa kelas sama sekali).
    let txQuery = supabase
      .from("transaksi_poin")
      .select("santri_id, tipe, nilai_poin")
      .eq("tahun_ajaran_id", taId);
    if (scopedKelasIds) {
      const scopedSantriIds = [...new Set(placements.map((p) => p.santri_id))];
      txQuery = txQuery.in(
        "santri_id",
        scopedSantriIds.length > 0
          ? scopedSantriIds
          : ["00000000-0000-0000-0000-000000000000"],
      );
    }
    const { data: txData } = await txQuery;
    const tx = (txData ?? []) as {
      santri_id: string;
      tipe: "POSITIF" | "NEGATIF";
      nilai_poin: number;
    }[];

    const santriToKelas = new Map<string, { id: string; nama: string }>();
    const kelasAgg = new Map<
      string,
      { nama: string; count: number; pos: number; neg: number }
    >();
    for (const p of placements) {
      if (!p.kelas) continue;
      santriToKelas.set(p.santri_id, { id: p.kelas.id, nama: p.kelas.nama_kelas });
      const e =
        kelasAgg.get(p.kelas.id) ?? {
          nama: p.kelas.nama_kelas,
          count: 0,
          pos: 0,
          neg: 0,
        };
      e.count++;
      kelasAgg.set(p.kelas.id, e);
    }

    const noneSantri = new Set<string>();
    let nonePos = 0;
    let noneNeg = 0;
    const santriAgg = new Map<string, { pos: number; neg: number }>();

    for (const t of tx) {
      const e = santriAgg.get(t.santri_id) ?? { pos: 0, neg: 0 };
      if (t.tipe === "POSITIF") e.pos += t.nilai_poin;
      else e.neg += t.nilai_poin;
      santriAgg.set(t.santri_id, e);

      const k = santriToKelas.get(t.santri_id);
      if (k) {
        const ke = kelasAgg.get(k.id)!;
        if (t.tipe === "POSITIF") ke.pos += t.nilai_poin;
        else ke.neg += t.nilai_poin;
      } else {
        noneSantri.add(t.santri_id);
        if (t.tipe === "POSITIF") nonePos += t.nilai_poin;
        else noneNeg += t.nilai_poin;
      }
    }

    kelasRekap = [...kelasAgg.entries()]
      .map(([key, v]) => ({
        key,
        nama: v.nama,
        count: v.count,
        pos: v.pos,
        neg: v.neg,
        net: v.pos - v.neg,
      }))
      .sort((a, b) => a.nama.localeCompare(b.nama));
    if (noneSantri.size > 0) {
      kelasRekap.push({
        key: "none",
        nama: "Tanpa Kelas",
        count: noneSantri.size,
        pos: nonePos,
        neg: noneNeg,
        net: nonePos - noneNeg,
      });
    }

    // Per santri (yang punya transaksi)
    const ids = [...santriAgg.keys()];
    if (ids.length > 0) {
      const { data: names } = await supabase
        .from("santri")
        .select("id, nama")
        .in("id", ids);
      const nameMap = new Map((names ?? []).map((s) => [s.id, s.nama]));
      santriRekap = ids
        .map((id) => {
          const v = santriAgg.get(id)!;
          return {
            id,
            nama: nameMap.get(id) ?? "?",
            kelas: santriToKelas.get(id)?.nama ?? null,
            pos: v.pos,
            neg: v.neg,
            net: v.pos - v.neg,
          };
        })
        .sort((a, b) => a.nama.localeCompare(b.nama));
    }
  }

  return (
    <div className="animate-enter space-y-6 p-6 md:p-8">
      <PageHeader
        icon={FileBarChart2}
        title="Laporan / Rekap"
        description="Rekap poin per kelas atau per santri dalam satu tahun ajaran."
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border/70 bg-card p-3 shadow-sm">
        <TaFilter options={taOptions} value={taId} />
        <div className="flex w-full gap-1 rounded-lg bg-muted p-1 sm:w-auto">
          <Button
            asChild
            size="sm"
            variant={mode === "kelas" ? "default" : "ghost"}
            className="flex-1 sm:flex-none"
          >
            <Link href={`/laporan?ta=${taId}&mode=kelas`}>Per Kelas</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant={mode === "santri" ? "default" : "ghost"}
            className="flex-1 sm:flex-none"
          >
            <Link href={`/laporan?ta=${taId}&mode=santri`}>Per Santri</Link>
          </Button>
        </div>
      </div>

      {!taId ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Belum ada tahun ajaran.
          </CardContent>
        </Card>
      ) : mode === "kelas" ? (
        <RekapKelasTable rows={kelasRekap} taLabel={taLabel} />
      ) : (
        <RekapSantriTable rows={santriRekap} taLabel={taLabel} />
      )}
    </div>
  );
}
