import { Network } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requirePerm } from "@/lib/auth/dal";
import {
  parseListParams,
  totalPages,
  type SearchParams,
} from "@/lib/list-params";
import { orDash } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Pagination } from "@/components/shared/pagination";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { PenugasanDialog } from "./penugasan-dialog";

type PegawaiRow = { id: string; nama: string; jabatan: string | null };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePerm("master");
  const sp = await searchParams;
  const { page, perPage, q, from, to } = parseListParams(sp);

  const supabase = await createClient();

  const { data: ta } = await supabase
    .from("tahun_ajaran")
    .select("id, tahun")
    .eq("is_aktif", true)
    .maybeSingle();

  if (!ta?.id) {
    return (
      <div className="animate-enter space-y-6 p-6 md:p-8">
        <PageHeader
          icon={Network}
          title="Penugasan Musyrif"
          description="Tetapkan kelas yang boleh diinput poinnya oleh tiap guru/musyrif."
        />
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Belum ada tahun ajaran aktif. Aktifkan dulu di Master → Tahun Ajaran.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: kelasData } = await supabase
    .from("kelas")
    .select("id, nama_kelas, level:level_pendidikan(nama)")
    .eq("tahun_ajaran_id", ta.id)
    .order("nama_kelas");
  const kelasOptions = (
    (kelasData ?? []) as unknown as {
      id: string;
      nama_kelas: string;
      level: { nama: string } | null;
    }[]
  ).map((k) => ({
    id: k.id,
    label: k.level?.nama ? `${k.nama_kelas} · ${k.level.nama}` : k.nama_kelas,
  }));

  // Jumlah kelas yang ditugaskan per pegawai (TA aktif).
  const { data: gkData } = await supabase
    .from("guru_kelas")
    .select("pegawai_id, kelas:kelas!inner(tahun_ajaran_id)")
    .eq("kelas.tahun_ajaran_id", ta.id);
  const countMap = new Map<string, number>();
  for (const r of (gkData ?? []) as unknown as { pegawai_id: string }[]) {
    countMap.set(r.pegawai_id, (countMap.get(r.pegawai_id) ?? 0) + 1);
  }

  let query = supabase
    .from("pegawai")
    .select("id, nama, jabatan", { count: "exact" })
    .or(
      "jabatan.eq.Musyrif,jabatan.eq.Musyrifah,jabatan_tambahan.cs.{Musyrif},jabatan_tambahan.cs.{Musyrifah}",
    )
    .order("nama");
  if (q) {
    const term = q.replace(/[,()*]/g, " ").trim();
    if (term) query = query.or(`nama.ilike.*${term}*,jabatan.ilike.*${term}*`);
  }
  const { data, count } = await query.range(from, to);
  const rows = (data ?? []) as PegawaiRow[];

  const columns: Column<PegawaiRow>[] = [
    {
      key: "nama",
      header: "Pegawai",
      cell: (r) => <span className="font-medium">{r.nama}</span>,
    },
    {
      key: "jabatan",
      header: "Jabatan",
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {orDash(r.jabatan)}
        </span>
      ),
    },
    {
      key: "aksi",
      header: <span className="sr-only">Aksi</span>,
      headClassName: "text-right",
      className: "text-right",
      cell: (r) => (
        <div className="flex justify-end">
          <PenugasanDialog
            pegawaiId={r.id}
            pegawaiNama={r.nama}
            kelasOptions={kelasOptions}
            count={countMap.get(r.id) ?? 0}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="animate-enter space-y-6 p-6 md:p-8">
      <PageHeader
        icon={Network}
        title="Penugasan Musyrif"
        description={`Tetapkan kelas yang boleh diinput poinnya oleh tiap guru/musyrif. T.A. ${ta.tahun}.`}
      />
      <div className="flex flex-wrap items-center gap-2.5 rounded-card border border-border/70 bg-card p-3 shadow-sm">
        <SearchInput placeholder="Cari nama atau jabatan…" />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        isFiltered={!!q}
        empty="Belum ada penugasan guru."
        emptyHint="Tambah penugasan dengan tombol di atas."
      />
      <Pagination
        page={page}
        perPage={perPage}
        totalPages={totalPages(count, perPage)}
        totalItems={count ?? 0}
      />
    </div>
  );
}
