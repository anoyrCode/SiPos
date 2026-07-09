import { School, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requirePerm } from "@/lib/auth/dal";
import {
  getStr,
  parseListParams,
  totalPages,
  type SearchParams,
} from "@/lib/list-params";
import { orDash } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { Pagination } from "@/components/shared/pagination";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KelasForm } from "./kelas-form";
import { deleteKelas } from "./actions";
import type { KelasRow, Option } from "./schema";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePerm("master");
  const sp = await searchParams;
  const { page, perPage, q, from, to } = parseListParams(sp);
  const taFilter = getStr(sp.ta);

  const supabase = await createClient();

  const [levelsRes, tahunRes, pegawaiRes] = await Promise.all([
    supabase.from("level_pendidikan").select("id, nama").order("urutan"),
    supabase.from("tahun_ajaran").select("id, tahun").order("tahun", {
      ascending: false,
    }),
    supabase.from("pegawai").select("id, nama").order("nama"),
  ]);

  const levels: Option[] = (levelsRes.data ?? []).map((l) => ({
    value: l.id,
    label: l.nama,
  }));
  const tahunAjaran: Option[] = (tahunRes.data ?? []).map((t) => ({
    value: t.id,
    label: t.tahun,
  }));
  const pegawai: Option[] = (pegawaiRes.data ?? []).map((p) => ({
    value: p.id,
    label: p.nama,
  }));

  let query = supabase
    .from("kelas")
    .select(
      "id, nama_kelas, level_pendidikan_id, tahun_ajaran_id, wali_id, level:level_pendidikan(nama), tahun:tahun_ajaran(tahun), wali:pegawai(nama)",
      { count: "exact" },
    )
    .order("nama_kelas", { ascending: true });
  if (q) query = query.ilike("nama_kelas", `%${q}%`);
  if (taFilter) query = query.eq("tahun_ajaran_id", taFilter);
  const { data, count } = await query.range(from, to);
  const rows = (data ?? []) as unknown as KelasRow[];

  const columns: Column<KelasRow>[] = [
    {
      key: "nama_kelas",
      header: "Kelas",
      cell: (r) => <span className="font-medium">{r.nama_kelas}</span>,
    },
    {
      key: "level",
      header: "Level",
      cell: (r) =>
        r.level?.nama ? (
          <Badge variant="outline">{r.level.nama}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "tahun",
      header: "Tahun Ajaran",
      cell: (r) => orDash(r.tahun?.tahun),
    },
    {
      key: "wali",
      header: "Wali Kelas",
      cell: (r) => orDash(r.wali?.nama),
    },
    {
      key: "aksi",
      header: <span className="sr-only">Aksi</span>,
      headClassName: "text-right",
      className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <KelasForm
            initial={r}
            levels={levels}
            tahunAjaran={tahunAjaran}
            pegawai={pegawai}
          />
          <ConfirmDialog
            action={deleteKelas}
            id={r.id}
            title="Hapus kelas?"
            description={`"${r.nama_kelas}" akan dihapus permanen.`}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label="Hapus">
                <Trash2 />
              </Button>
            }
          />
        </div>
      ),
    },
  ];

  return (
    <div className="animate-enter space-y-6 p-6 md:p-8">
      <PageHeader
        icon={School}
        title="Data Kelas"
        description="Kelola kelas per tahun ajaran."
      />
      <div className="flex flex-wrap items-center gap-2.5 rounded-card border border-border/70 bg-card p-3 shadow-sm">
        <SearchInput placeholder="Cari nama kelas…" />
        <FilterSelect
          param="ta"
          placeholder="Tahun ajaran"
          allLabel="Semua tahun ajaran"
          options={tahunAjaran}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <KelasForm levels={levels} tahunAjaran={tahunAjaran} pegawai={pegawai} />
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        isFiltered={!!q || !!taFilter}
        empty="Belum ada data kelas."
        emptyHint="Tambah kelas dengan tombol di atas."
      />
      <Pagination
        page={page}
        totalPages={totalPages(count, perPage)}
        totalItems={count ?? 0}
      />
    </div>
  );
}
